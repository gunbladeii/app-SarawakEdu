let schools = [
  { name: "SMK Serian", candidates: 218, pass: 88, attendance: 94, gpa: 4.91, red: 11, amber: 28, subject: "Matematik", gpsQuality: 15, gpsQuantity: 12, lmsNeed: 13, bmNeed: 7, sejarahNeed: 6 },
  { name: "SMK Taee", candidates: 96, pass: 77, attendance: 89, gpa: 5.42, red: 13, amber: 19, subject: "Sejarah", gpsQuality: 14, gpsQuantity: 11, lmsNeed: 15, bmNeed: 5, sejarahNeed: 12 },
  { name: "SMK Tebakang", candidates: 104, pass: 82, attendance: 91, gpa: 5.18, red: 8, amber: 17, subject: "Bahasa Melayu", gpsQuality: 10, gpsQuantity: 8, lmsNeed: 9, bmNeed: 8, sejarahNeed: 3 },
  { name: "SMK Gedong", candidates: 132, pass: 74, attendance: 86, gpa: 5.61, red: 18, amber: 24, subject: "Matematik", gpsQuality: 20, gpsQuantity: 14, lmsNeed: 18, bmNeed: 9, sejarahNeed: 10 },
  { name: "SMK Balai Ringin", candidates: 156, pass: 79, attendance: 88, gpa: 5.36, red: 15, amber: 26, subject: "Sains", gpsQuality: 17, gpsQuantity: 13, lmsNeed: 15, bmNeed: 8, sejarahNeed: 7 },
  { name: "SMK Tarat", candidates: 119, pass: 84, attendance: 92, gpa: 5.04, red: 7, amber: 18, subject: "Sejarah", gpsQuality: 9, gpsQuantity: 8, lmsNeed: 7, bmNeed: 3, sejarahNeed: 5 },
  { name: "SMK Tebedu", candidates: 141, pass: 81, attendance: 90, gpa: 5.22, red: 10, amber: 23, subject: "Bahasa Inggeris", gpsQuality: 12, gpsQuantity: 10, lmsNeed: 10, bmNeed: 4, sejarahNeed: 7 },
  { name: "SMK Sadong Jaya", candidates: 88, pass: 72, attendance: 84, gpa: 5.83, red: 16, amber: 15, subject: "Bahasa Melayu", gpsQuality: 18, gpsQuantity: 11, lmsNeed: 16, bmNeed: 10, sejarahNeed: 8 },
  { name: "SMK Siburan", candidates: 176, pass: 86, attendance: 93, gpa: 4.98, red: 9, amber: 22, subject: "Matematik", gpsQuality: 11, gpsQuantity: 9, lmsNeed: 9, bmNeed: 4, sejarahNeed: 6 }
];

