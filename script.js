// ══════════════════════════════════════════════════════════
//  ZONA DE RISCO v4 — script.js
//  Firebase + Leaflet + OSRM + Nominatim — Salvador/Lauro
// ══════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const fbApp = initializeApp({
  apiKey: "AIzaSyCfK_Tx19SqiqkyIGU0v84mWqLEncqYdEs",
  authDomain: "studyapp-5e70d.firebaseapp.com",
  projectId: "studyapp-5e70d",
  storageBucket: "studyapp-5e70d.firebasestorage.app",
  messagingSenderId: "548719143251",
  appId: "1:548719143251:web:d6c1d738996636289559a6"
});
const db   = getFirestore(fbApp);
const auth = getAuth(fbApp);

// ── State ─────────────────────────────────────────────────
let map, userMarker, routeLayerFast, routeLayerSafe;
let userLat = -12.9714, userLng = -38.5014;
let allIncidents = [];
let selectedCrimeType = "";
let selectedSeverity  = 3;
let reportLat = null, reportLng = null;
let reportMarker = null;
let isPickingLocation = false;
let activeRouteType   = "fast";
let navActive = false;
let dangerAlerted = false;
let deferredInstall = null;
let incidentLayers, riskLayers;
let fastCoords = [], safeCoords = [];
let fastMeta = null, safeMeta = null;
let initDone = false;
let locationTracking = false;
const LOCAL_KEY = "zonarisco-local-v4";
let targetPos = null;
let smoothPos = null;
let targetHeading = 0;
let smoothHeading = 0;
let lastFixTime = 0;
let speedKmh = 0;
let lastFollowAt = 0;
let lastAlertAt = 0;

