#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

extern "C" {
  #include "user_interface.h"
}

/*====================== CẤU HÌNH WIFI ======================*/
const char* WIFI_SSID     = "MinhDuc";
const char* WIFI_PASSWORD = "18022004";

/*====================== LOCAL MOSQUITTO (RASPBERRY PI) ======================*/
const char* MQTT_HOST = "192.168.1.10"; 
const uint16_t MQTT_PORT = 1883;

/*====================== TOPIC HỆ THỐNG ======================*/
#define ROOM_ID "0101"
const char* TOPIC_CTRL    = "hotel/room/" ROOM_ID "/control";
const char* TOPIC_SENSORS = "hotel/room/" ROOM_ID "/sensors";

/*====================== PIN MAPPING THEO SCHEMATIC ======================*/
#define ZC_PIN     14  // GPIO14: Nhận xung qua không từ H11AA1
#define TRIAC_PIN  12  // GPIO12: Xuất xung mở TRIAC qua MOC3023

/*====================== BIẾN TRẠNG THÁI ======================*/
// Chỉ ON (100% full power) hoặc OFF (0%)
bool fanState = false;

// Độ trễ cố định cho mức 100% công suất: ~600us sau điểm qua không
const int FULL_POWER_DELAY_US = 600; 

unsigned long lastReconnect = 0;
unsigned long lastPublishMs = 0;
const unsigned long PUBLISH_INTERVAL_MS = 5000;

WiFiClient espClient;
PubSubClient mqtt(espClient);

/*====================== NGẮT PHẦN CỨNG (ISR) ======================*/
// Ngắt Timer: Tạo xung ngắn 30us mở cổng Gate của BT136
void ICACHE_RAM_ATTR dimTimerISR() {
  if (fanState) {
    digitalWrite(TRIAC_PIN, HIGH);
    delayMicroseconds(30);
    digitalWrite(TRIAC_PIN, LOW);
  }
}

// Ngắt Zero-Cross: Khi phát hiện AC qua 0V, hẹn giờ Timer đếm trễ để kích xung
void ICACHE_RAM_ATTR zeroCrossISR() {
  if (!fanState) return;
  // Cấu hình TIM_DIV16: 1 microsecond ≈ 5 ticks
  timer1_write(FULL_POWER_DELAY_US * 5);
}

/*====================== GỬI TRẠNG THÁI LÊN MOSQUITTO ======================*/
void publishState() {
  StaticJsonDocument<128> doc;
  doc["fan"] = fanState ? 1 : 0;

  char out[128];
  size_t n = serializeJson(doc, out);
  mqtt.publish(TOPIC_SENSORS, (const uint8_t*)out, n, false);
  Serial.printf("[PUB -> sensors] %s\n", out);
}

/*====================== XỬ LÝ LỆNH TỪ DASHBOARD / APP ======================*/
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, TOPIC_CTRL) != 0) return;

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.println("[MQTT] Lỗi parse JSON!");
    return;
  }

  const char* device = doc["device"] | "";
  bool state         = doc["state"]  | false;

  Serial.printf("[RECV <- control] Device: %s | State: %s\n", device, state ? "ON" : "OFF");

  // Xử lý lệnh bật / tắt quạt
  if (strcmp(device, "fan") == 0) {
    fanState = state;
    if (!fanState) {
      digitalWrite(TRIAC_PIN, LOW); // Đảm bảo ngắt hẳn gate khi tắt
    }
    publishState();
  }
}

/*====================== WIFI & MQTT CONNECTION ======================*/
void connectWiFi() {
  Serial.print("[WiFi] Đang kết nối ");
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
    Serial.print("\n[WiFi] Đã kết nối! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Kết nối thất bại!");
  }
}

void reconnectMQTT() {
  if (mqtt.connected()) return;
  if (millis() - lastReconnect < 3000) return;
  lastReconnect = millis();

  Serial.printf("[MQTT] Đang kết nối Mosquitto Pi (%s:%d)...", MQTT_HOST, MQTT_PORT);
  String clientId = "ESP_FanNode_" + String(ROOM_ID) + "_" + String(micros() & 0xFFFF, HEX);

  if (mqtt.connect(clientId.c_str())) {
    Serial.println(" Thành công!");
    mqtt.subscribe(TOPIC_CTRL, 1);
    Serial.printf("[MQTT] Subscribed topic: %s\n", TOPIC_CTRL);
    publishState();
  } else {
    Serial.printf(" Thất bại rc=%d\n", mqtt.state());
  }
}

/*====================== SETUP ======================*/
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n--- [INIT] Node: TRIAC Fan Pure ON/OFF (Full Power / Cutoff) ---");

  pinMode(TRIAC_PIN, OUTPUT);
  pinMode(ZC_PIN, INPUT);
  digitalWrite(TRIAC_PIN, LOW);
  fanState = false;

  // Cấu hình Hardware Timer 1
  timer1_isr_init();
  timer1_attachInterrupt(dimTimerISR);
  timer1_enable(TIM_DIV16, TIM_EDGE, TIM_SINGLE);

  // Bắt ngắt sườn lên khi tín hiệu AC qua điểm 0V
  attachInterrupt(digitalPinToInterrupt(ZC_PIN), zeroCrossISR, RISING);

  connectWiFi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);
}

/*====================== LOOP ======================*/
void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    reconnectMQTT();
    mqtt.loop();
  } else {
    connectWiFi();
  }

  // Khóa cứng mức LOW khi quạt đang tắt
  if (!fanState) {
    digitalWrite(TRIAC_PIN, LOW);
  }

  // Gửi heartbeat định kỳ 5s
  unsigned long now = millis();
  if (now - lastPublishMs >= PUBLISH_INTERVAL_MS) {
    lastPublishMs = now;
    if (mqtt.connected()) {
      publishState();
    }
  }

  yield();
}