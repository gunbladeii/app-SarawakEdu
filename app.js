let schools = [
  { name: "SMK Serian", candidates: 218, pass: 88, attendance: 94, gpa: 4.91, red: 11, amber: 28, subject: "Matematik" },
  { name: "SMK Taee", candidates: 96, pass: 77, attendance: 89, gpa: 5.42, red: 13, amber: 19, subject: "Sejarah" },
  { name: "SMK Tebakang", candidates: 104, pass: 82, attendance: 91, gpa: 5.18, red: 8, amber: 17, subject: "Bahasa Melayu" },
  { name: "SMK Gedong", candidates: 132, pass: 74, attendance: 86, gpa: 5.61, red: 18, amber: 24, subject: "Matematik" },
  { name: "SMK Balai Ringin", candidates: 156, pass: 79, attendance: 88, gpa: 5.36, red: 15, amber: 26, subject: "Sains" },
  { name: "SMK Tarat", candidates: 119, pass: 84, attendance: 92, gpa: 5.04, red: 7, amber: 18, subject: "Sejarah" },
  { name: "SMK Tebedu", candidates: 141, pass: 81, attendance: 90, gpa: 5.22, red: 10, amber: 23, subject: "Bahasa Inggeris" },
  { name: "SMK Sadong Jaya", candidates: 88, pass: 72, attendance: 84, gpa: 5.83, red: 16, amber: 15, subject: "Bahasa Melayu" },
  { name: "SMK Siburan", candidates: 176, pass: 86, attendance: 93, gpa: 4.98, red: 9, amber: 22, subject: "Matematik" }
];

let students = [
  { name: "Aina L.", school: "SMK Gedong", risk: "red", issue: "Gagal BM dan kehadiran 78%", intervention: "Sesi ibu bapa + mentor akademik" },
  { name: "Daniel A.", school: "SMK Sadong Jaya", risk: "red", issue: "Tidak capai lulus Sejarah", intervention: "Kelas pemulihan mikro + pemantauan mingguan" },
  { name: "Rizal J.", school: "SMK Balai Ringin", risk: "red", issue: "Ponteng berselang dan Matematik E", intervention: "Ziarah cakna bersama ketua kaum" },
  { name: "Nur F.", school: "SMK Taee", risk: "amber", issue: "Markah Sains menurun 12 mata", intervention: "Latih tubi terarah 4 minggu" },
  { name: "Brandon M.", school: "SMK Tebedu", risk: "amber", issue: "Kehadiran 86% dan BI rendah", intervention: "Buddy support + latihan lisan" },
  { name: "Siti R.", school: "SMK Serian", risk: "amber", issue: "GPA sasaran tergelincir", intervention: "Klinik subjek dan semakan target" },
  { name: "Aaron K.", school: "SMK Tarat", risk: "green", issue: "Perlu kekalkan momentum", intervention: "Set pengayaan SPM" }
];

let interventions = [
  { owner: "Sekolah", action: "Analisis item, kelas mikro, mentor mentee, pemantauan kehadiran harian." },
  { owner: "Ibu bapa", action: "Aku janji belajar, semakan jadual ulang kaji, sokongan kehadiran." },
  { owner: "Ketua kaum / penghulu", action: "Ziarah komuniti untuk kes kehadiran kritikal dan sokongan keluarga." },
  { owner: "YB / agensi", action: "Sokongan logistik, ruang belajar komuniti, bantuan peranti atau pengangkutan." }
];

const riskLabel = {
  red: "Merah",
  amber: "Kuning",
  green: "Hijau"
};

const riskScore = {
  red: 3,
  amber: 2,
  green: 1
};

let cameraStream = null;
let scanFrameId = null;
let qrDetector = null;
let supabaseClient = null;
let activeSession = null;

function setDataSourceStatus(message) {
  const element = document.querySelector("#dataSourceStatus");
  if (element) element.textContent = message;
}

