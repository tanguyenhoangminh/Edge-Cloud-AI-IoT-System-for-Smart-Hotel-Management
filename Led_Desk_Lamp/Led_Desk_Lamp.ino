#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

/*====================== WIFI ======================*/
const char* WIFI_SSID     = "MinhDuc";
const char* WIFI_PASSWORD = "18022004";

/*====================== LOCAL MOSQUITTO ON RASPBERRY PI ======================*/
// Thay bằng địa chỉ IP mạng LAN thực tế của Raspberry Pi 4 (ví dụ: 192.168.1.167 hoặc 192.168.137.98)
const char* MQTT_HOST = "192.168.1.10"; 
const uint16_t MQTT_PORT = 1883;

/*====================== TOPIC ======================*/
#define ROOM_ID "0101"
const char* TOPIC_CTRL    = "hotel/room/" ROOM_ID "/control";
const char* TOPIC_SENSORS = "hotel/room/" ROOM_ID "/sensors";

/*====================== PIN MAPPING ======================*/
#define MOSFET1_PIN   14  // GPIO14 - PWM Dimming cho Main Light
#define SENSE1_PIN    13  // GPIO13 - 4N35 Feedback dòng Main Light
#define MOSFET2_PIN   12  // GPIO12 - ON/OFF Digital cho Desk Lamp
#define SENSE2_PIN     4  // GPIO4  - 4N35 Feedback dòng Desk Lamp

#define PWM_MAX 1023
#define PWM_MIN 0

/*====================== STATE ======================*/
bool mainLightOn    = false;
bool deskLampOn     = false;
int  mainBrightness = 100; // 0 - 100% PWM dimming

int lastSense1 = -1;
int lastSense2 = -1;
unsigned long lastSenseCheck = 0;
unsigned long lastPublishMs  = 0;
const unsigned long PUBLISH_INTERVAL_MS = 5000;

WiFiClient espClient;
PubSubClient mqtt(espClient);

/*====================== HELPERS ======================*/
int percentToPWM(int percent) {
  return map(percent, 0, 100, PWM_MIN, PWM_MAX);
}

void applyMainLight() {
  if (!mainLightOn) {
    analogWrite(MOSFET1_PIN, 0);
  } else {
    analogWrite(MOSFET1_PIN, percentToPWM(mainBrightness));
  }
  Serial.printf("[MAIN LIGHT] State: %s | PWM: %d (%d%%)\n",
                mainLightOn ? "ON" : "OFF", mainLightOn ? percentToPWM(mainBrightness) : 0, mainBrightness);
}

void applyDeskLamp() {
  // Desk Lamp chỉ chạy ON/OFF số, không băm xung PWM
  digitalWrite(MOSFET2_PIN, deskLampOn ? HIGH : LOW);
  Serial.printf("[DESK LAMP] State: %s (Pure ON/OFF)\n", deskLampOn ? "ON" : "OFF");
}

void publishState() {
  StaticJsonDocument<256> doc;
  doc["main_light"]        = mainLightOn ? 1 : 0;
  doc["desk_lamp"]         = deskLampOn  ? 1 : 0;
  doc["main_brightness"]   = mainBrightness; // Gửi kèm giá trị Dimmer về server

  // Trạng thái thực tế từ cảm biến dòng quang cách ly 4N35 (LOW = đang có dòng qua đèn)
  doc["main_light_actual"] = (digitalRead(SENSE1_PIN) == LOW) ? 1 : 0;
  doc["desk_lamp_actual"]  = (digitalRead(SENSE2_PIN) == LOW) ? 1 : 0;

  char out[256];
  size_t n = serializeJson(doc, out);
  mqtt.publish(TOPIC_SENSORS, (const uint8_t*)out, n, false);
  Serial.printf("[PUB -> sensors] %s\n", out);
}

