#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

/*====================== WIFI & MQTT (Local Mosquitto 8883) ======================*/
const char* WIFI_SSID     = "MinhDuc";
const char* WIFI_PASSWORD = "18022004";

const char* MQTT_HOST     = "192.168.1.7"; 
const uint16_t MQTT_PORT  = 8883;   

const char* MQTT_USER = "";   
const char* MQTT_PASS = ""; 

/*====================== THỐNG NHẤT TOPIC VỚI API SERVER ======================*/
#define ROOM_2 "0102"

  
const char* TOPIC_SENSORS_2 = "hotel/room/" ROOM_2 "/sensors";  

 
const char* TOPIC_CTRL_2    = "hotel/room/" ROOM_2 "/control";  

/*====================== PIN MAPPING (NodeMCU) ======================*/
#define RELAY1_PIN D0
#define RELAY2_PIN D3
#define DHT_PIN    D6
#define PIR_PIN    D8
#define LIGHT_PIN  D7

// [MỚI THÊM] Sử dụng chân D4 và D5 cho 2 con LED
#define LAMP_PIN     D4 
#define BEDSIDE_PIN  D5

#define DHTTYPE    DHT11

#define RELAY1_ACTIVE_LOW false  // Relay1: HIGH=ON 
#define RELAY2_ACTIVE_LOW false  // Relay2: HIGH=ON 
#define LAMP_ACTIVE_LOW   false  // Đèn bàn: HIGH=ON
#define BEDSIDE_ACTIVE_LOW false // Đèn ngủ: HIGH=ON

/*====================== OLED CẤU HÌNH ======================*/
#define SCREEN_WIDTH 128 
#define SCREEN_HEIGHT 64 
#define OLED_RESET    -1 

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

DHT dht(DHT_PIN, DHTTYPE);
WiFiClientSecure net;
PubSubClient mqtt(net);

/*====================== STATE / TIMERS ======================*/
bool relay1_on = false;
bool relay2_on = false;
bool isSmartTvOn = false; 

float currentTemp = 24.0;
float currentHum = 50.0;

unsigned long lastSensorMs = 0;
const unsigned long SENSOR_INTERVAL_MS = 3000; 

/*====================== HELPERS ======================*/
void updateOLED() {
  display.clearDisplay(); 
  display.setTextColor(SSD1306_WHITE);

  if (isSmartTvOn) {
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("--- ROOM STATUS ---");
    
    display.setTextSize(2);
    display.setCursor(0, 20);
    display.printf("T: %.1fC\n", currentTemp);
    
    display.setCursor(0, 45);
    display.printf("H: %.1f%%\n", currentHum);
  } else {
    display.setTextSize(2);
    display.setCursor(20, 25);
    display.println("TV OFF");
  }
  
  display.display(); 
}

inline void writeRelay(uint8_t pin, bool on, bool activeLow) {
  int level = activeLow ? (on ? LOW : HIGH) : (on ? HIGH : LOW);
  digitalWrite(pin, level);
  Serial.printf("[RELAY/LED] pin=%u on=%d -> level=%d\n", pin, on, level);
}

void setRelay(uint8_t id, bool on) {
  if (id == 1) {
    relay1_on = on;
    writeRelay(RELAY1_PIN, on, RELAY1_ACTIVE_LOW);
  } else if (id == 2) {
    relay2_on = on;
    writeRelay(RELAY2_PIN, on, RELAY2_ACTIVE_LOW);
  }
}