function getSupabaseConfig() {
  const config = window.SPM_WATCH_CONFIG || {};
  return {
    supabaseUrl: (config.supabaseUrl || "").replace(/\/$/, ""),
    supabaseAnonKey: config.supabaseAnonKey || "",
    requireAuth: Boolean(config.requireAuth)
  };
}

function hasSupabaseConfig(config) {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

function normalizeOAuthHash() {
  const hash = window.location.hash || "";
  const tokenMarker = "#access_token=";

  if (!hash.includes(tokenMarker) || hash.startsWith(tokenMarker)) {
    return;
  }

  const tokenStart = hash.indexOf(tokenMarker);
  const authHash = hash.slice(tokenStart);
  const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${authHash}`;
  window.history.replaceState(null, "", cleanUrl);
}

function getSupabaseClient() {
  const config = getSupabaseConfig();

  if (!hasSupabaseConfig(config) || !window.supabase?.createClient) {
    return null;
  }

  if (!supabaseClient) {
    normalizeOAuthHash();
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      }
    });
  }

  return supabaseClient;
}

function getSupabaseAccessToken(config) {
  return activeSession?.access_token || config.supabaseAnonKey;
}

async function fetchSupabaseRows(path, config) {
  const accessToken = getSupabaseAccessToken(config);
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.supabaseAnonKey,
      authorization: `Bearer ${accessToken}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function mapSchoolRow(row) {
  return {
    code: row.code,
    name: row.name,
    candidates: Number(row.candidates || 0),
    pass: Number(row.pass_forecast || 0),
    attendance: Number(row.attendance_avg || 0),
    gpa: Number(row.gpa || 0),
    red: Number(row.red_count || 0),
    amber: Number(row.amber_count || 0),
    subject: row.critical_subject || "-"
  };
}

function mapStudentRow(row) {
  return {
    name: row.name,
    school: row.school,
    risk: row.risk,
    issue: row.issue,
    intervention: row.intervention
  };
}

function mapInterventionRow(row) {
  return {
    owner: row.owner,
    action: row.action
  };
}

function clearDashboardData() {
  schools = [];
  students = [];
  interventions = [];
}

async function loadDashboardData() {
  const config = getSupabaseConfig();

  if (!hasSupabaseConfig(config)) {
    setDataSourceStatus("Data lokal");
    return;
  }

  if (config.requireAuth && !activeSession) {
    clearDashboardData();
    setDataSourceStatus("Perlu login");
    return;
  }

  setDataSourceStatus("Sync Supabase");

  try {
    const [schoolRows, studentRows, interventionRows] = await Promise.all([
      fetchSupabaseRows(
        "schools?select=code,name,candidates,pass_forecast,attendance_avg,gpa,red_count,amber_count,critical_subject&order=name.asc",
        config
      ),
      fetchSupabaseRows(
        "dashboard_student_risks?select=name,school,risk,issue,intervention,last_reviewed,updated_at&order=updated_at.desc",
        config
      ),
      fetchSupabaseRows("intervention_channels?select=owner,action,sort_order&order=sort_order.asc", config)
    ]);

    if (schoolRows.length === 0) {
      setDataSourceStatus("Supabase kosong");
      return;
    }

    schools = schoolRows.map(mapSchoolRow);
    if (studentRows.length > 0) students = studentRows.map(mapStudentRow);
    if (interventionRows.length > 0) interventions = interventionRows.map(mapInterventionRow);

    setDataSourceStatus("Supabase live");
  } catch (error) {
    console.warn(error);
    if (config.requireAuth) {
      clearDashboardData();
      setDataSourceStatus("Akses ditolak");
      return;
    }
    setDataSourceStatus("Fallback lokal");
  }
}

function getRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function getUserLabel(session) {
  const user = session?.user;
  return user?.user_metadata?.full_name || user?.email || "Pengguna Google";
}

function updateAuthUi(session) {
  const config = getSupabaseConfig();
  const loginBtn = document.querySelector("#googleLoginBtn");
  const heroLoginBtn = document.querySelector("#googleLoginHeroBtn");
  const logoutBtn = document.querySelector("#logoutBtn");
  const userChip = document.querySelector("#authUser");
  const authGateTitle = document.querySelector("#authGateTitle");
  const authGateText = document.querySelector("#authGateText");
  const isLocked = config.requireAuth && !session?.user;
  document.body.classList.toggle("auth-locked", isLocked);

  if (session?.user) {
    const label = getUserLabel(session);
    userChip.textContent = label;
    userChip.hidden = false;
    loginBtn.hidden = true;
    heroLoginBtn.hidden = true;
    logoutBtn.hidden = false;
    authGateTitle.textContent = "Login Google aktif";
    authGateText.textContent = `Masuk sebagai ${label}. Data Supabase akan dibaca menggunakan session pengguna ini.`;
    return;
  }

  userChip.hidden = true;
  loginBtn.hidden = false;
  heroLoginBtn.hidden = false;
  logoutBtn.hidden = true;
  authGateTitle.textContent = config.requireAuth ? "Login Google diperlukan" : "Mod login sudah disediakan";
  authGateText.textContent = config.requireAuth
    ? "Dashboard production dikunci. Sila masuk menggunakan akaun Google yang dibenarkan."
    : "Aktifkan Google provider di Supabase untuk guna sign-up/login sebenar. Dashboard demo kekal boleh dibaca sementara kita lengkapkan polisi akses.";
}

async function signInWithGoogle() {
  const client = getSupabaseClient();

  if (!client) {
    window.alert("Supabase client belum tersedia. Semak config.js dan sambungan internet.");
    return;
  }

  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      queryParams: {
        prompt: "select_account"
      },
      redirectTo: getRedirectUrl()
    }
  });

  if (error) {
    window.alert(`Google login gagal: ${error.message}`);
  }
}