// ── Zonas de risco (dados fornecidos) ─────────────────────
const RISK_DATA = {
  metadata: {
    version: "1.0",
    updated: "2026-05-25",
    coverage: ["Salvador", "Lauro de Freitas"],
    model: "community + historical + news + perception",
    note: "Dados estimativos para heatmap e roteamento seguro."
  },
  salvador: [
    {
      name: "Valéria",
      risk: 98,
      severity: "critical",
      coords: { lat: -12.8758, lng: -38.4380 },
      radius: 1800,
      crimeTypes: ["tiroteio", "trafico", "homicidio", "assalto"],
      timeRisk: { day: 72, night: 98, dawn: 99 }
    },
    {
      name: "Planeta dos Macacos",
      region: "São Cristóvão / Cassange",
      risk: 97,
      severity: "critical",
      coords: { lat: -12.9105, lng: -38.3568 },
      radius: 850,
      crimeTypes: ["trafico", "tiroteio", "assalto"],
      timeRisk: { day: 65, night: 97, dawn: 96 }
    },
    {
      name: "Nordeste de Amaralina",
      risk: 96,
      severity: "critical",
      coords: { lat: -13.0007, lng: -38.4713 },
      radius: 1500,
      crimeTypes: ["tiroteio", "trafico", "assalto"],
      timeRisk: { day: 70, night: 96, dawn: 98 }
    },
    {
      name: "Tancredo Neves",
      risk: 95,
      severity: "critical",
      coords: { lat: -12.9480, lng: -38.4575 },
      radius: 1400,
      crimeTypes: ["assalto", "homicidio", "tiroteio"],
      timeRisk: { day: 68, night: 95, dawn: 97 }
    },
    {
      name: "Fazenda Coutos",
      risk: 94,
      severity: "critical",
      coords: { lat: -12.8589, lng: -38.4850 },
      radius: 1600,
      crimeTypes: ["trafico", "tiroteio", "assalto"],
      timeRisk: { day: 66, night: 94, dawn: 96 }
    },
    {
      name: "Mussurunga",
      risk: 90,
      severity: "high",
      coords: { lat: -12.9168, lng: -38.3648 },
      radius: 1700,
      crimeTypes: ["assalto", "rouboMoto", "tiroteio"],
      timeRisk: { day: 60, night: 90, dawn: 93 }
    },
    {
      name: "Bairro da Paz",
      risk: 91,
      severity: "high",
      coords: { lat: -12.9468, lng: -38.3741 },
      radius: 1400,
      crimeTypes: ["trafico", "assalto", "homicidio"],
      timeRisk: { day: 64, night: 91, dawn: 94 }
    },
    {
      name: "São Cristóvão",
      risk: 88,
      severity: "high",
      coords: { lat: -12.9170, lng: -38.3554 },
      radius: 1600,
      crimeTypes: ["assalto", "rouboMoto", "trafico"],
      timeRisk: { day: 58, night: 88, dawn: 91 }
    },
    {
      name: "Cassange",
      risk: 87,
      severity: "high",
      coords: { lat: -12.9037, lng: -38.3610 },
      radius: 1400,
      crimeTypes: ["assalto", "trafico", "tiroteio"],
      timeRisk: { day: 57, night: 87, dawn: 90 }
    },
    {
      name: "Bosque das Bromélias",
      risk: 89,
      severity: "high",
      coords: { lat: -12.8998, lng: -38.3488 },
      radius: 1200,
      crimeTypes: ["trafico", "assalto", "rouboMoto"],
      timeRisk: { day: 56, night: 89, dawn: 92 }
    },
    {
      name: "Calabetão",
      risk: 92,
      severity: "critical",
      coords: { lat: -12.9509, lng: -38.4588 },
      radius: 1100,
      crimeTypes: ["tiroteio", "trafico", "assalto"],
      timeRisk: { day: 65, night: 92, dawn: 95 }
    },
    {
      name: "Arenoso",
      risk: 90,
      severity: "high",
      coords: { lat: -12.9535, lng: -38.4540 },
      radius: 1200,
      crimeTypes: ["assalto", "trafico", "homicidio"],
      timeRisk: { day: 63, night: 90, dawn: 94 }
    },
    {
      name: "Mata Escura",
      risk: 89,
      severity: "high",
      coords: { lat: -12.9440, lng: -38.4635 },
      radius: 1500,
      crimeTypes: ["trafico", "assalto", "tiroteio"],
      timeRisk: { day: 60, night: 89, dawn: 92 }
    },
    {
      name: "Sussuarana",
      risk: 87,
      severity: "high",
      coords: { lat: -12.9392, lng: -38.4379 },
      radius: 1800,
      crimeTypes: ["assalto", "rouboMoto", "trafico"],
      timeRisk: { day: 57, night: 87, dawn: 90 }
    },
    {
      name: "Lobato",
      risk: 91,
      severity: "critical",
      coords: { lat: -12.8875, lng: -38.4800 },
      radius: 1300,
      crimeTypes: ["tiroteio", "trafico", "assalto"],
      timeRisk: { day: 66, night: 91, dawn: 95 }
    },
    {
      name: "Paripe",
      risk: 84,
      severity: "high",
      coords: { lat: -12.8225, lng: -38.4765 },
      radius: 2200,
      crimeTypes: ["assalto", "rouboMoto", "trafico"],
      timeRisk: { day: 54, night: 84, dawn: 88 }
    },
    {
      name: "Periperi",
      risk: 83,
      severity: "high",
      coords: { lat: -12.8321, lng: -38.4808 },
      radius: 1900,
      crimeTypes: ["assalto", "trafico", "furto"],
      timeRisk: { day: 50, night: 83, dawn: 87 }
    },
    {
      name: "Plataforma",
      risk: 85,
      severity: "high",
      coords: { lat: -12.8914, lng: -38.4840 },
      radius: 1500,
      crimeTypes: ["assalto", "trafico", "tiroteio"],
      timeRisk: { day: 58, night: 85, dawn: 89 }
    },
    {
      name: "Liberdade",
      risk: 80,
      severity: "high",
      coords: { lat: -12.9395, lng: -38.4890 },
      radius: 1800,
      crimeTypes: ["assalto", "furto", "trafico"],
      timeRisk: { day: 52, night: 80, dawn: 84 }
    },
    {
      name: "Massaranduba",
      risk: 82,
      severity: "high",
      coords: { lat: -12.9220, lng: -38.4904 },
      radius: 1200,
      crimeTypes: ["assalto", "trafico", "homicidio"],
      timeRisk: { day: 54, night: 82, dawn: 87 }
    },
    {
      name: "Baixa de Quintas",
      risk: 78,
      severity: "medium-high",
      coords: { lat: -12.9475, lng: -38.4960 },
      radius: 1300,
      crimeTypes: ["assalto", "furto", "rouboMoto"],
      timeRisk: { day: 50, night: 78, dawn: 82 }
    },
    {
      name: "Cosme de Farias",
      risk: 76,
      severity: "medium-high",
      coords: { lat: -12.9914, lng: -38.4978 },
      radius: 1300,
      crimeTypes: ["assalto", "trafico", "rouboMoto"],
      timeRisk: { day: 48, night: 76, dawn: 80 }
    },
    {
      name: "Calabar",
      risk: 74,
      severity: "medium-high",
      coords: { lat: -13.0001, lng: -38.5174 },
      radius: 900,
      crimeTypes: ["trafico", "assalto"],
      timeRisk: { day: 45, night: 74, dawn: 79 }
    },
    {
      name: "Alto das Pombas",
      risk: 73,
      severity: "medium-high",
      coords: { lat: -13.0015, lng: -38.5012 },
      radius: 850,
      crimeTypes: ["assalto", "trafico"],
      timeRisk: { day: 44, night: 73, dawn: 78 }
    },
    {
      name: "Engenho Velho da Federação",
      risk: 84,
      severity: "high",
      coords: { lat: -13.0000, lng: -38.5038 },
      radius: 1200,
      crimeTypes: ["trafico", "assalto", "tiroteio"],
      timeRisk: { day: 55, night: 84, dawn: 89 }
    },
    {
      name: "Santa Cruz",
      risk: 75,
      severity: "medium-high",
      coords: { lat: -12.9934, lng: -38.4700 },
      radius: 1000,
      crimeTypes: ["assalto", "furto"],
      timeRisk: { day: 46, night: 75, dawn: 80 }
    },
    {
      name: "Águas Claras",
      risk: 86,
      severity: "high",
      coords: { lat: -12.8918, lng: -38.4334 },
      radius: 1600,
      crimeTypes: ["assalto", "trafico", "rouboMoto"],
      timeRisk: { day: 57, night: 86, dawn: 91 }
    },
    {
      name: "Cajazeiras XI",
      risk: 81,
      severity: "high",
      coords: { lat: -12.8860, lng: -38.4130 },
      radius: 1400,
      crimeTypes: ["assalto", "furto", "trafico"],
      timeRisk: { day: 53, night: 81, dawn: 86 }
    },
    {
      name: "Stella Maris",
      risk: 48,
      severity: "medium",
      coords: { lat: -12.9386, lng: -38.3315 },
      radius: 1800,
      crimeTypes: ["furto", "assalto", "rouboMoto", "arrastao"],
      timeRisk: { day: 34, night: 48, dawn: 58 },
      alerts: [
        "Furtos próximos à orla",
        "Assaltos esporádicos em vias menos movimentadas",
        "Aumento de risco durante madrugada"
      ]
    },
    {
      name: "Praia do Flamengo",
      risk: 52,
      severity: "medium",
      coords: { lat: -12.9494, lng: -38.3127 },
      radius: 2200,
      crimeTypes: ["furto", "assalto", "rouboVeiculo"],
      timeRisk: { day: 38, night: 52, dawn: 61 }
    },
    {
      name: "Paralela",
      risk: 67,
      severity: "medium-high",
      coords: { lat: -12.9388, lng: -38.4142 },
      radius: 5000,
      crimeTypes: ["rouboVeiculo", "assalto", "rouboMoto"],
      timeRisk: { day: 52, night: 67, dawn: 79 },
      alerts: [
        "Roubo de veículos em horários de baixo fluxo",
        "Trechos críticos próximos a acessos"
      ]
    },
    {
      name: "Imbuí",
      risk: 61,
      severity: "medium-high",
      coords: { lat: -12.9770, lng: -38.4352 },
      radius: 1700,
      crimeTypes: ["assalto", "furto", "rouboMoto"],
      timeRisk: { day: 48, night: 61, dawn: 72 }
    }
  ],
  lauroDeFreitas: [
    {
      name: "Itinga",
      risk: 94,
      severity: "critical",
      coords: { lat: -12.8715, lng: -38.3524 },
      radius: 1600,
      crimeTypes: ["assalto", "homicidio", "rouboMoto", "tiroteio"],
      timeRisk: { day: 70, night: 94, dawn: 97 }
    },
    {
      name: "Vida Nova",
      risk: 81,
      severity: "high",
      coords: { lat: -12.8595, lng: -38.3345 },
      radius: 1000,
      crimeTypes: ["assalto", "trafico", "rouboMoto"],
      timeRisk: { day: 52, night: 81, dawn: 85 }
    },
    {
      name: "Caji",
      risk: 76,
      severity: "high",
      coords: { lat: -12.8430, lng: -38.3274 },
      radius: 1200,
      crimeTypes: ["assalto", "trafico"],
      timeRisk: { day: 48, night: 76, dawn: 81 }
    },
    {
      name: "Vila Praiana",
      risk: 88,
      severity: "high",
      coords: { lat: -12.8762, lng: -38.3210 },
      radius: 900,
      crimeTypes: ["trafico", "assalto", "rouboMoto"],
      timeRisk: { day: 60, night: 88, dawn: 91 }
    },
    {
      name: "Portão",
      risk: 79,
      severity: "high",
      coords: { lat: -12.8220, lng: -38.3370 },
      radius: 1500,
      crimeTypes: ["assalto", "trafico", "rouboMoto"],
      timeRisk: { day: 50, night: 79, dawn: 84 }
    },
    {
      name: "Areia Branca",
      risk: 74,
      severity: "medium-high",
      coords: { lat: -12.8412, lng: -38.3124 },
      radius: 1200,
      crimeTypes: ["assalto", "rouboMoto"],
      timeRisk: { day: 45, night: 74, dawn: 79 }
    },
    {
      name: "Jambeiro",
      risk: 69,
      severity: "medium-high",
      coords: { lat: -12.8380, lng: -38.2980 },
      radius: 1000,
      crimeTypes: ["furto", "assalto"],
      timeRisk: { day: 40, night: 69, dawn: 75 }
    },
    {
      name: "Parque São Paulo",
      risk: 72,
      severity: "medium-high",
      coords: { lat: -12.8488, lng: -38.3318 },
      radius: 1000,
      crimeTypes: ["assalto", "furto"],
      timeRisk: { day: 42, night: 72, dawn: 78 }
    },
    {
      name: "Caixa D’Água",
      risk: 77,
      severity: "high",
      coords: { lat: -12.8600, lng: -38.3412 },
      radius: 900,
      crimeTypes: ["assalto", "trafico"],
      timeRisk: { day: 48, night: 77, dawn: 82 }
    },
    {
      name: "Jardim Ipitanga",
      risk: 71,
      severity: "medium-high",
      coords: { lat: -12.8877, lng: -38.3204 },
      radius: 1300,
      crimeTypes: ["assalto", "furto", "rouboMoto"],
      timeRisk: { day: 43, night: 71, dawn: 76 }
    },
    {
      name: "Ipitanga",
      risk: 58,
      severity: "medium",
      coords: { lat: -12.8930, lng: -38.3064 },
      radius: 1700,
      crimeTypes: ["assalto", "furto", "rouboMoto"],
      timeRisk: { day: 42, night: 58, dawn: 67 },
      alerts: [
        "Furtos em áreas de praia",
        "Assaltos isolados em vias secundárias"
      ]
    },
    {
      name: "Vilas do Atlântico",
      risk: 38,
      severity: "low-medium",
      coords: { lat: -12.8784, lng: -38.2972 },
      radius: 2400,
      crimeTypes: ["furto", "assalto", "rouboVeiculo"],
      timeRisk: { day: 27, night: 38, dawn: 49 },
      alerts: [
        "Furtos ocasionais",
        "Aumento de risco em vias desertas na madrugada"
      ]
    },
    {
      name: "Buraquinho",
      risk: 42,
      severity: "medium-low",
      coords: { lat: -12.8720, lng: -38.2920 },
      radius: 1800,
      crimeTypes: ["furto", "assalto", "rouboMoto"],
      timeRisk: { day: 30, night: 42, dawn: 54 }
    },
    {
      name: "Busca Vida",
      risk: 26,
      severity: "low",
      coords: { lat: -12.8190, lng: -38.2760 },
      radius: 2600,
      crimeTypes: ["furto", "rouboVeiculo"],
      timeRisk: { day: 16, night: 26, dawn: 33 }
    },
    {
      name: "Centro de Lauro de Freitas",
      risk: 63,
      severity: "medium-high",
      coords: { lat: -12.8946, lng: -38.3213 },
      radius: 1600,
      crimeTypes: ["assalto", "furto", "rouboMoto"],
      timeRisk: { day: 50, night: 63, dawn: 71 }
    },
    {
      name: "Pitangueiras",
      risk: 55,
      severity: "medium",
      coords: { lat: -12.8881, lng: -38.3145 },
      radius: 1400,
      crimeTypes: ["assalto", "furto", "rouboMoto"],
      timeRisk: { day: 41, night: 55, dawn: 63 }
    }
  ]
};

