/**
 * Smart Room Proctor AI - Frontend Application
 * Powered by TensorFlow.js & Teachable Machine
 */

// --- Global State ---
// Direct storage link has CORS enabled; local './model/' is also available
const CLOUD_MODEL_URL = "https://storage.googleapis.com/tm-model/FZ36RgbjB/";
const LOCAL_MODEL_URL = "./model/";

function resolveModelUrl(rawUrl) {
  if (!rawUrl || rawUrl === "default") return LOCAL_MODEL_URL;
  let url = rawUrl.trim();
  if (!url.endsWith("/")) url += "/";

  // If user pasted teachablemachine.withgoogle.com/models/ID/
  // convert to direct Google Cloud Storage bucket which has CORS 'Access-Control-Allow-Origin: *'
  const match = url.match(/teachablemachine\.withgoogle\.com\/models\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://storage.googleapis.com/tm-model/${match[1]}/`;
  }
  return url;
}

let storedUrl = localStorage.getItem("tm_proctor_model_url");
let currentModelUrl = storedUrl ? resolveModelUrl(storedUrl) : LOCAL_MODEL_URL;

let model = null;
let webcam = null;
let isWebcamRunning = false;
let activeMode = "webcam"; // 'webcam' | 'upload'
let maxPredictions = 0;
let soundEnabled = true;
let detectionThreshold = 0.70; // Strictly > 70% required for malpractice alarm
let animationFrameId = null;

// FPS tracking
let lastFrameTime = performance.now();
let frameCount = 0;
let currentFps = 0;

// Audio Context for synthetic alert sounds
let audioCtx = null;
let lastAlertSoundTime = 0;

// Activity Audit Log Memory
const auditLogs = [];

// DOM Elements
const elements = {
  modelStatusPill: document.getElementById("modelStatusPill"),
  modelStatusText: document.getElementById("modelStatusText"),
  modelStatusDot: document.getElementById("modelStatusDot"),
  modelStatusPing: document.getElementById("modelStatusPing"),
  btnOpenSettings: document.getElementById("btnOpenSettings"),
  btnCloseSettings: document.getElementById("btnCloseSettings"),
  settingsModal: document.getElementById("settingsModal"),
  inputModelUrl: document.getElementById("inputModelUrl"),
  btnSaveModel: document.getElementById("btnSaveModel"),
  
  btnOpenDeploy: document.getElementById("btnOpenDeploy"),
  btnCloseDeploy: document.getElementById("btnCloseDeploy"),
  btnCloseDeploy2: document.getElementById("btnCloseDeploy2"),
  deployModal: document.getElementById("deployModal"),

  tabWebcam: document.getElementById("tabWebcam"),
  tabUpload: document.getElementById("tabUpload"),
  webcamContainer: document.getElementById("webcamContainer"),
  webcamPlaceholder: document.getElementById("webcamPlaceholder"),
  uploadContainer: document.getElementById("uploadContainer"),
  imageFileInput: document.getElementById("imageFileInput"),
  previewImage: document.getElementById("previewImage"),
  dropzonePrompt: document.getElementById("dropzonePrompt"),

  btnToggleCamera: document.getElementById("btnToggleCamera"),
  btnCameraText: document.getElementById("btnCameraText"),
  btnCapturePhoto: document.getElementById("btnCapturePhoto"),
  fpsBadge: document.getElementById("fpsBadge"),
  scanLine: document.getElementById("scanLine"),
  hudStatus: document.getElementById("hudStatus"),
  hudConfidence: document.getElementById("hudConfidence"),

  confidenceThreshold: document.getElementById("confidenceThreshold"),
  thresholdValue: document.getElementById("thresholdValue"),
  confidenceBarsContainer: document.getElementById("confidenceBarsContainer"),

  malpracticeBanner: document.getElementById("malpracticeBanner"),
  malpracticeBannerDetail: document.getElementById("malpracticeBannerDetail"),
  btnDismissAlert: document.getElementById("btnDismissAlert"),

  roomStateBadge: document.getElementById("roomStateBadge"),
  roomDoorStatus: document.getElementById("roomDoorStatus"),
  roomJammerStatus: document.getElementById("roomJammerStatus"),

  btnToggleSound: document.getElementById("btnToggleSound"),
  soundIcon: document.getElementById("soundIcon"),
  soundLabel: document.getElementById("soundLabel"),

  btnResetRoster: document.getElementById("btnResetRoster"),
  btnExportCSV: document.getElementById("btnExportCSV"),
  logList: document.getElementById("logList"),
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Setup UI event listeners
  setupEventListeners();

  // Load Model from URL
  elements.inputModelUrl.value = currentModelUrl;
  await loadModel(currentModelUrl);
});

