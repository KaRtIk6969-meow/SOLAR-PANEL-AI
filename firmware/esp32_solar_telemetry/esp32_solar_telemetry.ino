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
    - OneWire & DallasTemperature (optional, if using digital DS18B20)

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
// Replace with your local Wi-Fi SSID and Password
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Replace <LAPTOP_LAN_IP> with the IPv4 address of the laptop running FastAPI.
// Check the /device page on SolarAI Dashboard for your autodetected LAN IP.
// Example: "http://192.168.1.15:8000/api/v1/telemetry"
const char* SERVER_URL    = "http://<LAPTOP_LAN_IP>:8000/api/v1/telemetry";

// Unique hardware identifier registered on the SolarAI backend
const char* DEVICE_ID     = "SOLAR-ESP32-01";
const char* FIRMWARE_VER  = "1.0.0-hw";

// Optional: Device authorization token if enabled on backend settings
const char* DEVICE_TOKEN  = "solarai_super_secret_dev_key_change_in_production";

// Transmission interval in milliseconds (default: 5000ms = 5 seconds)
const unsigned long REPORTING_INTERVAL_MS = 5000;

// =============================================================================
// 2. HARDWARE PIN CONFIGURATION (PLACEHOLDERS - CONFIRM WITH HARDWARE TEAM)
// =============================================================================
// NOTE: Use ADC1 pins (GPIO 32 - 39) when Wi-Fi is active. ADC2 pins conflict with Wi-Fi.
constexpr int PIN_VOLTAGE_ADC    = 34; // Placeholder: Analog In for Array Voltage Divider
constexpr int PIN_CURRENT_ADC    = 35; // Placeholder: Analog In for Current Sensor (e.g., ACS712)
constexpr int PIN_TEMPERATURE    = 4;  // Placeholder: Digital In for Temp Sensor (DS18B20) / Analog
constexpr int PIN_IRRADIANCE_ADC = 36; // Placeholder: Analog In for Irradiance / Pyranometer / LDR
constexpr int PIN_STATUS_LED     = 2;  // Built-in status LED (GPIO 2 on most ESP32 boards)

// =============================================================================
// 3. SENSOR CALIBRATION CONSTANTS (TUNE BASED ON HARDWARE TESTBED)
// =============================================================================
// ADC parameters for ESP32 (12-bit resolution: 0 - 4095, 3.3V reference)
constexpr float ADC_REF_VOLTAGE  = 3.3f;
constexpr float ADC_RESOLUTION   = 4095.0f;

// Voltage Divider Calibration: R1 and R2 values
// Example: R1 = 30kΩ, R2 = 7.5kΩ -> Ratio = (30 + 7.5) / 7.5 = 5.0 (Max input ~16.5V)
// Example: R1 = 100kΩ, R2 = 10kΩ -> Ratio = 11.0 (Max input ~36V)
constexpr float VOLTAGE_DIVIDER_RATIO = 5.0f; 

// Current Sensor Calibration (e.g. ACS712 5A: 185 mV/A, 20A: 100 mV/A, 30A: 66 mV/A)
constexpr float ACS_ZERO_V       = 2.5f;   // Quiescent output voltage (VCC / 2)
constexpr float ACS_SENSITIVITY  = 0.185f; // Volts per Ampere (0.185 for 5A module)

// Irradiance Calibration (Analog solar cell / LDR scaled to W/m² [0 - 1500])
constexpr float IRRADIANCE_MAX_WM2 = 1200.0f;

// =============================================================================
// 4. SENSOR ACQUISITION FUNCTIONS
// =============================================================================

// Helper: Oversample analog pin to filter electrical noise
float readAnalogAverage(int pin, int samples = 16) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delayMicroseconds(50);
  }
  return (float)sum / (float)samples;
}

// Read Array Voltage in Volts (V)
float readVoltage() {
  float rawAdc = readAnalogAverage(PIN_VOLTAGE_ADC);
  float pinVoltage = (rawAdc / ADC_RESOLUTION) * ADC_REF_VOLTAGE;
  float arrayVoltage = pinVoltage * VOLTAGE_DIVIDER_RATIO;
  if (arrayVoltage < 0.1f) arrayVoltage = 0.0f; // Zero-floor noise
  return arrayVoltage;
}

// Read Load Current in Amperes (A)
float readCurrent() {
  float rawAdc = readAnalogAverage(PIN_CURRENT_ADC);
  float pinVoltage = (rawAdc / ADC_RESOLUTION) * ADC_REF_VOLTAGE;
  float currentAmps = (pinVoltage - ACS_ZERO_V) / ACS_SENSITIVITY;
  if (currentAmps < 0.05f) currentAmps = 0.0f; // Ignore negative / idle baseline noise
  return currentAmps;
}

