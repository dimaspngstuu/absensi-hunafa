/**
 * ==============================================================================
 * AL HUNAFA ATTENDANCE - CLIENT CONTROLLER & UNIVERSAL API BRIDGE
 * Engine: ZettBOT Core v1.0.0
 * Architecture: Jamstack Hybrid (Vercel Frontend + Google Sheets Backend)
 * ==============================================================================
 */

// Konfigurasi URL Google Apps Script Web App resmi Anda (berakhiran /exec)
// Bisa diisi langsung di bawah ini atau melalui menu Pengaturan di aplikasi
const DEFAULT_GAS_API_URL = "https://script.google.com/macros/s/AKfycbzryJei6cFoSKWqn2bp5oMiFElT0gp5tZbs-FiUTEuPGJ-QkQnhCyzWFUw2UAkNaF4/exec";

function getGasApiUrl() {
  return localStorage.getItem("alhunafa_gas_api_url") || DEFAULT_GAS_API_URL || "";
}

function setGasApiUrl(newUrl) {
  if (newUrl) {
    let clean = newUrl.trim();
    // Normalisasi jika user tanpa sengaja menyalin URL /dev atau tanpa /exec
    if (clean.endsWith("/dev")) {
      clean = clean.slice(0, -4) + "/exec";
    } else if (clean.includes("/macros/s/") && !clean.endsWith("/exec")) {
      clean = clean.replace(/\/+$/, "") + "/exec";
    }
    localStorage.setItem("alhunafa_gas_api_url", clean);
  } else {
    localStorage.removeItem("alhunafa_gas_api_url");
  }
}

/**
 * Universal GAS Runner Polyfill:
 * Memungkinkan pemanggilan google.script.run.* berjalan 100% mulus di Vercel (via HTTP fetch POST)
 * maupun langsung di dalam lingkungan Google Apps Script bawaan.
 */
if (typeof google === "undefined" || !google.script || !google.script.run) {
  window.google = window.google || {};
  window.google.script = window.google.script || {};

  function createUniversalGasRunner() {
    let successCb = function (res) { };
    let failureCb = function (err) { console.error("Universal Runner Error:", err); };

    const runner = {
      withSuccessHandler: function (fn) {
        successCb = fn;
        return runner;
      },
      withFailureHandler: function (fn) {
        failureCb = fn;
        return runner;
      }
    };

    function sendRequest(action, payload) {
      const gasUrl = getGasApiUrl();
      if (!gasUrl) {
        setTimeout(function () {
          failureCb(new Error("URL Web App Google Sheets belum diatur. Silakan atur URL Web App di menu Pengaturan."));
        }, 80);
        return;
      }

      const bodyData = JSON.stringify(Object.assign({ action: action }, payload || {}));

      // Menggunakan mode POST ke Google Apps Script
      // Content-Type: text/plain mencegah CORS OPTIONS preflight check
      fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: bodyData
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP Status " + res.status);
          return res.json();
        })
        .then(function (data) {
          successCb(data);
        })
        .catch(function (err) {
          console.warn("GAS Fetch Error:", err);
          let userMsg = err.message || String(err);
          if (userMsg.indexOf("Failed to fetch") !== -1 || userMsg.indexOf("NetworkError") !== -1) {
            userMsg = "Failed to fetch: Pastikan Deployment Google Apps Script disetel 'Siapa yang memiliki akses' = 'Siapa saja (Anyone)' dan link berakhiran '/exec'.";
          }
          failureCb(new Error(userMsg));
        });
    }

    runner.apiLogin = function (identifier, pin) {
      sendRequest("login", { identifier: identifier, pin: pin });
    };
    runner.apiGetDashboardData = function (token, idKaryawan) {
      sendRequest("getDashboard", { token: token, idKaryawan: idKaryawan });
    };
    runner.apiSubmitPresensi = function (token, payload) {
      sendRequest("submitPresensi", Object.assign({ token: token }, payload));
    };
    runner.apiSubmitIzin = function (token, payload) {
      sendRequest("submitIzin", Object.assign({ token: token }, payload));
    };
    runner.apiGetIzinList = function (token) {
      sendRequest("getIzinList", { token: token });
    };
    runner.apiUpdateStatusIzin = function (token, idPengajuan, newStatus) {
      sendRequest("updateStatusIzin", { token: token, idPengajuan: idPengajuan, newStatus: newStatus });
    };
    runner.apiGetFilteredReport = function (token, start, end) {
      sendRequest("getFilteredReport", { token: token, startDate: start, endDate: end });
    };
    runner.apiSaveConfig = function (token, newConfig) {
      sendRequest("saveConfig", { token: token, newConfig: newConfig });
    };
    runner.apiGetAdminDashboard = function (token) {
      sendRequest("getAdminDashboard", { token: token });
    };
    runner.apiSaveKaryawan = function (token, karyawan) {
      sendRequest("saveKaryawan", { token: token, karyawan: karyawan });
    };
    runner.apiSearchGoogleMapsLocation = function (token, query) {
      sendRequest("searchGoogleMapsLocation", { token: token, query: query });
    };
    runner.apiUpdatePassword = function (token, idKaryawan, oldPin, newPin) {
      sendRequest("updatePassword", { token: token, idKaryawan: idKaryawan, oldPin: oldPin, newPin: newPin });
    };
    runner.apiUpdateProfilePhoto = function (token, idKaryawan, photoUrl) {
      sendRequest("updateProfilePhoto", { token: token, idKaryawan: idKaryawan, photoUrl: photoUrl });
    };
    runner.apiLogout = function (token) {
      sendRequest("logout", { token: token });
    };

    return runner;
  }

  Object.defineProperty(window.google.script, "run", {
    get: function () {
      return createUniversalGasRunner();
    },
    configurable: true
  });
}

// Inisialisasi status sesi otentikasi dari sessionStorage
const storedUserJson = sessionStorage.getItem("alhunafa_user");
let initialUserSession = null;
try {
  if (storedUserJson) initialUserSession = JSON.parse(storedUserJson);
} catch (e) {
  initialUserSession = null;
}

const AppState = {
  currentUser: initialUserSession || null,
  sessionToken: sessionStorage.getItem("alhunafa_session_token") || null,
  currentConfig: {
    NAMA_KANTOR: "Al Hunafa Attendance Center",
    ALAMAT_KANTOR: "Kantor Al Hunafa",
    LATITUDE_KANTOR: -6.175392,
    LONGITUDE_KANTOR: 106.827153,
    RADIUS_MAKSIMAL_METER: 50,
    JAM_MASUK_STANDAR: "08:00",
    JAM_PULANG_STANDAR: "17:00"
  },
  // In-Memory Caching (0-Second Tab Switch Anti-Lag by ZettBOT)
  cache: {
    dashboard: null,
    dashboardTime: 0,
    leaveList: null,
    leaveListTime: 0,
    reports: {}
  },
  userLocation: {
    latitude: null,
    longitude: null,
    distanceMeter: null,
    isWithinRadius: false
  },
  activePresensiType: "CHECK_IN",
  capturedPhotoBase64: null,
  cameraMediaStream: null,
  historyList: [],
  historyLimit: 3,
  todayAllEmployeesLog: [],
  lemburList: [],
  todayRecord: {
    checkInTime: null,
    checkInStatus: null,
    checkOutTime: null,
    checkOutStatus: null,
    totalHours: null
  },
  isSubmitting: false,
  adminLeafletMap: null,
  adminMarker: null,
  pickerLeafletMap: null,
  pickerMarker: null,
  pickerRadiusCircle: null,
  pickerSelectedLat: null,
  pickerSelectedLon: null
};

/**
 * ==========================================================================
 * FITUR TIME SESSION (IDLE INACTIVITY AUTO-LOGOUT: 3 MENIT TANPA PERGERAKAN)
 * Dilengkapi Throttling 4 Detik Anti-Lag untuk Performa Mobile Optimal
 * ==========================================================================
 */
let idleTimer = null;
let lastActivityResetTime = 0;
const IDLE_LIMIT_MS = 3 * 60 * 1000; // 3 Menit = 180.000 ms

function resetIdleTimer() {
  const now = Date.now();
  // Throttle 4 detik: Mencegah pemanggilan timer berlebih saat user scroll layar di HP
  if (now - lastActivityResetTime < 4000) return;
  lastActivityResetTime = now;

  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  // Hanya aktifkan timer jika pengguna sedang login
  if (AppState.sessionToken && AppState.currentUser) {
    idleTimer = setTimeout(triggerIdleAutoLogout, IDLE_LIMIT_MS);
  }
}

function triggerIdleAutoLogout() {
  if (!AppState.sessionToken && !AppState.currentUser) return;

  console.warn("User inaktif selama 3 menit. Memulai logout otomatis.");
  const token = AppState.sessionToken;
  if (token && typeof google !== "undefined" && google.script && google.script.run) {
    try { google.script.run.apiLogout(token); } catch (e) { }
  }

  AppState.currentUser = null;
  AppState.sessionToken = null;
  sessionStorage.removeItem("alhunafa_session_token");
  sessionStorage.removeItem("alhunafa_user");
  try { localStorage.setItem("alhunafa_active_tab", "Home"); } catch (e) { }

  // Tutup semua modal yang mungkin sedang terbuka
  closeScanModal();
  const pwdModal = document.getElementById("passwordModal");
  if (pwdModal) pwdModal.classList.remove("open");

  openLoginModal();
  showToast("Sesi berakhir: Tidak ada pergerakan selama 3 menit. Silakan login kembali.", "error");
}

function initIdleSessionTracker() {
  const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "touchmove", "scroll", "click", "wheel"];
  activityEvents.forEach(function (eventName) {
    window.addEventListener(eventName, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();
}

/**
 * Menangani respon 401 / Sesi Kadaluarsa atau Tidak Valid dari Server GAS
 */
function handleUnauthorizedSession(msg) {
  console.warn("Unauthorized / Sesi Berakhir:", msg);
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  AppState.sessionToken = null;
  AppState.currentUser = null;
  sessionStorage.removeItem("alhunafa_session_token");
  sessionStorage.removeItem("alhunafa_user");
  try { localStorage.setItem("alhunafa_active_tab", "Home"); } catch (e) { }
  showToast(msg || "Sesi login Anda telah berakhir. Silakan login kembali.", "error");
  openLoginModal();
}

// Inisialisasi saat window dimuat
document.addEventListener("DOMContentLoaded", function () {
  setupGreetingAndDate();
  startRealTimeClock();
  initDefaultReportDates();
  initIdleSessionTracker();

  const savedTab = localStorage.getItem("alhunafa_active_tab") || "Home";

  if (!AppState.currentUser || !AppState.sessionToken) {
    openLoginModal();
  } else {
    loadInitialData();
  }

  switchNavTab(savedTab);
  startLiveWorkTimer();
});

/**
 * Jam Digital Real-time di Header Frontend
 */
function startRealTimeClock() {
  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const clockEl = document.getElementById("liveClockDisplay");
    if (clockEl) {
      clockEl.innerText = hh + ":" + mm + ":" + ss + " WIB";
    }
  }
  updateClock();
  setInterval(updateClock, 1000);
}

/**
 * Sapaan otomatis dan tanggal lengkap
 */
function setupGreetingAndDate() {
  const now = new Date();
  const hour = now.getHours();
  let timeGreet = "Pagi";
  if (hour >= 11 && hour < 15) timeGreet = "Siang";
  else if (hour >= 15 && hour < 18) timeGreet = "Sore";
  else if (hour >= 18 || hour < 4) timeGreet = "Malam";

  const greeting = "Assalamu'alaikum, Selamat Datang";

  const greetingEl = document.getElementById("greetingText");
  if (greetingEl) greetingEl.innerText = greeting;

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const dateStr = days[now.getDay()] + ", " + now.getDate() + " " + months[now.getMonth()] + " " + now.getFullYear();

  const dateEl = document.getElementById("currentFullDate");
  if (dateEl) dateEl.innerText = dateStr;

  const monthLabel1 = document.getElementById("absenceMonthLabel");
  const monthLabel2 = document.getElementById("attendedMonthLabel");
  if (monthLabel1) monthLabel1.innerText = months[now.getMonth()];
  if (monthLabel2) monthLabel2.innerText = months[now.getMonth()];

  // Perbarui posisi GPS maps di background jika izin lokasi sudah aktif
  if (navigator.geolocation && (!AppState.userLocation || !AppState.userLocation.latitude)) {
    navigator.geolocation.getCurrentPosition(function (pos) {
      AppState.userLocation.latitude = pos.coords.latitude;
      AppState.userLocation.longitude = pos.coords.longitude;
    }, function () { }, { timeout: 4000 });
  }
}

/**
 * Inisialisasi default rentang tanggal export laporan (Awal bulan s/d hari ini)
 */
function initDefaultReportDates() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const firstDay = yyyy + "-" + mm + "-01";
  const today = yyyy + "-" + mm + "-" + dd;

  const startInput = document.getElementById("reportStartDate");
  const endInput = document.getElementById("reportEndDate");
  if (startInput) startInput.value = firstDay;
  if (endInput) endInput.value = today;
}