/*====================== MQTT CALLBACK ======================*/
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, TOPIC_CTRL) != 0) return;

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.println("[CMD] Parse JSON lỗi!");
    return;
  }

  const char* device = doc["device"] | "";
  bool state         = doc["state"]  | false;
  int brightness     = doc["brightness"] | -1;

  Serial.printf("[RECV <- control] Dev: %s | State: %d | Bri: %d\n", device, state, brightness);

  // 1. Điều khiển Main Light (Bật/Tắt kèm độ sáng Dimmer)
  if (strcmp(device, "main_light") == 0) {
    mainLightOn = state;
    if (brightness >= 0 && brightness <= 100) {
      mainBrightness = brightness;
    }
    applyMainLight();
  }
  // 2. Lệnh chuyên dụng chỉnh độ sáng Main Light Dimmer
  else if (strcmp(device, "main_light_brightness") == 0) {
    if (brightness >= 0 && brightness <= 100) {
      mainBrightness = brightness;
      if (mainLightOn) applyMainLight();
    }
  }
  // 3. Điều khiển Desk Lamp (Thuần Bật/Tắt)
  else if (strcmp(device, "desk_lamp") == 0) {
    deskLampOn = state;
    applyDeskLamp();
  }

  publishState();
}

/*====================== WIFI & MQTT ======================*/
void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
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
    Serial.print("\n[WiFi] Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Kết nối thất bại!");
  }
}

void connectMQTT() {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);

  while (!mqtt.connected()) {
    Serial.printf("[MQTT] Đang kết nối Mosquitto Pi (%s:%d)...", MQTT_HOST, MQTT_PORT);
    String clientId = "ESP_LightNode_" + String(ROOM_ID) + "_" + String(micros() & 0xFFFF, HEX);

    // Kết nối không mật khẩu (allow_anonymous true trên Pi)
    if (mqtt.connect(clientId.c_str())) {
      Serial.println(" Thành công!");
      mqtt.subscribe(TOPIC_CTRL, 1);
      Serial.printf("[MQTT] Subscribed topic: %s\n", TOPIC_CTRL);
      publishState();
    } else {
      Serial.printf(" Thất bại rc=%d. Thử lại sau 3s...\n", mqtt.state());
      delay(3000);
    }
  }
}

/*====================== SETUP ======================*/
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n--- [START] Node 2: Main Light Dimmer & Desk Lamp (Mosquitto Local) ---");

  // Output cho MOSFET
  pinMode(MOSFET1_PIN, OUTPUT);
  pinMode(MOSFET2_PIN, OUTPUT);
  analogWrite(MOSFET1_PIN, 0);
  digitalWrite(MOSFET2_PIN, LOW);

  // Input có pull-up cho cảm biến dòng 4N35
  pinMode(SENSE1_PIN, INPUT_PULLUP);
  pinMode(SENSE2_PIN, INPUT_PULLUP);

  // Chỉ thiết lập PWM cho Main Light
  analogWriteFreq(1000);
  analogWriteRange(PWM_MAX);

  connectWiFi();
  connectMQTT();
}

/*====================== LOOP ======================*/
void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  unsigned long now = millis();

  // Đọc phản hồi thực tế từ mạch 4N35 mỗi 200ms
  if (now - lastSenseCheck >= 200) {
    lastSenseCheck = now;
    
    int s1 = digitalRead(SENSE1_PIN);
    int s2 = digitalRead(SENSE2_PIN);

    // Phát hiện công tắc cơ trên tường bị gạt
    if (s1 != lastSense1 || s2 != lastSense2) {
      lastSense1 = s1;
      lastSense2 = s2;
      
      mainLightOn = (s1 == LOW);
      deskLampOn  = (s2 == LOW);
      
      Serial.printf("[FEEDBACK 4N35] Main: %s | Desk: %s\n",
                    mainLightOn ? "ON" : "OFF", deskLampOn ? "ON" : "OFF");
      publishState();
    }
  }

  // Bắn trạng thái định kỳ 5s
  if (now - lastPublishMs >= PUBLISH_INTERVAL_MS) {
    lastPublishMs = now;
    publishState();
  }
}