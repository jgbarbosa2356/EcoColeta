/* EcoColeta: um ESP32, tres sensores e tres dispositivos TagoIO.
   Entrada principal = esquerda; Patio = centro; Cantina = direita.
   Estimativa por altura, sem medicao de peso ou volume.
*/
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <time.h>
#include <cmath>
#include <algorithm>

const char* API_BASE = "https://api.us-e1.tago.io";
constexpr unsigned long SEND_INTERVAL = 10000;

String escapeJson(const char* text) {
  String out;
  for (const unsigned char* p = (const unsigned char*)text; *p; ++p) {
    if (*p == '"' || *p == '\\') out += '\\';
    if (*p >= 32) out += (char)*p;
  }
  return out;
}

bool validToken(const String& token) {
  if (token.length() != 36) return false;
  for (unsigned i = 0; i < token.length(); ++i) {
    bool separator = i == 8 || i == 13 || i == 18 || i == 23;
    char c = token[i];
    if (separator ? c != '-' : !((c >= '0' && c <= '9') ||
      (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) return false;
  }
  return true;
}

class Bin {
  static constexpr unsigned MAX_EVENTS = 16;
  struct Event { uint32_t number; int64_t epoch; };
  struct Stored {
    uint32_t signature = 0xEC0C0001, total = 0, dropped = 0;
    uint8_t count = 0;
    Event pending[MAX_EVENTS] = {};
  } state;
  Preferences memory;
  int trig, echo, led;
  const char* location;
  bool armed = false;
  unsigned lowSamples = 0;
  unsigned long lastAttempt = 0;
  bool firstSend = true;
  bool sampled = false;

  void save() { memory.putBytes("state", &state, sizeof(state)); }

  String metadata() const {
    return "\"ponto_id\":\"" + escapeJson(id) +
      "\",\"ponto_nome\":\"" + escapeJson(name) +
      "\",\"localizacao\":\"" + escapeJson(location) + "\"";
  }

  void recordCollection() {
    ++state.total;
    if (state.count == MAX_EVENTS) {
      for (unsigned i = 1; i < MAX_EVENTS; ++i) state.pending[i-1] = state.pending[i];
      --state.count;
      ++state.dropped;
    }
    time_t now = time(nullptr);
    state.pending[state.count++] = {state.total, now > 1700000000 ? (int64_t)now : 0};
    save();
    Serial.printf("[%s] Coleta provavel registrada: %lu\n", id, (unsigned long)state.total);
  }

public:
  const char* id;
  const char* name;
  String token;
  float distance = 0, level = 0;
  bool sensorOk = false;

  Bin(const char* identifier, const char* title, const char* place, int t, int e, int l)
    : trig(t), echo(e), led(l), location(place), id(identifier), name(title) {}

  void begin() {
    pinMode(trig, OUTPUT);
    pinMode(echo, INPUT);
    pinMode(led, OUTPUT);
    digitalWrite(trig, LOW);
    uint32_t hash = 2166136261UL;
    for (const unsigned char* p = (const unsigned char*)id; *p; ++p)
      hash = (hash ^ *p) * 16777619UL;
    String ns = "eco" + String(hash, HEX);
    memory.begin(ns.c_str(), false);
    if (memory.getBytesLength("state") == sizeof(state)) {
      Stored previous;
      memory.getBytes("state", &previous, sizeof(previous));
      if (previous.signature == state.signature && previous.count <= MAX_EVENTS) state = previous;
    }
    Serial.printf("Ponto ativo: %s | %s\n", id, name);
  }

  void setToken(const String& value) {
    token = value;
    firstSend = true;
    Serial.printf("[%s] Token recebido nesta sessao.\n", id);
  }

  void sample() {
    sampled = true;
    float readings[5];
    unsigned count = 0;
    for (unsigned i = 0; i < 5; ++i) {
      digitalWrite(trig, LOW); delayMicroseconds(2);
      digitalWrite(trig, HIGH); delayMicroseconds(10);
      digitalWrite(trig, LOW);
      unsigned long pulse = pulseIn(echo, HIGH, 30000);
      float cm = pulse / 58.0f;
      if (pulse && std::isfinite(cm) && cm >= 2 && cm <= 50) readings[count++] = cm;
      delay(60);
    }
    sensorOk = count >= 3;
    if (sensorOk) {
      std::sort(readings, readings + count);
      distance = readings[count / 2];
      level = std::max(0.0f, std::min(100.0f, (40.0f - distance) * 100.0f / 35.0f));
      if (level >= 50) { armed = true; lowSamples = 0; }
      else if (armed && level <= 20) {
        if (++lowSamples >= 3) {
          armed = false; lowSamples = 0; recordCollection();
        }
      } else lowSamples = 0;
      Serial.printf("[%s] %s: %.1f%% | %.1f cm | %s\n", id, name, level, distance, situation());
    } else {
      lowSamples = 0;
      Serial.printf("[%s] Sensor sem leitura valida.\n", id);
    }
    digitalWrite(led, sensorOk && level >= 80 ? HIGH : LOW);
  }

  const char* situation() const {
    return level >= 90 ? "critico" : level >= 80 ? "atencao" : "normal";
  }

  void publishIfDue() {
    if (!sampled) return;
    if (!firstSend && millis() - lastAttempt < SEND_INTERVAL) return;
    firstSend = false;
    lastAttempt = millis();
    if (!token.length()) {
      Serial.printf("[%s] Aguardando token deste dispositivo.\n", id);
      return;
    }
    if (WiFi.status() != WL_CONNECTED) {
      Serial.printf("[%s] Sem Wi-Fi; eventos permanecem na fila.\n", id);
      return;
    }
    String body = "[{\"variable\":\"sensor_ok\",\"value\":" + String(sensorOk ? 1 : 0) + "}";
    if (sensorOk) {
      body += ",{\"variable\":\"nivel\",\"value\":" + String(level, 1) +
        ",\"unit\":\"%\",\"metadata\":{" + metadata() + "}}";
      body += ",{\"variable\":\"distancia\",\"value\":" + String(distance, 1) + ",\"unit\":\"cm\"}";
      body += ",{\"variable\":\"situacao\",\"value\":\"" + String(situation()) + "\"}";
    }
    body += ",{\"variable\":\"coletas_total\",\"value\":" + String(state.total) + "}";
    body += ",{\"variable\":\"eventos_descartados\",\"value\":" + String(state.dropped) + "}";
    for (unsigned i = 0; i < state.count; ++i) {
      const Event& event = state.pending[i];
      body += ",{\"variable\":\"coleta\",\"value\":" + String(event.number);
      if (event.epoch) {
        time_t when = (time_t)event.epoch; struct tm utc; char date[25];
        gmtime_r(&when, &utc);
        strftime(date, sizeof(date), "%Y-%m-%dT%H:%M:%SZ", &utc);
        body += ",\"time\":\"" + String(date) + "\"";
      }
      body += ",\"metadata\":{" + metadata() + ",\"event_id\":\"" + String(id) +
        "-" + String(event.number) + "\",\"tipo\":\"provavel\",\"hora_estimada\":" +
        String(event.epoch ? "false" : "true") + "}}";
    }
    body += "]";
    WiFiClientSecure client;
    // Apenas laboratorio no ESP32 virtual. Para placa fisica, configure uma CA valida.
    client.setInsecure();
    client.setHandshakeTimeout(30);
    HTTPClient http;
    http.setConnectTimeout(10000);
    http.setTimeout(12000);
    if (!http.begin(client, String(API_BASE) + "/data")) {
      Serial.printf("[%s] Falha ao preparar HTTPS.\n", id);
      lastAttempt = millis();
      return;
    }
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Device-Token", token);
    Serial.printf("[%s] Enviando para TagoIO...\n", id);
    int code = http.POST(body);
    String response = http.getString();
    response.replace(" ", ""); response.replace("\n", ""); response.replace("\r", "");
    bool accepted = code >= 200 && code < 300 && response.indexOf("\"status\":true") >= 0;
    Serial.printf("[%s] Envio HTTPS %d: %s\n", id, code, accepted ? "aceito" : "falhou");
    if (code < 0) Serial.println(HTTPClient::errorToString(code));
    if (accepted && state.count) { state.count = 0; save(); }
    http.end();
    lastAttempt = millis();
  }
};

Bin entrada("LIXEIRA_01", "Entrada principal", "Escola - acesso principal", 5, 18, 23);
Bin patio("LIXEIRA_02", "Patio", "Escola - area de convivencia", 19, 21, 22);
Bin cantina("LIXEIRA_03", "Cantina", "Escola - praca de alimentacao", 26, 27, 25);
Bin* bins[] = {&entrada, &patio, &cantina};

String command;
bool commandOverflow = false;

void readCommands() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c != '\n') {
      if (command.length() < 96 && !commandOverflow) command += c;
      else commandOverflow = true;
      continue;
    }
    command.trim();
    bool handled = false;
    if (commandOverflow) Serial.println("Comando longo demais. Envie novamente.");
    else if (command == "DESCONECTAR") {
      for (Bin* bin : bins) bin->token = "";
      Serial.println("Tokens removidos desta sessao.");
      handled = true;
    } else for (unsigned i = 0; i < 3; ++i) {
      String prefix = "TOKEN_0" + String(i + 1) + "=";
      if (!command.startsWith(prefix)) continue;
      handled = true;
      String candidate = command.substring(prefix.length()); candidate.trim();
      if (!validToken(candidate)) {
        Serial.println("Token em formato invalido. Use o Device-Token UUID, sem aspas.");
        break;
      }
      bool duplicate = false;
      for (unsigned j = 0; j < 3; ++j)
        if (j != i && bins[j]->token == candidate) duplicate = true;
      if (duplicate) Serial.println("Esse token ja foi usado em outra lixeira. Use tokens diferentes.");
      else bins[i]->setToken(candidate);
      break;
    }
    if (!handled && command.length() && !commandOverflow)
      Serial.println("Use TOKEN_01=..., TOKEN_02=..., TOKEN_03=... ou DESCONECTAR.");
    command = "";
    commandOverflow = false;
  }
}

void setup() {
  Serial.begin(115200);
  for (Bin* bin : bins) bin->begin();
  WiFi.mode(WIFI_STA);
  WiFi.begin("Wokwi-GUEST", "", 6);
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("EcoColeta: 3 sensores. Vazio=40 cm; cheio=5 cm.");
  Serial.println("Informe no monitor: TOKEN_01=..., TOKEN_02=..., TOKEN_03=...");
}

void loop() {
  readCommands();
  static unsigned long sampledAt = 0, reconnectAt = 0;
  unsigned long now = millis();
  if (WiFi.status() != WL_CONNECTED && now - reconnectAt >= 10000) {
    reconnectAt = now; WiFi.reconnect();
  }
  if (now - sampledAt >= 1000) {
    sampledAt = now;
    for (Bin* bin : bins) bin->sample();
  }
  for (Bin* bin : bins) bin->publishIfDue();
  delay(10);
}