// Read Panel Cell Surface Temperature in Celsius (°C)
// Replace with DallasTemperature / OneWire code if using digital DS18B20
float readTemperature() {
  // Placeholder formula for analog LM35 / NTC or OneWire placeholder
  float rawAdc = readAnalogAverage(PIN_TEMPERATURE);
  float tempVoltage = (rawAdc / ADC_RESOLUTION) * ADC_REF_VOLTAGE;
  float tempC = tempVoltage * 100.0f; // LM35: 10mV/°C
  // Bounds check for plausible testbed range
  if (tempC < -10.0f || tempC > 110.0f) {
    tempC = 28.5f; // Fallback nominal room temperature if sensor disconnected
  }
  return tempC;
}

// Read Solar Irradiance in W/m²
float readIrradiance() {
  float rawAdc = readAnalogAverage(PIN_IRRADIANCE_ADC);
  float ratio = rawAdc / ADC_RESOLUTION;
  float irradiance = ratio * IRRADIANCE_MAX_WM2;
  if (irradiance < 0.0f) irradiance = 0.0f;
  return irradiance;
}

// =============================================================================
// 5. WI-FI & TELEMETRY DISPATCH
// =============================================================================

void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println();
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
    Serial.println("\n[Wi-Fi] Connected successfully!");
    Serial.print("[Wi-Fi] ESP32 Local IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("[Wi-Fi] Target Backend: ");
    Serial.println(SERVER_URL);
    digitalWrite(PIN_STATUS_LED, HIGH);
  } else {
    Serial.println("\n[Wi-Fi] Connection failed. Will retry next cycle.");
    digitalWrite(PIN_STATUS_LED, LOW);
  }
}

void transmitTelemetry(float voltage, float current, float temp, float irradiance) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Telemetry] Skipped: Wi-Fi offline. Reconnecting...");
    connectToWiFi();
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.setTimeout(4000); // 4-second network timeout

  // Build JSON Payload conforming to SolarAI TelemetryCreate schema
  StaticJsonDocument<256> doc;
  doc["device_id"]        = DEVICE_ID;
  doc["voltage_v"]        = round(voltage * 100.0f) / 100.0f;
  doc["current_a"]        = round(current * 100.0f) / 100.0f;
  doc["temperature_c"]    = round(temp * 10.0f) / 10.0f;
  doc["irradiance_w_m2"]  = round(irradiance * 10.0f) / 10.0f;
  doc["firmware_version"] = FIRMWARE_VER;

  String requestBody;
  serializeJson(doc, requestBody);

  Serial.print("[Telemetry] POST -> ");
  Serial.println(requestBody);

  int httpCode = http.POST(requestBody);

  if (httpCode > 0) {
    Serial.printf("[Telemetry] Server Response: HTTP %d\n", httpCode);
    if (httpCode == HTTP_CODE_CREATED || httpCode == HTTP_CODE_OK) {
      // Blink LED to indicate successful transmission
      digitalWrite(PIN_STATUS_LED, LOW);
      delay(80);
      digitalWrite(PIN_STATUS_LED, HIGH);
    } else {
      String payload = http.getString();
      Serial.printf("[Telemetry] Notice: %s\n", payload.c_str());
    }
  } else {
    Serial.printf("[Telemetry] Error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

// =============================================================================
// 6. MAIN ARDUINO SETUP & LOOP
// =============================================================================

unsigned long lastReportTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("  SolarAI - ESP32 Edge Telemetry Ingestion Node       ");
  Serial.printf ("  Device ID: %s | Firmware: %s\n", DEVICE_ID, FIRMWARE_VER);
  Serial.println("=======================================================");

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  // Configure ADC attenuation (11dB gives approx 0 - 3.3V measurement range)
  analogSetAttenuation(ADC_11db);

  connectToWiFi();
}

void loop() {
  unsigned long now = millis();

  // Periodic non-blocking telemetry broadcast
  if (now - lastReportTime >= REPORTING_INTERVAL_MS) {
    lastReportTime = now;

    // 1. Sample physical sensors
    float voltage    = readVoltage();
    float current    = readCurrent();
    float temp       = readTemperature();
    float irradiance = readIrradiance();

    // 2. Transmit to SolarAI FastAPI ingestion pipeline
    transmitTelemetry(voltage, current, temp, irradiance);
  }

  // Handle Wi-Fi auto-reconnection
  if (WiFi.status() != WL_CONNECTED && (now - lastReportTime > 15000)) {
    connectToWiFi();
  }

  delay(10);
}