const REAL_ZONES = [
  ...RISK_DATA.salvador.map(z => ({ ...z, city: "Salvador" })),
  ...RISK_DATA.lauroDeFreitas.map(z => ({ ...z, city: "Lauro de Freitas" }))
].map(z => ({
  ...z,
  riskValue: (z.risk || 0) / 100,
  fullName: `${z.name} — ${z.city}`
}));

// ══════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════
window.addEventListener("DOMContentLoaded", () => {
  registerSW();
  setupInstallBanner();

  const splash = document.getElementById("splash-status");

  if (navigator.geolocation) {
    const timer = setTimeout(() => finishInit(), 5000);
    navigator.geolocation.getCurrentPosition(
      pos => {
        clearTimeout(timer);
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        if (splash) splash.textContent = "Localização encontrada!";
        finishInit();
      },
      () => {
        clearTimeout(timer);
        if (splash) splash.textContent = "Usando localização padrão...";
        finishInit();
      },
      { timeout: 5000, enableHighAccuracy: true }
    );
  } else {
    finishInit();
  }
});

function finishInit() {
  if (initDone) return;
  initDone = true;

  initMap();
  initAuth();
  loadFirestoreData();
  startWatchPosition();
  setupBottomSheet();
  setupSearchBar();
  setupReportModal();
  setupDangerToast();
  setupRoutePanel();
  setupFABs();
  setupNavControls();
  startSmoothTracking();

  setTimeout(() => {
    const splash = document.getElementById("splash");
    if (splash) splash.classList.add("gone");
  }, 700);
}

// ══════════════════════════════════════════════════════════
//  MAP
// ══════════════════════════════════════════════════════════
function initMap() {
  incidentLayers = L.layerGroup();
  riskLayers     = L.layerGroup();

  map = L.map("map", {
    center: [userLat, userLng],
    zoom: 14,
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
  });

  // Light map tile — Carto Positron
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd", maxZoom: 19,
  }).addTo(map);

  riskLayers.addTo(map);
  incidentLayers.addTo(map);

  placeUserMarker();
  drawRiskZones();

  // Click no mapa para definir local do report
  map.on("click", e => {
    if (!isPickingLocation) return;
    setReportLocation(e.latlng.lat, e.latlng.lng, false);
    isPickingLocation = false;
    openModal();
  });

  map.on("dragstart", () => {
    if (!navActive) {
      locationTracking = false;
      document.getElementById("fab-location").classList.remove("tracking");
    }
  });
}

function placeUserMarker() {
  if (userMarker) userMarker.remove();
  const icon = L.divIcon({
    className: "",
    html: `<div class="user-pin"><div class="user-arrow"></div></div>`,
    iconSize: [18, 18], iconAnchor: [9, 9],
  });
  userMarker = L.marker([userLat, userLng], { icon, zIndexOffset: 1000 }).addTo(map);
}

function startWatchPosition() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      targetPos = { lat: userLat, lng: userLng };
      const now = Date.now();
      if (smoothPos && lastFixTime) {
        const dt = Math.max(1, (now - lastFixTime) / 1000);
        const dist = distKm(smoothPos.lat, smoothPos.lng, userLat, userLng);
        speedKmh = Math.min(140, (dist / dt) * 3600);
        targetHeading = bearingDeg(smoothPos.lat, smoothPos.lng, userLat, userLng);
      }
      lastFixTime = now;
      checkDangerProximity();
      updateNearbyTab();
    },
    null,
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}

// ── Risk Zones ────────────────────────────────────────────
function drawRiskZones() {
  riskLayers.clearLayers();
  REAL_ZONES.forEach(z => {
    const r = calcZoneRisk(z);
    const color = r >= 0.75 ? "#ff2424" : r >= 0.5 ? "#ffc107" : "#00e676";
    const radius = z.radius || (180 + r * 900);

    L.polygon(circleToPolygon(z.coords.lat, z.coords.lng, radius, 18), {
      color,
      fillColor: color,
      fillOpacity: 0.08 + r * 0.2,
      weight: 1.2,
      opacity: r > 0.65 ? 0.6 : 0.3,
      smoothFactor: 1,
    })
      .addTo(riskLayers)
      .bindPopup(`
        <div class="popup-wrap">
          <div class="popup-type">${z.fullName}</div>
          <div class="popup-desc">${(z.alerts || []).join(" · ") || "Área sensível"}</div>
          <div class="popup-footer">
            <span class="popup-time">📍 ${z.region || z.city}</span>
            <span class="popup-badge ${r>=0.7?"badge-high":r>=0.5?"badge-med":"badge-low"}">${z.severity || "risk"}</span>
          </div>
        </div>`, { maxWidth: 240 }
      );
  });
}

// ══════════════════════════════════════════════════════════
//  FIREBASE
// ══════════════════════════════════════════════════════════
function loadFirestoreData() {
  setConnStatus("connecting");
  const q = query(collection(db, "incidents"), orderBy("timestamp", "desc"), limit(80));

  onSnapshot(q,
    snap => {
      const fsData = snap.docs.map(d => ({
        id: d.id, ...d.data(), fromFS: true,
        _ts: d.data().timestamp?.toMillis?.() ?? Date.now(),
      }));
      const localData = getLocalIncidents();
      allIncidents = mergeAndSort([
        ...fsData, ...localData,
      ]);
      setConnStatus("online");
      refreshAll();
    },
    err => {
      console.warn("Firestore:", err.message);
      const localData = getLocalIncidents();
      allIncidents = mergeAndSort([...localData]);
      setConnStatus("offline");
      refreshAll();
    }
  );
}

