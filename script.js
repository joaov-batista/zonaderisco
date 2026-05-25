import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCfK_Tx19SqiqkyIGU0v84mWqLEncqYdEs",
  authDomain: "studyapp-5e70d.firebaseapp.com",
  projectId: "studyapp-5e70d",
  storageBucket: "studyapp-5e70d.firebasestorage.app",
  messagingSenderId: "548719143251",
  appId: "1:548719143251:web:d6c1d738996636289559a6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// STATE
let map;
let userMarker;
let userLat = -12.9714;
let userLng = -38.5014;

let selectedCrime = "";
let allIncidents = [];

// SPLASH
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const splash = document.getElementById("splash");

    if (splash) {
      splash.classList.add("gone");

      setTimeout(() => {
        splash.style.display = "none";
      }, 500);
    }

    initMap();
    initEvents();
    loadIncidents();
  }, 2500);
});

// MAPA
function initMap() {
  map = L.map("map", {
    zoomControl: false,
    attributionControl: false
  }).setView([userLat, userLng], 13);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 20
    }
  ).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(position => {
      userLat = position.coords.latitude;
      userLng = position.coords.longitude;

      updateUserMarker();
      checkDangerZones();
    });
  }

  updateUserMarker();
}

function updateUserMarker() {
  if (userMarker) {
    userMarker.remove();
  }

  const icon = L.divIcon({
    className: "",
    html: `
      <div style="
        width:18px;
        height:18px;
        background:#00ff88;
        border-radius:50%;
        box-shadow:0 0 20px #00ff88;
        border:3px solid white;
      "></div>
    `,
    iconSize: [18, 18]
  });

  userMarker = L.marker([userLat, userLng], { icon }).addTo(map);

  map.setView([userLat, userLng], 14);
}

// EVENTOS
function initEvents() {

  // FAB REPORT
  document.getElementById("fab-report")
    .addEventListener("click", () => {
      document.getElementById("modal-overlay")
        .classList.remove("hidden");
    });

  // FECHAR MODAL
  document.getElementById("modal-x")
    .addEventListener("click", closeModal);

  document.getElementById("modal-overlay")
    .addEventListener("click", e => {
      if (e.target.id === "modal-overlay") {
        closeModal();
      }
    });

  // CRIMES
  document.querySelectorAll(".cg-btn").forEach(btn => {
    btn.addEventListener("click", () => {

      document.querySelectorAll(".cg-btn")
        .forEach(b => b.classList.remove("selected"));

      btn.classList.add("selected");

      selectedCrime = btn.dataset.type;
    });
  });

  // ENVIAR
  document.getElementById("send-report")
    ?.addEventListener("click", submitReport);
}

function closeModal() {
  document.getElementById("modal-overlay")
    .classList.add("hidden");
}

// FIRESTORE
function loadIncidents() {

  const q = query(
    collection(db, "incidents"),
    orderBy("timestamp", "desc")
  );

  onSnapshot(q, snapshot => {

    allIncidents = [];

    snapshot.forEach(doc => {
      allIncidents.push({
        id: doc.id,
        ...doc.data()
      });
    });

    renderIncidents();

  }, error => {
    console.log(error);
  });
}

// RENDER
function renderIncidents() {

  const feed = document.getElementById("incidents-feed");

  if (!feed) return;

  feed.innerHTML = "";

  allIncidents.forEach(incident => {

    createMarker(incident);

    const card = document.createElement("div");

    card.className = "inc-card";

    card.innerHTML = `
      <div class="inc-card-emoji">🚨</div>

      <div class="inc-card-info">
        <div class="inc-card-type">
          ${incident.type || "Ocorrência"}
        </div>

        <div class="inc-card-meta">
          ${incident.description || "Sem descrição"}
        </div>
      </div>
    `;

    feed.appendChild(card);
  });

  document.getElementById("feed-count").innerText =
    `${allIncidents.length} alertas`;
}

// MARCADORES
function createMarker(data) {

  if (!data.lat || !data.lng) return;

  let color = "#ff1a1a";

  if (data.level <= 2) {
    color = "#00ff88";
  }
  else if (data.level <= 3) {
    color = "#f5c518";
  }

  const icon = L.divIcon({
    className: "",
    html: `
      <div style="
        width:16px;
        height:16px;
        background:${color};
        border-radius:50%;
        box-shadow:0 0 20px ${color};
      "></div>
    `,
    iconSize: [16, 16]
  });

  L.marker([data.lat, data.lng], { icon })
    .addTo(map)
    .bindPopup(`
      <div style="color:white">
        <b>${data.type}</b><br>
        ${data.description}
      </div>
    `);

  // ZONA DE RISCO
  L.circle([data.lat, data.lng], {
    radius: 250,
    color,
    fillColor: color,
    fillOpacity: 0.15
  }).addTo(map);
}

// ENVIAR REPORT
async function submitReport() {

  if (!selectedCrime) {
    alert("Selecione uma ocorrência");
    return;
  }

  const description =
    document.getElementById("report-desc")?.value || "";

  try {

    await addDoc(collection(db, "incidents"), {

      type: selectedCrime,
      description,
      lat: userLat,
      lng: userLng,
      level: 5,
      timestamp: serverTimestamp()

    });

    closeModal();

    alert("Ocorrência enviada!");

  } catch (error) {

    console.error(error);

    alert("Erro ao enviar");
  }
}

// ALERTA DE RISCO
function checkDangerZones() {

  allIncidents.forEach(incident => {

    const dist =
      Math.sqrt(
        Math.pow(incident.lat - userLat, 2) +
        Math.pow(incident.lng - userLng, 2)
      );

    if (dist < 0.003) {

      const toast = document.getElementById("danger-toast");

      toast.classList.remove("hidden");

      setTimeout(() => {
        toast.classList.add("hidden");
      }, 5000);
    }
  });
}