// --- Sound Synthesizer (Zero External Assets) ---
function playSecuritySiren() {
  if (!soundEnabled) return;
  const now = Date.now();
  if (now - lastAlertSoundTime < 3000) return; // Don't spam sound within 3 seconds
  lastAlertSoundTime = now;

  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.35); // Drop to A4

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (err) {
    console.warn("Audio chime failed to play:", err);
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Modals
  elements.btnOpenSettings.addEventListener("click", () => {
    elements.settingsModal.classList.remove("hidden");
  });
  elements.btnCloseSettings.addEventListener("click", () => {
    elements.settingsModal.classList.add("hidden");
  });
  elements.btnOpenDeploy.addEventListener("click", () => {
    elements.deployModal.classList.remove("hidden");
  });
  elements.btnCloseDeploy.addEventListener("click", () => {
    elements.deployModal.classList.add("hidden");
  });
  elements.btnCloseDeploy2.addEventListener("click", () => {
    elements.deployModal.classList.add("hidden");
  });

  // Reload model from custom URL
  elements.btnSaveModel.addEventListener("click", async () => {
    const rawUrl = elements.inputModelUrl.value.trim();
    const url = resolveModelUrl(rawUrl);
    localStorage.setItem("tm_proctor_model_url", url);
    currentModelUrl = url;
    elements.settingsModal.classList.add("hidden");
    await loadModel(url);
  });

  // Mode switching
  elements.tabWebcam.addEventListener("click", () => switchMode("webcam"));
  elements.tabUpload.addEventListener("click", () => switchMode("upload"));

  // Camera toggle button
  elements.btnToggleCamera.addEventListener("click", toggleCamera);

  // Snapshot button
  elements.btnCapturePhoto.addEventListener("click", captureSnapshot);

  // Sound toggle
  elements.btnToggleSound.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      elements.soundIcon.className = "w-4 h-4 text-emerald-400";
      elements.soundLabel.textContent = "Alarm On";
      elements.soundLabel.className = "text-[11px] font-mono text-emerald-300";
    } else {
      elements.soundIcon.className = "w-4 h-4 text-slate-500";
      elements.soundLabel.textContent = "Alarm Muted";
      elements.soundLabel.className = "text-[11px] font-mono text-slate-500";
    }
  });

  // Threshold slider
  elements.confidenceThreshold.addEventListener("input", (e) => {
    detectionThreshold = parseInt(e.target.value, 10) / 100;
    elements.thresholdValue.textContent = `> ${e.target.value}%`;
  });

  // File Upload Handlers
  elements.imageFileInput.addEventListener("change", handleFileUpload);

  // Drag & drop support on uploadContainer
  elements.uploadContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    elements.uploadContainer.classList.add("border-indigo-500", "bg-indigo-950/20");
  });
  elements.uploadContainer.addEventListener("dragleave", (e) => {
    e.preventDefault();
    elements.uploadContainer.classList.remove("border-indigo-500", "bg-indigo-950/20");
  });
  elements.uploadContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    elements.uploadContainer.classList.remove("border-indigo-500", "bg-indigo-950/20");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  });

  // Dismiss Malpractice Banner
  elements.btnDismissAlert.addEventListener("click", () => {
    elements.malpracticeBanner.classList.add("hidden");
    elements.roomStateBadge.className = "px-2.5 py-1 text-xs font-bold rounded-lg uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    elements.roomStateBadge.textContent = "NORMAL";
  });

  // Reset Student Roster
  elements.btnResetRoster.addEventListener("click", resetRoster);

  // Export CSV Audit Report
  elements.btnExportCSV.addEventListener("click", exportAuditReportCSV);
}