/**
 * ==========================================================================
 * FITUR 1: LIVE WORK DURATION TIMER (DIHITUNG DARI CHECK IN)
 * ==========================================================================
 */
function startLiveWorkTimer() {
  setInterval(function () {
    const timerDisplay = document.getElementById("workLiveTimerDisplay");
    const statusBadge = document.getElementById("workStatusBadge");
    const statusDot = document.getElementById("workStatusDot");
    const statusText = document.getElementById("workStatusText");
    const timeNote = document.getElementById("workTimeNote");
    if (!timerDisplay) return;

    const rec = AppState.todayRecord;

    // Skenario 1: Sudah Check In tapi BELUM Check Out (Sedang Bekerja)
    if (rec && rec.checkInTime && !rec.checkOutTime) {
      const inParts = rec.checkInTime.split(":");
      const now = new Date();
      const inDate = new Date();
      inDate.setHours(parseInt(inParts[0], 10), parseInt(inParts[1], 10), parseInt(inParts[2] || "0", 10), 0);

      let diffMs = now - inDate;
      if (diffMs < 0) diffMs = 0;

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const padH = String(hours).padStart(2, '0');
      const padM = String(minutes).padStart(2, '0');
      const padS = String(seconds).padStart(2, '0');

      timerDisplay.innerText = padH + " Jam " + padM + " Menit " + padS + " Detik";
      statusDot.style.display = "inline-block";
      statusText.innerText = "Sedang Bekerja";
      timeNote.innerHTML = "Waktu Check In: <strong>" + rec.checkInTime + " WIB</strong>";
    }
    // Skenario 2: Sudah Check Out (Selesai Bekerja)
    else if (rec && rec.checkInTime && rec.checkOutTime) {
      timerDisplay.innerText = "Total Jam Kerja: " + (rec.totalHours || "08:03") + " Jam";
      statusDot.style.display = "none";
      statusText.innerText = "Selesai Bekerja";
      timeNote.innerHTML = "Check In: <strong>" + rec.checkInTime + "</strong> • Check Out: <strong>" + rec.checkOutTime + "</strong>";
    }
    // Skenario 3: Belum Check In
    else {
      timerDisplay.innerText = "Belum Melakukan Check-In";
      statusDot.style.display = "none";
      statusText.innerText = "Menunggu Presensi";
      timeNote.innerText = "Silakan tekan tombol kamera di bawah untuk presensi masuk.";
    }
  }, 1000);
}

/**
 * Memuat data awal aplikasi (Dilengkapi In-Memory Caching untuk Transisi Super Cepat)
 */
function loadInitialData(forceRefresh) {
  updateUserInterface();

  const now = Date.now();
  // Gunakan cache jika data tersedia dan belum kedaluwarsa (<= 60 detik)
  if (!forceRefresh && AppState.cache && AppState.cache.dashboard && (now - AppState.cache.dashboardTime < 60000)) {
    applyDashboardData(AppState.cache.dashboard);
    return;
  }

  if (typeof google !== "undefined" && google.script && google.script.run) {
    if (!AppState.sessionToken) {
      console.warn("Belum ada token sesi GAS. Membuka login modal.");
      openLoginModal();
      return;
    }

    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          if (!AppState.cache) AppState.cache = {};
          AppState.cache.dashboard = res;
          AppState.cache.dashboardTime = Date.now();
          applyDashboardData(res);
        } else if (res && res.code === 401) {
          handleUnauthorizedSession(res.message);
        }
      })
      .withFailureHandler(function (err) {
        console.warn("GAS load fallback:", err);
        if (AppState.cache && AppState.cache.dashboard) {
          applyDashboardData(AppState.cache.dashboard);
        } else {
          loadMockData();
        }
      })
      .apiGetDashboardData(AppState.sessionToken, AppState.currentUser ? AppState.currentUser.idKaryawan : "");
  } else {
    loadMockData();
  }
}

function applyDashboardData(res) {
  if (!res) return;
  if (res.config) AppState.currentConfig = res.config;
  if (res.history) AppState.historyList = res.history;
  if (res.todayAllEmployeesLog) {
    AppState.todayAllEmployeesLog = res.todayAllEmployeesLog;
  } else {
    AppState.todayAllEmployeesLog = [];
  }
  if (res.todayRecord) {
    AppState.todayRecord = res.todayRecord;
  } else {
    AppState.todayRecord = null;
  }
  if (res.stats) {
    const attended = (res.stats && typeof res.stats.totalAttended !== "undefined") ? res.stats.totalAttended : 0;
    const absence = (res.stats && typeof res.stats.totalAbsence !== "undefined") ? res.stats.totalAbsence : 0;

    const attendedEl = document.getElementById("cardAttendedCount");
    const absenceEl = document.getElementById("cardAbsenceCount");
    if (attendedEl) attendedEl.innerHTML = attended + " <span>Day</span>";
    if (absenceEl) absenceEl.innerHTML = absence + " <span>Day</span>";

    const statAtt = document.getElementById("statAttendedFull");
    const statLeave = document.getElementById("statLeaveFull");
    if (statAtt) statAtt.innerText = attended + " Hari";
    if (statLeave) statLeave.innerText = absence + " Hari";

    renderAttendanceChart(attended, absence);
  }
  renderDashboardData();
}

function loadMockData() {
  renderAttendanceChart(0, 0);
  AppState.historyList = [];
  AppState.todayAllEmployeesLog = [];
  renderDashboardData();
}

function toggleSeeMoreHistory() {
  if (AppState.historyLimit >= 5) {
    AppState.historyLimit = 3;
    showToast("Menampilkan 3 riwayat kehadiran.", "info");
  } else {
    AppState.historyLimit = 5;
    showToast("Menampilkan riwayat 5 hari ke belakang.", "success");
  }
  renderDashboardData();
}

function updateUserInterface() {
  renderDashboardData();
  if (AppState.currentUser) {
    updateSettingsView();
  }
}

let adminMonitorFilter = "all";
let adminMonitorSearchQuery = "";

function setAdminMonitorFilter(filterType) {
  adminMonitorFilter = filterType;
  ["all", "working", "done"].forEach(function (type) {
    const chip = document.getElementById("chipFilter" + type.charAt(0).toUpperCase() + type.slice(1));
    if (chip) {
      if (type === filterType) chip.classList.add("active");
      else chip.classList.remove("active");
    }
  });
  renderAdminMonitoringView();
}

function handleAdminMonitorSearch(val) {
  adminMonitorSearchQuery = (val || "").trim().toLowerCase();
  renderAdminMonitoringView();
}

function getEmployeeInitials(name) {
  if (!name) return "PG";
  const clean = name.trim().replace(/^(H\.|Hj\.|Drs\.|Dr\.|Ir\.|M\.)\s*/i, "");
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

function getAvatarGradient(name) {
  const gradients = [
    "linear-gradient(135deg, #059669, #10b981)",
    "linear-gradient(135deg, #4f46e5, #6366f1)",
    "linear-gradient(135deg, #0891b2, #06b6d4)",
    "linear-gradient(135deg, #d97706, #f59e0b)",
    "linear-gradient(135deg, #e11d48, #f43f5e)",
    "linear-gradient(135deg, #7c3aed, #8b5cf6)",
    "linear-gradient(135deg, #2563eb, #3b82f6)",
    "linear-gradient(135deg, #0d9488, #14b8a6)"
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

function calculateLiveDuration(inTimeStr) {
  if (!inTimeStr || inTimeStr === "-") return "-";
  const parts = inTimeStr.split(":");
  if (parts.length < 2) return "-";
  const now = new Date();
  const inDate = new Date();
  inDate.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2] || "0", 10), 0);
  let diffMs = now - inDate;
  if (diffMs < 0) diffMs = 0;
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return m + " menit";
  return h + "j " + m + "m";
}

function renderAdminMonitoringView() {
  const adminSection = document.getElementById("adminMonitoringSection");
  const adminList = document.getElementById("adminMonitoringList");
  const adminBadge = document.getElementById("adminMonitoringBadge");

  if (!adminSection || !adminList) return;
  if (!AppState.currentUser || AppState.currentUser.role !== "Admin") {
    adminSection.style.display = "none";
    return;
  }

  adminSection.style.display = "block";
  const allLogs = AppState.todayAllEmployeesLog || [];

  const workingLogs = allLogs.filter(function (l) { return !l.checkOutTime || l.checkOutTime === "-"; });
  const doneLogs = allLogs.filter(function (l) { return l.checkOutTime && l.checkOutTime !== "-"; });

  // Update counters pada header & filter chips
  if (adminBadge) adminBadge.innerText = allLogs.length + " Pegawai";
  const cntAll = document.getElementById("countAllPegawai");
  const cntWork = document.getElementById("countWorkingPegawai");
  const cntDone = document.getElementById("countDonePegawai");
  if (cntAll) cntAll.innerText = allLogs.length;
  if (cntWork) cntWork.innerText = workingLogs.length;
  if (cntDone) cntDone.innerText = doneLogs.length;

  // Filter berdasarkan kategori
  let filtered = allLogs;
  if (adminMonitorFilter === "working") {
    filtered = workingLogs;
  } else if (adminMonitorFilter === "done") {
    filtered = doneLogs;
  }

  // Filter berdasarkan pencarian nama atau ID
  if (adminMonitorSearchQuery) {
    filtered = filtered.filter(function (l) {
      const name = (l.nama || "").toLowerCase();
      const id = (l.idKaryawan || "").toLowerCase();
      return name.indexOf(adminMonitorSearchQuery) !== -1 || id.indexOf(adminMonitorSearchQuery) !== -1;
    });
  }

  if (allLogs.length === 0) {
    adminList.innerHTML = '<div style="text-align:center; padding:24px 16px; font-size:13px; color:var(--text-sub); background:var(--card-bg); border-radius:var(--radius-lg); border:1px dashed var(--border-color);"><div style="font-size:24px; margin-bottom:6px;">📋</div>Belum ada pegawai yang melakukan presensi hari ini.</div>';
    return;
  }

  if (filtered.length === 0) {
    adminList.innerHTML = '<div style="text-align:center; padding:20px 16px; font-size:12.5px; color:var(--text-sub); background:var(--card-bg); border-radius:var(--radius-lg); border:1px dashed var(--border-color);">Tidak ditemukan data pegawai untuk filter ini.</div>';
    return;
  }

  let html = "";
  filtered.forEach(function (log) {
    const hasCheckedOut = log.checkOutTime && log.checkOutTime !== "-";
    const initials = getEmployeeInitials(log.nama);
    const gradient = getAvatarGradient(log.nama);
    const idBadgeText = log.idKaryawan ? log.idKaryawan : "Pegawai";
    const inTimeDisplay = log.checkInTime || "--:--";
    const outTimeDisplay = hasCheckedOut ? log.checkOutTime : "--:--:--";

    let durationDisplay = "-";
    if (hasCheckedOut) {
      durationDisplay = log.totalHours || "Selesai";
    } else {
      durationDisplay = calculateLiveDuration(log.checkInTime);
    }

    const statusBadgeHtml = hasCheckedOut
      ? '<div class="pegawai-status-badge badge-selesai"><span class="status-icon-check">✓</span> Selesai</div>'
      : '<div class="pegawai-status-badge badge-kerja"><span class="status-pulse-dot"></span> Sedang Kerja</div>';

    html += '<div class="admin-pegawai-card">' +
      '<div class="pegawai-card-top">' +
        '<div class="pegawai-profile-group">' +
          '<div class="pegawai-avatar" style="background:' + gradient + ';">' + initials + '</div>' +
          '<div class="pegawai-info">' +
            '<div class="pegawai-name">' + (log.nama || "Pegawai") + '</div>' +
            '<div class="pegawai-sub">' +
              '<span class="pegawai-id-badge">' + idBadgeText + '</span>' +
              '<span class="pegawai-time-hint">Masuk ' + inTimeDisplay + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        statusBadgeHtml +
      '</div>' +
      '<div class="pegawai-metrics-grid">' +
        '<div class="pegawai-metric-item">' +
          '<div class="metric-label">Check In</div>' +
          '<div class="metric-value text-green">' + inTimeDisplay + '</div>' +
          '<div class="metric-sub">' + (log.checkInStatus || "Hadir") + '</div>' +
        '</div>' +
        '<div class="pegawai-metric-item">' +
          '<div class="metric-label">Check Out</div>' +
          '<div class="metric-value ' + (hasCheckedOut ? 'text-blue' : 'text-muted') + '">' + outTimeDisplay + '</div>' +
          '<div class="metric-sub">' + (hasCheckedOut ? "Pulang" : "Belum Pulang") + '</div>' +
        '</div>' +
        '<div class="pegawai-metric-item">' +
          '<div class="metric-label">Durasi Kerja</div>' +
          '<div class="metric-value text-dark">' + durationDisplay + '</div>' +
          '<div class="metric-sub">' + (hasCheckedOut ? "Total Jam" : "Live Berjalan") + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  });

  adminList.innerHTML = html;
}

