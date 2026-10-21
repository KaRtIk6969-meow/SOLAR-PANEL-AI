/*
  =============================================================================
  SolarAI - ESP32 Solar Telemetry Edge Firmware
  =============================================================================
  Platform : ESP32 Dev Module / NodeMCU-32S
  Framework: Arduino / PlatformIO
  Libraries Required:
    - WiFi (built-in ESP32 core)
    - HTTPClient (built-in ESP32 core)
    - ArduinoJson (v6.x or v7.x by Benoit Blanchon)

  IMPORTANT NOTICE FOR HARDWARE TEAM:
  Pin assignments below are CONFIGURATION PLACEHOLDERS.
  Review and confirm exact GPIOs and sensor models with your hardware testbed
  before compiling and flashing the microcontroller.
  =============================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// =============================================================================
// 1. WI-FI & BACKEND SERVER CONFIGURATION
// =============================================================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Target endpoint on laptop: http://<LAPTOP_LAN_IP>:8000/api/v1/telemetry
const char* SERVER_URL    = "http://<LAPTOP_LAN_IP>:8000/api/v1/telemetry";

const char* DEVICE_ID     = "SOLAR-ESP32-01";
const char* FIRMWARE_VER  = "1.0.0-hw";
const char* DEVICE_TOKEN  = "solarai_super_secret_dev_key_change_in_production";
const unsigned long REPORTING_INTERVAL_MS = 5000;

// =============================================================================
// 2. HARDWARE PIN CONFIGURATION (PLACEHOLDERS - CONFIRM WITH HARDWARE TEAM)
// =============================================================================
constexpr int PIN_VOLTAGE_ADC    = 34; // Placeholder: ADC1 channel for Voltage Divider
constexpr int PIN_CURRENT_ADC    = 35; // Placeholder: ADC1 channel for Current Sensor (e.g. ACS712)
constexpr int PIN_TEMPERATURE    = 4;  // Placeholder: Digital GPIO for Temp Sensor / Analog
constexpr int PIN_IRRADIANCE_ADC = 36; // Placeholder: ADC1 channel for Irradiance / Pyranometer / LDR
constexpr int PIN_STATUS_LED     = 2;  // Built-in status LED

// =============================================================================
// 3. SENSOR CALIBRATION CONSTANTS
// =============================================================================
constexpr float ADC_REF_VOLTAGE       = 3.3f;
constexpr float ADC_RESOLUTION        = 4095.0f;
constexpr float VOLTAGE_DIVIDER_RATIO = 5.0f;
constexpr float ACS_ZERO_V            = 2.5f;
constexpr float ACS_SENSITIVITY       = 0.185f;
constexpr float IRRADIANCE_MAX_WM2    = 1200.0f;

float readAnalogAverage(int pin, int samples = 16) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delayMicroseconds(50);
  }
  return (float)sum / (float)samples;
}

float readVoltage() {
  float rawAdc = readAnalogAverage(PIN_VOLTAGE_ADC);
  float pinVoltage = (rawAdc / ADC_RESOLUTION) * ADC_REF_VOLTAGE;
  float arrayVoltage = pinVoltage * VOLTAGE_DIVIDER_RATIO;
  if (arrayVoltage < 0.1f) arrayVoltage = 0.0f;
  return arrayVoltage;
}

float readCurrent() {
  float rawAdc = readAnalogAverage(PIN_CURRENT_ADC);
  float pinVoltage = (rawAdc / ADC_RESOLUTION) * ADC_REF_VOLTAGE;
  float currentAmps = (pinVoltage - ACS_ZERO_V) / ACS_SENSITIVITY;
  if (currentAmps < 0.05f) currentAmps = 0.0f;
  return currentAmps;
}

float readTemperature() {
  float rawAdc = readAnalogAverage(PIN_TEMPERATURE);
  float tempVoltage = (rawAdc / ADC_RESOLUTION) * ADC_REF_VOLTAGE;
  float tempC = tempVoltage * 100.0f;
  if (tempC < -10.0f || tempC > 110.0f) {
    tempC = 28.5f;
  }
  return tempC;
}

float readIrradiance() {
  float rawAdc = readAnalogAverage(PIN_IRRADIANCE_ADC);
  float ratio = rawAdc / ADC_RESOLUTION;
  float irradiance = ratio * IRRADIANCE_MAX_WM2;
  if (irradiance < 0.0f) irradiance = 0.0f;
  return irradiance;
}

void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("[Wi-Fi] Connecting to: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[Wi-Fi] Connected!");
    Serial.print("[Wi-Fi] IP: ");
    Serial.println(WiFi.localIP());
    digitalWrite(PIN_STATUS_LED, HIGH);
  } else {
    Serial.println("\n[Wi-Fi] Failed to connect.");
    digitalWrite(PIN_STATUS_LED, LOW);
  }
}

void transmitTelemetry(float voltage, float current, float temp, float irradiance) {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
    return;
  }
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.setTimeout(4000);

  StaticJsonDocument<256> doc;
  doc["device_id"]        = DEVICE_ID;
  doc["voltage_v"]        = round(voltage * 100.0f) / 100.0f;
  doc["current_a"]        = round(current * 100.0f) / 100.0f;
  doc["temperature_c"]    = round(temp * 10.0f) / 10.0f;
  doc["irradiance_w_m2"]  = round(irradiance * 10.0f) / 10.0f;
  doc["firmware_version"] = FIRMWARE_VER;

  String requestBody;
  serializeJson(doc, requestBody);
  Serial.print("[Telemetry] POST: ");
  Serial.println(requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode > 0) {
    Serial.printf("[Telemetry] Response: HTTP %d\n", httpCode);
    digitalWrite(PIN_STATUS_LED, LOW);
    delay(80);
    digitalWrite(PIN_STATUS_LED, HIGH);
  } else {
    Serial.printf("[Telemetry] Error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

unsigned long lastReportTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== SolarAI ESP32 Edge Telemetry Node ===");
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);
  analogSetAttenuation(ADC_11db);
  connectToWiFi();
}

void loop() {
  unsigned long now = millis();
  if (now - lastReportTime >= REPORTING_INTERVAL_MS) {
    lastReportTime = now;
    float voltage    = readVoltage();
    float current    = readCurrent();
    float temp       = readTemperature();
    float irradiance = readIrradiance();
    transmitTelemetry(voltage, current, temp, irradiance);
  }
  if (WiFi.status() != WL_CONNECTED && (now - lastReportTime > 15000)) {
    connectToWiFi();
  }
  delay(10);
}