/*====================== THỐNG NHẤT XỬ LÝ LỆNH ĐIỀU KHIỂN TỪ SERVER ======================*/
void handleCommand(const char* roomId, const char* payload, size_t len) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload, len);
  if (err) {
    Serial.println("[CMD] Parsing failed!");
    return;
  }

  const char* device = doc["device"] | "";
  bool state = doc["state"] | false;

  Serial.printf("[CMD] Lệnh từ phòng %s -> device: %s, state: %d\n", roomId, device, state);

  if (strcmp(device, "main_light") == 0) {
    setRelay(1, state);
  } 
  else if (strcmp(device, "fan") == 0) {
    setRelay(2, state);
  }
  // [MỚI THÊM] Điều khiển Đèn Bàn
  else if (strcmp(device, "desk_lamp") == 0) {
    writeRelay(LAMP_PIN, state, LAMP_ACTIVE_LOW);
  }
  // [MỚI THÊM] Điều khiển Đèn Ngủ
  else if (strcmp(device, "bedside_lamp") == 0) {
    writeRelay(BEDSIDE_PIN, state, BEDSIDE_ACTIVE_LOW);
  }
  else if (strcmp(device, "tv") == 0) {
    isSmartTvOn = state;
    updateOLED(); 
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("[MQTT] IN "); Serial.print(topic); Serial.print(" => ");
  for (unsigned int i = 0; i < length; i++) Serial.print((char)payload[i]);
  Serial.println();
  
  if (strcmp(topic, TOPIC_CTRL_2) == 0) {
    handleCommand(ROOM_2, (const char*)payload, length);
  }
}

/*====================== NET / MQTT ======================*/
void connectWiFi() {
  Serial.print("[WiFi] Connecting");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint8_t tries = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
    if (++tries > 60) break;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\n[WiFi] Connected. IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Failed to connect.");
  }
}

void connectMQTT() {
  net.setInsecure(); 

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);

  while (!mqtt.connected()) {
    Serial.print("[MQTT] Connecting to Local TLS (8883)...");
    
    if (mqtt.connect("ESP8266_Hotel_0102", MQTT_USER, MQTT_PASS)) {
      Serial.println("connected");
      mqtt.subscribe(TOPIC_CTRL_2, 1);
    } else {
      Serial.print("failed, rc="); Serial.print(mqtt.state());
      Serial.println(" retry in 2s"); delay(2000);
    }
  }
}

/*====================== SETUP / LOOP ======================*/
void setup() {
  Serial.begin(115200); delay(80);

  Wire.begin(D2, D1); 
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
  } else {
    Serial.println(F("OLED Init Success"));
  }
  
  updateOLED(); 

  pinMode(RELAY2_PIN, INPUT_PULLUP);
  delay(20);
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  pinMode(PIR_PIN,    INPUT_PULLUP);
  pinMode(LIGHT_PIN,  INPUT);

  // [MỚI THÊM] Khởi tạo Output cho 2 LED mới
  pinMode(LAMP_PIN, OUTPUT);
  pinMode(BEDSIDE_PIN, OUTPUT);

  // Tắt mọi thứ lúc mới khởi động
  writeRelay(RELAY1_PIN, false, RELAY1_ACTIVE_LOW);
  writeRelay(RELAY2_PIN, false, RELAY2_ACTIVE_LOW);
  writeRelay(LAMP_PIN, false, LAMP_ACTIVE_LOW);
  writeRelay(BEDSIDE_PIN, false, BEDSIDE_ACTIVE_LOW);

  dht.begin();
  connectWiFi();
  connectMQTT();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected())             connectMQTT();
  mqtt.loop();

  unsigned long now = millis();

  if (now - lastSensorMs >= SENSOR_INTERVAL_MS) {
    lastSensorMs = now;
    
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    
    if (isnan(t)) t = 24.0;
    if (isnan(h)) h = 50.0;
    
    currentTemp = t;
    currentHum = h;
    
    if (isSmartTvOn) {
      updateOLED();
    }

    bool motionDetected = (digitalRead(PIR_PIN) == HIGH);
    
    bool isLight = (digitalRead(LIGHT_PIN) == LOW); 
    float lightLevel = isLight ? 800.0 : 100.0; 

    StaticJsonDocument<256> doc;
    doc["temp"] = t;
    doc["humidity"] = h;
    doc["motion"] = motionDetected;
    doc["light"] = lightLevel;

    char out[256]; 
    size_t n = serializeJson(doc, out);
    
    mqtt.publish(TOPIC_SENSORS_2, (const uint8_t*)out, n, false);
    
    Serial.print("[PUB] SENSORS TO ROOM 0102 => "); 
    Serial.println(out);
  }
}