function renderDashboardData() {
  const userHeader = document.getElementById("userNameHeader");
  if (userHeader) userHeader.innerText = AppState.currentUser ? AppState.currentUser.nama : "-";

  const locLabel = (AppState.currentConfig.ALAMAT_KANTOR && AppState.currentConfig.ALAMAT_KANTOR !== "West Jakarta, Indonesia")
    ? AppState.currentConfig.ALAMAT_KANTOR
    : "Kantor Al Hunafa";
  document.getElementById("officeLocationLabel").innerText = locLabel;

  const cardIn = document.getElementById("cardCheckInTime");
  const cardInSub = document.getElementById("checkInSubText");
  const inBadge = document.getElementById("cardCheckInIconBadge");

  if (AppState.todayRecord && AppState.todayRecord.checkInTime) {
    if (cardIn) {
      cardIn.innerText = AppState.todayRecord.checkInTime.substring(0, 5);
      cardIn.classList.remove("muted-val");
    }
    if (cardInSub) cardInSub.innerText = AppState.todayRecord.checkInStatus || "Hadir";
    if (inBadge) inBadge.classList.remove("muted");
  } else {
    if (cardIn) {
      cardIn.innerText = "--:--";
      cardIn.classList.add("muted-val");
    }
    if (cardInSub) cardInSub.innerText = "Belum Presensi";
    if (inBadge) inBadge.classList.add("muted");
  }

  const cardOut = document.getElementById("cardCheckOutTime");
  const cardOutSub = document.getElementById("checkOutSubText");
  const outBadge = document.getElementById("cardCheckOutIconBadge");

  if (AppState.todayRecord && AppState.todayRecord.checkOutTime) {
    if (cardOut) {
      cardOut.innerText = AppState.todayRecord.checkOutTime.substring(0, 5);
      cardOut.classList.remove("muted-val");
    }
    if (cardOutSub) cardOutSub.innerText = AppState.todayRecord.checkOutStatus || "Hadir";
    if (outBadge) outBadge.classList.remove("muted");
  } else {
    if (cardOut) {
      cardOut.innerText = "--:--";
      cardOut.classList.add("muted-val");
    }
    if (cardOutSub) cardOutSub.innerText = "Belum Presensi";
    if (outBadge) outBadge.classList.add("muted");
  }

  // Khusus Role Admin: Render Pemantauan Presensi Pegawai Hari Ini di Beranda
  renderAdminMonitoringView();

  // Khusus Role Admin: Sembunyikan seluruh modul absen pribadi di Beranda & tombol kamera navigasi
  const isAdmin = (AppState.currentUser && AppState.currentUser.role === "Admin");
  const homeMetricsGrid = document.getElementById("homeMetricsGrid");
  const workDurationBanner = document.getElementById("workDurationBanner");
  const navCenterScan = document.getElementById("navCenterScanAction");
  const homeHistorySec = document.getElementById("homeAttendanceHistorySection");
  const analyticsHistSec = document.getElementById("analyticsPersonalHistorySection");

  if (homeMetricsGrid) {
    homeMetricsGrid.style.display = isAdmin ? "none" : "grid";
  }
  if (workDurationBanner) {
    workDurationBanner.style.display = isAdmin ? "none" : "block";
  }
  if (navCenterScan) {
    navCenterScan.style.display = isAdmin ? "none" : "flex";
  }
  if (homeHistorySec) {
    homeHistorySec.style.display = isAdmin ? "none" : "block";
  }
  if (analyticsHistSec) {
    analyticsHistSec.style.display = isAdmin ? "none" : "block";
  }

  // Render Riwayat Presensi di Beranda (Home)
  const container = document.getElementById("historyCardsContainer");
  if (container && !isAdmin) {
    container.innerHTML = "";
    if (!AppState.historyList || AppState.historyList.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; font-size:13px; color:var(--text-sub);">Belum ada catatan riwayat absensi.</div>';
    } else {
      const limit = AppState.historyLimit || 3;
      const listToShow = AppState.historyList.slice(0, limit);
      const btnSeeMore = document.getElementById("btnSeeMoreHistory");
      if (btnSeeMore) {
        btnSeeMore.innerText = (limit >= 5) ? "Show Less" : "See More";
      }

      listToShow.forEach(function (item) {
        const card = document.createElement("div");
        card.className = "history-card";
        card.innerHTML =
          '<div class="history-main-row">' +
          '<div class="date-box">' +
          '<div class="date-box-num">' + item.dayNumber + '</div>' +
          '<div class="date-box-day">' + item.dayName + '</div>' +
          '</div>' +
          '<div class="time-columns">' +
          '<div class="time-col">' +
          '<div class="time-val">' + item.checkInTime + '</div>' +
          '<div class="time-lbl">Check In</div>' +
          '</div>' +
          '<div class="time-col">' +
          '<div class="time-val">' + item.checkOutTime + '</div>' +
          '<div class="time-lbl">Check out</div>' +
          '</div>' +
          '<div class="time-col">' +
          '<div class="time-val">' + item.totalHours + '</div>' +
          '<div class="time-lbl">Total Jam</div>' +
          '</div>' +
          '</div>' +
          '</div>' +
          '<div class="history-location-row">' +
          '<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>' +
          '<span>' + (item.lokasi || AppState.currentConfig.ALAMAT_KANTOR) + '</span>' +
          '</div>';
        container.appendChild(card);
      });
    }
  }

  // Render Riwayat Kehadiran Pegawai di Tab Laporan (Analytics)
  const reportHistoryContainer = document.getElementById("personalReportHistoryList");
  if (reportHistoryContainer) {
    reportHistoryContainer.innerHTML = "";
    if (!AppState.historyList || AppState.historyList.length === 0) {
      reportHistoryContainer.innerHTML = '<div style="text-align:center; padding:20px; font-size:13px; color:var(--text-sub);">Belum ada riwayat kehadiran yang tercatat.</div>';
    } else {
      AppState.historyList.forEach(function (item) {
        const card = document.createElement("div");
        card.className = "history-card";
        card.innerHTML =
          '<div class="history-main-row">' +
          '<div class="date-box">' +
          '<div class="date-box-num">' + item.dayNumber + '</div>' +
          '<div class="date-box-day">' + item.dayName + '</div>' +
          '</div>' +
          '<div class="time-columns">' +
          '<div class="time-col">' +
          '<div class="time-val">' + item.checkInTime + '</div>' +
          '<div class="time-lbl">Check In</div>' +
          '</div>' +
          '<div class="time-col">' +
          '<div class="time-val">' + item.checkOutTime + '</div>' +
          '<div class="time-lbl">Check out</div>' +
          '</div>' +
          '<div class="time-col">' +
          '<div class="time-val">' + item.totalHours + '</div>' +
          '<div class="time-lbl">Total Jam</div>' +
          '</div>' +
          '</div>' +
          '</div>' +
          '<div class="history-location-row">' +
          '<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>' +
          '<span>' + (item.lokasi || AppState.currentConfig.ALAMAT_KANTOR) + '</span>' +
          '</div>';
        reportHistoryContainer.appendChild(card);
      });
    }
  }
}

/**
 * ==========================================================================
 * FITUR 4: GOOGLE MAPS DIRECT NAVIGATION & VISUAL MAP PICKER
 * ==========================================================================
 */
function openOfficeInGoogleMaps() {
  if (AppState.userLocation && AppState.userLocation.latitude && AppState.userLocation.longitude) {
    const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + AppState.userLocation.latitude + "," + AppState.userLocation.longitude;
    window.open(mapsUrl, "_blank");
    return;
  }

  if (navigator.geolocation) {
    showToast("Membuka koordinat Maps saat ini...", "info");
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        AppState.userLocation.latitude = pos.coords.latitude;
        AppState.userLocation.longitude = pos.coords.longitude;
        const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + pos.coords.latitude + "," + pos.coords.longitude;
        window.open(mapsUrl, "_blank");
      },
      function (err) {
        const lat = AppState.currentConfig.LATITUDE_KANTOR || -6.175392;
        const lon = AppState.currentConfig.LONGITUDE_KANTOR || 106.827153;
        const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lon;
        window.open(mapsUrl, "_blank");
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  } else {
    const lat = AppState.currentConfig.LATITUDE_KANTOR || -6.175392;
    const lon = AppState.currentConfig.LONGITUDE_KANTOR || 106.827153;
    const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lon;
    window.open(mapsUrl, "_blank");
  }
}

function openAdminSelectedInGoogleMaps() {
  const lat = document.getElementById("adminLatInput").value || -6.175392;
  const lon = document.getElementById("adminLonInput").value || 106.827153;
  const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lon;
  window.open(mapsUrl, "_blank");
}

function createGoogleMapsPinIcon() {
  return L.divIcon({
    className: 'gmaps-custom-pin-icon',
    html: '<div class="gmaps-pin-wrap">' +
      '<div class="gmaps-pin-pulse"></div>' +
      '<svg viewBox="0 0 24 24" width="34" height="42">' +
      '<path fill="#EA4335" stroke="#C5221F" stroke-width="0.8" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>' +
      '<circle cx="12" cy="9" r="2.8" fill="#FFFFFF"/>' +
      '</svg>' +
      '</div>',
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38]
  });
}

function initAdminInteractiveMap() {
  const mapContainer = document.getElementById("adminInteractiveMap");
  if (!mapContainer) return;

  const lat = parseFloat(AppState.currentConfig.LATITUDE_KANTOR) || -6.175392;
  const lon = parseFloat(AppState.currentConfig.LONGITUDE_KANTOR) || 106.827153;

  if (!AppState.adminLeafletMap) {
    AppState.adminLeafletMap = L.map("adminInteractiveMap").setView([lat, lon], 16);

    L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: "© Google Maps"
    }).addTo(AppState.adminLeafletMap);

    AppState.adminMarker = L.marker([lat, lon], {
      icon: createGoogleMapsPinIcon(),
      draggable: true
    }).addTo(AppState.adminLeafletMap);

    AppState.adminMarker.on("dragend", function (e) {
      const position = AppState.adminMarker.getLatLng();
      updateAdminCoordinates(position.lat, position.lng);
    });

    AppState.adminLeafletMap.on("click", function (e) {
      AppState.adminMarker.setLatLng(e.latlng);
      updateAdminCoordinates(e.latlng.lat, e.latlng.lng);
    });
  } else {
    setTimeout(function () {
      AppState.adminLeafletMap.invalidateSize();
      AppState.adminLeafletMap.setView([lat, lon], 16);
      AppState.adminMarker.setLatLng([lat, lon]);
    }, 200);
  }
}

function updateAdminCoordinates(lat, lon) {
  const roundLat = Math.round(lat * 1000000) / 1000000;
  const roundLon = Math.round(lon * 1000000) / 1000000;
  document.getElementById("adminLatInput").value = roundLat;
  document.getElementById("adminLonInput").value = roundLon;
  showToast("Titik lokasi kantor diperbarui di Google Maps!", "success");
}