let students = [
  { name: "Aina L.", school: "SMK Gedong", risk: "red", issue: "Gagal BM dan kehadiran 78%", intervention: "Sesi ibu bapa + mentor akademik" },
  { name: "Daniel A.", school: "SMK Sadong Jaya", risk: "red", issue: "Tidak capai lulus Sejarah", intervention: "Kelas pemulihan mikro + pemantauan mingguan" },
  { name: "Rizal J.", school: "SMK Balai Ringin", risk: "red", issue: "Ponteng berselang dan Matematik E", intervention: "Ziarah cakna bersama ketua kaum" },
  { name: "Nur F.", school: "SMK Taee", risk: "amber", issue: "Markah Sains menurun 12 mata", intervention: "Latih tubi terarah 4 minggu" },
  { name: "Brandon M.", school: "SMK Tebedu", risk: "amber", issue: "Kehadiran 86% dan BI rendah", intervention: "Sokongan rakan sebaya + latihan lisan" },
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

const dataSourceMessages = {
  local: "Data contoh",
  loginRequired: "Sila masuk",
  syncing: "Mengemas kini",
  empty: "Data belum tersedia",
  live: "Data terkini",
  denied: "Akses tidak dibenarkan",
  fallback: "Data contoh"
};

function renderIcons() {
  if (window.lucide?.createIcons) {
    try {
      window.lucide.createIcons({
        attrs: {
          "aria-hidden": "true",
          "stroke-width": 2
        }
      });
    } catch (error) {
      console.warn("Lucide icons could not be rendered.", error);
    }
  }
}

function setTodayLabel() {
  const label = document.querySelector("#todayLabel");
  if (!label) return;

  label.textContent = new Intl.DateTimeFormat("ms-MY", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date());
}

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
  const red = Number(row.red_count || 0);
  const amber = Number(row.amber_count || 0);
  const derivedGpsQuality = Math.round(red * 0.65 + amber * 0.2);
  const derivedGpsQuantity = Math.round(red * 0.45 + amber * 0.18);
  const derivedLmsNeed = Math.max(red, Math.round(red + amber * 0.25));
  const bmNeed = Number(row.bm_need_help ?? Math.round(derivedLmsNeed * 0.55));
  const sejarahNeed = Number(row.sejarah_need_help ?? Math.round(derivedLmsNeed * 0.5));

  return {
    code: row.code,
    name: row.name,
    candidates: Number(row.candidates || 0),
    pass: Number(row.pass_forecast || 0),
    attendance: Number(row.attendance_avg || 0),
    gpa: Number(row.gpa || 0),
    red,
    amber,
    subject: row.critical_subject || "-",
    gpsQuality: Number(row.gps_quality_need ?? derivedGpsQuality),
    gpsQuantity: Number(row.gps_quantity_need ?? derivedGpsQuantity),
    lmsNeed: Number(row.lms_need_help ?? derivedLmsNeed),
    bmNeed,
    sejarahNeed
  };
}

function mapStudentRow(row) {
  return {
    name: row.name,
    school: row.school,
    risk: row.risk,
    issue: row.issue,
    intervention: row.intervention,
    gpsFocus: row.gps_focus || "-",
    lmsFocus: row.lms_focus || ""
  };
}

function mapInterventionRow(row) {
  return {
    owner: row.owner,
    action: row.action
  };
}

async function fetchSchoolRows(config) {
  const fullSelect = "schools?select=code,name,candidates,pass_forecast,attendance_avg,gpa,red_count,amber_count,critical_subject,gps_quality_need,gps_quantity_need,lms_need_help,bm_need_help,sejarah_need_help&order=name.asc";
  const basicSelect = "schools?select=code,name,candidates,pass_forecast,attendance_avg,gpa,red_count,amber_count,critical_subject&order=name.asc";

  try {
    return await fetchSupabaseRows(fullSelect, config);
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("gps_quality_need") && !message.includes("lms_need_help") && !message.includes("bm_need_help")) {
      throw error;
    }
    return fetchSupabaseRows(basicSelect, config);
  }
}

async function fetchStudentRows(config) {
  const fullSelect = "dashboard_student_risks?select=name,school,risk,issue,intervention,gps_focus,lms_focus,last_reviewed,updated_at&order=updated_at.desc";
  const basicSelect = "dashboard_student_risks?select=name,school,risk,issue,intervention,last_reviewed,updated_at&order=updated_at.desc";

  try {
    return await fetchSupabaseRows(fullSelect, config);
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("gps_focus") && !message.includes("lms_focus")) {
      throw error;
    }
    return fetchSupabaseRows(basicSelect, config);
  }
}

function clearDashboardData() {
  schools = [];
  students = [];
  interventions = [];
}

async function loadDashboardData() {
  const config = getSupabaseConfig();

  if (!hasSupabaseConfig(config)) {
    setDataSourceStatus(dataSourceMessages.local);
    return;
  }

  if (config.requireAuth && !activeSession) {
    clearDashboardData();
    setDataSourceStatus(dataSourceMessages.loginRequired);
    return;
  }

  setDataSourceStatus(dataSourceMessages.syncing);

  try {
    const [schoolRows, studentRows, interventionRows] = await Promise.all([
      fetchSchoolRows(config),
      fetchStudentRows(config),
      fetchSupabaseRows("intervention_channels?select=owner,action,sort_order&order=sort_order.asc", config)
    ]);

    if (schoolRows.length === 0) {
      setDataSourceStatus(dataSourceMessages.empty);
      return;
    }

    schools = schoolRows.map(mapSchoolRow);
    if (studentRows.length > 0) students = studentRows.map(mapStudentRow);
    if (interventionRows.length > 0) interventions = interventionRows.map(mapInterventionRow);

    setDataSourceStatus(dataSourceMessages.live);
  } catch (error) {
    console.warn(error);
    if (config.requireAuth) {
      clearDashboardData();
      setDataSourceStatus(dataSourceMessages.denied);
      return;
    }
    setDataSourceStatus(dataSourceMessages.fallback);
  }
}

function getRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function getUserLabel(session) {
  const user = session?.user;
  return user?.user_metadata?.full_name || user?.email || "Pengguna Google";
}

function getUserEmail(session) {
  return session?.user?.email || "";
}

function getUserAvatar(session) {
  const metadata = session?.user?.user_metadata || {};
  return metadata.avatar_url || metadata.picture || "";
}

function getInitials(label) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "G";
}

function showProfileInitial(profilePhoto, profileInitial, label) {
  profilePhoto.hidden = true;
  profilePhoto.removeAttribute("src");
  profileInitial.textContent = getInitials(label);
  profileInitial.hidden = false;
}

function updateAuthUi(session) {
  const config = getSupabaseConfig();
  const sidebarLoginBtn = document.querySelector("#sidebarLoginBtn");
  const heroLoginBtn = document.querySelector("#googleLoginHeroBtn");
  const logoutBtn = document.querySelector("#logoutBtn");
  const sidebarProfile = document.querySelector("#sidebarProfile");
  const profilePhoto = document.querySelector("#profilePhoto");
  const profileInitial = document.querySelector("#profileInitial");
  const profileName = document.querySelector("#profileName");
  const profileEmail = document.querySelector("#profileEmail");
  const authGateTitle = document.querySelector("#authGateTitle");
  const authGateText = document.querySelector("#authGateText");
  const isLocked = config.requireAuth && !session?.user;
  document.body.classList.toggle("auth-locked", isLocked);

  if (session?.user) {
    const label = getUserLabel(session);
    const email = getUserEmail(session);
    const avatar = getUserAvatar(session);
    sidebarProfile.classList.remove("guest");
    profileName.textContent = label;
    profileEmail.textContent = email;
    profileInitial.textContent = getInitials(label);
    profilePhoto.onerror = () => showProfileInitial(profilePhoto, profileInitial, label);

    if (avatar) {
      profilePhoto.hidden = false;
      profileInitial.hidden = true;
      profilePhoto.src = avatar;
    } else {
      showProfileInitial(profilePhoto, profileInitial, label);
    }

    sidebarLoginBtn.hidden = true;
    heroLoginBtn.hidden = true;
    logoutBtn.hidden = false;
    authGateTitle.textContent = "Akses pengguna aktif";
    authGateText.textContent = `Masuk sebagai ${label}. Paparan ini menunjukkan maklumat yang dibenarkan untuk akaun ini.`;
    return;
  }

  sidebarProfile.classList.add("guest");
  profilePhoto.onerror = null;
  showProfileInitial(profilePhoto, profileInitial, "Google");
  profileName.textContent = "Masuk Google";
  profileEmail.textContent = "Sila masuk untuk melihat paparan";
  sidebarLoginBtn.hidden = false;
  heroLoginBtn.hidden = false;
  logoutBtn.hidden = true;
  authGateTitle.textContent = config.requireAuth ? "Sila masuk untuk melihat maklumat" : "Akses masuk sedang disediakan";
  authGateText.textContent = config.requireAuth
    ? "Maklumat ini dilindungi. Sila masuk menggunakan akaun Google yang dibenarkan."
    : "Paparan contoh boleh digunakan sementara akses pengguna dilengkapkan.";
}

