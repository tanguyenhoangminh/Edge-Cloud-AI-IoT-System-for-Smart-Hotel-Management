# Edge–Cloud AI-IoT System for Smart Hotel Management

> A senior project by **Ta Nguyen Hoang Minh** (EEEEIU22084)  
> School of Electrical Engineering — International University, VNU-HCM  
> June 2026

**[🌐 Live Demo →](https://hotel-project-mosquitto.vercel.app/)**  
username: admin
password:123456

No installation needed — the app is fully deployed and accessible from any browser.

---

## Overview

This system integrates IoT sensors, edge computing, cloud services, and machine learning to enable real-time monitoring, smart decision-making, and automated control across a multi-floor hotel environment.

- **IoT layer** — Custom-fabricated ESP8266 (ESP-12F) PCB nodes deployed per room, collecting temperature, humidity, occupancy, air quality, and smoke data.
- **Edge layer** — Raspberry Pi 4 running a local Mosquitto MQTT broker; automation rules execute locally to minimize response latency.
- **Cloud layer** — Node.js/Express backend on Render, MySQL 8.0 on Railway, MQTT brokered via HiveMQ Cloud.
- **AI module** — Decision Tree, Random Forest, and XGBoost regression models predicting CO₂, humidity, and energy consumption for proactive fan control and energy waste detection.
- **Dashboard** — React Native (Expo) web + mobile app with real-time monitoring, device control, energy analytics, voice commands, and alert management.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Hotel Rooms                         │
│  ESP-12F Nodes  ──MQTT──>  Raspberry Pi 4 (Edge)        │
│  (Sensor + Control PCBs)    └── Mosquitto Broker        │
│                              └── Local Automation       │
└─────────────────────┬───────────────────────────────────┘
                      │ MQTT Bridge (TLS 8883)
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Cloud Layer                           │
│  HiveMQ Cloud  ──>  Node.js/Express (Render)            │
│                      └── MySQL 8.0 (Railway)            │
│                      └── ML Agent (edge_agent.py)       │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API / WebSocket
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Management Dashboard                       │
│  React Native (Expo) — Web + Android APK                │
│  Deployed on Vercel → hotel-project-mosquitto.vercel.app│
└─────────────────────────────────────────────────────────┘
```

---

## Hardware Modules

Four custom PCBs were designed in Altium Designer and fabricated on two-layer FR4:

| Module | MCU | Key Components |
|--------|-----|----------------|
| **Battery-Powered Sensor Node** | ESP-12F | Sensors, LiPo 500mAh + TP4056, T64 boost |
| **Lighting Dimming Control** | ESP-12F | AO3400 MOSFET, PWM dimming, 4N35 optocoupler feedback, HLK-20M12 |
| **Fan Speed Regulation** | ESP-12F | BT136-600E TRIAC, phase-angle control, H11AA1 zero-cross detection |
| **Door Lock & Alarm** | ESP-12F (NodeMCU) | TIP122 solenoid driver, BC547B buzzer switch, LM7805T |

All AC-side boards include reinforced isolation (Hi-Link modules + optocouplers) and comply with IEC 62368-1.

---

## Software Stack

| Layer | Technology |
|-------|-----------|
| Firmware | Arduino (ESP8266 SDK), MQTT QoS Level 1 |
| Edge gateway | Raspberry Pi OS, Eclipse Mosquitto |
| Backend | Node.js + Express, mysql2 |
| Database | MySQL 8.0 (Railway) |
| MQTT broker | HiveMQ Cloud (TLS) |
| ML module | Python, scikit-learn, XGBoost, joblib |
| Frontend | React Native + Expo |
| Hosting | Render (backend), Railway (DB + ML agent), Vercel (frontend) |

---

## Machine Learning Module

Three regression targets, three algorithms evaluated per target:

| Target | Best Model | RMSE | R² |
|--------|-----------|------|----|
| CO₂ (ppm) | XGBoost | — | ~0.99 |
| Humidity (%) | Random Forest | — | ~0.99 |
| Energy (Wh) | XGBoost | — | ~0.99 |

Features: hour of day, current humidity, current CO₂, occupancy status, states of 8 devices.

**Automated actions driven by ML predictions:**
- Fan turns **ON** proactively when predicted CO₂ > 800 ppm (fan currently off)
- Fan turns **OFF** when predicted CO₂ < 500 ppm (fan currently on)
- Rule-based fallback: light dims to 30% on no-occupancy; smoke threshold triggers fan + curtain open regardless of model output

Training data: 200 simulated rooms × 2,880 steps (24 h each), generated from calibrated physics coefficients to match the live simulation engine.

---

## Dashboard Features

- **Room overview** — live sensor readings, occupancy status, per-room device states across all floors
- **Device control** — PWM brightness sliders (0–100%), toggle switches; commands dispatched via MQTT + REST simultaneously
- **Energy analytics** — cumulative consumption charts, predicted vs. actual deviation
- **Alert panel** — system alerts with severity indicators and one-click acknowledgement
- **Voice commands** — speech-to-text → Groq LLM intent parsing → MQTT actuator command (OpenRouter as fallback)
- **Mobile APK** — built with `eas build -p android --profile development`

---

## Running Locally

> The app is already live at **[hotel-project-mosquitto.vercel.app](https://hotel-project-mosquitto.vercel.app/)**.  
> These steps are only needed if you want to run a local development copy.

### Prerequisites

- Node.js ≥ 18
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)

### Steps

```bash
# Clone the repo
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>

# Install dependencies
npm install

# Start the Expo dev server
npx expo start
```

Then press `w` to open in browser, or scan the QR code with the Expo Go app.

### Environment Variables

Create a `.env` file (or set on your hosting platform):

```env
DB_HOST=your_railway_mysql_host
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
HIVEMQ_HOST=your_cluster.hivemq.cloud
HIVEMQ_USER=your_mqtt_user
HIVEMQ_PASS=your_mqtt_password
GROQ_API_KEY=your_groq_key
```

---

## Project Structure (overview)

```
├── server.js              # Express backend, MQTT subscriber, simulation engine
├── edge_agent.py          # ML polling agent (Railway worker)
├── ml/
│   ├── generate_data.py   # Synthetic dataset generation
│   ├── train_models.py    # Training + evaluation, exports .joblib
│   └── models/            # Serialized model files
├── app/                   # React Native / Expo frontend
│   ├── screens/
│   └── components/
└── hardware/              # Altium Designer schematics & PCB layouts
```

---

## Cost

Total prototype BOM: **~$99 USD**  
Primary cost driver: Raspberry Pi 4 Model B 4GB ($55).  
All other per-room hardware costs under $20/room.

---

## Author

**Ta Nguyen Hoang Minh** — Electronics & Telecommunications Engineering  
International University — Vietnam National University Ho Chi Minh City  
Advisor: M.Eng. Vo Minh Thanh

---

## License

This project was submitted as a senior capstone project for academic evaluation. Hardware designs, firmware, and software are shared for reference and educational purposes.