function parseGoogleMapsUrlOrSearch() {
  const val = document.getElementById("mapsUrlSearchInput").value.trim();
  if (!val) {
    showToast("Ketik nama tempat, alamat, atau link Google Maps.", "info");
    return;
  }

  showToast("Mencari lokasi di Google Maps...", "info");

  if (typeof google !== "undefined" && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          const lat = res.lat;
          const lon = res.lon;
          if (AppState.adminLeafletMap && AppState.adminMarker) {
            AppState.adminLeafletMap.setView([lat, lon], 17);
            AppState.adminMarker.setLatLng([lat, lon]);
            updateAdminCoordinates(lat, lon);
          }
          const officeLabel = document.getElementById("adminOfficeNameInput");
          if (officeLabel && res.address && (!officeLabel.value || officeLabel.value === "Kantor Al Hunafa")) {
            officeLabel.value = res.address;
          }
          showToast("✓ Lokasi ditemukan di Google Maps!", "success");
        } else {
          fallbackLocalMapsSearch(val);
        }
      })
      .withFailureHandler(function (err) {
        fallbackLocalMapsSearch(val);
      })
      .apiSearchGoogleMapsLocation(AppState.sessionToken, val);
  } else {
    fallbackLocalMapsSearch(val);
  }

  function fallbackLocalMapsSearch(query) {
    const coordRegex = /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/;
    const match = query.match(coordRegex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      if (AppState.adminLeafletMap && AppState.adminMarker) {
        AppState.adminLeafletMap.setView([lat, lon], 17);
        AppState.adminMarker.setLatLng([lat, lon]);
        updateAdminCoordinates(lat, lon);
      }
      showToast("Koordinat diterapkan di Google Maps.", "success");
      return;
    }

    const urlMatch = query.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      query.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
      query.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (urlMatch) {
      const lat = parseFloat(urlMatch[1]);
      const lon = parseFloat(urlMatch[2]);
      if (AppState.adminLeafletMap && AppState.adminMarker) {
        AppState.adminLeafletMap.setView([lat, lon], 17);
        AppState.adminMarker.setLatLng([lat, lon]);
        updateAdminCoordinates(lat, lon);
      }
      showToast("Koordinat link Google Maps diterapkan.", "success");
      return;
    }

    fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(query))
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          if (AppState.adminLeafletMap && AppState.adminMarker) {
            AppState.adminLeafletMap.setView([lat, lon], 17);
            AppState.adminMarker.setLatLng([lat, lon]);
            updateAdminCoordinates(lat, lon);
            showToast("Lokasi ditemukan: " + data[0].display_name.substring(0, 30) + "...", "success");
          }
        } else {
          showToast("Lokasi tidak ditemukan. Coba ketik nama jalan atau geser pin langsung di peta.", "error");
        }
      })
      .catch(() => {
        showToast("Silakan klik atau geser pin langsung di peta Google Maps.", "info");
      });
  }
}

/**
 * ==========================================================================
 * FITUR PIN PETA INTERAKTIF ALA GOOGLE MAPS (DRAGGABLE PIN & GEOCODING)
 * ==========================================================================
 */
function openMapPickerModal() {
  const modal = document.getElementById("mapPickerModal");
  if (!modal) return;
  modal.classList.add("open");

  let lat = parseFloat(AppState.currentConfig.LATITUDE_KANTOR) || -6.175392;
  let lon = parseFloat(AppState.currentConfig.LONGITUDE_KANTOR) || 106.827153;

  if (AppState.userLocation && AppState.userLocation.latitude && !AppState.userLocation.isWithinRadius) {
    lat = AppState.userLocation.latitude;
    lon = AppState.userLocation.longitude;
  }

  AppState.pickerSelectedLat = lat;
  AppState.pickerSelectedLon = lon;
  updatePickerCoordsDisplay(lat, lon);

  setTimeout(function () {
    initPickerInteractiveMap(lat, lon);
  }, 200);
}

function closeMapPickerModal() {
  const modal = document.getElementById("mapPickerModal");
  if (modal) modal.classList.remove("open");
}

function initPickerInteractiveMap(lat, lon) {
  const mapContainer = document.getElementById("pickerInteractiveMap");
  if (!mapContainer) return;

  if (!AppState.pickerLeafletMap) {
    AppState.pickerLeafletMap = L.map("pickerInteractiveMap").setView([lat, lon], 17);

    L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: "© Google Maps"
    }).addTo(AppState.pickerLeafletMap);

    AppState.pickerMarker = L.marker([lat, lon], {
      icon: createGoogleMapsPinIcon(),
      draggable: true
    }).addTo(AppState.pickerLeafletMap);

    AppState.pickerRadiusCircle = L.circle([lat, lon], {
      radius: 50,
      color: '#2e7d32',
      fillColor: '#2e7d32',
      fillOpacity: 0.15,
      weight: 1.5
    }).addTo(AppState.pickerLeafletMap);

    AppState.pickerMarker.on("drag", function (e) {
      const pos = e.target.getLatLng();
      if (AppState.pickerRadiusCircle) AppState.pickerRadiusCircle.setLatLng(pos);
      updatePickerCoordsDisplay(pos.lat, pos.lng);
    });

    AppState.pickerMarker.on("dragend", function (e) {
      const pos = e.target.getLatLng();
      updatePickerCoordsDisplay(pos.lat, pos.lng);
    });

    AppState.pickerLeafletMap.on("click", function (e) {
      AppState.pickerMarker.setLatLng(e.latlng);
      if (AppState.pickerRadiusCircle) AppState.pickerRadiusCircle.setLatLng(e.latlng);
      updatePickerCoordsDisplay(e.latlng.lat, e.latlng.lng);
    });
  } else {
    AppState.pickerLeafletMap.invalidateSize();
    AppState.pickerLeafletMap.setView([lat, lon], 17);
    AppState.pickerMarker.setLatLng([lat, lon]);
    if (AppState.pickerRadiusCircle) AppState.pickerRadiusCircle.setLatLng([lat, lon]);
  }
}

function updatePickerCoordsDisplay(lat, lon) {
  AppState.pickerSelectedLat = Math.round(lat * 1000000) / 1000000;
  AppState.pickerSelectedLon = Math.round(lon * 1000000) / 1000000;
  const el = document.getElementById("pickerCoordsLabel");
  if (el) el.innerText = AppState.pickerSelectedLat + ", " + AppState.pickerSelectedLon;
}

function searchLocationOnPickerMap() {
  const query = (document.getElementById("pickerSearchInput").value || "").trim();
  if (!query) {
    showToast("Ketik nama lokasi atau alamat terlebih dahulu.", "info");
    return;
  }

  const coordMatch = query.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    movePickerTo(lat, lon, "Koordinat ditemukan.");
    return;
  }

  const urlCoordMatch = query.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    query.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
    query.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (urlCoordMatch) {
    const lat = parseFloat(urlCoordMatch[1]);
    const lon = parseFloat(urlCoordMatch[2]);
    movePickerTo(lat, lon, "Koordinat dari Google Maps diterapkan.");
    return;
  }

  showToast("Mencari lokasi di Google Maps...", "info");

  if (typeof google !== "undefined" && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          movePickerTo(res.lat, res.lon, "✓ Lokasi ditemukan di Google Maps!");
        } else {
          fallbackPickerSearch(query);
        }
      })
      .withFailureHandler(function () {
        fallbackPickerSearch(query);
      })
      .apiSearchGoogleMapsLocation(AppState.sessionToken, query);
  } else {
    fallbackPickerSearch(query);
  }

  function fallbackPickerSearch(q) {
    fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(q))
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          movePickerTo(lat, lon, "Lokasi ditemukan: " + (data[0].display_name ? data[0].display_name.substring(0, 32) + "..." : q));
        } else {
          showToast("Lokasi tidak ditemukan di Google Maps. Coba ketik nama jalan atau geser pin langsung di peta.", "error");
        }
      })
      .catch(function () {
        showToast("Silakan geser pin langsung di peta Google Maps.", "info");
      });
  }
}

function movePickerTo(lat, lon, msg) {
  if (AppState.pickerLeafletMap && AppState.pickerMarker) {
    AppState.pickerLeafletMap.flyTo([lat, lon], 17);
    AppState.pickerMarker.setLatLng([lat, lon]);
    if (AppState.pickerRadiusCircle) AppState.pickerRadiusCircle.setLatLng([lat, lon]);
    updatePickerCoordsDisplay(lat, lon);
    if (msg) showToast(msg, "success");
  }
}

function setPickerToMyCurrentLocation() {
  showToast("Mendeteksi posisi GPS ponsel Anda...", "info");
  if (!navigator.geolocation) {
    showToast("GPS tidak didukung pada browser ini.", "error");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      movePickerTo(lat, lon, "Pin dipindahkan ke posisi GPS Anda saat ini!");
    },
    function (err) {
      showToast("Gagal membaca GPS: Pastikan izin lokasi aktif.", "error");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function savePickerLocation() {
  const lat = AppState.pickerSelectedLat;
  const lon = AppState.pickerSelectedLon;
  if (!lat || !lon) {
    showToast("Titik lokasi belum dipilih.", "error");
    return;
  }

  AppState.currentConfig.LATITUDE_KANTOR = lat;
  AppState.currentConfig.LONGITUDE_KANTOR = lon;

  const adminLatInput = document.getElementById("adminLatInput");
  const adminLonInput = document.getElementById("adminLonInput");
  if (adminLatInput) adminLatInput.value = lat;
  if (adminLonInput) adminLonInput.value = lon;

  const btnSave = document.getElementById("btnSavePickerLocation");
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.innerText = "Menyimpan ke Server...";
  }

  const newCfg = {
    LATITUDE_KANTOR: String(lat),
    LONGITUDE_KANTOR: String(lon)
  };

  if (typeof google !== "undefined" && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerText = "✓ Simpan Lokasi Kantor";
        }
        closeMapPickerModal();
        showToast("Titik lokasi kantor berhasil disimpan!", "success");
        triggerGpsDetection();
      })
      .withFailureHandler(function (err) {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerText = "✓ Simpan Lokasi Kantor";
        }
        closeMapPickerModal();
        showToast("Lokasi aktif diperbarui secara lokal.", "info");
        triggerGpsDetection();
      })
      .apiSaveConfig(AppState.sessionToken, newCfg);
  } else {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.innerText = "✓ Simpan Lokasi Kantor";
    }
    closeMapPickerModal();
    showToast("Titik lokasi kantor diperbarui!", "success");
    triggerGpsDetection();
  }
}

/**
 * ==========================================================================
 * FITUR 3: UNIVERSAL CAMERA ENGINE (NATIVE MOBILE FRONT CAMERA & WEBCAM)
 * ==========================================================================
 */
function openScanModal(forcedType) {
  const modal = document.getElementById("scanModal");
  modal.classList.add("open");

  resetCameraState();

  if (forcedType) {
    setPresensiType(forcedType);
  } else if (AppState.todayRecord && AppState.todayRecord.checkInTime && !AppState.todayRecord.checkOutTime) {
    setPresensiType("CHECK_OUT");
  } else {
    setPresensiType("CHECK_IN");
  }

  triggerGpsDetection();
  startLiveCameraStream();
}

function closeScanModal() {
  document.getElementById("scanModal").classList.remove("open");
  stopLiveCameraStream();
}

function handleCameraBoxClick() {
  if (AppState.capturedPhotoBase64) return;
  handleCaptureAction();
}

function handleCaptureAction() {
  if (AppState.capturedPhotoBase64) {
    resetCameraState();
    startLiveCameraStream();
    return;
  }
  const video = document.getElementById("cameraLiveVideo");
  if (AppState.cameraMediaStream && video && video.videoWidth > 0) {
    takeLiveSnapshot();
  } else {
    triggerNativeCamera();
  }
}

function triggerNativeCamera() {
  if (AppState.capturedPhotoBase64) {
    resetCameraState();
  }
  const nativeInput = document.getElementById("nativeCameraInput");
  if (nativeInput) nativeInput.click();
}

function resetCameraState() {
  AppState.capturedPhotoBase64 = null;
  const img = document.getElementById("cameraSnapshotImg");
  const prompt = document.getElementById("cameraTouchPrompt");
  const video = document.getElementById("cameraLiveVideo");
  const reticle = document.getElementById("faceGuideReticle");
  const btnCapture = document.getElementById("btnCaptureSnap");

  if (img) { img.src = ""; img.style.display = "none"; }
  if (prompt) prompt.style.display = "flex";
  if (video) video.style.display = "block";
  if (reticle) reticle.style.display = "block";

  if (btnCapture) {
    btnCapture.innerHTML = "📸 Buka Kamera";
    btnCapture.style.background = "#2e7d32";
  }

  checkIfReadyToSubmit();
}

function startLiveCameraStream() {
  const video = document.getElementById("cameraLiveVideo");
  const prompt = document.getElementById("cameraTouchPrompt");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (prompt) prompt.style.display = "flex";
    return;
  }

  function setupVideoStream(stream) {
    AppState.cameraMediaStream = stream;
    video.srcObject = stream;
    video.setAttribute("autoplay", "true");
    video.setAttribute("playsinline", "true");
    video.muted = true;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(function (e) {
        console.warn("Video play notice:", e);
      });
    }

    video.onloadedmetadata = function () {
      video.style.display = "block";
      if (prompt) prompt.style.display = "none";
      const btnCapture = document.getElementById("btnCaptureSnap");
      if (btnCapture && !AppState.capturedPhotoBase64) {
        btnCapture.innerHTML = "📸 Jepret Foto Kamera";
        btnCapture.style.background = "#2e7d32";
      }
    };
  }

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
  })
    .then(setupVideoStream)
    .catch(function (err) {
      console.warn("Kamera user facingMode gagal, mencoba fallback kamera default:", err);
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(setupVideoStream)
        .catch(function (fallbackErr) {
          console.warn("Akses live webcam diblokir atau tidak tersedia:", fallbackErr);
          if (prompt) {
            prompt.style.display = "flex";
            const pText = prompt.querySelector(".prompt-cam-text");
            const pSub = prompt.querySelector(".prompt-cam-sub");
            if (pText) pText.innerText = "Sentuh / Klik untuk Buka Kamera";
            if (pSub) pSub.innerText = "Ambil selfie presensi atau unggah file";
          }
          const btnCapture = document.getElementById("btnCaptureSnap");
          if (btnCapture && !AppState.capturedPhotoBase64) {
            btnCapture.innerHTML = "📸 Buka Kamera / Pilih Foto";
          }
        });
    });
}

