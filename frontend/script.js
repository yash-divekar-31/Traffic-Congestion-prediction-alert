/* ═══════════════════════════════════════════════════════════
   FlowSense — Pune Traffic Intelligence + AI
   Map design: Dark CartoDB tiles + colour-coded polylines
   ═══════════════════════════════════════════════════════════ */

// ── CONFIG ──────────────────────────────────────────────────
const CONFIG = {
  mapCenter: [18.5204, 73.8567],
  mapZoom: 13,
  refreshInterval: 8000,
  weatherRefresh: 300000,
};

// ── ML FEATURE IMPORTANCES ───────────────────────────────────
const ML_FEATURES = [
  { name: "Hour of Day",     importance: 0.22 },
  { name: "Day of Week",     importance: 0.18 },
  { name: "Rain Intensity",  importance: 0.14 },
  { name: "Historical Avg",  importance: 0.13 },
  { name: "Event Proximity", importance: 0.10 },
  { name: "Road Capacity",   importance: 0.08 },
  { name: "Temperature",     importance: 0.06 },
  { name: "Wind Speed",      importance: 0.04 },
  { name: "Visibility",      importance: 0.03 },
  { name: "Humidity",        importance: 0.02 },
];

// ── PUNE ROUTE CORRIDORS (10 routes) ────────────────────────
const ROUTES = [
  { id:"r1",  name:"FC Road Corridor",       from:"Shivajinagar",   to:"Baner",        coords:[[18.5204,73.8567],[18.5250,73.8480],[18.5300,73.8400]], baseDelay:5,  color:"#22c55e" },
  { id:"r2",  name:"JM Road — Swargate",     from:"JM Road",        to:"Swargate",      coords:[[18.5162,73.8485],[18.5100,73.8560],[18.5050,73.8620]], baseDelay:12, color:"#eab308" },
  { id:"r3",  name:"Shivajinagar Flyover",   from:"Shivajinagar",   to:"Pune Station",  coords:[[18.5310,73.8490],[18.5270,73.8560],[18.5230,73.8620]], baseDelay:18, color:"#f97316" },
  { id:"r4",  name:"Hadapsar Industrial",    from:"Magarpatta",     to:"Hadapsar",      coords:[[18.5020,73.9280],[18.5070,73.9200],[18.5120,73.9120]], baseDelay:25, color:"#ef4444" },
  { id:"r5",  name:"Kothrud — Karve Road",   from:"Kothrud",        to:"Deccan",        coords:[[18.5088,73.8240],[18.5130,73.8310],[18.5180,73.8390]], baseDelay:8,  color:"#22c55e" },
  { id:"r6",  name:"Wakad — Hinjewadi Tech", from:"Wakad",          to:"Hinjewadi IT",  coords:[[18.5988,73.7310],[18.5900,73.7420],[18.5820,73.7530]], baseDelay:30, color:"#ef4444" },
  { id:"r7",  name:"Viman Nagar — Airport",  from:"Viman Nagar",    to:"Pune Airport",  coords:[[18.5679,73.9143],[18.5750,73.9100],[18.5820,73.9050]], baseDelay:10, color:"#22c55e" },
  { id:"r8",  name:"Aundh — Baner Road",     from:"Aundh",          to:"Baner",         coords:[[18.5590,73.8077],[18.5550,73.7980],[18.5490,73.7880]], baseDelay:14, color:"#eab308" },
  { id:"r9",  name:"Pimpri — Chinchwad",     from:"Pimpri",         to:"Chinchwad",     coords:[[18.6279,73.7997],[18.6200,73.8050],[18.6120,73.8100]], baseDelay:20, color:"#f97316" },
  { id:"r10", name:"Kondhwa — Wanowrie",     from:"Kondhwa",        to:"Wanowrie",      coords:[[18.4736,73.8800],[18.4810,73.8760],[18.4880,73.8720]], baseDelay:16, color:"#eab308" },
];