function mergeAndSort(list) {
  const seen = new Set();
  return list
    .filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; })
    .sort((a, b) => (b._ts || 0) - (a._ts || 0));
}

function setConnStatus(status) {
  const dot   = document.getElementById("conn-dot");
  const label = document.getElementById("conn-label");
  if (!dot || !label) return;
  const map_ = {
    online:     { color: "var(--green)",  text: "Online"    },
    offline:    { color: "var(--yellow)", text: "Offline"   },
    connecting: { color: "var(--yellow)", text: "Conectando"},
  };
  const s = map_[status] || map_.connecting;
  dot.style.background = s.color;
  label.textContent    = s.text;
}

function refreshAll() {
  renderAllMarkers();
  renderFeedTab();
  renderHeatmapTab();
  updateNearbyTab();
  checkDangerProximity();

  const count = document.getElementById("feed-count");
  if (count) count.textContent = `${allIncidents.length} alertas`;
}

// ── Markers ───────────────────────────────────────────────
function renderAllMarkers() {
  incidentLayers.clearLayers();
  allIncidents.forEach(inc => {
    if (inc.lat == null || inc.lng == null) return;
    const lvl = inc.level || inc.dangerLevel || 3;
    const pinClass = lvl >= 4 ? "p-high" : lvl >= 3 ? "p-med" : "p-low";
    const badgeCls  = lvl >= 4 ? "badge-high" : lvl >= 3 ? "badge-med" : "badge-low";
    const badgeText = lvl >= 4 ? "ALTO" : lvl >= 3 ? "MED" : "BAIXO";
    const emoji = inc.emoji || "⚠️";
    const label = inc.label || inc.type;
    const timeStr = inc.time || getTimeAgo(inc.timestamp || inc._ts);

    const icon = L.divIcon({
      className: "",
      html: `<div class="inc-pin ${pinClass}"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    });

    L.marker([inc.lat, inc.lng], { icon })
      .addTo(incidentLayers)
      .bindPopup(`
        <div class="popup-wrap">
          <div class="popup-emoji">${emoji}</div>
          <div class="popup-type">${label}</div>
          <div class="popup-desc">${inc.desc || inc.description || "Sem descrição."}</div>
          <div class="popup-footer">
            <span class="popup-time">🕐 ${timeStr}</span>
            <span class="popup-badge ${badgeCls}">${badgeText}</span>
          </div>
        </div>`, { maxWidth: 240 }
      )
      .on("click", () => showIncidentDetail(inc));
  });
}

// ── Incident Detail ───────────────────────────────────────
function showIncidentDetail(inc) {
  const detail = document.getElementById("incident-detail");
  const body   = document.getElementById("id-body");
  const lvl = inc.level || inc.dangerLevel || 3;
  const riskPct = Math.round((lvl / 5) * 100);
  const badgeCls  = lvl >= 4 ? "badge-high" : lvl >= 3 ? "badge-med" : "badge-low";
  const badgeText = lvl >= 4 ? "ALTO RISCO" : lvl >= 3 ? "MÉDIO" : "BAIXO";
  const dist = inc.lat ? distKm(userLat, userLng, inc.lat, inc.lng) : null;
  const distStr = dist !== null
    ? (dist < 1 ? Math.round(dist*1000)+"m" : dist.toFixed(1)+"km") + " de você"
    : "";
  const timeStr = inc.time || getTimeAgo(inc.timestamp || inc._ts);

  body.innerHTML = `
    <div class="idb-emoji">${inc.emoji || "⚠️"}</div>
    <div class="idb-type">${inc.label || inc.type}</div>
    <div class="idb-desc">${inc.desc || inc.description || "Sem descrição."}</div>
    <div class="idb-meta">
      <span class="idb-tag">🕐 ${timeStr}</span>
      ${distStr ? `<span class="idb-tag">📍 ${distStr}</span>` : ""}
      ${inc.bairro ? `<span class="idb-tag">🏘️ ${inc.bairro}</span>` : ""}
      <span class="idb-tag ${badgeCls}" style="border-radius:4px">${badgeText}</span>
    </div>
    <div class="idb-risk">
      <div class="idb-risk-label">
        <span>Nível de risco</span>
        <span style="color:var(--red);font-weight:700">${riskPct}%</span>
      </div>
      <div class="idb-risk-bar-wrap">
        <div class="idb-risk-fill" style="width:${riskPct}%"></div>
      </div>
    </div>
    ${inc.lat ? `<button class="idb-btn-route" id="idb-route-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M3 17h14M3 12h18M3 7h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      TRAÇAR ROTA SEGURA
    </button>` : ""}
  `;

  detail.classList.remove("hidden");

  if (inc.lat) {
    map.flyTo([inc.lat, inc.lng], 16, { duration: 0.9 });
    const btn = document.getElementById("idb-route-btn");
    if (btn) btn.addEventListener("click", () => {
      detail.classList.add("hidden");
      showToast("Digite o destino para calcular a rota", "success");
      document.getElementById("search-input").focus();
    });
  }
}

// ══════════════════════════════════════════════════════════
//  TABS
// ══════════════════════════════════════════════════════════

// ── Feed Tab ──────────────────────────────────────────────
function renderFeedTab() {
  const feed = document.getElementById("incidents-feed");
  if (!allIncidents.length) {
    feed.innerHTML = `<div class="feed-loading"><div class="spinner"></div><span>Aguardando dados...</span></div>`;
    return;
  }

  feed.innerHTML = allIncidents.map(inc => {
    const lvl = inc.level || inc.dangerLevel || 3;
    const cardCls  = lvl >= 4 ? "" : lvl >= 3 ? "warn" : "safe";
    const badgeCls = lvl >= 4 ? "badge-high" : lvl >= 3 ? "badge-med" : "badge-low";
    const badgeText = lvl >= 4 ? "ALTO" : lvl >= 3 ? "MED" : "BAIXO";
    const dist = inc.lat ? distKm(userLat, userLng, inc.lat, inc.lng) : null;
    const distStr = dist !== null
      ? (dist < 1 ? Math.round(dist*1000)+"m" : dist.toFixed(1)+"km")
      : "";
    const timeStr = inc.time || getTimeAgo(inc.timestamp || inc._ts);
    return `
      <div class="inc-card ${cardCls}" data-id="${inc.id}">
        <div class="inc-card-emoji">${inc.emoji || "⚠️"}</div>
        <div class="inc-card-info">
          <div class="inc-card-type">
            ${inc.label || inc.type}
            <span class="inc-card-badge ${badgeCls}">${badgeText}</span>
          </div>
          <div class="inc-card-meta">${[inc.bairro, distStr, timeStr].filter(Boolean).join(" · ")}</div>
        </div>
      </div>`;
  }).join("");

  feed.querySelectorAll(".inc-card").forEach(card => {
    card.addEventListener("click", () => {
      const inc = allIncidents.find(i => i.id === card.dataset.id);
      if (inc) showIncidentDetail(inc);
    });
  });
}

// ── Heatmap Tab ───────────────────────────────────────────
function renderHeatmapTab() {
  const grid  = document.getElementById("risk-grid");
  const hour  = new Date().getHours();
  const nightBonus = (hour >= 20 || hour <= 6) ? 10 : 0;

  // Overall risk
  const avgRisk = Math.min(95,
    Math.round(REAL_ZONES.reduce((a, z) => a + calcZoneRisk(z), 0) / REAL_ZONES.length * 100) + nightBonus
  );
  const bar = document.getElementById("overall-risk-bar");
  if (bar) setTimeout(() => bar.style.width = avgRisk + "%", 100);

  const detail = document.getElementById("rrc-detail");
  if (detail) detail.textContent =
    `${allIncidents.length} ocorrências nas últimas 24h em Salvador e Lauro de Freitas. ` +
    (nightBonus > 0
      ? "⚠️ Período noturno — risco elevado."
      : "Período diurno. Atenção nas zonas vermelhas.");

  // Grid — zonas mais perigosas
  const sorted = [...REAL_ZONES]
    .sort((a, b) => calcZoneRisk(b) - calcZoneRisk(a))
    .slice(0, 10);

  grid.innerHTML = sorted.map(z => {
    const pct = Math.min(98, Math.round(calcZoneRisk(z) * 100) + nightBonus);
    const color = pct >= 75 ? "#ff2424" : pct >= 50 ? "#ffc107" : "#00e676";
    return `
      <div class="rog-card" data-lat="${z.coords.lat}" data-lng="${z.coords.lng}">
        <div class="rog-name">${z.name}</div>
        <div class="rog-region">${z.region || z.city}</div>
        <div class="rog-bar" style="width:${pct}%;background:${color}"></div>
        <div class="rog-pct" style="color:${color}">${pct}%</div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".rog-card").forEach(card => {
    card.addEventListener("click", () => {
      const lat = parseFloat(card.dataset.lat);
      const lng = parseFloat(card.dataset.lng);
      map.flyTo([lat, lng], 15, { duration: 1.1 });
      peekSheet();
    });
  });
}

// ── Nearby Tab ────────────────────────────────────────────
function updateNearbyTab() {
  const list = document.getElementById("nearby-list");
  const nearby = allIncidents
    .filter(i => i.lat && distKm(userLat, userLng, i.lat, i.lng) <= 1.5)
    .sort((a, b) =>
      distKm(userLat, userLng, a.lat, a.lng) - distKm(userLat, userLng, b.lat, b.lng)
    );

  if (!nearby.length) {
    list.innerHTML = `
      <div class="feed-loading" style="padding:28px 0">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="opacity:.25">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 8v5M12 16v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>Nenhuma ocorrência em 1,5 km</span>
      </div>`;
    return;
  }

  list.innerHTML = nearby.map(inc => {
    const lvl = inc.level || inc.dangerLevel || 3;
    const cardCls = lvl >= 4 ? "" : lvl >= 3 ? "warn" : "safe";
    const dist    = distKm(userLat, userLng, inc.lat, inc.lng);
    const distStr = dist < 1 ? Math.round(dist*1000)+"m" : dist.toFixed(1)+"km";
    const timeStr = inc.time || getTimeAgo(inc.timestamp || inc._ts);
    return `
      <div class="inc-card ${cardCls}" data-id="${inc.id}">
        <div class="inc-card-emoji">${inc.emoji || "⚠️"}</div>
        <div class="inc-card-info">
          <div class="inc-card-type">
            ${inc.label || inc.type}
            <span class="inc-card-badge badge-high">${distStr}</span>
          </div>
          <div class="inc-card-meta">${[inc.bairro, timeStr].filter(Boolean).join(" · ")}</div>
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll(".inc-card").forEach(card => {
    card.addEventListener("click", () => {
      const inc = allIncidents.find(i => i.id === card.dataset.id);
      if (inc) showIncidentDetail(inc);
    });
  });
}

// ══════════════════════════════════════════════════════════
//  SEARCH + NOMINATIM
// ══════════════════════════════════════════════════════════
function setupSearchBar() {
  const input    = document.getElementById("search-input");
  const list     = document.getElementById("autocomplete-list");
  const btnClear = document.getElementById("sb-clear");
  let timer;

  input.addEventListener("input", () => {
    const val = input.value.trim();
    btnClear.classList.toggle("hidden", !val);
    clearTimeout(timer);
    if (val.length < 3) { list.classList.add("hidden"); return; }
    timer = setTimeout(() => geocodeSearch(val, list), 420);
  });

  // Enter key → busca
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && input.value.trim()) {
      clearTimeout(timer);
      geocodeSearch(input.value.trim(), list);
    }
  });

  btnClear.addEventListener("click", () => {
    input.value = "";
    btnClear.classList.add("hidden");
    list.classList.add("hidden");
    clearRoutes();
    document.getElementById("route-panel").classList.add("hidden");
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".topbar")) list.classList.add("hidden");
  });
}

async function geocodeSearch(q, listEl) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", Salvador, Bahia, Brasil")}&format=json&limit=5&addressdetails=1`;
    const res  = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
    const data = await res.json();
    if (!data?.length) {
      showAutocomplete(buildLocalSuggestions(q), listEl, true);
      return;
    }
    showAutocomplete(data, listEl);
  } catch (e) {
    console.warn("Geocoding:", e);
    showAutocomplete(buildLocalSuggestions(q), listEl, true);
  }
}

function showAutocomplete(results, listEl, isLocal = false) {
  if (!results.length) { listEl.classList.add("hidden"); return; }
  listEl.innerHTML = results.map(r => {
    const main = isLocal
      ? r.name
      : r.address?.road || r.address?.suburb || r.name || r.display_name.split(",")[0];
    const sub  = isLocal
      ? `${r.city}${r.region ? " · " + r.region : ""}`
      : [r.address?.suburb, r.address?.city_district, r.address?.city].filter(Boolean).join(", ");
    const lat = isLocal ? r.coords.lat : r.lat;
    const lng = isLocal ? r.coords.lng : r.lon;
    return `
      <div class="ac-item" data-lat="${lat}" data-lng="${lng}" data-name="${main}">
        <svg class="ac-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="1.8"/>
        </svg>
        <div>
          <div class="ac-main">${main}</div>
          ${sub ? `<div class="ac-sub">${sub}</div>` : ""}
        </div>
      </div>`;
  }).join("");
  listEl.classList.remove("hidden");

  listEl.querySelectorAll(".ac-item").forEach(el => {
    el.addEventListener("click", () => {
      const lat  = parseFloat(el.dataset.lat);
      const lng  = parseFloat(el.dataset.lng);
      const name = el.dataset.name;
      document.getElementById("search-input").value = name;
      document.getElementById("sb-clear").classList.remove("hidden");
      listEl.classList.add("hidden");
      calcRoute(lat, lng, name);
    });
  });
}

function buildLocalSuggestions(query) {
  const q = query.toLowerCase();
  return REAL_ZONES
    .filter(z => z.name.toLowerCase().includes(q) || z.city.toLowerCase().includes(q))
    .slice(0, 6);
}

// ══════════════════════════════════════════════════════════
//  ROUTING — OSRM
// ══════════════════════════════════════════════════════════
async function calcRoute(destLat, destLng, destName = "Destino") {
  clearRoutes();
  const panel = document.getElementById("route-panel");
  panel.classList.remove("hidden");
  document.getElementById("rp-dest").textContent = destName;
  document.getElementById("rp-meta").textContent  = "Calculando rotas...";
  document.getElementById("rp-fast-time").textContent = "—";
  document.getElementById("rp-safe-time").textContent = "—";
  document.getElementById("rp-risk-bar").style.width  = "0%";
  document.getElementById("rp-risk-pct").textContent  = "--%";

  // ── Rota rápida ──
  try {
    const r = await osrmRoute([userLng, userLat], [destLng, destLat]);
    if (r) {
      fastCoords = r.geometry.coordinates.map(c => [c[1], c[0]]);
      const mins = Math.round(r.duration / 60);
      const km   = (r.distance / 1000).toFixed(1);
      document.getElementById("rp-fast-time").textContent = `${mins} min`;
      document.getElementById("rp-meta").textContent = `${km} km • ${mins} min`;

      routeLayerFast = L.polyline(fastCoords, {
        color: "#2b7bff", weight: 6, opacity: 0.95,
      }).addTo(map);

      fastMeta = buildRouteMeta(fastCoords, r.distance, r.duration);

      const risk = calcRouteRisk(fastCoords);
      animateRiskBar(risk);
      map.fitBounds(routeLayerFast.getBounds(), { padding: [80, 80] });
    }
  } catch (e) { console.warn("OSRM fast:", e); showToast("Erro ao calcular rota", "error"); }

  // ── Rota segura (waypoint alternativo) ──
  try {
    const { midLat, midLng } = computeSafeWaypoint(destLat, destLng);
    const r = await osrmRoute([userLng, userLat], [midLng, midLat], [destLng, destLat]);
    if (r) {
      safeCoords = r.geometry.coordinates.map(c => [c[1], c[0]]);
      const mins = Math.round(r.duration / 60) + 4;
      document.getElementById("rp-safe-time").textContent = `${mins} min`;
      routeLayerSafe = L.polyline(safeCoords, {
        color: "#00c853", weight: 6, opacity: 0, dashArray: "8,6",
      }).addTo(map);

      safeMeta = buildRouteMeta(safeCoords, r.distance, r.duration);

      const riskFast = calcRouteRisk(fastCoords);
      const riskSafe = calcRouteRisk(safeCoords);
      if (riskFast > 0.6 && riskSafe < riskFast) {
        activeRouteType = "safe";
        document.getElementById("rp-safe").classList.add("active");
        document.getElementById("rp-fast").classList.remove("active");
        if (routeLayerFast) routeLayerFast.setStyle({ opacity: 0.3 });
        if (routeLayerSafe) routeLayerSafe.setStyle({ opacity: 0.9 });
        animateRiskBar(riskSafe);
        showToast("Rota recalculada por risco", "success");
      }
    }
  } catch (e) { console.warn("OSRM safe:", e); }

  peekSheet();
}

function animateRiskBar(risk) {
  const pct = Math.round(risk * 100);
  const bar = document.getElementById("rp-risk-bar");
  const lbl = document.getElementById("rp-risk-pct");
  bar.style.width = pct + "%";
  lbl.textContent = pct + "%";
  lbl.style.color = pct >= 65 ? "var(--red)" : pct >= 40 ? "var(--yellow)" : "var(--green)";
}

async function osrmRoute(...waypoints) {
  const coords = waypoints.map(w => w.join(",")).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res  = await fetch(url);
  const data = await res.json();
  return data.routes?.[0] || null;
}

function calcRouteRisk(coords) {
  if (!coords.length) return 0;
  const step = Math.max(1, Math.floor(coords.length / 24));
  let total = 0, count = 0;
  for (let i = 0; i < coords.length; i += step) {
    const [lat, lng] = coords[i];
    let pt = 0;
    REAL_ZONES.forEach(z => {
      const d = distKm(lat, lng, z.lat, z.lng);
      if (d < 0.9) pt = Math.max(pt, z.risk * (1 - d / 0.9));
    });
    total += pt; count++;
  }
  return Math.min(0.95, count ? total / count : 0);
}

function clearRoutes() {
  if (routeLayerFast) { routeLayerFast.remove(); routeLayerFast = null; }
  if (routeLayerSafe) { routeLayerSafe.remove(); routeLayerSafe = null; }
  fastCoords = []; safeCoords = [];
  fastMeta = null; safeMeta = null;
}

// ══════════════════════════════════════════════════════════
//  ROUTE PANEL
// ══════════════════════════════════════════════════════════
function setupRoutePanel() {
  document.getElementById("rp-fast").addEventListener("click", () => {
    document.getElementById("rp-fast").classList.add("active");
    document.getElementById("rp-safe").classList.remove("active");
    activeRouteType = "fast";
    if (routeLayerFast) routeLayerFast.setStyle({ opacity: 0.9 });
    if (routeLayerSafe) routeLayerSafe.setStyle({ opacity: 0 });
    animateRiskBar(calcRouteRisk(fastCoords));
  });

  document.getElementById("rp-safe").addEventListener("click", () => {
    document.getElementById("rp-safe").classList.add("active");
    document.getElementById("rp-fast").classList.remove("active");
    activeRouteType = "safe";
    if (routeLayerFast) routeLayerFast.setStyle({ opacity: 0.3 });
    if (routeLayerSafe) routeLayerSafe.setStyle({ opacity: 0.9 });
    animateRiskBar(calcRouteRisk(safeCoords));
  });

  document.getElementById("rp-close").addEventListener("click", () => {
    navActive = false;
    locationTracking = false;
    setNavMode(false);
    updateNavButton();
    document.getElementById("route-panel").classList.add("hidden");
    document.getElementById("search-input").value = "";
    document.getElementById("sb-clear").classList.add("hidden");
    clearRoutes();
    // Reset tab btns
    document.getElementById("rp-fast").classList.add("active");
    document.getElementById("rp-safe").classList.remove("active");
  });

  document.getElementById("rp-start").addEventListener("click", () => {
    const activeCoords = activeRouteType === "safe" ? safeCoords : fastCoords;
    if (!activeCoords.length) { showToast("Busque um destino primeiro", "error"); return; }
    navActive = !navActive;
    locationTracking = navActive;
    document.getElementById("fab-location").classList.toggle("tracking", navActive);
    updateNavButton();
    setNavMode(navActive);
    showToast(navActive ? "Navegação iniciada" : "Navegação encerrada", "success");
  });
}

function setupNavControls() {
  const recenter = document.getElementById("nav-recenter");
  const endBtn = document.getElementById("nav-end");
  if (recenter) {
    recenter.addEventListener("click", () => {
      locationTracking = true;
      followUser(userLat, userLng);
    });
  }
  if (endBtn) {
    endBtn.addEventListener("click", () => {
      navActive = false;
      locationTracking = false;
      updateNavButton();
      setNavMode(false);
      showToast("Navegação encerrada", "success");
    });
  }
}

function setNavMode(active) {
  const body = document.body;
  const hud = document.getElementById("nav-hud");
  const controls = document.getElementById("nav-controls");
  if (active) {
    body.classList.add("nav-active");
    hud?.classList.remove("hidden");
    controls?.classList.remove("hidden");
  } else {
    body.classList.remove("nav-active");
    hud?.classList.add("hidden");
    controls?.classList.add("hidden");
    document.getElementById("nav-alert").textContent = "Sem alertas";
    document.getElementById("fab-location").classList.remove("tracking");
    map?.dragging?.enable();
  }
}

function updateNavButton() {
  const btn = document.getElementById("rp-start");
  if (!btn) return;
  btn.innerHTML = navActive
    ? "ENCERRAR NAVEGAÇÃO"
    : `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <polygon points="5,3 19,12 5,21" fill="currentColor"/>
      </svg>
      INICIAR NAVEGAÇÃO
    `;
}

// ══════════════════════════════════════════════════════════
//  DANGER TOAST
// ══════════════════════════════════════════════════════════
function setupDangerToast() {
  document.getElementById("dt-close").addEventListener("click", () => {
    document.getElementById("danger-toast").classList.add("hidden");
  });
  document.getElementById("dt-route").addEventListener("click", () => {
    document.getElementById("danger-toast").classList.add("hidden");
    document.getElementById("search-input").focus();
    showToast("Digite um destino para calcular rota segura", "success");
  });
}

function checkDangerProximity() {
  if (dangerAlerted) return;
  const near = REAL_ZONES.find(z =>
    calcZoneRisk(z) >= 0.72 && distKm(userLat, userLng, z.coords.lat, z.coords.lng) < 0.45
  );
  if (!near) return;
  dangerAlerted = true;
  document.getElementById("dt-sub").textContent = `${near.fullName}`;
  document.getElementById("danger-toast").classList.remove("hidden");
  setTimeout(() => { dangerAlerted = false; }, 90000);
}

// ══════════════════════════════════════════════════════════
//  REPORT MODAL
// ══════════════════════════════════════════════════════════
function setupReportModal() {
  document.getElementById("fab-report").addEventListener("click",       openModal);
  document.getElementById("btn-report-mini").addEventListener("click",  openModal);
  document.getElementById("modal-x").addEventListener("click",          closeModal);
  document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });

  document.querySelectorAll(".cg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cg-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedCrimeType = btn.dataset.type;
    });
  });

  document.querySelectorAll(".sev-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sev-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedSeverity = parseInt(btn.dataset.level);
    });
  });

  document.getElementById("loc-pick").addEventListener("click", () => {
    closeModal();
    isPickingLocation = true;
    showToast("Toque no mapa para marcar o local da ocorrência", "success");
  });

  document.getElementById("btn-send").addEventListener("click", sendReport);

  document.getElementById("id-close").addEventListener("click", () => {
    document.getElementById("incident-detail").classList.add("hidden");
  });
}