function stopLiveCameraStream() {
  if (AppState.cameraMediaStream) {
    AppState.cameraMediaStream.getTracks().forEach(track => track.stop());
    AppState.cameraMediaStream = null;
  }
}

function takeLiveSnapshot() {
  const video = document.getElementById("cameraLiveVideo");
  if (!video || video.videoWidth === 0) {
    triggerNativeCamera();
    return;
  }

  const canvas = document.getElementById("cameraPreviewCanvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");

  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const base64 = canvas.toDataURL("image/jpeg", 0.85);
  AppState.capturedPhotoBase64 = base64;

  const img = document.getElementById("cameraSnapshotImg");
  const prompt = document.getElementById("cameraTouchPrompt");
  const reticle = document.getElementById("faceGuideReticle");
  const btnCapture = document.getElementById("btnCaptureSnap");

  img.src = base64;
  img.style.display = "block";
  video.style.display = "none";
  if (reticle) reticle.style.display = "none";
  if (prompt) prompt.style.display = "none";

  if (btnCapture) {
    btnCapture.innerHTML = "🔄 Ambil Ulang Foto";
    btnCapture.style.background = "#475569";
  }

  stopLiveCameraStream();
  checkIfReadyToSubmit();
  showToast("Foto selfie berhasil dijepret!", "success");
}

function handleNativeCameraCaptured(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  processAndDisplaySelfie(file, "Foto selfie berhasil diambil!");
  e.target.value = "";
}

function triggerGalleryFileInput() {
  document.getElementById("galleryFileInput").click();
}

function handleGalleryPhotoSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  processAndDisplaySelfie(file, "Foto berhasil dimuat dari galeri!");
  e.target.value = "";
}

function processAndDisplaySelfie(file, successMsg) {
  const reader = new FileReader();
  reader.onload = function (evt) {
    const rawImg = new Image();
    rawImg.onload = function () {
      const canvas = document.createElement("canvas");
      let width = rawImg.width;
      let height = rawImg.height;
      const maxDim = 1080;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(rawImg, 0, 0, width, height);

      const compressed = canvas.toDataURL("image/jpeg", 0.85);
      AppState.capturedPhotoBase64 = compressed;

      const img = document.getElementById("cameraSnapshotImg");
      const prompt = document.getElementById("cameraTouchPrompt");
      const video = document.getElementById("cameraLiveVideo");
      const reticle = document.getElementById("faceGuideReticle");
      const btnCapture = document.getElementById("btnCaptureSnap");

      if (img) { img.src = compressed; img.style.display = "block"; }
      if (prompt) prompt.style.display = "none";
      if (video) video.style.display = "none";
      if (reticle) reticle.style.display = "none";

      if (btnCapture) {
        btnCapture.innerHTML = "🔄 Ambil Ulang Foto";
        btnCapture.style.background = "#475569";
      }

      stopLiveCameraStream();
      checkIfReadyToSubmit();
      showToast(successMsg || "Foto selfie siap dikirim!", "success");
    };
    rawImg.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * ==========================================================================
 * FITUR 2: EXPORT LAPORAN RENTANG TANGGAL (EXCEL & PDF)
 * Dilengkapi In-Memory Report Caching (Anti-Lag & Akses Instan)
 * ==========================================================================
 */
function exportReportToExcel() {
  const start = document.getElementById("reportStartDate").value;
  const end = document.getElementById("reportEndDate").value;
  const cacheKey = (start || "all") + "_" + (end || "all");

  // Jika data pada rentang tanggal sama sudah ada di cache, langsung unduh instan 0 detik
  if (AppState.cache && AppState.cache.reports && AppState.cache.reports[cacheKey]) {
    downloadXlsxFile(AppState.cache.reports[cacheKey], start, end);
    return;
  }

  showToast("Mengambil data laporan dari server...", "info");

  if (typeof google !== "undefined" && google.script && google.script.run) {
    if (!AppState.sessionToken) {
      handleUnauthorizedSession("Sesi tidak valid. Silakan login kembali.");
      return;
    }
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          if (!AppState.cache) AppState.cache = {};
          if (!AppState.cache.reports) AppState.cache.reports = {};
          AppState.cache.reports[cacheKey] = res.data;
          downloadXlsxFile(res.data, start, end);
        } else if (res && res.code === 401) {
          handleUnauthorizedSession(res.message);
        } else {
          showToast((res ? res.message : "Gagal mengambil data laporan."), "error");
        }
      })
      .withFailureHandler(function (err) {
        showToast("Gagal mengambil laporan: " + (err.message || err), "error");
      })
      .apiGetFilteredReport(AppState.sessionToken, start, end);
  } else {
    showToast("Gagal mengambil laporan dari server.", "error");
  }
}

function downloadXlsxFile(dataRows, start, end) {
  if (!dataRows || dataRows.length === 0) {
    showToast("Tidak ada data presensi pada rentang tanggal tersebut.", "error");
    return;
  }

  if (typeof XLSX === "undefined") {
    showToast("Memuat modul Excel, silakan coba beberapa detik lagi...", "info");
    return;
  }

  const excelRows = dataRows.map(function (r, idx) {
    return {
      "No": idx + 1,
      "ID Presensi": r.idPresensi || "-",
      "ID Karyawan": r.idKaryawan || "-",
      "Nama Pegawai": r.nama || "-",
      "Tanggal": r.tanggal || r.formattedDate || "-",
      "Waktu Check In": r.checkIn || "-",
      "Waktu Check Out": r.checkOut || "-",
      "Total Jam Kerja": r.totalHours || "-",
      "Lokasi Presensi": r.lokasi || "Office",
      "Foto Masuk Link": r.fotoMasukUrl || "-",
      "Foto Pulang Link": r.fotoPulangUrl || "-"
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelRows);

  ws["!cols"] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 14 },
    { wch: 24 },
    { wch: 16 },
    { wch: 15 },
    { wch: 15 },
    { wch: 16 },
    { wch: 28 },
    { wch: 30 },
    { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Rekap Presensi");
  const fileName = "Rekap_Presensi_Al_Hunafa_" + (start || "Semua") + "_sd_" + (end || "HariIni") + ".xlsx";
  XLSX.writeFile(wb, fileName);

  showToast("Berkas Excel (.xlsx) berhasil diunduh!", "success");
}

function openPrintPdfReport() {
  const start = document.getElementById("reportStartDate").value;
  const end = document.getElementById("reportEndDate").value;
  const cacheKey = (start || "all") + "_" + (end || "all");

  document.getElementById("printPeriodLabel").innerText = "Periode: " + (start || "Semua") + " s/d " + (end || "Hari Ini");
  const tbody = document.getElementById("printReportTableBody");
  tbody.innerHTML = "";

  const renderTable = function (rows) {
    tbody.innerHTML = "";
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" align="center" style="padding:15px; color:#666;">Tidak ada data presensi pada rentang tanggal ini.</td></tr>';
      window.print();
      return;
    }
    rows.forEach(function (r, idx) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td align="center">' + (idx + 1) + '</td>' +
        '<td>' + (r.idPresensi || "-") + '</td>' +
        '<td>' + (r.nama || "-") + '</td>' +
        '<td>' + (r.tanggal || r.formattedDate || "-") + '</td>' +
        '<td align="center">' + (r.checkIn || "-") + '</td>' +
        '<td align="center">' + (r.checkOut || "-") + '</td>' +
        '<td align="center"><strong>' + (r.totalHours || "-") + '</strong></td>';
      tbody.appendChild(tr);
    });
    window.print();
  };

  // Gunakan cache in-memory jika tersedia
  if (AppState.cache && AppState.cache.reports && AppState.cache.reports[cacheKey]) {
    renderTable(AppState.cache.reports[cacheKey]);
    return;
  }

  showToast("Menyiapkan dokumen cetak PDF...", "info");

  if (typeof google !== "undefined" && google.script && google.script.run) {
    if (!AppState.sessionToken) {
      handleUnauthorizedSession("Sesi tidak valid. Silakan login kembali.");
      return;
    }
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success && res.data) {
          if (!AppState.cache) AppState.cache = {};
          if (!AppState.cache.reports) AppState.cache.reports = {};
          AppState.cache.reports[cacheKey] = res.data;
          renderTable(res.data);
        } else if (res && res.code === 401) {
          handleUnauthorizedSession(res.message);
        } else {
          showToast((res ? res.message : "Gagal memuat data PDF."), "error");
        }
      })
      .withFailureHandler(function (err) {
        showToast("Gagal memuat data PDF: " + (err.message || err), "error");
      })
      .apiGetFilteredReport(AppState.sessionToken, start, end);
  }
}

/**
 * ==========================================================================
 * GRAFIK PERFORMA KEHADIRAN (CHART.JS DOUGHNUT)
 * ==========================================================================
 */
let attendanceChartInstance = null;
function renderAttendanceChart(param1, param2, param3) {
  const canvas = document.getElementById("attendanceDoughnutChart");
  if (!canvas) return;
  if (typeof Chart === "undefined") {
    setTimeout(function () { renderAttendanceChart(param1, param2, param3); }, 300);
    return;
  }

  let totalHadir = 0;
  let totalSakitIzin = 0;

  if (typeof param3 !== "undefined") {
    totalHadir = (Number(param1) || 0) + (Number(param2) || 0);
    totalSakitIzin = Number(param3) || 0;
  } else if (typeof param1 === "number" && typeof param2 === "number") {
    totalHadir = param1;
    totalSakitIzin = param2;
  } else if (AppState && AppState.currentStats) {
    totalHadir = AppState.currentStats.totalAttended || 0;
    totalSakitIzin = AppState.currentStats.totalAbsence || 0;
  }

  const elHadir = document.getElementById("statAttendedFull");
  if (elHadir) elHadir.innerText = totalHadir + " Hari";
  const elLeave = document.getElementById("statLeaveFull");
  if (elLeave) elLeave.innerText = totalSakitIzin + " Hari";

  if (attendanceChartInstance) {
    attendanceChartInstance.destroy();
  }

  const isZero = (totalHadir === 0 && totalSakitIzin === 0);
  const chartLabels = isZero ? ["Belum Ada Data"] : ["Hadir", "Sakit/Izin"];
  const chartData = isZero ? [1] : [totalHadir, totalSakitIzin];
  const chartColors = isZero ? ["#e2e8f0"] : ["#22c55e", "#3b82f6"];
  const chartHover = isZero ? ["#cbd5e1"] : ["#16a34a", "#2563eb"];

  attendanceChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartData,
        backgroundColor: chartColors,
        hoverBackgroundColor: chartHover,
        borderWidth: 3,
        borderColor: "#ffffff",
        hoverOffset: isZero ? 0 : 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: 9,
            padding: 12,
            font: { family: "Plus Jakarta Sans", size: 12, weight: "600" }
          }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return " " + ctx.label + ": " + ctx.raw + " Hari";
            }
          }
        }
      }
    }
  });
}

/**
 * Switcher Navigasi Bawah
 */
function switchNavTab(tabName) {
  const tabs = ["Home", "Analytics", "Leave", "Settings"];
  if (!tabName || !tabs.includes(tabName)) {
    tabName = "Home";
  }
  tabs.forEach(function (t) {
    const btn = document.getElementById("nav" + t);
    const view = document.getElementById("view" + t);
    if (btn) btn.classList.remove("active");
    if (view) view.classList.remove("active-view");
  });

  const activeBtn = document.getElementById("nav" + tabName);
  const activeView = document.getElementById("view" + tabName);
  if (activeBtn) activeBtn.classList.add("active");
  if (activeView) activeView.classList.add("active-view");

  try {
    localStorage.setItem("alhunafa_active_tab", tabName);
  } catch (e) {
    console.warn("Storage tab warning:", e);
  }

  const vp = document.getElementById("viewportScroll");
  if (vp) vp.scrollTop = 0;

  if (tabName === "Analytics") {
    setTimeout(function () {
      renderAttendanceChart();
    }, 120);
  }

  if (tabName === "Leave") {
    renderLeaveView();
  }

  if (tabName === "Settings") {
    updateSettingsView();
    setTimeout(initAdminInteractiveMap, 150);
  }
}