// ── NLP KEYWORD MAP ──────────────────────────────────────────
const ROUTE_KEYWORDS = {
  r1:  ["fc road","ferguson","shivajinagar","baner","law college"],
  r2:  ["jm road","jangli maharaj","swargate","bus stand","deccan"],
  r3:  ["flyover","shivajinagar","pune station","railway","station road"],
  r4:  ["hadapsar","magarpatta","industrial","solapur road","phursungi"],
  r5:  ["kothrud","karve road","warje","chandani chowk","paud road"],
  r6:  ["wakad","hinjewadi","it park","tech park","software park","it hub","rajiv gandhi"],
  r7:  ["viman nagar","airport","nagar road","kalyani nagar","viman"],
  r8:  ["aundh","baner","balewadi","sus road","pashan"],
  r9:  ["pimpri","chinchwad","pcmc","old mumbai road","bhosari"],
  r10: ["kondhwa","wanowrie","undri","market yard","katraj"],
};

// ── GLOBAL STATE ─────────────────────────────────────────────
let map, routeLayers = {}, incidentMarkers = [];
let congestionChart, speedChart, wxChart;
let currentWeather = {};
let appState = {
  routes: [], alerts: [],
  cityFlow: 62, avgSpeed: 28, totalIncidents: 4, delayIndex: 7,
};
let aiHistory = [];
let aiApiKey  = localStorage.getItem("flowsense_api_key") || "";

// ── API KEY MANAGEMENT ───────────────────────────────────────
function saveApiKey() {
  const key = document.getElementById("api-key-field").value.trim();
  if (key.length > 10) {
    aiApiKey = key;
    localStorage.setItem("flowsense_api_key", key);
    document.getElementById("api-key-notice").style.display = "none";
    document.getElementById("ai-status").textContent = "Active";
    showToast("API Key Saved", "AI assistant is now active!", "success", "🤖");
  } else {
    showToast("Invalid Key", "Please enter a valid Google AI Studio key", "danger", "❌");
  }
}

function checkApiKey() {
  if (!aiApiKey) {
    document.getElementById("api-key-notice").style.display = "block";
    document.getElementById("ai-status").textContent = "No Key";
    document.getElementById("ai-status").style.color = "var(--orange)";
  }
}

// ── ML PREDICTION ENGINE ─────────────────────────────────────
function mlPredict(route, weatherData) {
  const now  = new Date();
  const hour = now.getHours();
  const dow  = now.getDay();

  const peakFactor    = (hour >= 8 && hour <= 10) ? 1.5 : (hour >= 17 && hour <= 20) ? 1.7 : (hour >= 23 || hour <= 5) ? 0.4 : 1.0;
  const weekendFactor = (dow === 0 || dow === 6) ? 0.65 : 1.0;
  const rainFactor    = (weatherData && weatherData.rain) ? 1.2 : 1.0;
  const tempFactor    = (weatherData && weatherData.temp > 38) ? 1.08 : 1.0;
  const noise         = (Math.random() - 0.5) * 0.15;

  const score = Math.min(100, Math.max(0, route.baseDelay * peakFactor * weekendFactor * rainFactor * tempFactor * (1 + noise) * 2.5));
  const level = score < 30 ? "low" : score < 55 ? "medium" : score < 75 ? "high" : "severe";
  const speed = Math.max(5, 60 - score * 0.55 + Math.random() * 5);

  return { score: Math.round(score), level, speed: Math.round(speed) };
}