async function signOut() {
  const client = getSupabaseClient();
  if (!client) return;

  await client.auth.signOut();
  activeSession = null;
  updateAuthUi(null);
  await loadDashboardData();
  renderAll();
}

async function initAuth() {
  const client = getSupabaseClient();

  if (!client) {
    updateAuthUi(null);
    return;
  }

  const { data, error } = await client.auth.getSession();
  if (!error) {
    activeSession = data.session;
  }
  updateAuthUi(activeSession);

  client.auth.onAuthStateChange((_event, session) => {
    activeSession = session;
    updateAuthUi(session);
    loadDashboardData().then(renderAll);
  });
}

function getSchoolRisk(school) {
  const redRate = school.red / school.candidates;
  if (school.pass < 78 || school.attendance < 87 || redRate > 0.1) return "red";
  if (school.pass < 84 || school.attendance < 91 || redRate > 0.065) return "amber";
  return "green";
}

function formatPct(value) {
  return `${Math.round(value)}%`;
}

function getFilteredData() {
  const term = document.querySelector("#searchInput").value.trim().toLowerCase();
  const risk = document.querySelector("#riskFilter").value;

  const filteredSchools = schools.filter((school) => {
    const schoolRisk = getSchoolRisk(school);
    const matchesTerm = school.name.toLowerCase().includes(term);
    const matchesRisk = risk === "all" || schoolRisk === risk;
    return matchesTerm && matchesRisk;
  });

  const filteredStudents = students.filter((student) => {
    const matchesTerm = [student.name, student.school, student.issue].some((value) =>
      value.toLowerCase().includes(term)
    );
    const matchesRisk = risk === "all" || student.risk === risk;
    return matchesTerm && matchesRisk;
  });

  return { filteredSchools, filteredStudents };
}

function renderSummary() {
  const totalCandidates = schools.reduce((sum, school) => sum + school.candidates, 0);
  const totalRed = schools.reduce((sum, school) => sum + school.red, 0);
  const weightedPass = totalCandidates
    ? schools.reduce((sum, school) => sum + school.pass * school.candidates, 0) / totalCandidates
    : 0;
  const weightedAttendance = totalCandidates
    ? schools.reduce((sum, school) => sum + school.attendance * school.candidates, 0) / totalCandidates
    : 0;

  document.querySelector("#totalCandidates").textContent = totalCandidates.toLocaleString("ms-MY");
  document.querySelector("#redCount").textContent = totalRed.toLocaleString("ms-MY");
  document.querySelector("#passForecast").textContent = formatPct(weightedPass);
  document.querySelector("#attendanceAvg").textContent = formatPct(weightedAttendance);
}