// --- Mode Switcher ---
function switchMode(mode) {
  activeMode = mode;
  if (mode === "webcam") {
    elements.tabWebcam.className = "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-sm transition";
    elements.tabUpload.className = "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition";

    elements.webcamContainer.classList.remove("hidden");
    elements.uploadContainer.classList.add("hidden");
    elements.btnToggleCamera.classList.remove("hidden");
    elements.btnCapturePhoto.classList.remove("hidden");
  } else {
    elements.tabUpload.className = "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-sm transition";
    elements.tabWebcam.className = "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition";

    // Stop webcam if active
    if (isWebcamRunning) {
      stopCamera();
    }

    elements.webcamContainer.classList.add("hidden");
    elements.uploadContainer.classList.remove("hidden");
    elements.btnToggleCamera.classList.add("hidden");
    elements.btnCapturePhoto.classList.add("hidden");
    elements.fpsBadge.textContent = "PHOTO MODE";
    elements.hudStatus.textContent = "IMAGE INSPECTION";
  }
}

// --- Teachable Machine Model Loader ---
async function loadModel(targetUrl) {
  const resolved = resolveModelUrl(targetUrl);
  updateModelStatus("loading", "Connecting Model...");

  const candidateUrls = [resolved];
  if (resolved !== LOCAL_MODEL_URL) {
    candidateUrls.push(LOCAL_MODEL_URL);
  }
  if (resolved !== CLOUD_MODEL_URL) {
    candidateUrls.push(CLOUD_MODEL_URL);
  }

  let loadSuccess = false;
  let lastError = null;

  for (const url of candidateUrls) {
    try {
      console.log("Attempting to load model from:", url);
      const modelURL = url + "model.json";
      const metadataURL = url + "metadata.json";

      model = await tmImage.load(modelURL, metadataURL);
      maxPredictions = model.getTotalClasses();

      updateModelStatus("ready", `Model Active (${maxPredictions} Classes)`);
      addAuditLog("SYSTEM", "Model loaded successfully (" + (url.startsWith(".") ? "Local Bundle" : "Cloud URL") + ")");
      initProbabilityBars();

      currentModelUrl = url;
      loadSuccess = true;
      break;
    } catch (err) {
      console.warn(`Failed to load from ${url}:`, err);
      lastError = err;
    }
  }

  if (!loadSuccess) {
    console.error("All model load candidates failed:", lastError);
    updateModelStatus("error", "Load Failed");
    addAuditLog("ERROR", "Could not load model: " + (lastError?.message || "Check console"));
  }
}

function updateModelStatus(state, text) {
  elements.modelStatusText.textContent = text;
  if (state === "ready") {
    elements.modelStatusDot.className = "relative inline-flex rounded-full h-2 w-2 bg-emerald-500";
    elements.modelStatusPing.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75";
  } else if (state === "loading") {
    elements.modelStatusDot.className = "relative inline-flex rounded-full h-2 w-2 bg-amber-500";
    elements.modelStatusPing.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75";
  } else {
    elements.modelStatusDot.className = "relative inline-flex rounded-full h-2 w-2 bg-red-500";
    elements.modelStatusPing.className = "hidden";
  }
}

// --- Dynamic Probability Bars UI ---
function initProbabilityBars() {
  if (!model) return;
  elements.confidenceBarsContainer.innerHTML = "";

  for (let i = 0; i < maxPredictions; i++) {
    const className = model.getClassLabels()[i];
    const isMalpractice = className.toLowerCase().includes("malpractice") || className.toLowerCase().includes("absent");

    const barWrapper = document.createElement("div");
    barWrapper.className = "space-y-1";
    barWrapper.innerHTML = `
      <div class="flex items-center justify-between text-xs">
        <span class="font-mono text-slate-300 truncate max-w-[280px]" title="${className}">
          ${className}
        </span>
        <span id="probText-${i}" class="font-mono font-semibold ${isMalpractice ? 'text-red-400' : 'text-indigo-400'}">0%</span>
      </div>
      <div class="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
        <div id="probBar-${i}" class="h-full rounded-full transition-all duration-100 ${isMalpractice ? 'bg-gradient-to-r from-red-600 to-rose-400' : 'bg-gradient-to-r from-indigo-600 to-violet-400'}" style="width: 0%"></div>
      </div>
    `;
    elements.confidenceBarsContainer.appendChild(barWrapper);
  }
}

// --- Webcam Control ---
async function toggleCamera() {
  if (!model) {
    alert("Please wait for the model to finish loading.");
    return;
  }

  if (isWebcamRunning) {
    stopCamera();
  } else {
    await startCamera();
  }
}