function openModal() {
  reportLat = reportLat ?? userLat;
  reportLng = reportLng ?? userLng;
  setReportLocation(reportLat, reportLng, false);
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  selectedCrimeType = "";
  selectedSeverity  = 3;
  reportLat = null; reportLng = null;
  isPickingLocation = false;
  document.querySelectorAll(".cg-btn").forEach(b => b.classList.remove("selected"));
  document.querySelectorAll(".sev-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.level == "3");
  });
  const desc = document.getElementById("report-desc");
  if (desc) desc.value = "";
}

function setReportLocation(lat, lng, flyTo) {
  reportLat = lat; reportLng = lng;
  if (flyTo) map.flyTo([lat, lng], 16, { duration: 0.7 });
  if (!reportMarker) {
    const icon = L.divIcon({
      className: "",
      html: `<div class="report-pin"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    });
    reportMarker = L.marker([lat, lng], { icon }).addTo(map);
  } else {
    reportMarker.setLatLng([lat, lng]);
  }
  updateModalLocation();
}

function updateModalLocation() {
  const el = document.getElementById("modal-loc-text");
  if (!el) return;
  const lat = reportLat ?? userLat;
  const lng = reportLng ?? userLng;
  el.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  reverseGeocode(lat, lng).then(name => { if (el && name) el.textContent = name; });
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "pt-BR" } }
    );
    const d = await res.json();
    return [d.address?.road, d.address?.suburb, d.address?.city_district]
      .filter(Boolean).join(", ") || null;
  } catch { return null; }
}

async function sendReport() {
  if (!selectedCrimeType) {
    showToast("Selecione o tipo de ocorrência ☝️", "error");
    return;
  }

  const btn = document.getElementById("btn-send");
  btn.disabled = true;
  btn.textContent = "Enviando...";

  const LABELS = {
    assalto:"🔪 Assalto", arrastaoe:"🏃 Arrastão", tiroteio:"🔫 Tiroteio",
    "roubo-carro":"🚗 Roubo de Carro", suspeitos:"👤 Suspeitos Armados",
    area:"⛔ Área Perigosa", acidente:"🚨 Acidente", outro:"❓ Outro",
  };
  const EMOJIS = {
    assalto:"🔪", arrastaoe:"🏃", tiroteio:"🔫", "roubo-carro":"🚗",
    suspeitos:"👤", area:"⛔", acidente:"🚨", outro:"❓",
  };

  const lat = reportLat ?? userLat;
  const lng = reportLng ?? userLng;
  let bairro = "Salvador, BA";
  try { bairro = (await reverseGeocode(lat, lng)) || bairro; } catch {}

  const inc = {
    type:        selectedCrimeType,
    emoji:       EMOJIS[selectedCrimeType] || "⚠️",
    label:       LABELS[selectedCrimeType] || selectedCrimeType,
    desc:        (document.getElementById("report-desc")?.value || "").trim() || "Denúncia via app.",
    level:       selectedSeverity,
    dangerLevel: selectedSeverity,
    lat, lng,
    time:        new Date().toTimeString().slice(0, 5),
    anonymous:   document.getElementById("anon-check")?.checked ?? true,
    bairro,
    timestamp:   serverTimestamp(),
    _ts:         Date.now(),
  };

  try {
    await addDoc(collection(db, "incidents"), inc);
    showToast("✅ Alerta enviado com sucesso!", "success");
  } catch (e) {
    console.warn("Firestore:", e.message);
    const local = { ...inc, id: `local-${Date.now()}`, timestamp: null };
    saveLocalIncident(local);
    allIncidents.unshift(local);
    refreshAll();
    showToast("✅ Registrado localmente.", "success");
  }

  closeModal();
  btn.disabled = false;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg> ENVIAR ALERTA`;
}

// ══════════════════════════════════════════════════════════
//  BOTTOM SHEET — swipe
// ══════════════════════════════════════════════════════════
function setupBottomSheet() {
  const sheet  = document.getElementById("bottom-sheet");
  const handle = document.getElementById("bs-handle");
  let startY = 0, wasExpanded = false;

  handle.addEventListener("touchstart", e => {
    startY = e.touches[0].clientY;
    wasExpanded = sheet.classList.contains("expanded");
    sheet.style.transition = "none";
  }, { passive: true });

  handle.addEventListener("touchmove", e => {
    const dy = e.touches[0].clientY - startY;
    if (wasExpanded && dy > 0)  sheet.style.transform = `translateY(${dy}px)`;
    if (!wasExpanded && dy < 0) sheet.style.transform = `translateY(calc(100% - var(--sheet-peek) + ${dy}px))`;
  }, { passive: true });

  handle.addEventListener("touchend", e => {
    sheet.style.transition = "";
    sheet.style.transform  = "";
    const dy = e.changedTouches[0].clientY - startY;
    if      (dy < -40) expandSheet();
    else if (dy > 40)  peekSheet();
    else               wasExpanded ? expandSheet() : peekSheet();
  });

  handle.addEventListener("click", () => {
    sheet.classList.contains("expanded") ? peekSheet() : expandSheet();
  });

  // Tabs
  document.querySelectorAll(".bst").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bst").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".bs-tab-content").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      expandSheet();

      // Render ao ativar
      if (btn.dataset.tab === "heatmap") renderHeatmapTab();
      if (btn.dataset.tab === "nearby")  updateNearbyTab();
    });
  });

  peekSheet();
}