function updateSettingsView() {
  if (!AppState.currentUser) return;

  document.getElementById("profileName").innerText = AppState.currentUser.nama;
  document.getElementById("profileNip").innerText = AppState.currentUser.nip;

  const jabatanEl = document.getElementById("profileJabatan");
  if (jabatanEl) {
    jabatanEl.innerText = AppState.currentUser.jabatan || (AppState.currentUser.role === "Admin" ? "HRD & Operational Manager" : "Staff Operasional");
  }

  const roleBadge = document.getElementById("profileRoleBadge");
  if (roleBadge) {
    if (AppState.currentUser.role === "Admin") {
      roleBadge.className = "role-pill-badge role-pill-admin";
      roleBadge.innerText = "Admin";
    } else {
      roleBadge.className = "role-pill-badge role-pill-pegawai";
      roleBadge.innerText = "Pegawai";
    }
  }

  const userPhoto = AppState.currentUser.photoUrl || localStorage.getItem("userPhoto_" + AppState.currentUser.nip);
  const avatarImg = document.getElementById("profileAvatarImg");
  const avatarInitials = document.getElementById("profileAvatarInitials");

  if (avatarImg && avatarInitials) {
    if (userPhoto) {
      avatarImg.src = userPhoto;
      avatarImg.style.display = "block";
      avatarInitials.style.display = "none";
    } else {
      avatarImg.style.display = "none";
      avatarInitials.style.display = "inline";
      const names = (AppState.currentUser.nama || "User").trim().split(" ");
      let initials = names[0].charAt(0).toUpperCase();
      if (names.length > 1) {
        initials += names[names.length - 1].charAt(0).toUpperCase();
      }
      avatarInitials.innerText = initials;
    }
  }

  const adminArea = document.getElementById("adminPanelArea");
  if (AppState.currentUser.role === "Admin") {
    adminArea.style.display = "block";
    document.getElementById("adminLatInput").value = AppState.currentConfig.LATITUDE_KANTOR;
    document.getElementById("adminLonInput").value = AppState.currentConfig.LONGITUDE_KANTOR;
    document.getElementById("adminRadiusInput").value = AppState.currentConfig.RADIUS_MAKSIMAL_METER;
    document.getElementById("adminOfficeNameInput").value = AppState.currentConfig.ALAMAT_KANTOR || "West Jakarta, Indonesia";

    // Sinkronkan input URL Web App GAS jika elemen tersedia di DOM
    const gasApiInput = document.getElementById("adminGasApiUrlInput");
    if (gasApiInput) {
      gasApiInput.value = getGasApiUrl();
    }
  } else {
    adminArea.style.display = "none";
  }
}

function triggerGpsDetection(onComplete) {
  const radarCard = document.getElementById("gpsRadarCard");
  const statusText = document.getElementById("gpsStatusText");
  const subText = document.getElementById("gpsDistanceSub");
  const outOfRangeAction = document.getElementById("gpsOutOfRangeAction");

  if (outOfRangeAction) outOfRangeAction.style.display = "none";

  if (!navigator.geolocation) {
    showToast("GPS tidak didukung di browser ini.", "error");
    if (outOfRangeAction) outOfRangeAction.style.display = "block";
    return;
  }

  statusText.innerText = "Mendeteksi posisi GPS presisi...";
  subText.innerText = "Pastikan izin lokasi ponsel telah aktif.";

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      AppState.userLocation.latitude = lat;
      AppState.userLocation.longitude = lon;

      const dist = calculateClientHaversine(
        lat, lon,
        AppState.currentConfig.LATITUDE_KANTOR,
        AppState.currentConfig.LONGITUDE_KANTOR
      );
      const roundedDist = Math.round(dist * 10) / 10;
      AppState.userLocation.distanceMeter = roundedDist;

      const maxRadius = AppState.currentConfig.RADIUS_MAKSIMAL_METER || 50;

      if (roundedDist <= maxRadius) {
        AppState.userLocation.isWithinRadius = true;
        radarCard.className = "radar-box valid";
        statusText.innerText = "Lokasi Valid: " + roundedDist + " meter dari kantor";
        subText.innerText = "✓ Anda berada dalam batas radius maksimal " + maxRadius + "m.";
        if (outOfRangeAction) outOfRangeAction.style.display = "none";
        checkIfReadyToSubmit();
      } else {
        AppState.userLocation.isWithinRadius = false;
        radarCard.className = "radar-box invalid";
        statusText.innerText = "Di Luar Jarak: " + roundedDist + " meter dari kantor";
        subText.innerText = "✕ Maksimal " + maxRadius + "m. Anda belum bisa presensi.";
        if (outOfRangeAction) outOfRangeAction.style.display = "block";
        document.getElementById("btnSubmitPresensi").disabled = true;
      }

      if (onComplete) onComplete(true, roundedDist);
    },
    function (err) {
      console.warn("GPS error:", err);
      radarCard.className = "radar-box invalid";
      statusText.innerText = "Gagal Mengakses GPS";
      subText.innerText = "Silakan izinkan akses lokasi di pengaturan browser ponsel Anda.";
      if (outOfRangeAction) outOfRangeAction.style.display = "block";
      document.getElementById("btnSubmitPresensi").disabled = true;
      if (onComplete) onComplete(false, null);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

function calculateClientHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function setPresensiType(type) {
  AppState.activePresensiType = type;
  const btnIn = document.getElementById("btnTypeCheckIn");
  const btnOut = document.getElementById("btnTypeCheckOut");

  if (type === "CHECK_IN") {
    btnIn.classList.add("active");
    btnOut.classList.remove("active");
  } else {
    btnIn.classList.remove("active");
    btnOut.classList.add("active");
  }
  checkIfReadyToSubmit();
}

function checkIfReadyToSubmit() {
  const btn = document.getElementById("btnSubmitPresensi");
  const isGpsOk = AppState.userLocation.isWithinRadius;
  const isPhotoOk = !!AppState.capturedPhotoBase64;

  if (isGpsOk && isPhotoOk && !AppState.isSubmitting) {
    btn.disabled = false;
    btn.innerText = "Kirim Presensi Sekarang";
  } else {
    btn.disabled = true;
    if (!isGpsOk) btn.innerText = "Di Luar Radius Kantor";
    else if (!isPhotoOk) btn.innerText = "Ambil Foto Selfie Dulu";
  }
}

function submitAttendanceProcess() {
  if (AppState.isSubmitting) return;
  AppState.isSubmitting = true;

  const btn = document.getElementById("btnSubmitPresensi");
  btn.disabled = true;
  btn.innerText = "Mengupload ke Google Drive...";

  const payload = {
    idKaryawan: AppState.currentUser.idKaryawan,
    type: AppState.activePresensiType,
    latitude: AppState.userLocation.latitude,
    longitude: AppState.userLocation.longitude,
    base64Photo: AppState.capturedPhotoBase64
  };

  if (typeof google !== "undefined" && google.script && google.script.run) {
    if (!AppState.sessionToken) {
      AppState.isSubmitting = false;
      btn.disabled = false;
      btn.innerText = "Kirim Presensi Sekarang";
      handleUnauthorizedSession("Sesi tidak valid. Silakan login kembali.");
      return;
    }
    google.script.run
      .withSuccessHandler(function (res) {
        AppState.isSubmitting = false;
        if (res && res.success) {
          closeScanModal();
          showToast(res.message, "success");

          if (!AppState.todayRecord) {
            AppState.todayRecord = { checkInTime: null, checkInStatus: null, checkOutTime: null, checkOutStatus: null, totalHours: null };
          }
          const pType = payload.type || (res ? res.type : null) || AppState.activePresensiType;
          const now = new Date();
          const fallbackTime = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
          const displayTime = (res && res.time) ? res.time : fallbackTime;

          if (pType === "CHECK_IN") {
            AppState.todayRecord.checkInTime = displayTime;
            AppState.todayRecord.checkInStatus = res.status || "Hadir";
          } else if (pType === "CHECK_OUT") {
            AppState.todayRecord.checkOutTime = displayTime;
            AppState.todayRecord.checkOutStatus = res.status || "Selesai";
            if (res.totalHours) AppState.todayRecord.totalHours = res.totalHours;
          }
          renderDashboardData();
          loadInitialData();
        } else if (res && res.code === 401) {
          btn.disabled = false;
          btn.innerText = "Kirim Presensi Sekarang";
          handleUnauthorizedSession(res.message);
        } else {
          btn.disabled = false;
          btn.innerText = "Kirim Presensi Sekarang";
          showToast((res ? res.message : "Gagal memproses presensi."), "error");
        }
      })
      .withFailureHandler(function (err) {
        AppState.isSubmitting = false;
        btn.disabled = false;
        btn.innerText = "Kirim Presensi Sekarang";
        showToast("Kesalahan server: " + err.message, "error");
      })
      .apiSubmitPresensi(AppState.sessionToken, payload);
  }
}

let currentLeaveProofBase64 = null;

function handleLeaveProofFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!file.type.match("image.*")) {
    showToast("File bukti wajib berupa gambar (JPG, PNG, atau WebP).", "error");
    e.target.value = "";
    return;
  }

  showToast("Memproses foto bukti...", "info");
  const reader = new FileReader();
  reader.onload = function (evt) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      const maxSide = 960;
      if (width > maxSide || height > maxSide) {
        if (width > height) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        } else {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      currentLeaveProofBase64 = canvas.toDataURL("image/jpeg", 0.75);

      const previewImg = document.getElementById("proofPreviewImg");
      const fileNameEl = document.getElementById("proofFileName");
      const previewWrap = document.getElementById("proofPreviewWrap");
      const uploadBox = document.getElementById("proofUploadBox");

      if (previewImg) previewImg.src = currentLeaveProofBase64;
      if (fileNameEl) fileNameEl.innerText = file.name;
      if (previewWrap) previewWrap.style.display = "block";
      if (uploadBox) uploadBox.style.display = "none";
      showToast("Foto bukti siap dilampirkan.", "success");
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function clearLeaveProof() {
  currentLeaveProofBase64 = null;
  const fileInput = document.getElementById("leaveProofFileInput");
  if (fileInput) fileInput.value = "";
  const previewWrap = document.getElementById("proofPreviewWrap");
  const uploadBox = document.getElementById("proofUploadBox");
  if (previewWrap) previewWrap.style.display = "none";
  if (uploadBox) uploadBox.style.display = "flex";
}

function openProofViewerModal(imgUrl, title) {
  const modal = document.getElementById("proofViewerModal");
  const img = document.getElementById("proofViewerImg");
  const titleEl = document.getElementById("proofViewerTitle");
  const driveLink = document.getElementById("proofViewerDriveLink");

  if (modal && img) {
    let displayUrl = imgUrl;
    if (imgUrl.indexOf("/file/d/") !== -1) {
      const match = imgUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        displayUrl = "https://lh3.googleusercontent.com/d/" + match[1];
      }
    }
    img.src = displayUrl;
    img.onerror = function () {
      if (imgUrl.indexOf("/file/d/") !== -1) {
        const match = imgUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          img.src = "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w1000";
        }
      }
    };
    if (titleEl) titleEl.innerText = title || "Lampiran Bukti Surat";
    if (driveLink) {
      driveLink.href = imgUrl;
      driveLink.style.display = (imgUrl && imgUrl.startsWith("http")) ? "inline-flex" : "none";
    }
    modal.classList.add("open");
  }
}

function closeProofViewerModal() {
  const modal = document.getElementById("proofViewerModal");
  if (modal) modal.classList.remove("open");
}

function renderLeaveView() {
  const isAdmin = (AppState.currentUser && AppState.currentUser.role === "Admin");
  const adminSection = document.getElementById("adminLeaveSection");
  const empSection = document.getElementById("employeeLeaveSection");

  if (adminSection) adminSection.style.display = isAdmin ? "block" : "none";
  if (empSection) empSection.style.display = isAdmin ? "none" : "block";

  if (isAdmin) {
    fetchAndRenderAdminLeaveRequests();
  } else {
    fetchAndRenderEmployeeLeaveHistory();
  }
}

let adminLeaveFilter = "all";

function setAdminLeaveFilter(filterType) {
  adminLeaveFilter = filterType;
  ["all", "pending", "lembur", "izin"].forEach(function (type) {
    const chip = document.getElementById("chipLeaveFilter" + type.charAt(0).toUpperCase() + type.slice(1));
    if (chip) {
      if (type === filterType) chip.classList.add("active");
      else chip.classList.remove("active");
    }
  });
  if (AppState.cache && AppState.cache.adminLeaves) {
    fetchAndRenderAdminLeaveRequests(false);
  } else {
    fetchAndRenderAdminLeaveRequests(true);
  }
}