async function signInWithGoogle() {
  const client = getSupabaseClient();

  if (!client) {
    window.alert("Akses masuk belum dapat digunakan. Sila maklumkan kepada pentadbir sistem.");
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
    window.alert("Log masuk Google tidak berjaya. Sila cuba sekali lagi.");
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

function getDistrictSupportTotals(source = schools) {
  const totals = source.reduce(
    (sum, school) => {
      sum.candidates += school.candidates;
      sum.gpsQuality += school.gpsQuality || 0;
      sum.gpsQuantity += school.gpsQuantity || 0;
      sum.lmsNeed += school.lmsNeed || 0;
      sum.bmNeed += school.bmNeed || 0;
      sum.sejarahNeed += school.sejarahNeed || 0;
      return sum;
    },
    { candidates: 0, gpsQuality: 0, gpsQuantity: 0, lmsNeed: 0, bmNeed: 0, sejarahNeed: 0 }
  );

  totals.gpsNeed = totals.gpsQuality + totals.gpsQuantity;
  totals.lmsReady = Math.max(totals.candidates - totals.lmsNeed, 0);
  totals.lmsReadyRate = totals.candidates ? (totals.lmsReady / totals.candidates) * 100 : 0;
  return totals;
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
  const totals = getDistrictSupportTotals();

  document.querySelector("#totalCandidates").textContent = totalCandidates.toLocaleString("ms-MY");
  document.querySelector("#redCount").textContent = totals.gpsNeed.toLocaleString("ms-MY");
  document.querySelector("#passForecast").textContent = totals.lmsNeed.toLocaleString("ms-MY");
  document.querySelector("#attendanceAvg").textContent = formatPct(totals.lmsReadyRate);
  document.querySelector("#gpsNeedBreakdown").textContent =
    `Kualiti ${totals.gpsQuality}, Kuantiti ${totals.gpsQuantity}`;
  document.querySelector("#lmsNeedBreakdown").textContent =
    `Bahasa Melayu ${totals.bmNeed}, Sejarah ${totals.sejarahNeed}`;
  document.querySelector("#lmsReadyNote").textContent = "Lulus Bahasa Melayu dan Sejarah";
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
          <div class="support-tags" aria-label="Bantuan GPS dan LMS">
            <span>GPS Kualiti <strong>${school.gpsQuality}</strong></span>
            <span>GPS Kuantiti <strong>${school.gpsQuantity}</strong></span>
            <span>LMS <strong>${school.lmsNeed}</strong></span>
          </div>
          <p>Purata gred ${school.gpa.toFixed(2)}. Subjek yang perlu diberi perhatian: <strong>${school.subject}</strong>.</p>
          <p>${school.red} murid Merah dan ${school.amber} murid Kuning memerlukan tindak susul.</p>
        </article>
      `;
    })
    .join("")
    : `<div class="empty-state">Tiada data sekolah untuk dipaparkan.</div>`;
}

function renderDrivers() {
  const totals = getDistrictSupportTotals();
  const drivers = [
    {
      icon: "clipboard-check",
      title: "1. Semak kedudukan calon",
      detail: `${totals.candidates.toLocaleString("ms-MY")} calon dipantau mengikut sekolah, kehadiran, prestasi semasa dan kedudukan subjek utama.`
    },
    {
      icon: "book-open",
      title: "2. Bantu GPS Kualiti",
      detail: `${totals.gpsQuality.toLocaleString("ms-MY")} calon perlu bimbingan markah untuk membantu memperbaiki purata gred sekolah.`
    },
    {
      icon: "trending-down",
      title: "3. Bantu GPS Kuantiti",
      detail: `${totals.gpsQuantity.toLocaleString("ms-MY")} calon perlu dipastikan kekal dalam kumpulan lulus supaya jumlah lulus daerah meningkat.`
    },
    {
      icon: "map-pin",
      title: "4. Pastikan LMS",
      detail: `${totals.lmsNeed.toLocaleString("ms-MY")} calon belum selamat LMS kerana Bahasa Melayu atau Sejarah masih perlu dipulihkan.`
    }
  ];

  document.querySelector("#driverList").innerHTML = drivers
    .map(
      (driver) => `
        <div class="driver-item">
          <span class="item-icon" data-lucide="${driver.icon}"></span>
          <div><strong>${driver.title}</strong><span>${driver.detail}</span></div>
        </div>
      `
    )
    .join("");
}

function getStudentFocusLabel(student) {
  if (student.lmsFocus && student.lmsFocus !== "Sedia LMS") return "LMS";
  if (student.gpsFocus && student.gpsFocus !== "-") return student.gpsFocus;
  return "Pemantauan";
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
          <td>${getStudentFocusLabel(student)}</td>
          <td>${student.issue}</td>
          <td>${student.intervention}</td>
        </tr>
      `
    )
    .join("")
    : `<tr><td colspan="6">Tiada data murid risiko untuk dipaparkan.</td></tr>`;
}

function renderInterventions() {
  const icons = ["school", "users-round", "map-pin", "landmark"];
  document.querySelector("#interventionStack").innerHTML = interventions.length
    ? interventions
    .map(
      (item, index) => `
        <div class="intervention-item">
          <span class="item-icon" data-lucide="${icons[index] || "handshake"}"></span>
          <div><strong>${item.owner}</strong><span>${item.action}</span></div>
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
  renderIcons();
}

function buildSummaryText() {
  const redSchools = schools.filter((school) => getSchoolRisk(school) === "red");
  const redStudents = students.filter((student) => student.risk === "red");

  return [
    "RINGKASAN TINDAKAN DAERAH SERIAN",
    "",
    `Sekolah memerlukan tindakan segera: ${redSchools.map((school) => school.name).join(", ")}`,
    `Contoh murid yang memerlukan tindakan segera: ${redStudents.map((student) => student.name).join(", ")}`,
    "",
    "Keutamaan 7 hari:",
    "1. Sahkan data kehadiran dan markah terkini setiap sekolah.",
    "2. Laksana kelas bimbingan berfokus Bahasa Melayu, Sejarah dan Matematik untuk murid kategori Merah.",
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
    setCameraStatus("Peranti atau pelayar ini belum dapat membuka kamera.");
    return;
  }

  if (!isLocalOrSecure) {
    setCameraStatus("Kamera hanya boleh digunakan melalui pautan rasmi yang selamat.");
    return;
  }

  if (permission === "ditolak") {
    setCameraStatus("Kamera belum boleh digunakan kerana kebenaran tidak diberikan. Benarkan kamera pada tetapan peranti, kemudian cuba semula.");
    return;
  }

  const qrStatus = hasBarcodeDetector
    ? "Kamera sedia digunakan untuk imbasan QR."
    : "Kamera sedia digunakan. Bacaan QR penuh akan diaktifkan dalam fasa seterusnya.";

  setCameraStatus(`Kamera boleh digunakan. Kebenaran kamera: ${permission}. ${qrStatus}`);
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
    setCameraStatus("Kamera aktif, tetapi bacaan QR belum dapat diproses pada peranti ini.");
  }

  scanFrameId = requestAnimationFrame(() => scanQrFrame(video));
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus("Peranti ini belum membenarkan kamera digunakan melalui aplikasi ini.");
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
      setCameraStatus("Kamera aktif. Halakan kamera kepada kod QR untuk ujian awal.");
      scanQrFrame(video);
    } else {
      setCameraStatus("Kamera aktif. Bacaan QR penuh akan diaktifkan dalam fasa seterusnya.");
    }
  } catch (error) {
    const message = error.name === "NotAllowedError"
      ? "Kebenaran kamera tidak diberikan. Benarkan kamera pada tetapan pelayar untuk menggunakan imbasan QR."
      : "Kamera tidak dapat dibuka pada peranti ini.";
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
    pwaStatus.textContent = "Telah dipasang";
    return;
  }

  if (!("serviceWorker" in navigator)) {
    pwaStatus.textContent = "Sedia digunakan";
    return;
  }

  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    pwaStatus.textContent = "Perlu pautan selamat";
    return;
  }

  navigator.serviceWorker
    .register("./sw.js")
    .then(() => {
      pwaStatus.textContent = "Sedia dipasang";
    })
    .catch(() => {
      pwaStatus.textContent = "Sedia digunakan";
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
document.querySelector("#sidebarLoginBtn").addEventListener("click", signInWithGoogle);
document.querySelector("#googleLoginHeroBtn").addEventListener("click", signInWithGoogle);
document.querySelector("#logoutBtn").addEventListener("click", signOut);

async function initApp() {
  setTodayLabel();
  renderIcons();
  await initAuth();
  await loadDashboardData();
  renderAll();
  initPwaStatus();
  checkCameraSupport();
}

initApp();