function expandSheet() {
  const s = document.getElementById("bottom-sheet");
  s.classList.add("expanded"); s.classList.remove("peek");
}
function peekSheet() {
  const s = document.getElementById("bottom-sheet");
  s.classList.remove("expanded"); s.classList.add("peek");
}

// ══════════════════════════════════════════════════════════
//  FABs
// ══════════════════════════════════════════════════════════
function setupFABs() {
  document.getElementById("fab-location").addEventListener("click", () => {
    locationTracking = !locationTracking;
    document.getElementById("fab-location").classList.toggle("tracking", locationTracking);
    if (locationTracking) {
      map.flyTo([userLat, userLng], 16, { duration: 1 });
      showToast("Rastreando localização", "success");
    }
  });
}

// ══════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════
let toastTimer;
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  const m = document.getElementById("toast-msg");
  if (m) m.textContent = msg;
  t.className = `toast${type ? " toast-" + type : ""}`;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 3200);
}

// ══════════════════════════════════════════════════════════
//  PWA
// ══════════════════════════════════════════════════════════
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function setupInstallBanner() {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredInstall = e;
    setTimeout(() => document.getElementById("install-banner").classList.remove("hidden"), 10000);
  });
  document.getElementById("ib-install").addEventListener("click", () => {
    if (deferredInstall) {
      deferredInstall.prompt();
      deferredInstall.userChoice.then(() => {
        document.getElementById("install-banner").classList.add("hidden");
      });
    }
  });
  document.getElementById("ib-dismiss").addEventListener("click", () => {
    document.getElementById("install-banner").classList.add("hidden");
  });
}