async function startCamera() {
  try {
    const flip = true;
    const width = 640;
    const height = 480;

    webcam = new tmImage.Webcam(width, height, flip);
    await webcam.setup();
    await webcam.play();

    // Replace placeholder with webcam canvas
    elements.webcamPlaceholder.classList.add("hidden");
    elements.webcamContainer.innerHTML = "";
    elements.webcamContainer.appendChild(webcam.canvas);

    isWebcamRunning = true;
    elements.btnCameraText.textContent = "Stop Live Monitor";
    elements.btnToggleCamera.classList.remove("bg-indigo-600", "hover:bg-indigo-500");
    elements.btnToggleCamera.classList.add("bg-red-600", "hover:bg-red-500");
    elements.btnCapturePhoto.classList.remove("hidden");
    elements.scanLine.classList.remove("hidden");
    elements.hudStatus.textContent = "SYSTEM: ACTIVE SCAN";

    addAuditLog("ROOM", "Hall camera activated. Live surveillance streaming.");

    // Start Inference Loop
    animationFrameId = window.requestAnimationFrame(webcamLoop);
  } catch (err) {
    console.error("Camera access error:", err);
    alert("Unable to access camera. Please allow webcam permission in your browser.");
  }
}

function stopCamera() {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (webcam) {
    webcam.stop();
  }

  isWebcamRunning = false;
  elements.btnCameraText.textContent = "Start Live Monitor";
  elements.btnToggleCamera.classList.add("bg-indigo-600", "hover:bg-indigo-500");
  elements.btnToggleCamera.classList.remove("bg-red-600", "hover:bg-red-500");
  elements.btnCapturePhoto.classList.add("hidden");
  elements.scanLine.classList.add("hidden");
  elements.fpsBadge.textContent = "0 FPS";
  elements.hudStatus.textContent = "SYSTEM: STANDBY";
  elements.hudConfidence.textContent = "MAX CONF: --";

  // Revert viewport placeholder
  elements.webcamContainer.innerHTML = "";
  elements.webcamContainer.appendChild(elements.webcamPlaceholder);
  elements.webcamPlaceholder.classList.remove("hidden");

  addAuditLog("ROOM", "Hall camera stopped. Standby mode.");
}

// --- Webcam Inference Loop ---
async function webcamLoop(timestamp) {
  if (!isWebcamRunning) return;

  webcam.update();
  const predictions = await model.predict(webcam.canvas);
  handlePredictions(predictions);

  // Compute FPS
  frameCount++;
  if (timestamp - lastFrameTime >= 1000) {
    currentFps = frameCount;
    frameCount = 0;
    lastFrameTime = timestamp;
    elements.fpsBadge.textContent = `${currentFps} FPS`;
  }

  animationFrameId = window.requestAnimationFrame(webcamLoop);
}

// --- Photo Upload Mode Handlers ---
function handleFileUpload(e) {
  if (e.target.files && e.target.files[0]) {
    processImageFile(e.target.files[0]);
  }
}