function renderCharts() {
  const chart = document.querySelector("#performanceChart");
  const donut = document.querySelector("#riskDonut");
  const legend = document.querySelector("#riskLegend");
  const totalCandidates = schools.reduce((sum, school) => sum + school.candidates, 0);
  const totalRed = schools.reduce((sum, school) => sum + school.red, 0);
  const totalAmber = schools.reduce((sum, school) => sum + school.amber, 0);
  const totalGreen = Math.max(totalCandidates - totalRed - totalAmber, 0);
  const redDeg = totalCandidates ? (totalRed / totalCandidates) * 360 : 0;
  const amberDeg = totalCandidates ? redDeg + (totalAmber / totalCandidates) * 360 : redDeg;
  const safeAvg = totalCandidates
    ? Math.round(schools.reduce((sum, school) => sum + school.pass * school.candidates, 0) / totalCandidates)
    : 0;

  chart.innerHTML = schools.length
    ? schools
    .map(
      (school) => `
        <div class="bar-row">
          <span title="${school.name}">${school.name}</span>
          <div class="bar-track" aria-label="${school.name} ramalan lulus ${school.pass}%">
            <span class="bar-fill" style="--bar-value: ${Math.min(school.pass, 100)}%"></span>
          </div>
          <strong>${school.pass}%</strong>
        </div>
      `
    )
    .join("")
    : `<div class="empty-state">Data akan dipaparkan selepas login Google.</div>`;

  donut.style.setProperty("--red-deg", `${redDeg}deg`);
  donut.style.setProperty("--amber-deg", `${amberDeg}deg`);
  donut.dataset.label = `${safeAvg}%`;
  legend.innerHTML = [
    ["Merah", totalRed, "red"],
    ["Kuning", totalAmber, "amber"],
    ["Hijau", totalGreen, "green"]
  ]
    .map(
      ([label, value, color]) => `
        <p><span><span class="dot ${color}"></span> ${label}</span><strong>${Number(value).toLocaleString("ms-MY")}</strong></p>
      `
    )
    .join("");
}

function renderSchools(filteredSchools) {
  const grid = document.querySelector("#schoolGrid");
  grid.innerHTML = filteredSchools.length
    ? filteredSchools
    .map((school) => {
      const risk = getSchoolRisk(school);
      return `
        <article class="school-card ${risk}">
          <div>
            <div class="traffic ${risk}" aria-label="Risiko ${riskLabel[risk]}">
              <span class="red"></span>
              <span class="amber"></span>
              <span class="green"></span>
            </div>
            <h4>${school.name}</h4>
          </div>
          <div class="school-stats">
            <div><span>Calon</span><strong>${school.candidates}</strong></div>
            <div><span>Lulus</span><strong>${school.pass}%</strong></div>
            <div><span>Hadir</span><strong>${school.attendance}%</strong></div>
          </div>
          <p>GPA ${school.gpa.toFixed(2)}. Subjek kritikal: <strong>${school.subject}</strong>.</p>
          <p>${school.red} merah, ${school.amber} kuning memerlukan tindak susul.</p>
        </article>
      `;
    })
    .join("")
    : `<div class="empty-state">Tiada data sekolah untuk dipaparkan.</div>`;
}