// ══════════════════════════════════════════════════════════
//  FIREBASE AUTH
// ══════════════════════════════════════════════════════════
function initAuth() {
  signInAnonymously(auth).catch(err => {
    console.warn("Auth:", err.message);
  });
}

// ══════════════════════════════════════════════════════════
//  LOCAL STORAGE
// ══════════════════════════════════════════════════════════
function getLocalIncidents() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveLocalIncident(incident) {
  const list = getLocalIncidents();
  list.unshift(incident);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 80)));
}

// ══════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════
function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371, d2r = Math.PI / 180;
  const dLat = (lat2 - lat1) * d2r;
  const dLng = (lng2 - lng1) * d2r;
  const a = Math.sin(dLat/2)**2
    + Math.cos(lat1*d2r) * Math.cos(lat2*d2r) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getTimeAgo(ts) {
  if (!ts) return "Agora";
  try {
    const d    = (typeof ts === "number") ? new Date(ts) : (ts.toDate ? ts.toDate() : new Date(ts));
    const diff = Math.floor((Date.now() - d) / 60000);
    if (diff < 1)    return "Agora";
    if (diff < 60)   return `há ${diff}min`;
    if (diff < 1440) return `há ${Math.floor(diff/60)}h`;
    return `há ${Math.floor(diff/1440)}d`;
  } catch { return "Recente"; }
}

