#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

/*====================== CẤU HÌNH WIFI ======================*/
const char* WIFI_SSID     = "MinhDuc";
const char* WIFI_PASSWORD = "18022004";

/*====================== LOCAL MOSQUITTO (RASPBERRY PI) ======================*/
const char* MQTT_HOST = "192.168.1.10"; 
const uint16_t MQTT_PORT = 1883;

/*====================== TOPIC ======================*/
#define ROOM_ID "0101"
const char* TOPIC_SENSORS = "hotel/room/" ROOM_ID "/sensors";

/*====================== PIN MAPPING THEO SCHEMATIC ======================*/
#define DHT_PIN   14    // GPIO14: DHT11 Data (P6)
#define DHTTYPE   DHT11

// Cầu phân áp R6 = 100k, R7 = 22k -> V_max đo được tại cọc A0 = 1.0V * (122 / 22) = 5.545V
const float V_MAX_ADC = 5.545; 
#define RL_VALUE      10.0  // Trở tải RL trên module MQ-135 (10k)

DHT dht(DHT_PIN, DHTTYPE);
WiFiClient espClient;
PubSubClient mqtt(espClient);

unsigned long lastSensorMs = 0;
const unsigned long SENSOR_INTERVAL_MS = 3000;
unsigned long lastReconnect = 0;

// Biến lưu ngưỡng nền không khí sạch tự động đo được lúc bật nguồn
float rs_air_baseline = 0.0;

/*====================== ĐỌC VÀ CHUYỂN ĐỔI ADC MQ-135 ======================*/
float readCO2_ADC() {
  // 1. Đọc trung bình 15 mẫu để lọc phẳng nhiễu ADC trên ESP8266
  long rawSum = 0;
  for (int i = 0; i < 15; i++) {
    rawSum += analogRead(A0);
    delay(5);
  }
  float raw = (float)rawSum / 15.0;
  if (raw < 1.0) raw = 1.0;

  // 2. Tính điện áp thực tế tại cọc A0 (P7) nối vào module MQ-135
  float volt = raw * (V_MAX_ADC / 1023.0);
  if (volt >= 4.85) volt = 4.85;
  if (volt <= 0.05) volt = 0.05;

  // 3. Tính điện trở Rs của cảm biến (module chạy nguồn 5V)
  float rs = RL_VALUE * (5.0 - volt) / volt;

  // 4. Tự động lấy mẫu Rs ban đầu làm Baseline (chuẩn 400 ppm cho phòng hiện tại)
  if (rs_air_baseline <= 0.0) {
    rs_air_baseline = rs;
    Serial.printf("\n>>> [MQ135] Da xac lap Base Air Rs = %.2fk <<<\n\n", rs_air_baseline);
  }

  // 5. Tính tỉ số suy giảm Rs
  float ratio = rs / rs_air_baseline;

  // 6. Đường cong đáp ứng:
  // - Lúc bình thường: ratio ~ 1.0 -> ppm ~ 400
  // - Khi thổi hơi thở vào: Rs giảm -> ratio < 1.0 -> ppm tăng vọt lên 800 - 1500
  float ppm = 400.0 * pow(ratio, -1.35);

  Serial.printf("[MQ135-ADC] Raw: %.0f | Volt: %.2fV | Rs: %.2fk | ppm: %.1f\n", raw, volt, rs, ppm);

  // Kẹp dải hiển thị logic trong nhà (không kẹp cứng ở 400 để số có thể dao động nhẹ tự nhiên)
  if (ppm < 380.0)  ppm = 380.0;
  if (ppm > 5000.0) ppm = 5000.0;

  return ppm;
}

/*====================== KẾT NỐI WIFI & MQTT ======================*/
void connectWiFi() {
  Serial.print("[WiFi] Dang ket noi ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint8_t tries = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
    if (++tries > 50) break;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\n[WiFi] Da ket noi! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Ket noi that bai!");
  }
}

void reconnectMQTT() {
  if (mqtt.connected()) return;
  if (millis() - lastReconnect < 3000) return;
  lastReconnect = millis();

  Serial.printf("[MQTT] Ket noi Mosquitto Pi (%s:%d)...", MQTT_HOST, MQTT_PORT);
  String clientId = "ESP_SensorNode_" + String(ROOM_ID) + "_" + String(micros() & 0xFFFF, HEX);

  if (mqtt.connect(clientId.c_str())) {
    Serial.println(" Thanh cong!");
  } else {
    Serial.printf(" That bai rc=%d\n", mqtt.state());
  }
}

/*====================== SETUP ======================*/
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n--- [START] Node 1: Sensor (DHT11 + MQ-135 ADC Analog) ---");

  dht.begin();
  connectWiFi();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(256);
}

/*====================== LOOP ======================*/
void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    reconnectMQTT();
    mqtt.loop();
  } else {
    connectWiFi();
  }

  unsigned long now = millis();

  // Đọc cảm biến định kỳ mỗi 3 giây
  if (now - lastSensorMs >= SENSOR_INTERVAL_MS) {
    lastSensorMs = now;

    // 1. Đọc DHT11
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (isnan(t)) t = 25.0;
    if (isnan(h)) h = 60.0;

    // 2. Đọc ADC MQ-135
    float co2 = readCO2_ADC();

    // 3. Đóng gói JSON gửi về Mosquitto trên Pi
    StaticJsonDocument<128> doc;
    doc["temp"]     = round(t * 10.0) / 10.0;
    doc["humidity"] = round(h * 10.0) / 10.0;
    doc["co2"]      = round(co2);

    char out[128];
    size_t n = serializeJson(doc, out);

    if (mqtt.connected()) {
      mqtt.publish(TOPIC_SENSORS, (const uint8_t*)out, n, false);
      Serial.printf("[MQTT PUB -> sensors] %s\n", out);
    }
  }

  yield();
}