function renderDrivers() {
  const drivers = [
    {
      title: "Kehadiran bawah 87%",
      detail: `${schools.filter((school) => school.attendance < 87).length} sekolah perlu pemantauan harian.`
    },
    {
      title: "Subjek teras kritikal",
      detail: "BM, Sejarah dan Matematik menjadi isyarat awal risiko gagal SPM."
    },
    {
      title: "Jurang ramalan lulus",
      detail: `${schools.filter((school) => school.pass < 80).length} sekolah di bawah paras sasaran daerah 80%.`
    },
    {
      title: "Kes komuniti",
      detail: "Kes kehadiran merah wajar melibatkan ibu bapa, ketua kaum dan penghulu."
    }
  ];

  document.querySelector("#driverList").innerHTML = drivers
    .map((driver) => `<div class="driver-item"><strong>${driver.title}</strong><span>${driver.detail}</span></div>`)
    .join("");
}

function renderStudents(filteredStudents) {
  const sorted = [...filteredStudents].sort((a, b) => riskScore[b.risk] - riskScore[a.risk]);
  document.querySelector("#studentTable").innerHTML = sorted.length
    ? sorted
    .map(
      (student) => `
        <tr>
          <td><strong>${student.name}</strong></td>
          <td>${student.school}</td>
          <td><span class="risk-pill ${student.risk}">${riskLabel[student.risk]}</span></td>
          <td>${student.issue}</td>
          <td>${student.intervention}</td>
        </tr>
      `
    )
    .join("")
    : `<tr><td colspan="5">Tiada data murid risiko untuk dipaparkan.</td></tr>`;
}

function renderInterventions() {
  document.querySelector("#interventionStack").innerHTML = interventions.length
    ? interventions
    .map(
      (item) => `
        <div class="intervention-item">
          <strong>${item.owner}</strong>
          <span>${item.action}</span>
        </div>
      `
    )
    .join("")
    : `<div class="empty-state">Tiada saluran intervensi untuk dipaparkan.</div>`;
}

function renderAll() {
  const { filteredSchools, filteredStudents } = getFilteredData();
  renderSummary();
  renderCharts();
  renderSchools(filteredSchools);
  renderDrivers();
  renderStudents(filteredStudents);
  renderInterventions();
}

function buildSummaryText() {
  const redSchools = schools.filter((school) => getSchoolRisk(school) === "red");
  const redStudents = students.filter((student) => student.risk === "red");

  return [
    "RINGKASAN TINDAKAN DAERAH SERIAN",
    "",
    `Sekolah merah: ${redSchools.map((school) => school.name).join(", ")}`,
    `Murid risiko merah contoh: ${redStudents.map((student) => student.name).join(", ")}`,
    "",
    "Keutamaan 7 hari:",
    "1. Sahkan data kehadiran dan markah terkini setiap sekolah.",
    "2. Laksana kelas mikro BM, Sejarah dan Matematik untuk murid merah.",
    "3. Atur libat urus ibu bapa bagi murid ponteng atau gagal subjek teras.",
    "4. Rujuk kes kehadiran kritikal kepada ketua kaum/penghulu untuk ziarah komuniti.",
    "5. Bentang status kepada PPD dan pemegang taruh untuk sokongan logistik."
  ].join("\n");
}

function setCameraStatus(message) {
  document.querySelector("#cameraStatus").textContent = message;
}

function setScannerState(isActive) {
  document.querySelector("#cameraStartBtn").disabled = isActive;
  document.querySelector("#cameraStopBtn").disabled = !isActive;
  document.querySelector("#cameraPlaceholder").hidden = isActive;
}

async function getCameraPermissionState() {
  if (!navigator.permissions?.query) return "tidak diketahui";

  try {
    const result = await navigator.permissions.query({ name: "camera" });
    const labels = {
      granted: "dibenarkan",
      denied: "ditolak",
      prompt: "belum diminta"
    };
    return labels[result.state] || result.state;
  } catch (error) {
    return "tidak diketahui";
  }
}

async function checkCameraSupport() {
  const hasMediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);
  const isLocalOrSecure = window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const permission = await getCameraPermissionState();
  const hasBarcodeDetector = "BarcodeDetector" in window;

  if (!hasMediaDevices) {
    setCameraStatus("Browser ini belum menyokong akses kamera melalui web.");
    return;
  }

  if (!isLocalOrSecure) {
    setCameraStatus("Kamera web memerlukan HTTPS atau localhost.");
    return;
  }

  const qrStatus = hasBarcodeDetector
    ? "QR scanner native disokong."
    : "Engine QR native tiada; boleh tambah library QR kemudian.";

  setCameraStatus(`Kamera disokong. Permission: ${permission}. ${qrStatus}`);
}