function startSmoothTracking() {
  smoothPos = { lat: userLat, lng: userLng };
  targetPos = targetPos || { lat: userLat, lng: userLng };

  const tick = () => {
    if (targetPos && smoothPos) {
      smoothPos.lat += (targetPos.lat - smoothPos.lat) * 0.12;
      smoothPos.lng += (targetPos.lng - smoothPos.lng) * 0.12;
      smoothHeading += (targetHeading - smoothHeading) * 0.12;

      if (userMarker) userMarker.setLatLng([smoothPos.lat, smoothPos.lng]);
      updateUserHeading(smoothHeading);

      if (navActive || locationTracking) followUser(smoothPos.lat, smoothPos.lng);
      if (navActive) updateNavHUD();
      if (Date.now() - lastAlertAt > 3000) {
        checkProximityAlerts();
        lastAlertAt = Date.now();
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function followUser(lat, lng) {
  const now = Date.now();
  if (now - lastFollowAt < 350) return;
  lastFollowAt = now;

  const zoom = navActive ? 17 : 15;
  const offsetY = navActive ? map.getSize().y * 0.22 : 0;
  const projected = map.project([lat, lng], zoom).subtract([0, offsetY]);
  const target = map.unproject(projected, zoom);
  map.setView(target, zoom, { animate: true, duration: 0.4, easeLinearity: 0.2 });
}

function updateUserHeading(deg) {
  const el = userMarker?.getElement();
  if (!el) return;
  const arrow = el.querySelector(".user-arrow");
  if (arrow) arrow.style.transform = `rotate(${deg}deg)`;
}

function buildRouteMeta(coords, distanceMeters, durationSec) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const d = distKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]) * 1000;
    cum[i] = cum[i - 1] + d;
  }
  return {
    totalDistance: distanceMeters || cum[cum.length - 1] || 0,
    totalDuration: durationSec || 0,
    cumDist: cum
  };
}

function updateNavHUD() {
  const meta = activeRouteType === "safe" ? safeMeta : fastMeta;
  if (!meta || !smoothPos) return;
  const remaining = calcRemainingDistance(meta, smoothPos.lat, smoothPos.lng);
  const etaSec = speedKmh > 5
    ? (remaining / 1000) / speedKmh * 3600
    : Math.max(60, meta.totalDuration * (remaining / Math.max(1, meta.totalDistance)));

  setText("nav-distance", remaining > 1000 ? `${(remaining/1000).toFixed(1)} km` : `${Math.round(remaining)} m`);
  setText("nav-eta", `${Math.max(1, Math.round(etaSec / 60))} min`);
  setText("nav-speed", `${Math.round(speedKmh)} km/h`);

  const risk = Math.round(calcRouteRisk(activeRouteType === "safe" ? safeCoords : fastCoords) * 100);
  setText("nav-risk", `${risk}%`);
}

function calcRemainingDistance(meta, lat, lng) {
  if (!meta || !meta.cumDist?.length) return 0;
  let bestIdx = 0;
  let best = Infinity;
  for (let i = 0; i < meta.cumDist.length; i += 8) {
    const c = activeRouteType === "safe" ? safeCoords[i] : fastCoords[i];
    if (!c) continue;
    const d = distKm(lat, lng, c[0], c[1]);
    if (d < best) { best = d; bestIdx = i; }
  }
  const total = meta.totalDistance || meta.cumDist[meta.cumDist.length - 1] || 0;
  const done = meta.cumDist[bestIdx] || 0;
  return Math.max(0, total - done);
}

function checkProximityAlerts() {
  if (!navActive || !smoothPos) return;
  const near = allIncidents.find(i => i.lat && distKm(smoothPos.lat, smoothPos.lng, i.lat, i.lng) < 0.35);
  if (!near) {
    setText("nav-alert", "Sem alertas");
    return;
  }
  const dist = distKm(smoothPos.lat, smoothPos.lng, near.lat, near.lng);
  const text = `${near.label || near.type} a ${Math.round(dist * 1000)}m a frente`;
  setText("nav-alert", text);
  showToast(text, "error");
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function bearingDeg(lat1, lng1, lat2, lng2) {
  const d2r = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * d2r) * Math.cos(lat2 * d2r);
  const x = Math.cos(lat1 * d2r) * Math.sin(lat2 * d2r) -
    Math.sin(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.cos((lng2 - lng1) * d2r);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function computeSafeWaypoint(destLat, destLng) {
  let midLat = (userLat + destLat) / 2;
  let midLng = (userLng + destLng) / 2;
  const threat = REAL_ZONES
    .filter(z => calcZoneRisk(z) >= 0.7)
    .sort((a, b) => distKm(midLat, midLng, a.coords.lat, a.coords.lng) - distKm(midLat, midLng, b.coords.lat, b.coords.lng))[0];

  if (threat && distKm(midLat, midLng, threat.coords.lat, threat.coords.lng) < 2.2) {
    const vecLat = midLat - threat.coords.lat;
    const vecLng = midLng - threat.coords.lng;
    midLat += vecLat * 0.5 + 0.008;
    midLng += vecLng * 0.5 - 0.008;
  } else {
    midLat += 0.006;
    midLng -= 0.006;
  }
  return { midLat, midLng };
}

function calcZoneRisk(zone) {
  const base = zone.riskValue ?? (zone.risk || 0) / 100;
  const timeRisk = zone.timeRisk || {};
  const hour = new Date().getHours();
  const bucket = hour >= 6 && hour < 18
    ? "day"
    : hour >= 18 && hour < 24
      ? "night"
      : "dawn";
  const timePct = (timeRisk[bucket] || zone.risk || 0) / 100;
  return Math.min(0.99, Math.max(base, timePct));
}