// ── MAP INITIALISATION ───────────────────────────────────────
// Standard OpenStreetMap tiles + colour-coded circle markers
// exactly matching the screenshot (light map, ring circles)
function initMap() {
  map = L.map("map", { zoomControl: true }).setView(CONFIG.mapCenter, CONFIG.mapZoom);

  // Standard OSM tile layer — light map as shown in screenshot
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  // Draw circle markers at each corridor's primary coord, coloured by congestion
  ROUTES.forEach(r => {
    const levelColor = r.color; // will be updated live in refreshData()
    const circle = L.circleMarker(r.coords[0], {
      radius: 10,
      color: levelColor,
      fillColor: "transparent",
      fillOpacity: 0,
      weight: 3,
    }).addTo(map);

    circle.bindPopup(
      `<div class="prediction-popup">
        <div class="popup-title">🛣️ ${r.name}</div>
        <div class="popup-row"><span>From</span><span class="popup-val">${r.from}</span></div>
        <div class="popup-row"><span>To</span><span class="popup-val">${r.to}</span></div>
        <div class="popup-row"><span>Status</span><span class="popup-val">Live</span></div>
      </div>`,
      { className: "custom-popup" }
    );

    routeLayers[r.id] = circle;
  });

  addIncidentMarkers();
}

function addIncidentMarkers() {
  const incidents = [
    { pos:[18.5250,73.8520], type:"🚧", label:"Road Work — FC Road" },
    { pos:[18.5050,73.8630], type:"💥", label:"Accident — JM Road" },
    { pos:[18.5300,73.8580], type:"🚦", label:"Signal Failure — Shivajinagar" },
    { pos:[18.5120,73.9150], type:"⚠️", label:"Flooding — Hadapsar" },
    { pos:[18.5900,73.7430], type:"🏗️", label:"Construction — Wakad" },
    { pos:[18.5679,73.9143], type:"🚗", label:"High Volume — Viman Nagar" },
  ];

  incidentMarkers.forEach(m => m.remove());
  incidentMarkers = incidents.map(inc => {
    const icon = L.divIcon({
      html: `<div style="font-size:18px;line-height:1;filter:drop-shadow(0 1px 4px rgba(0,0,0,.7))">${inc.type}</div>`,
      className: "",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    return L.marker(inc.pos, { icon })
      .addTo(map)
      .bindPopup(
        `<div class="prediction-popup">
          <div class="popup-title">${inc.type} ${inc.label}</div>
          <div class="popup-row"><span>Status</span><span class="popup-val">Active</span></div>
        </div>`,
        { className: "custom-popup" }
      );
  });
}

// ── DATA REFRESH ─────────────────────────────────────────────
function refreshData() {
  const enriched = ROUTES.map(r => {
    const pred = mlPredict(r, currentWeather);
    return { ...r, ...pred };
  });

  appState.routes         = enriched;
  appState.cityFlow       = Math.round(enriched.reduce((s, r) => s + r.score, 0) / enriched.length);
  appState.avgSpeed       = Math.round(enriched.reduce((s, r) => s + r.speed, 0) / enriched.length);
  appState.totalIncidents = Math.floor(2 + Math.random() * 5);
  appState.delayIndex     = Math.round(3 + (appState.cityFlow / 100) * 15);

  // Update circle marker colours based on live congestion
  enriched.forEach(r => {
    if (routeLayers[r.id]) {
      const colour = r.level === "low"    ? "#22c55e"
                   : r.level === "medium" ? "#eab308"
                   : r.level === "high"   ? "#f97316"
                   :                        "#ef4444";
      routeLayers[r.id].setStyle({ color: colour });
    }
  });

  renderRouteList(enriched);
  buildAlerts(enriched);
  updateStats();
  updateGauge(appState.cityFlow);
  updateCharts();

  document.getElementById("api-latency").textContent = Math.round(20 + Math.random() * 40) + "ms";

  const flowEl = document.getElementById("city-flow");
  if (flowEl) {
    flowEl.textContent = appState.cityFlow + "% congested";
    flowEl.style.color = appState.cityFlow > 70 ? "var(--red)"
                       : appState.cityFlow > 45 ? "var(--orange)"
                       :                          "var(--green)";
  }
}

// ── ALERTS ───────────────────────────────────────────────────
function buildAlerts(routes) {
  const newAlerts = [];

  routes.forEach(r => {
    if (r.level === "severe") {
      newAlerts.push({ icon:"🔴", title:`Severe — ${r.name}`, sub:`${r.score}% · ${r.speed} km/h · Avoid`, type:"severe" });
    } else if (r.level === "high") {
      newAlerts.push({ icon:"🟠", title:`High Traffic — ${r.name}`, sub:`${r.score}% · ${r.speed} km/h`, type:"high" });
    }
  });

  newAlerts.push(
    { icon:"💥", title:"Accident — JM Road near Swargate", sub:"Right lane blocked · +8 min delay", type:"incident" },
    { icon:"🚧", title:"Road Work — FC Road (weekly)",     sub:"Until 10 PM · Use alternate",        type:"work" }
  );

  const severeNow    = newAlerts.filter(a => a.type === "severe").length;
  const severeBefore = appState.alerts.filter(a => a.type === "severe").length;
  if (severeNow > severeBefore) {
    const n = newAlerts.find(a => a.type === "severe");
    if (n) showToast(n.title, n.sub, "danger", "🚨");
  }

  appState.alerts = newAlerts;
  renderAlerts(newAlerts);
}

// ── UI RENDERERS ─────────────────────────────────────────────
function renderRouteList(routes) {
  document.getElementById("route-list").innerHTML = routes.map(r => `
    <div class="route-card ${r.level}" onclick="focusRoute('${r.id}','${r.name}')">
      <div class="route-header">
        <div class="route-name">${r.name}</div>
        <div class="route-badge badge-${r.level}">${r.level.toUpperCase()}</div>
      </div>
      <div class="route-meta">
        <span>🕒 +${Math.round(r.score / 10)}m</span>
        <span>⚡ ${r.speed} km/h</span>
        <span>📊 ${r.score}%</span>
      </div>
      <div class="congestion-bar">
        <div class="congestion-fill" style="width:${r.score}%;background:${
          r.level === "low"    ? "var(--green)"  :
          r.level === "medium" ? "var(--yellow)" :
          r.level === "high"   ? "var(--orange)" : "var(--red)"}"></div>
      </div>
    </div>
  `).join("");
}

function renderAlerts(alerts) {
  document.getElementById("alert-count").textContent = alerts.length;
  document.getElementById("alert-list").innerHTML = alerts.map(a => `
    <div class="alert-item">
      <div class="alert-icon">${a.icon}</div>
      <div class="alert-text">
        <div class="alert-title">${a.title}</div>
        <div class="alert-sub">${a.sub}</div>
      </div>
    </div>
  `).join("");
}

function updateStats() {
  document.getElementById("avg-speed").textContent      = appState.avgSpeed;
  document.getElementById("congestion-pct").textContent = appState.cityFlow;
  document.getElementById("incident-count").textContent = appState.totalIncidents;
  document.getElementById("delay-idx").textContent      = appState.delayIndex;

  const congEl = document.getElementById("congestion-pct");
  congEl.style.color = appState.cityFlow > 70 ? "var(--red)"
                     : appState.cityFlow > 45 ? "var(--orange)"
                     :                          "var(--green)";
}

function focusRoute(id, name) {
  const layer = routeLayers[id];
  if (layer) {
    map.setView(layer.getLatLng(), 14);
    showToast(`Focused: ${name}`, "Map centered on corridor", "info", "📍");
  }
  document.querySelectorAll(".route-card").forEach(c => c.classList.remove("active"));
  if (event && event.currentTarget) event.currentTarget.classList.add("active");
}

// ── GAUGE ────────────────────────────────────────────────────
function updateGauge(score) {
  const arc    = document.getElementById("gauge-arc");
  const needle = document.getElementById("gauge-needle");
  const text   = document.getElementById("gauge-text");

  arc.setAttribute("stroke-dashoffset", 188 - (score / 100) * 188);

  const color = score < 30 ? "var(--green)"
              : score < 55 ? "var(--yellow)"
              : score < 75 ? "var(--orange)"
              :               "var(--red)";

  arc.setAttribute("stroke", color);
  needle.style.transform = `rotate(${(score / 100) * 180 - 90}deg)`;
  needle.setAttribute("stroke", color);
  text.textContent = score + "%";
  text.setAttribute("fill", color);
}

// ── CHARTS ───────────────────────────────────────────────────
function initCharts() {
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: "#1f2330" }, ticks: { color: "#8a91a8", font: { size: 9, family: "DM Mono" } } },
      y: { grid: { color: "#1f2330" }, ticks: { color: "#8a91a8", font: { size: 9, family: "DM Mono" } } },
    },
  };

  congestionChart = new Chart(document.getElementById("congChart"), {
    type: "line",
    data: {
      labels: Array.from({ length: 24 }, (_, i) => i + ":00"),
      datasets: [{
        data: generateDayProfile(),
        borderColor: "#f5a623",
        backgroundColor: "rgba(245,166,35,0.08)",
        fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0,
      }],
    },
    options: { ...baseOptions },
  });

  speedChart = new Chart(document.getElementById("speedChart"), {
    type: "bar",
    data: {
      labels: ["0-10","11-20","21-30","31-40","41-50","50+"],
      datasets: [{
        data: [5, 18, 30, 25, 15, 7],
        backgroundColor: ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6"],
        borderRadius: 4,
      }],
    },
    options: { ...baseOptions },
  });

  wxChart = new Chart(document.getElementById("wxChart"), {
    type: "bar",
    data: {
      labels: ["Clear","Cloudy","Drizzle","Rain","Heavy Rain","Fog"],
      datasets: [{
        label: "Avg Speed (km/h)",
        data: [45, 40, 33, 26, 18, 22],
        backgroundColor: "rgba(59,130,246,0.6)",
        borderColor: "#3b82f6",
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: { ...baseOptions },
  });

  renderFeatureBars();
  renderPipelineSteps();
}

function generateDayProfile() {
  return Array.from({ length: 24 }, (_, h) =>
    (h >= 8 && h <= 10)          ? 65 + Math.random() * 20 :
    (h >= 17 && h <= 20)         ? 75 + Math.random() * 20 :
    (h >= 23 || h <= 5)          ? 5  + Math.random() * 10 :
                                   30 + Math.random() * 20
  );
}

function updateCharts() {
  if (!congestionChart) return;
  const now = new Date().getHours();
  congestionChart.data.datasets[0].data[now] = appState.cityFlow;
  congestionChart.update("none");
  speedChart.data.datasets[0].data = [5,15,28,22,18,8].map(v => Math.round(v + Math.random() * 5));
  speedChart.update("none");
}

// ── ML FEATURE & PIPELINE RENDERERS ─────────────────────────
function renderFeatureBars() {
  document.getElementById("feature-bars").innerHTML = ML_FEATURES.map(f => `
    <div style="margin-bottom:7px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
        <span style="color:var(--text-2)">${f.name}</span>
        <span style="font-family:var(--font-mono)">${Math.round(f.importance * 100)}%</span>
      </div>
      <div style="height:3px;background:var(--bg-3);border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${f.importance * 100}%;background:var(--accent);border-radius:2px;transition:width 0.8s ease"></div>
      </div>
    </div>
  `).join("");
}

function renderPipelineSteps() {
  const steps = [
    { name:"Data Ingestion",  status:"ok",   detail:"Kafka stream · 1.2M/day" },
    { name:"Feature Store",   status:"ok",   detail:"Redis cache · 14 features" },
    { name:"Model Training",  status:"ok",   detail:"Auto every 2h · Docker" },
    { name:"Validation Gate", status:"ok",   detail:"MAE < 5 km/h threshold" },
    { name:"Model Registry",  status:"ok",   detail:"MLflow · v2.4.1 live" },
    { name:"API Deployment",  status:"ok",   detail:"FastAPI · K8s pod healthy" },
    { name:"Monitoring",      status:"warn", detail:"Drift alert on Hadapsar" },
    { name:"CI/CD",           status:"ok",   detail:"GitHub Actions · passing" },
  ];

  document.getElementById("pipeline-steps").innerHTML = steps.map(s => `
    <div class="model-row">
      <span class="model-key" style="display:flex;align-items:center;gap:6px">
        <span class="${s.status === 'ok' ? 'status-ok' : 'status-warn'}">${s.status === 'ok' ? '●' : '▲'}</span>${s.name}
      </span>
      <span class="model-val" style="max-width:120px;text-align:right;font-size:10px;color:var(--text-2)">${s.detail}</span>
    </div>
  `).join("");
}

function renderWeatherImpact() {
  const impacts = [
    { factor:"Rain",       impact:"+22%", desc:"Congestion vs clear day", bad: true  },
    { factor:"Fog",        impact:"+18%", desc:"Speed reduction factor",  bad: true  },
    { factor:"Heat >38°C", impact:"+8%",  desc:"Driver behavior change",  bad: true  },
    { factor:"Night",      impact:"-40%", desc:"Volume reduction",        bad: false },
    { factor:"Weekend",    impact:"-35%", desc:"Fewer commuters",         bad: false },
  ];

  document.getElementById("wx-impact-list").innerHTML = impacts.map(i => `
    <div class="model-row">
      <span class="model-key">${i.factor}</span>
      <div style="text-align:right">
        <div class="model-val ${i.bad ? 'up' : 'down'}">${i.impact}</div>
        <div style="font-size:10px;color:var(--text-2)">${i.desc}</div>
      </div>
    </div>
  `).join("");
}

// ── WEATHER (Open-Meteo, free, no API key) ───────────────────
async function fetchWeather() {
  try {
    const [lat, lon] = CONFIG.mapCenter;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code`;
    const res  = await fetch(url);
    const data = await res.json();
    const c    = data.current;

    const wxEmoji = c.weather_code < 3  ? "☀️"
                  : c.weather_code < 50 ? "⛅"
                  : c.weather_code < 70 ? "🌧️"
                  : c.weather_code < 80 ? "❄️"
                  :                       "⛈️";
    const wxDesc  = c.weather_code < 3  ? "Clear skies"
                  : c.weather_code < 50 ? "Partly cloudy"
                  : c.weather_code < 70 ? "Rain"
                  : c.weather_code < 80 ? "Snow"
                  :                       "Thunderstorm";

    currentWeather = {
      temp:     c.temperature_2m,
      humidity: c.relative_humidity_2m,
      wind:     c.wind_speed_10m,
      rain:     c.precipitation > 0,
      code:     c.weather_code,
      desc:     wxDesc,
    };

    document.getElementById("wx-icon").textContent  = wxEmoji;
    document.getElementById("wx-temp").textContent  = `${Math.round(c.temperature_2m)}°C`;
    document.getElementById("wx-desc").textContent  = wxDesc;
    document.getElementById("wx-hum").textContent   = `💧 ${c.relative_humidity_2m}%`;
    document.getElementById("wx-wind").textContent  = `🌬️ ${Math.round(c.wind_speed_10m)} km/h`;

    renderWeatherImpact();
    if (currentWeather.rain) showToast("Rain Alert", "Expect +20% congestion on all corridors", "warning", "🌧️");

  } catch (err) {
    currentWeather = { temp:30, humidity:65, wind:12, rain:false, desc:"Partly cloudy" };
    document.getElementById("wx-desc").textContent = "Weather unavailable (using estimates)";
    renderWeatherImpact();
  }
}

// ── NLP SEARCH ───────────────────────────────────────────────
function nlpSearch(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results = [];
  ROUTES.forEach(r => {
    const keywords = ROUTE_KEYWORDS[r.id] || [];
    const nameMatch = r.name.toLowerCase().includes(q);
    const fromMatch = r.from.toLowerCase().includes(q);
    const toMatch   = r.to.toLowerCase().includes(q);
    const kwMatch   = keywords.some(k => k.includes(q) || q.includes(k.split(" ")[0]));

    if (nameMatch || fromMatch || toMatch || kwMatch) {
      const routeState = appState.routes.find(x => x.id === r.id);
      results.push({ ...r, ...(routeState || {}), matched: nameMatch ? "name" : (fromMatch || toMatch) ? "area" : "keyword" });
    }
  });

  return results;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("search-input").addEventListener("input", function () {
    const q      = this.value.trim();
    const sugDiv = document.getElementById("search-suggestions");

    if (!q) { sugDiv.style.display = "none"; return; }

    const results = nlpSearch(q);
    if (!results.length) { sugDiv.style.display = "none"; return; }

    sugDiv.innerHTML = results.slice(0, 5).map(r => `
      <div class="suggestion-item" onclick="selectSuggestion('${r.id}','${r.name.replace(/'/g,"\\'")}')">
        <span class="suggestion-icon">${r.level === 'severe' ? '🔴' : r.level === 'high' ? '🟠' : r.level === 'medium' ? '🟡' : '🟢'}</span>
        <div class="suggestion-text">
          <div style="font-weight:700;font-size:12px">${r.name}</div>
          <div style="font-size:10px;color:var(--text-2);font-family:var(--font-mono)">${r.from || ''} → ${r.to || ''}</div>
        </div>
        <span class="suggestion-level badge-${r.level || 'medium'}">${(r.level || '?').toUpperCase()}</span>
      </div>
    `).join("");

    sugDiv.style.display = "block";
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".search-wrap")) {
      document.getElementById("search-suggestions").style.display = "none";
    }
  });
});

function selectSuggestion(id, name) {
  document.getElementById("search-input").value = "";
  document.getElementById("search-suggestions").style.display = "none";
  focusRouteById(id, name);
}

function focusRouteById(id, name) {
  const layer = routeLayers[id];
  if (layer) {
    map.setView(layer.getLatLng(), 14);
    showToast(`Focused: ${name}`, "Map centered on corridor", "info", "📍");
  }
}

// ── AI CHAT (Claude API) ─────────────────────────────────────
function buildTrafficContext() {
  const now = new Date();
  const routeSummary = (appState.routes.length ? appState.routes
    : ROUTES.map(r => ({ ...r, level:"unknown", score:0, speed:0 })))
    .map(r => `${r.name} (${r.from}→${r.to}): ${r.level || '?'} congestion, ${r.score || '?'}% load, ${r.speed || '?'} km/h`)
    .join("\n");

  return `You are FlowSense AI — a Pune traffic intelligence assistant with live data access.

CURRENT TIME: ${now.toLocaleTimeString("en-IN")} ${now.toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" })}
CITY OVERVIEW: ${appState.cityFlow}% city-wide congestion, avg speed ${appState.avgSpeed} km/h, ${appState.totalIncidents} active incidents, ${appState.delayIndex} min avg delay

WEATHER: ${currentWeather.desc || "Partly cloudy"}, ${currentWeather.temp || "30"}°C, humidity ${currentWeather.humidity || "65"}%, wind ${currentWeather.wind || "12"} km/h${currentWeather.rain ? " — RAIN ACTIVE" : ""}

LIVE CORRIDOR STATUS:
${routeSummary}

ACTIVE INCIDENTS:
- Accident on JM Road near Swargate (right lane blocked, +8 min delay)
- Road work on FC Road (until 10 PM)
- Flooding alert at Hadapsar
- Construction zone at Wakad-Hinjewadi entry

You have knowledge of all Pune roads, landmarks, and neighborhoods. Be concise, helpful, and specific. Use km/h, minutes, and real road names. Respond in 2-4 sentences unless a detailed comparison is needed.`;
}

async function callClaudeAPI(userMsg) {
  if (!aiApiKey) {
    return "Please add your Google AI Studio API key using the field at the top of the chat to enable AI responses.";
  }

  aiHistory.push({ role: "user", parts: [{ text: userMsg }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${aiApiKey}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildTrafficContext() }] },
      contents: aiHistory,
      generationConfig: { maxOutputTokens: 400 },
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    aiHistory.pop();
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }

  const data  = await resp.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
  aiHistory.push({ role: "model", parts: [{ text: reply }] });

  if (aiHistory.length > 20) aiHistory = aiHistory.slice(-20);
  return reply;
}

function appendAiMsg(text, role) {
  const container = document.getElementById("ai-messages");
  const div = document.createElement("div");
  div.className = `ai-msg ${role}`;

  if (role === "bot") {
    div.innerHTML = `<div class="ai-avatar bot">🤖</div><div class="ai-bubble bot">${text.replace(/\n/g, "<br>")}</div>`;
  } else {
    div.innerHTML = `<div class="ai-bubble user">${text.replace(/\n/g, "<br>")}</div><div class="ai-avatar user">👤</div>`;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function showTyping() {
  const container = document.getElementById("ai-messages");
  const div = document.createElement("div");
  div.className = "ai-msg";
  div.id = "ai-typing-indicator";
  div.innerHTML = `<div class="ai-avatar bot">🤖</div><div class="ai-bubble bot"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  document.getElementById("ai-typing-indicator")?.remove();
}

async function sendAiMessage() {
  const input = document.getElementById("ai-input");
  const btn   = document.getElementById("ai-send");
  const text  = input.value.trim();

  if (!text) return;
  input.value  = "";
  btn.disabled = true;

  appendAiMsg(text, "user");
  showTyping();

  try {
    const reply = await callClaudeAPI(text);
    removeTyping();
    appendAiMsg(reply, "bot");
  } catch (err) {
    removeTyping();
    appendAiMsg(`⚠️ Error: ${err.message}`, "bot");
  }

  btn.disabled = false;
  input.focus();
}

function sendQuickMsg(text) {
  document.getElementById("ai-input").value = text;
  sendAiMessage();
}

function handleAiKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendAiMessage();
  }
}

// ── TOAST NOTIFICATIONS ──────────────────────────────────────
function showToast(title, desc, type = "info", icon = "ℹ️") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-desc">${desc}</div>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity   = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── TAB SWITCHING ────────────────────────────────────────────
function switchTab(el, tabId) {
  document.querySelectorAll(".panel-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => { p.classList.remove("active"); p.style.display = "none"; });

  el.classList.add("active");
  const pane = document.getElementById("tab-" + tabId);
  pane.classList.add("active");
  pane.style.display = tabId === "ai" ? "flex" : "block";
}

// ── CLOCK ────────────────────────────────────────────────────
function updateClock() {
  document.getElementById("clock").textContent =
    new Date().toLocaleTimeString("en-IN", { hour12: false }) + "  " +
    new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// ── BOOTSTRAP ────────────────────────────────────────────────
const loaderMsgs = [
  "Initializing traffic models...",
  "Connecting to Pune sensor network...",
  "Loading 10 road corridors...",
  "Starting ML inference engine...",
  "Fetching live weather from Open-Meteo...",
  "Connecting Claude AI assistant...",
];
let msgIdx = 0;
const loaderInterval = setInterval(() => {
  const el = document.getElementById("loader-msg");
  if (el) el.textContent = loaderMsgs[++msgIdx % loaderMsgs.length];
}, 320);

window.addEventListener("load", async () => {
  await new Promise(r => setTimeout(r, 1900));
  clearInterval(loaderInterval);

  const loader = document.getElementById("loader");
  loader.style.opacity = "0";
  setTimeout(() => loader.remove(), 500);

  initMap();
  initCharts();
  updateClock();
  setInterval(updateClock, 1000);

  await fetchWeather();
  setInterval(fetchWeather, CONFIG.weatherRefresh);

  refreshData();
  setInterval(refreshData, CONFIG.refreshInterval);

  checkApiKey();

  setTimeout(() => showToast("FlowSense Active",         "Monitoring 10 corridors in Pune",          "success", "✅"), 500);
  setTimeout(() => showToast("Wakad–Hinjewadi Alert",    "Severe congestion on IT corridor",         "danger",  "🚨"), 2000);
  setTimeout(() => showToast("AI Assistant Ready",       "Click '🤖 AI Chat' tab to start",          "info",    "🤖"), 3500);
});