function processImageFile(file) {
  if (!model) {
    alert("Please wait for the model to finish loading.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    elements.previewImage.src = event.target.result;
    elements.previewImage.classList.remove("hidden");
    elements.dropzonePrompt.classList.add("hidden");

    elements.previewImage.onload = async () => {
      elements.hudStatus.textContent = "INSPECTING PHOTO...";
      const predictions = await model.predict(elements.previewImage);
      handlePredictions(predictions);
      elements.hudStatus.textContent = "PHOTO PROCESSED";
      addAuditLog("PHOTO", `Exam photo analyzed (${file.name})`);
    };
  };
  reader.readAsDataURL(file);
}

// --- Snapshot from Webcam ---
function captureSnapshot() {
  if (!isWebcamRunning || !webcam) return;
  const canvas = webcam.canvas;
  const dataUrl = canvas.toDataURL("image/jpeg");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `smart_room_snapshot_${Date.now()}.jpg`;
  a.click();
  addAuditLog("SNAPSHOT", "Snapshot saved by proctor operator");
}

// --- Handle Predictions and Rule Engine ---
function handlePredictions(predictions) {
  let highestProb = 0;
  let topPrediction = null;

  // Update dynamic probability meters
  predictions.forEach((pred, index) => {
    const probPercent = Math.round(pred.probability * 100);
    const textEl = document.getElementById(`probText-${index}`);
    const barEl = document.getElementById(`probBar-${index}`);

    if (textEl) textEl.textContent = `${probPercent}%`;
    if (barEl) barEl.style.width = `${probPercent}%`;

    if (pred.probability > highestProb) {
      highestProb = pred.probability;
      topPrediction = pred;
    }
  });

  if (topPrediction) {
    elements.hudConfidence.textContent = `CONF: ${(highestProb * 100).toFixed(1)}%`;
  }

  // Find the strongest malpractice prediction among all classes
  let topMalpractice = null;
  let topPresent = null;

  predictions.forEach((pred) => {
    const isMal = pred.className.toLowerCase().includes("malpractice") || pred.className.toLowerCase().includes("absent");
    if (isMal) {
      if (!topMalpractice || pred.probability > topMalpractice.probability) {
        topMalpractice = pred;
      }
    } else {
      if (!topPresent || pred.probability > topPresent.probability) {
        topPresent = pred;
      }
    }
  });

  // STRICT REQUIREMENT:
  // "Give alarm for malpractice if it is more than 70% true. Otherwise don't give malpractice for it."
  if (topMalpractice && topMalpractice.probability > detectionThreshold) {
    // Malpractice is strictly greater than 70%
    triggerMalpracticeAlarm(topMalpractice.className, topMalpractice.probability);
  } else {
    // Otherwise DO NOT give malpractice!
    clearMalpracticeAlarm();

    // If candidate presence is verified
    if (topPresent && topPresent.probability >= 0.50) {
      recordStudentPresence(topPresent.className, topPresent.probability);
    }
  }
}

// Student state debounce tracking to avoid spamming logs
const lastStudentState = {};

// --- Trigger Malpractice Alarm (> 70%) ---
function triggerMalpracticeAlarm(className, confidence) {
  const idMatch = className.match(/447330\d{2}/);
  const studentId = idMatch ? idMatch[0] : null;
  const timeStr = new Date().toLocaleTimeString();

  // Show Alert Banner & Update Room State
  elements.malpracticeBanner.classList.remove("hidden");
  elements.malpracticeBannerDetail.textContent = `Alert: Student ${studentId || 'Unknown'} detected with smartphone (> ${(detectionThreshold * 100).toFixed(0)}%). Auto-marked ABSENT (${(confidence * 100).toFixed(0)}% confidence).`;

  elements.roomStateBadge.className = "px-2.5 py-1 text-xs font-bold rounded-lg uppercase bg-red-500/20 text-red-400 border border-red-500/40 glow-alert animate-pulse";
  elements.roomStateBadge.textContent = "ALERT: MALPRACTICE";

  // Play synthetic security siren
  playSecuritySiren();

  if (studentId) {
    updateStudentCard(studentId, "Malpractice - Absent", "danger", timeStr, confidence);
    
    // Log only if status changed or after 5 seconds to keep audit log clean
    const now = Date.now();
    const prev = lastStudentState[studentId];
    if (!prev || prev.status !== "MALPRACTICE" || now - prev.time > 5000) {
      addAuditLog("MALPRACTICE", `Candidate ${studentId} smartphone detected (${(confidence * 100).toFixed(0)}% > 70%) -> MARKED ABSENT`);
      lastStudentState[studentId] = { status: "MALPRACTICE", time: now };
    }
  }
}

// --- Clear Malpractice Alarm (<= 70%) ---
function clearMalpracticeAlarm() {
  if (!elements.malpracticeBanner.classList.contains("hidden")) {
    elements.malpracticeBanner.classList.add("hidden");
  }
  if (elements.roomStateBadge.textContent.includes("ALERT")) {
    elements.roomStateBadge.className = "px-2.5 py-1 text-xs font-bold rounded-lg uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    elements.roomStateBadge.textContent = "NORMAL";
  }
}

// --- Record Normal Student Presence ---
function recordStudentPresence(className, confidence) {
  const idMatch = className.match(/447330\d{2}/);
  const studentId = idMatch ? idMatch[0] : null;
  const timeStr = new Date().toLocaleTimeString();

  if (studentId) {
    const badge = document.getElementById(`badge-${studentId}`);
    const isCurrentlyMalpractice = badge && badge.textContent.includes("Malpractice");
    
    // If student isn't in malpractice state, mark present
    if (!isCurrentlyMalpractice) {
      updateStudentCard(studentId, "Present", "success", timeStr, confidence);
      
      const now = Date.now();
      const prev = lastStudentState[studentId];
      if (!prev || prev.status !== "PRESENT" || now - prev.time > 10000) {
        addAuditLog("ATTENDANCE", `Candidate ${studentId} verified PRESENT (${(confidence * 100).toFixed(0)}%)`);
        lastStudentState[studentId] = { status: "PRESENT", time: now };
      }
    }
  }
}

// --- Update Monitored Student Card ---
function updateStudentCard(studentId, statusText, statusType, timestamp, confidence) {
  const badge = document.getElementById(`badge-${studentId}`);
  const timeEl = document.getElementById(`time-${studentId}`);
  const card = document.getElementById(`studentCard-${studentId}`);

  if (!badge) return;

  if (statusType === "danger") {
    badge.className = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse";
    badge.innerHTML = `<i data-lucide="x-circle" class="w-3 h-3"></i> ${statusText}`;
    if (card) {
      card.className = "p-3 rounded-xl bg-red-950/20 border border-red-500/40 transition flex items-center justify-between";
    }
  } else if (statusType === "success") {
    badge.className = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    badge.innerHTML = `<i data-lucide="check-circle" class="w-3 h-3"></i> ${statusText}`;
    if (card) {
      card.className = "p-3 rounded-xl bg-slate-950/50 border border-emerald-500/20 transition flex items-center justify-between";
    }
  }

  if (timeEl) {
    timeEl.textContent = `${timestamp} (${(confidence * 100).toFixed(0)}%)`;
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// --- Reset Roster ---
function resetRoster() {
  const ids = ["44733003", "44733010", "44733013"];
  ids.forEach(id => {
    const badge = document.getElementById(`badge-${id}`);
    const timeEl = document.getElementById(`time-${id}`);
    const card = document.getElementById(`studentCard-${id}`);

    if (badge) {
      badge.className = "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700";
      badge.textContent = "Pending";
    }
    if (timeEl) timeEl.textContent = "--";
    if (card) {
      card.className = "p-3 rounded-xl bg-slate-950/50 border border-slate-800 transition flex items-center justify-between";
    }
  });

  elements.malpracticeBanner.classList.add("hidden");
  elements.roomStateBadge.className = "px-2.5 py-1 text-xs font-bold rounded-lg uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
  elements.roomStateBadge.textContent = "NORMAL";

  addAuditLog("ROSTER", "Candidate status roster reset by proctor");
}

// --- Audit Logger ---
function addAuditLog(category, message) {
  const timestamp = new Date().toLocaleTimeString();
  auditLogs.unshift({ timestamp, category, message });

  const logEntry = document.createElement("div");
  logEntry.className = "p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-start gap-2 hover:border-slate-700 transition";

  let badgeColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
  if (category === "MALPRACTICE" || category === "ERROR") {
    badgeColor = "text-red-400 bg-red-500/10 border-red-500/20";
  } else if (category === "ATTENDANCE") {
    badgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  }

  logEntry.innerHTML = `
    <span class="text-[10px] px-1.5 py-0.5 rounded border font-mono ${badgeColor}">${category}</span>
    <div class="flex-1">
      <span class="text-slate-300">${message}</span>
      <span class="text-[10px] text-slate-500 block">${timestamp}</span>
    </div>
  `;

  // Remove placeholder if present
  if (elements.logList.children.length === 1 && elements.logList.children[0].textContent.includes("System initialized")) {
    elements.logList.innerHTML = "";
  }

  elements.logList.prepend(logEntry);

  // Keep max 60 log entries in memory
  if (elements.logList.children.length > 60) {
    elements.logList.removeChild(elements.logList.lastChild);
  }
}

// --- Export CSV Report ---
function exportAuditReportCSV() {
  if (auditLogs.length === 0) {
    alert("No activity recorded yet to export.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,Timestamp,Category,Description\n";
  auditLogs.forEach(row => {
    const escapedMsg = `"${row.message.replace(/"/g, '""')}"`;
    csvContent += `${row.timestamp},${row.category},${escapedMsg}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `smart_room_proctor_audit_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