async function scanQrFrame(video) {
  if (!cameraStream || !qrDetector) return;

  try {
    if (video.readyState >= 2) {
      const results = await qrDetector.detect(video);
      if (results.length > 0) {
        const qrResult = document.querySelector("#qrResult");
        qrResult.hidden = false;
        qrResult.textContent = `QR dikesan: ${results[0].rawValue}`;
      }
    }
  } catch (error) {
    setCameraStatus("Kamera aktif, tetapi bacaan QR native gagal pada browser ini.");
  }

  scanFrameId = requestAnimationFrame(() => scanQrFrame(video));
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus("Browser ini tidak membenarkan akses kamera melalui web.");
    return;
  }

  try {
    const video = document.querySelector("#cameraPreview");
    const qrResult = document.querySelector("#qrResult");
    qrResult.hidden = true;
    qrResult.textContent = "";

    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    video.srcObject = cameraStream;
    await video.play();
    setScannerState(true);

    if ("BarcodeDetector" in window) {
      qrDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
      setCameraStatus("Kamera aktif. Halakan kepada QR code untuk ujian awal.");
      scanQrFrame(video);
    } else {
      setCameraStatus("Kamera aktif. Modul permission sudah ready; engine QR akan ditambah dalam fasa seterusnya.");
    }
  } catch (error) {
    const message = error.name === "NotAllowedError"
      ? "Permission kamera ditolak. Benarkan kamera pada setting browser untuk guna imbas QR."
      : "Kamera tidak dapat dibuka pada device/browser ini.";
    setCameraStatus(message);
    setScannerState(false);
  }
}

function stopCamera() {
  if (scanFrameId) {
    cancelAnimationFrame(scanFrameId);
    scanFrameId = null;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  qrDetector = null;
  document.querySelector("#cameraPreview").srcObject = null;
  document.querySelector("#qrResult").hidden = true;
  setScannerState(false);
  setCameraStatus("Kamera ditutup.");
}

function initPwaStatus() {
  const pwaStatus = document.querySelector("#pwaStatus");
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  if (isStandalone) {
    pwaStatus.textContent = "Installed";
    return;
  }

  if (!("serviceWorker" in navigator)) {
    pwaStatus.textContent = "Web only";
    return;
  }

  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    pwaStatus.textContent = "Perlu HTTPS";
    return;
  }

  navigator.serviceWorker
    .register("./sw.js")
    .then(() => {
      pwaStatus.textContent = "PWA-ready";
    })
    .catch(() => {
      pwaStatus.textContent = "Web ready";
    });
}

document.querySelector("#searchInput").addEventListener("input", renderAll);
document.querySelector("#riskFilter").addEventListener("change", renderAll);
document.querySelector("#exportBtn").addEventListener("click", () => {
  document.querySelector("#summaryText").textContent = buildSummaryText();
  document.querySelector("#summaryDialog").showModal();
});
document.querySelector("#closeDialog").addEventListener("click", () => {
  document.querySelector("#summaryDialog").close();
});
document.querySelector("#cameraCheckBtn").addEventListener("click", checkCameraSupport);
document.querySelector("#cameraStartBtn").addEventListener("click", startCamera);
document.querySelector("#cameraStopBtn").addEventListener("click", stopCamera);
document.querySelector("#googleLoginBtn").addEventListener("click", signInWithGoogle);
document.querySelector("#googleLoginHeroBtn").addEventListener("click", signInWithGoogle);
document.querySelector("#logoutBtn").addEventListener("click", signOut);

async function initApp() {
  await initAuth();
  await loadDashboardData();
  renderAll();
  initPwaStatus();
  checkCameraSupport();
}

initApp();