function handleLeaveTypeChange(val) {
  const lblReason = document.getElementById("lblReason");
  const leaveReason = document.getElementById("leaveReason");
  const lblProof = document.getElementById("lblProofAttachment");
  const promptTitle = document.getElementById("proofUploadPromptTitle");
  const btnSubmit = document.getElementById("btnSubmitLeave");

  if (val === "Lembur") {
    if (lblReason) lblReason.innerText = "Keterangan / Rincian Tugas Lembur";
    if (leaveReason) leaveReason.placeholder = "Jelaskan rincian tugas lembur (misal: Persiapan PPDB, Piket Acara Malam s/d 20:00)...";
    if (lblProof) lblProof.innerText = "Lampiran Bukti (Surat Tugas / Foto Kegiatan Lembur)";
    if (promptTitle) promptTitle.innerText = "Pilih Foto Surat Tugas / Foto Kegiatan";
    if (btnSubmit) btnSubmit.innerText = "Kirim Pengajuan Lembur";
  } else {
    if (lblReason) lblReason.innerText = "Keterangan / Alasan";
    if (leaveReason) leaveReason.placeholder = "Tuliskan keterangan detail...";
    if (lblProof) lblProof.innerText = "Lampiran Bukti (Surat Dokter / Foto Pendukung)";
    if (promptTitle) promptTitle.innerText = "Pilih Foto / Jepret Surat Sakit";
    if (btnSubmit) btnSubmit.innerText = "Kirim Pengajuan Izin";
  }
}

function fetchAndRenderAdminLeaveRequests(force) {
  const container = document.getElementById("adminLeaveCardsContainer");
  const badgeCount = document.getElementById("adminLeaveBadgeCount");
  if (!container) return;

  function renderList(list) {
    if (!list || list.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:24px; font-size:13px; color:var(--text-sub); background:var(--card-bg); border-radius:var(--radius-md); border:1px dashed var(--primary-border);">Belum ada pengajuan izin/lembur dari pegawai.</div>';
      if (badgeCount) badgeCount.innerText = "0 Menunggu";
      const cAll = document.getElementById("countLeaveAll");
      const cPen = document.getElementById("countLeavePending");
      const cLem = document.getElementById("countLeaveLembur");
      const cIz = document.getElementById("countLeaveIzin");
      if (cAll) cAll.innerText = "0";
      if (cPen) cPen.innerText = "0";
      if (cLem) cLem.innerText = "0";
      if (cIz) cIz.innerText = "0";
      return;
    }

    const pendingCount = list.filter(l => l.status === "Menunggu").length;
    const lemburCount = list.filter(l => l.jenis === "Lembur").length;
    const izinCount = list.filter(l => l.jenis !== "Lembur").length;

    if (badgeCount) badgeCount.innerText = pendingCount + " Menunggu";
    const cAll = document.getElementById("countLeaveAll");
    const cPen = document.getElementById("countLeavePending");
    const cLem = document.getElementById("countLeaveLembur");
    const cIz = document.getElementById("countLeaveIzin");
    if (cAll) cAll.innerText = list.length;
    if (cPen) cPen.innerText = pendingCount;
    if (cLem) cLem.innerText = lemburCount;
    if (cIz) cIz.innerText = izinCount;

    let displayList = list;
    if (adminLeaveFilter === "pending") {
      displayList = list.filter(l => l.status === "Menunggu");
    } else if (adminLeaveFilter === "lembur") {
      displayList = list.filter(l => l.jenis === "Lembur");
    } else if (adminLeaveFilter === "izin") {
      displayList = list.filter(l => l.jenis !== "Lembur");
    }

    if (displayList.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; font-size:12.5px; color:var(--text-sub); background:var(--card-bg); border-radius:var(--radius-md); border:1px dashed var(--border-color);">Tidak ada pengajuan untuk kategori ini.</div>';
      return;
    }

    let html = "";
    displayList.forEach(function (item) {
      let pillClass = "pill-izin";
      if (item.jenis === "Sakit") pillClass = "pill-sakit";
      if (item.jenis === "Cuti") pillClass = "pill-cuti";
      if (item.jenis === "Lembur") pillClass = "pill-lembur";
      if (item.jenis === "Lembur") pillClass = "pill-lembur";

      let statusBadge = "";
      if (item.status === "Disetujui") {
        statusBadge = '<span style="font-size: 11px; font-weight: 700; color: #15803d; background: #dcfce7; padding: 3px 8px; border-radius: 999px;">✓ Disetujui</span>';
      } else if (item.status === "Ditolak") {
        statusBadge = '<span style="font-size: 11px; font-weight: 700; color: #b91c1c; background: #fee2e2; padding: 3px 8px; border-radius: 999px;">✕ Ditolak</span>';
      } else {
        statusBadge = '<span style="font-size: 11px; font-weight: 700; color: #b45309; background: #fef3c7; padding: 3px 8px; border-radius: 999px;">⏳ Menunggu</span>';
      }

      let proofButton = "";
      if (item.bukti && item.bukti !== "-" && item.bukti.startsWith("http")) {
        const proofTitle = (item.jenis === "Lembur") ? "Bukti Tugas Lembur" : ("Bukti " + (item.jenis || "Izin"));
        proofButton = '<button type="button" class="btn-view-proof" onclick="openProofViewerModal(\'' + item.bukti + '\', \'' + proofTitle + ' - ' + (item.nama || "") + '\')">📄 Lihat Bukti Lampiran</button>';
      }

      let actionButtons = "";
      if (item.status === "Menunggu") {
        actionButtons = '<div class="leave-actions-row">' +
          '<button type="button" class="btn-approve-leave" onclick="updateLeaveStatusByAdmin(\'' + item.idPengajuan + '\', \'Disetujui\')">✓ Terima / Setujui</button>' +
          '<button type="button" class="btn-reject-leave" onclick="updateLeaveStatusByAdmin(\'' + item.idPengajuan + '\', \'Ditolak\')">✕ Tolak</button>' +
          '</div>';
      }

      html += '<div class="leave-approval-card" id="leaveCard-' + item.idPengajuan + '">' +
        '<div class="leave-card-header">' +
        '<div>' +
        '<div class="leave-emp-name">' + (item.nama || "Pegawai") + '</div>' +
        '<div style="font-size: 11px; color: var(--text-sub); margin-top: 1px;">ID: ' + (item.idPengajuan || "-") + '</div>' +
        '</div>' +
        '<div style="display: flex; gap: 5px; align-items: center;">' +
        '<span class="leave-type-pill ' + pillClass + '">' + (item.jenis || "Izin") + '</span>' +
        statusBadge +
        '</div>' +
        '</div>' +
        '<div class="leave-date-range">📅 ' + (item.tglMulai || "-") + ' s/d ' + (item.tglSelesai || "-") + '</div>' +
        '<div class="leave-reason-text">"' + (item.alasan || "Tanpa keterangan") + '"</div>' +
        (proofButton ? '<div style="margin-top: 6px;">' + proofButton + '</div>' : '') +
        actionButtons +
        '</div>';
    });

    container.innerHTML = html;
  }

  // Gunakan cache in-memory jika tersedia
  const now = Date.now();
  if (!force && AppState.cache && AppState.cache.adminLeaves && (now - AppState.cache.adminLeavesTime < 60000)) {
    renderList(AppState.cache.adminLeaves);
    return;
  }

  container.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;"><div class="btn-spinner" style="margin: 0 auto 10px auto; border-top-color: var(--primary);"></div>Memuat data pengajuan izin...</div>';

  if (typeof google !== "undefined" && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success && res.data) {
          if (!AppState.cache) AppState.cache = {};
          AppState.cache.adminLeaves = res.data;
          AppState.cache.adminLeavesTime = Date.now();
          renderList(res.data);
        } else {
          container.innerHTML = '<div style="text-align:center; padding:20px; font-size:13px; color:var(--text-sub);">Belum ada pengajuan izin.</div>';
        }
      })
      .withFailureHandler(function (err) {
        if (AppState.cache && AppState.cache.adminLeaves) {
          renderList(AppState.cache.adminLeaves);
        } else {
          container.innerHTML = '<div style="text-align:center; padding:20px; font-size:13px; color:var(--danger);">Gagal memuat data: ' + err.message + '</div>';
        }
      })
      .apiGetIzinList(AppState.sessionToken);
  }
}

function updateLeaveStatusByAdmin(idPengajuan, newStatus) {
  if (!confirm("Konfirmasi: Apakah Anda yakin ingin memproses pengajuan ini menjadi \"" + newStatus + "\"?")) {
    return;
  }

  const card = document.getElementById("leaveCard-" + idPengajuan);
  if (card) {
    card.style.opacity = "0.5";
    card.style.pointerEvents = "none";
  }

  if (typeof google !== "undefined" && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          if (AppState.cache) {
            AppState.cache.adminLeaves = null;
            AppState.cache.employeeLeaves = null;
          }
          showToast(res.message, "success");
          fetchAndRenderAdminLeaveRequests(true);
        } else {
          if (card) {
            card.style.opacity = "1";
            card.style.pointerEvents = "auto";
          }
          showToast((res ? res.message : "Gagal mengupdate pengajuan."), "error");
        }
      })
      .withFailureHandler(function (err) {
        if (card) {
          card.style.opacity = "1";
          card.style.pointerEvents = "auto";
        }
        showToast("Gagal terhubung ke server: " + err.message, "error");
      })
      .apiUpdateStatusIzin(AppState.sessionToken, idPengajuan, newStatus);
  }
}

function fetchAndRenderEmployeeLeaveHistory(force) {
  const container = document.getElementById("personalLeaveHistoryContainer");
  if (!container) return;

  function renderEmpList(data) {
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:18px; font-size:12.5px; color:var(--text-sub); background:var(--card-bg); border-radius:var(--radius-md); border:1px dashed var(--border-color);">Belum ada riwayat pengajuan izin sebelumnya.</div>';
      return;
    }
    let html = "";
    data.forEach(function (item) {
      let pillClass = "pill-izin";
      if (item.jenis === "Sakit") pillClass = "pill-sakit";
      if (item.jenis === "Cuti") pillClass = "pill-cuti";
      if (item.jenis === "Lembur") pillClass = "pill-lembur";

      let statusBadge = "";
      if (item.status === "Disetujui") {
        statusBadge = '<span style="font-size: 11px; font-weight: 700; color: #15803d; background: #dcfce7; padding: 3px 8px; border-radius: 999px;">✓ Disetujui</span>';
      } else if (item.status === "Ditolak") {
        statusBadge = '<span style="font-size: 11px; font-weight: 700; color: #b91c1c; background: #fee2e2; padding: 3px 8px; border-radius: 999px;">✕ Ditolak</span>';
      } else {
        statusBadge = '<span style="font-size: 11px; font-weight: 700; color: #b45309; background: #fef3c7; padding: 3px 8px; border-radius: 999px;">⏳ Menunggu</span>';
      }

      let proofButton = "";
      if (item.bukti && item.bukti !== "-" && item.bukti.startsWith("http")) {
        proofButton = '<button type="button" class="btn-view-proof" onclick="openProofViewerModal(\'' + item.bukti + '\', \'Bukti ' + (item.jenis || "Izin") + '\')">📄 Lihat Bukti Surat</button>';
      }

      html += '<div class="leave-approval-card">' +
        '<div class="leave-card-header">' +
        '<span class="leave-type-pill ' + pillClass + '">' + (item.jenis || "Izin") + '</span>' +
        statusBadge +
        '</div>' +
        '<div class="leave-date-range">📅 ' + (item.tglMulai || "-") + ' s/d ' + (item.tglSelesai || "-") + '</div>' +
        '<div style="font-size: 12.5px; color: #475569; margin-top: 4px;">"' + (item.alasan || "-") + '"</div>' +
        (proofButton ? '<div style="margin-top: 8px;">' + proofButton + '</div>' : '') +
        '</div>';
    });
    container.innerHTML = html;
  }

  // Gunakan cache jika tersedia
  const now = Date.now();
  if (!force && AppState.cache && AppState.cache.employeeLeaves && (now - AppState.cache.employeeLeavesTime < 60000)) {
    renderEmpList(AppState.cache.employeeLeaves);
    return;
  }

  if (typeof google !== "undefined" && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success && res.data) {
          if (!AppState.cache) AppState.cache = {};
          AppState.cache.employeeLeaves = res.data;
          AppState.cache.employeeLeavesTime = Date.now();
          renderEmpList(res.data);
        } else {
          container.innerHTML = '<div style="text-align:center; padding:18px; font-size:12.5px; color:var(--text-sub); background:var(--card-bg); border-radius:var(--radius-md); border:1px dashed var(--border-color);">Belum ada riwayat pengajuan izin sebelumnya.</div>';
        }
      })
      .withFailureHandler(function (err) {
        if (AppState.cache && AppState.cache.employeeLeaves) {
          renderEmpList(AppState.cache.employeeLeaves);
        } else {
          container.innerHTML = '<div style="text-align:center; padding:18px; font-size:12.5px; color:var(--danger);">Gagal memuat data izin: ' + err.message + '</div>';
        }
      })
      .apiGetIzinList(AppState.sessionToken);
  }
}

