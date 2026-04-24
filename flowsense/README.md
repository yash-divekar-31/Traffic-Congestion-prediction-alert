# FlowSense — Pune Traffic Intelligence Platform
## Enhanced with NLP/LLM Search & AI Assistant

---

## 📁 Project Structure

```
flowsense/
├── index.html              ← Main enhanced app (open this in browser)
├── README.md               ← This file
└── data/
    ├── pune-routes.json    ← All corridor & route dataset
    └── weather-config.json ← Weather API config & impact data
```

---

## 🌐 Live Data Sources Used

| Source | What it provides | Cost |
|--------|-----------------|------|
| **OpenStreetMap + CartoDB** | Dark-mode map tiles | Free forever |
| **Open-Meteo API** | Real-time weather for Pune | Free, no key needed |
| **Anthropic Claude API** | NLP search + AI assistant chat | Free trial / paid |

**Weather endpoint (no API key):**
```
https://api.open-meteo.com/v1/forecast
  ?latitude=18.5204&longitude=73.8567
  &current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code
```

---

## 🤖 NLP/LLM Features Added

### AI Assistant (right panel → "AI Chat" tab)
- Powered by **Claude claude-sonnet-4-20250514** via Anthropic API
- Understands natural language queries like:
  - *"Is Hinjewadi congested right now?"*
  - *"Which route should I avoid this evening?"*
  - *"What's the fastest way from Kothrud to Viman Nagar?"*
  - *"Will rain affect traffic today?"*
- Context-aware: sends current traffic state + weather to Claude with each message

### NLP Smart Search (left sidebar)
- Type natural language into the search bar
- Matches corridors, areas, and route names using fuzzy NLP matching
- Examples: "tech park", "it road", "hinjewadi", "FC road", "airport"

---

## 🔧 Setup Instructions

### 1. Get a Free Anthropic API Key
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Go to API Keys → Create Key
4. Copy the key (starts with `sk-ant-...`)

### 2. Add Your API Key
Open `index.html` and find line ~12:
```js
const ANTHROPIC_API_KEY = "YOUR_API_KEY_HERE";
```
Replace with your actual key.

### 3. Open in Browser
Just double-click `index.html` — no server needed!

> ⚠️ **CORS Note**: The Anthropic API is called directly from the browser.
> This works for local development. In production, route API calls through
> a backend proxy to keep your key secret.

---

## 📊 Simulated ML Engine

The in-browser ML engine simulates a real Gradient Boost + LSTM pipeline:

**Inputs (14 features):**
- Hour of day, day of week (temporal)
- Rain intensity, temperature, wind speed, humidity (weather)
- Historical corridor averages (historical)
- Event proximity, road capacity, visibility (contextual)

**Output:**
- Congestion score 0–100
- Level: Low / Medium / High / Severe
- Avg speed estimate (km/h)
- Next-hour prediction

In production, this would call a FastAPI/Flask endpoint serving a
scikit-learn or PyTorch model trained on Pune SCOOT sensor data.

---

## 🗺️ Monitored Corridors (10 total)

1. FC Road Corridor (Shivajinagar → Baner)
2. JM Road — Swargate
3. Shivajinagar Flyover → Pune Station
4. Hadapsar Industrial Zone
5. Kothrud — Karve Road → Deccan
6. Wakad — Hinjewadi IT Park ⭐ (most congested)
7. Viman Nagar → Airport
8. Aundh — Baner Road
9. Pimpri — Chinchwad Road
10. Kondhwa — Wanowrie

---

## 🧰 Libraries Used

| Library | Version | CDN |
|---------|---------|-----|
| Leaflet.js | 1.9.4 | cdnjs |
| Chart.js | 4.4.1 | cdnjs |
| Google Fonts (Syne + DM Mono) | — | fonts.googleapis.com |
| Anthropic API | claude-sonnet-4-20250514 | api.anthropic.com |

All libraries load from CDN — no npm / build step needed.

---

## 🔄 Refresh Intervals

| Data | Interval |
|------|----------|
| Traffic simulation | Every 8 seconds |
| Weather (Open-Meteo) | Every 5 minutes |
| ML prediction gauge | Every 8 seconds |
| Clock | Every 1 second |

---

*Built on FlowSense — Traffic Intelligence Platform*
*Enhanced with NLP search + Claude AI assistant*