function handleLeaveSubmit(e) {
  e.preventDefault();
  const jenis = document.getElementById("leaveType").value;
  const tglMulai = document.getElementById("leaveStartDate").value;
  const tglSelesai = document.getElementById("leaveEndDate").value;
  const alasan = document.getElementById("leaveReason").value;
  const submitBtn = document.getElementById("btnSubmitLeave");

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Mengirim Pengajuan...";
  }

  const payload = {
    idKaryawan: AppState.currentUser ? AppState.currentUser.idKaryawan : "",
    jenis: jenis,
    tglMulai: tglMulai,
    tglSelesai: tglSelesai,
    alasan: alasan,
    buktiPhoto: currentLeaveProofBase64 || "-"
  };

  if (typeof google !== "undefined" && google.script && google.script.run) {
    if (!AppState.sessionToken) {
      handleUnauthorizedSession("Sesi tidak valid. Silakan login kembali.");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Kirim Pengajuan Izin"; }
      return;
    }
    google.script.run
      .withSuccessHandler(function (res) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = "Kirim Pengajuan Izin";
        }
        if (res && res.success) {
          if (AppState.cache) {
            AppState.cache.employeeLeaves = null;
            AppState.cache.adminLeaves = null;
          }
          showToast(res.message, "success");
          document.getElementById("leaveForm").reset();
          handleLeaveTypeChange("Sakit");
          clearLeaveProof();
          fetchAndRenderEmployeeLeaveHistory(true);
        } else if (res && res.code === 401) {
          handleUnauthorizedSession(res.message);
        } else {
          showToast((res ? res.message : "Gagal memproses pengajuan."), "error");
        }
      })
      .withFailureHandler(function (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = "Kirim Pengajuan Izin";
        }
        showToast("Gagal mengirim pengajuan: " + err.message, "error");
      })
      .apiSubmitIzin(AppState.sessionToken, payload);
  }
}

function detectCurrentLocationForAdmin() {
  if (!navigator.geolocation) {
    showToast("GPS tidak didukung.", "error");
    return;
  }
  showToast("Mendeteksi posisi koordinat kantor...", "info");
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      if (AppState.adminLeafletMap && AppState.adminMarker) {
        AppState.adminLeafletMap.setView([lat, lon], 17);
        AppState.adminMarker.setLatLng([lat, lon]);
        updateAdminCoordinates(lat, lon);
      }
    },
    function (err) {
      showToast("Gagal mengambil GPS: " + err.message, "error");
    },
    { enableHighAccuracy: true }
  );
}

function saveAdminSettings() {
  const lat = parseFloat(document.getElementById("adminLatInput").value);
  const lon = parseFloat(document.getElementById("adminLonInput").value);
  const radius = parseFloat(document.getElementById("adminRadiusInput").value);
  const officeName = document.getElementById("adminOfficeNameInput").value.trim();

  // Simpan URL API ke localStorage browser
  let urlUpdated = false;
  const gasApiInput = document.getElementById("adminGasApiUrlInput");
  if (gasApiInput) {
    const rawVal = gasApiInput.value.trim();
    if (rawVal) {
      setGasApiUrl(rawVal);
      urlUpdated = true;
    }
  }

  if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
    if (urlUpdated) {
      showToast("URL Web App Google Sheets berhasil disimpan di aplikasi!", "success");
      return;
    }
    showToast("Mohon tentukan lokasi di peta dan radius yang valid.", "error");
    return;
  }

  const newCfg = {
    LATITUDE_KANTOR: lat,
    LONGITUDE_KANTOR: lon,
    RADIUS_MAKSIMAL_METER: radius,
    ALAMAT_KANTOR: officeName
  };

  if (typeof google !== "undefined" && google.script && google.script.run) {
    if (!AppState.sessionToken) {
      if (urlUpdated) showToast("URL Web App berhasil disimpan di browser!", "success");
      handleUnauthorizedSession("Sesi tidak valid. Silakan login kembali.");
      return;
    }
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          showToast(res.message || "Pengaturan kantor dan URL berhasil disimpan!", "success");
          AppState.currentConfig.LATITUDE_KANTOR = lat;
          AppState.currentConfig.LONGITUDE_KANTOR = lon;
          AppState.currentConfig.RADIUS_MAKSIMAL_METER = radius;
          AppState.currentConfig.ALAMAT_KANTOR = officeName;
          document.getElementById("officeLocationLabel").innerText = officeName;
        } else if (res && res.code === 401) {
          handleUnauthorizedSession(res.message);
        } else {
          const errMsg = res ? (res.message || "") : "";
          if (errMsg.indexOf("tidak dikenal") !== -1) {
            showToast("URL Web App tersimpan di browser! Catatan: Google Apps Script Anda perlu di-Deploy Versi Baru agar sinkron dengan Google Sheets.", "info");
          } else {
            showToast(errMsg || "Gagal menyimpan konfigurasi ke Google Sheets.", "error");
          }
        }
      })
      .withFailureHandler(function (err) {
        showToast("URL tersimpan di browser. Status sinkronisasi: " + (err.message || err), "info");
      })
      .apiSaveConfig(AppState.sessionToken, newCfg);
  }
}

function openLoginModal() {
  const modal = document.getElementById("loginModal");
  const backBtn = document.getElementById("loginBackBtn");
  if (backBtn) {
    backBtn.style.display = AppState.currentUser ? "flex" : "none";
  }
  modal.classList.add("open");
}

function closeLoginModal() {
  if (!AppState.currentUser) {
    showToast("Silakan masuk terlebih dahulu untuk mengakses aplikasi.", "info");
    return;
  }
  document.getElementById("loginModal").classList.remove("open");
}

function toggleLoginPasswordVisibility() {
  const pinInput = document.getElementById("loginPin");
  const eyeIcon = document.getElementById("loginEyeIcon");
  if (pinInput.type === "password") {
    pinInput.type = "text";
    eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
  } else {
    pinInput.type = "password";
    eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
  }
}

function handleLogout() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const token = AppState.sessionToken;
  if (token && typeof google !== "undefined" && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(function (res) {
        console.log("Logout backend result:", res);
      })
      .apiLogout(token);
  }
  AppState.currentUser = null;
  AppState.sessionToken = null;
  sessionStorage.removeItem("alhunafa_session_token");
  sessionStorage.removeItem("alhunafa_user");
  try { localStorage.setItem("alhunafa_active_tab", "Home"); } catch (e) { }
  openLoginModal();
  showToast("Anda telah keluar akun (Logout).", "info");
}

function openPasswordModal() {
  document.getElementById("passwordModal").classList.add("open");
  document.getElementById("oldPinInput").value = "";
  document.getElementById("newPinInput").value = "";
  document.getElementById("confirmPinInput").value = "";
}

function closePasswordModal() {
  document.getElementById("passwordModal").classList.remove("open");
}

function handlePasswordSubmit(e) {
  e.preventDefault();
  if (!AppState.currentUser) return;

  const oldPin = document.getElementById("oldPinInput").value.trim();
  const newPin = document.getElementById("newPinInput").value.trim();
  const confirmPin = document.getElementById("confirmPinInput").value.trim();

  if (!oldPin) {
    showToast("PIN / Password lama wajib diisi!", "error");
    return;
  }

  if (newPin.length < 4) {
    showToast("PIN baru minimal 4 karakter!", "error");
    return;
  }

  if (newPin !== confirmPin) {
    showToast("Konfirmasi PIN baru tidak cocok!", "error");
    return;
  }

  if (typeof google !== "undefined" && google.script && google.script.run) {
    if (!AppState.sessionToken) {
      handleUnauthorizedSession("Sesi tidak valid. Silakan login kembali.");
      return;
    }
    google.script.run
      .withSuccessHandler(function (res) {
        if (res && res.success) {
          localStorage.setItem("userPin_" + AppState.currentUser.nip, newPin);
          closePasswordModal();
          showToast("Password / PIN berhasil diperbarui!", "success");
        } else if (res && res.code === 401) {
          handleUnauthorizedSession(res.message);
        } else {
          showToast((res ? res.message : "Gagal mengubah password."), "error");
        }
      })
      .apiUpdatePassword(AppState.sessionToken, AppState.currentUser.idKaryawan, oldPin, newPin);
  }
}

function handleProfilePhotoUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Format berkas harus berupa foto / gambar.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (evt) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      const maxDim = 250;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);

      if (AppState.currentUser) {
        AppState.currentUser.photoUrl = compressedDataUrl;
        localStorage.setItem("userPhoto_" + AppState.currentUser.nip, compressedDataUrl);

        if (typeof google !== "undefined" && google.script && google.script.run) {
          if (AppState.sessionToken) {
            google.script.run
              .withSuccessHandler(function (res) {
                if (res && res.code === 401) {
                  handleUnauthorizedSession(res.message);
                } else {
                  console.log("Photo synced to sheet:", res);
                }
              })
              .apiUpdateProfilePhoto(AppState.sessionToken, AppState.currentUser.idKaryawan, compressedDataUrl);
          }
        }

        updateSettingsView();
        showToast("Foto profil berhasil diperbarui!", "success");
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const rawInput = document.getElementById("loginNip").value.trim();
  const cleanInput = rawInput.toLowerCase();
  const pin = document.getElementById("loginPin").value.trim();
  const btn = document.getElementById("btnLoginSubmit");
  const formEl = document.getElementById("loginCardSurface");

  if (!rawInput || !pin) {
    showToast("Email/Username dan PIN wajib diisi.", "error");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="btn-spinner"></div><span>Memverifikasi...</span>';

  setTimeout(function () {
    if (typeof google !== "undefined" && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function (res) {
          if (res && res.success) {
            AppState.sessionToken = res.token || null;
            AppState.currentUser = res.user;
            if (res.token) {
              sessionStorage.setItem("alhunafa_session_token", res.token);
            }
            if (res.user) {
              sessionStorage.setItem("alhunafa_user", JSON.stringify(res.user));
            }
            resetIdleTimer();

            btn.style.background = "#2e7d32";
            btn.innerHTML = '<span>✓ Berhasil Masuk!</span>';
            setTimeout(function () {
              closeLoginModal();
              resetLoginBtn();
              showToast("Selamat datang, " + res.user.nama + "!", "success");
              loadInitialData();
              if (res.user.role === "Admin") {
                updateSettingsView();
              }
              try {
                localStorage.setItem("alhunafa_active_tab", "Home");
              } catch (e) { }
              switchNavTab("Home");
            }, 500);
          } else {
            triggerLoginFailure(res.message || "Email/Username atau PIN salah.");
          }
        })
        .withFailureHandler(function (err) {
          triggerLoginFailure("Gagal terhubung ke server: " + (err.message || err));
        })
        .apiLogin(rawInput, pin);
    } else {
      triggerLoginFailure("Backend API belum terhubung. Silakan cek URL Web App di Pengaturan.");
    }
  }, 600);

  function triggerLoginFailure(msg) {
    resetLoginBtn();
    if (formEl) {
      formEl.classList.remove("shake-error");
      void formEl.offsetWidth;
      formEl.classList.add("shake-error");
    }
    showToast(msg, "error");
    const pinField = document.getElementById("loginPin");
    if (pinField) {
      pinField.value = "";
      pinField.focus();
    }
  }

  function resetLoginBtn() {
    btn.disabled = false;
    btn.style.background = "";
    btn.innerHTML = '<span>Login</span>';
  }
}

function showNotificationAlert() {
  showToast("Tidak ada notifikasi baru hari ini.", "info");
}

function openAllHistoryModal() {
  showToast("Menampilkan seluruh riwayat presensi bulan ini.", "info");
}

function showToast(message, type) {
  const toast = document.getElementById("appToast");
  const msgEl = document.getElementById("toastMessage");
  const iconEl = document.getElementById("toastIcon");

  toast.className = "toast show " + (type || "success");
  msgEl.innerText = message;
  iconEl.innerText = type === "error" ? "✕" : (type === "info" ? "ℹ" : "✓");

  setTimeout(function () {
    toast.classList.remove("show");
  }, 3500);
}
