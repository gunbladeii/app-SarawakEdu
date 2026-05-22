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
let referenceSchools = [];
let referenceStudents = [];
let importPreviewRows = [];
let lastImportFileName = "";
let activeCycleCode = "SPM-2026-PERCUBAAN";
let schoolLoadRequest = null;
let schoolLoadRetryId = null;
let schoolLoadRetryCount = 0;
let schoolViewMode = "performance";

const DATA_ENTRY_ALLOWED_EMAILS = new Set(["gunbladeii25@gmail.com"]);
const REFERENCE_CACHE_VERSION = "v3";
const SCHOOL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const STUDENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

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

async function supabaseRequest(path, options = {}) {
  const config = getSupabaseConfig();
  const accessToken = getSupabaseAccessToken(config);

  if (!hasSupabaseConfig(config) || !activeSession) {
    throw new Error("Sila masuk Google dahulu.");
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.supabaseAnonKey,
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(body?.message || body?.hint || `Supabase ${response.status}`);
  }

  return body;
}

async function fetchReferenceData(scope, params = {}) {
  if (!activeSession?.access_token) {
    throw new Error("Sila masuk Google dahulu.");
  }

  const cached = getReferenceCache(scope, params);
  if (cached && params.refresh !== "1") {
    return {
      ...cached,
      meta: {
        ...(cached.meta || {}),
        cache: scope === "students" ? "browser_session" : "browser_cache",
        cacheAgeSeconds: Math.max(0, Math.round((Date.now() - cached.cachedAt) / 1000))
      }
    };
  }

  const url = new URL("/api/oracle-reference", window.location.origin);
  url.searchParams.set("scope", scope);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  let response;
  let payload;
  try {
    response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${activeSession.access_token}`
      }
    });
    payload = await response.json();
  } catch (error) {
    if (cached) {
      return {
        ...cached,
        meta: {
          ...(cached.meta || {}),
          cache: scope === "students" ? "browser_session_stale" : "browser_cache_stale",
          cacheAgeSeconds: Math.max(0, Math.round((Date.now() - cached.cachedAt) / 1000)),
          warning: "Data terkini belum dapat disambung."
        }
      };
    }
    throw error;
  }

  if (!response.ok || payload.success === false) {
    if (cached) {
      return {
        ...cached,
        meta: {
          ...(cached.meta || {}),
          cache: scope === "students" ? "browser_session_stale" : "browser_cache_stale",
          cacheAgeSeconds: Math.max(0, Math.round((Date.now() - cached.cachedAt) / 1000)),
          warning: payload.message || "Data terkini belum dapat dibaca."
        }
      };
    }
    throw new Error(payload.message || "Data rujukan tidak dapat dibaca.");
  }

  setReferenceCache(scope, params, payload);
  return payload;
}

function getReferenceCacheStorage(scope) {
  try {
    return scope === "students" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function getReferenceCacheKey(scope, params = {}) {
  const pairs = Object.entries(params)
    .filter(([key, value]) => !["refresh", "_"].includes(key) && value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));
  return `myspmcare:${REFERENCE_CACHE_VERSION}:${scope}:${pairs.map(([key, value]) => `${key}=${value}`).join("&")}`;
}

function getReferenceCache(scope, params = {}) {
  const storage = getReferenceCacheStorage(scope);
  if (!storage) return null;

  try {
    const raw = storage.getItem(getReferenceCacheKey(scope, params));
    if (!raw) return null;

    const cached = JSON.parse(raw);
    const ttl = scope === "students" ? STUDENT_CACHE_TTL_MS : SCHOOL_CACHE_TTL_MS;
    if (!cached?.payload || !cached.cachedAt || Date.now() - cached.cachedAt > ttl) {
      storage.removeItem(getReferenceCacheKey(scope, params));
      return null;
    }

    return {
      ...cached.payload,
      cachedAt: cached.cachedAt
    };
  } catch {
    return null;
  }
}

function setReferenceCache(scope, params = {}, payload) {
  const storage = getReferenceCacheStorage(scope);
  if (!storage || !payload?.success) return;

  try {
    storage.setItem(getReferenceCacheKey(scope, params), JSON.stringify({
      cachedAt: Date.now(),
      payload
    }));
  } catch {
    // Browser storage can be full or blocked; the app still works without it.
  }
}

function getReferenceCacheNote(meta = {}) {
  const cache = meta.cache || "";
  if (cache.includes("browser")) return " Disediakan daripada simpanan sementara peranti.";
  if (cache === "server_cache") return " Disediakan daripada simpanan pantas sistem.";
  if (cache === "server_stale") return " Disediakan daripada simpanan terakhir kerana sumber data semasa belum stabil.";
  if (meta.source === "senarai_serian") return " Senarai sekolah asas digunakan sementara sumber data semasa belum stabil.";
  return "";
}

function setEntryStatus(message) {
  const element = document.querySelector("#entryStatus");
  if (element) element.textContent = message;
}

function setCandidateSummary(message) {
  const element = document.querySelector("#candidateSummary");
  if (element) element.textContent = message;
}

function setImportSummary(message) {
  const element = document.querySelector("#importSummary");
  if (element) element.textContent = message;
}

async function loadActiveCycleCode() {
  const config = getSupabaseConfig();

  if (!hasSupabaseConfig(config) || !activeSession) {
    return activeCycleCode;
  }

  try {
    const rows = await fetchSupabaseRows("assessment_cycles?select=code,name&is_active=eq.true&limit=1", config);
    if (rows?.[0]?.code) {
      activeCycleCode = rows[0].code;
    }
  } catch (error) {
    console.warn("Kitaran aktif belum dapat dibaca.", error);
  }

  return activeCycleCode;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getShortSchoolName(name) {
  return String(name || "")
    .replace(/^SEKOLAH MENENGAH KEBANGSAAN\s+/i, "SMK ")
    .replace(/^SMK\s+SMK\s+/i, "SMK ")
    .trim();
}

function getSelectedEntrySchool() {
  const code = document.querySelector("#entrySchoolSelect")?.value || "";
  return referenceSchools.find((school) => school.code === code) || null;
}

function getStudentReferenceText(student) {
  return [
    student.className ? `Kelas ${student.className}` : "",
    student.studentCode ? `ID ${student.studentCode}` : "",
    student.identityHint || ""
  ].filter(Boolean).join(" | ");
}

async function hydrateStudentNamesFromSavedRecords(schoolCode, candidateRows) {
  if (!candidateRows.length || !activeSession) {
    return candidateRows;
  }

  try {
    const encodedSchool = encodeURIComponent(schoolCode);
    const rows = await supabaseRequest(
      `student_monitoring_records?select=student_code,student_name&school_code=eq.${encodedSchool}&student_name=not.is.null&order=updated_at.desc&limit=2000`
    );
    const nameMap = new Map();

    rows.forEach((row) => {
      const code = String(row.student_code || "").trim();
      const name = String(row.student_name || "").trim();
      if (code && name && !nameMap.has(code)) {
        nameMap.set(code, name);
      }
    });

    if (!nameMap.size) {
      return candidateRows;
    }

    return candidateRows.map((student) => ({
      ...student,
      name: student.name || nameMap.get(String(student.studentCode)) || ""
    }));
  } catch (error) {
    console.warn("Nama murid tersimpan belum dapat dibaca.", error);
    return candidateRows;
  }
}

function updateTemplateButtons() {
  const canDownload = Boolean(isDataEntryAllowed() && getSelectedEntrySchool() && referenceStudents.length);
  document.querySelectorAll("#downloadTemplateBtn, #downloadTemplateInlineBtn").forEach((button) => {
    if (button) button.disabled = !canDownload;
  });
}

function populateEntrySchoolSelect(emptyLabel = "Pilih sekolah") {
  const select = document.querySelector("#entrySchoolSelect");
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>${referenceSchools
    .map((school) => `<option value="${escapeHtml(school.code)}">${escapeHtml(getShortSchoolName(school.name))} (${escapeHtml(school.code)})</option>`)
    .join("")}`;

  if (referenceSchools.some((school) => school.code === currentValue)) {
    select.value = currentValue;
  }

  updateTemplateButtons();
}

function setEntrySchoolLoading(message) {
  const select = document.querySelector("#entrySchoolSelect");
  if (select) {
    select.innerHTML = `<option value="">${escapeHtml(message)}</option>`;
  }
}

function scheduleEntrySchoolRetry(delay = 1000) {
  if (schoolLoadRetryCount >= 3) return;
  schoolLoadRetryCount += 1;
  window.clearTimeout(schoolLoadRetryId);
  schoolLoadRetryId = window.setTimeout(() => {
    if (activeSession && referenceSchools.length === 0) {
      loadEntrySchools({ silent: true });
    }
  }, delay);
}

async function loadEntrySchools(options = {}) {
  const { silent = false, refresh = false } = options;

  if (schoolLoadRequest) {
    return schoolLoadRequest;
  }

  schoolLoadRequest = (async () => {
    if (!activeSession) {
      referenceSchools = [];
      schoolLoadRetryCount = 0;
      window.clearTimeout(schoolLoadRetryId);
      populateEntrySchoolSelect();
      setEntryStatus("Sila masuk Google untuk mengurus kemasukan data.");
      return;
    }

    if (!isDataEntryAllowed()) {
      referenceSchools = [];
      schoolLoadRetryCount = 0;
      window.clearTimeout(schoolLoadRetryId);
      populateEntrySchoolSelect();
      setEntryStatus("Akaun ini belum dibenarkan untuk mengurus kemasukan data sekolah.");
      return;
    }

    if (!silent) {
      schoolLoadRetryCount = 0;
      setEntrySchoolLoading("Sedang membaca sekolah...");
      setEntryStatus("Sedang membaca senarai sekolah. Sila tunggu sebentar.");
    }

    try {
      const result = await fetchReferenceData("schools", refresh ? { refresh: "1" } : {});
      referenceSchools = Array.isArray(result.data) ? result.data : [];
      populateEntrySchoolSelect(referenceSchools.length ? "Pilih sekolah" : "Tiada sekolah ditemui");

      if (referenceSchools.length) {
        schoolLoadRetryCount = 0;
        setEntryStatus(`${referenceSchools.length} sekolah tersedia. Pilih sekolah untuk semak calon SPM.${getReferenceCacheNote(result.meta)}`);
      } else {
        setEntryStatus("Senarai sekolah belum ditemui. Cuba muat semula senarai sebentar lagi.");
        scheduleEntrySchoolRetry(1500);
      }
    } catch (error) {
      console.warn("Senarai sekolah belum dapat dibaca.", error);
      referenceSchools = [];
      populateEntrySchoolSelect("Gagal membaca sekolah");
      setEntryStatus(`Senarai sekolah belum dapat dibaca. ${error.message}`);
      scheduleEntrySchoolRetry(1500);
    }
  })();

  try {
    await schoolLoadRequest;
  } finally {
    schoolLoadRequest = null;
  }
}

async function loadEntryCandidates() {
  if (!isDataEntryAllowed()) {
    setCandidateSummary("Akaun ini belum dibenarkan untuk mengurus kemasukan data sekolah.");
    return;
  }

  const schoolCode = document.querySelector("#entrySchoolSelect")?.value || "";

  if (!schoolCode) {
    setCandidateSummary("Pilih sekolah dahulu.");
    return;
  }

  setCandidateSummary("Sedang menyemak calon SPM...");
  updateTemplateButtons();

  try {
    await loadActiveCycleCode();
    const result = await fetchReferenceData("students", {
      kod_sekolah: schoolCode,
      spm_only: "1",
      limit: "250"
    });
    referenceStudents = await hydrateStudentNamesFromSavedRecords(schoolCode, result.data || []);
    const school = referenceSchools.find((item) => item.code === schoolCode);
    if (referenceStudents.length) {
      const missingNames = referenceStudents.filter((student) => !student.name).length;
      const nameNote = missingNames
        ? ` ${missingNames.toLocaleString("ms-MY")} nama belum dibekalkan oleh sumber data; lengkapkan kolum student_name dalam template.`
        : "";
      setCandidateSummary(`${referenceStudents.length.toLocaleString("ms-MY")} calon Tingkatan 5 ditemui untuk ${getShortSchoolName(school?.name || schoolCode)}. Template sekolah kini boleh dimuat turun.${nameNote}${getReferenceCacheNote(result.meta)}`);
      setImportSummary(missingNames
        ? "Muat turun template sekolah, lengkapkan nama dan data pemantauan, kemudian muat naik fail yang sama untuk semakan preview."
        : "Muat turun template sekolah, lengkapkan data pemantauan, kemudian muat naik fail yang sama untuk semakan preview.");
    } else {
      setCandidateSummary(`Tiada calon Tingkatan 5 ditemui untuk ${getShortSchoolName(school?.name || schoolCode)}.`);
      setImportSummary("Template sekolah belum boleh dijana kerana senarai calon kosong.");
    }
    renderImportPreview();
  } catch (error) {
    referenceStudents = [];
    setCandidateSummary(error.message);
  } finally {
    updateTemplateButtons();
  }
}

function handleEntrySchoolChange() {
  referenceStudents = [];
  importPreviewRows = [];
  renderImportPreview();
  updateTemplateButtons();
  setCandidateSummary("Tekan Tarik calon SPM untuk jana senarai murid sekolah ini.");
  setImportSummary("Template akan tersedia selepas senarai calon SPM berjaya dibaca.");
}

const templateHeaders = [
  "cycle_code",
  "school_code",
  "school_name",
  "student_code",
  "student_reference",
  "student_name",
  "class_id",
  "class_name",
  "form_code",
  "attendance_rate",
  "bm_score",
  "bm_grade",
  "bm_pass",
  "sejarah_score",
  "sejarah_grade",
  "sejarah_pass",
  "current_gpa",
  "target_gpa",
  "critical_subject",
  "gps_quality_need",
  "gps_quantity_need",
  "risk",
  "issue_note",
  "intervention_action",
  "intervention_owner",
  "due_date"
];

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildStudentTemplateCsv() {
  const school = getSelectedEntrySchool();
  if (!school || !referenceStudents.length) {
    throw new Error("Tarik calon SPM dahulu sebelum muat turun template.");
  }

  const schoolName = getShortSchoolName(school.name);
  const rows = referenceStudents.map((student) => ({
    cycle_code: activeCycleCode,
    school_code: school.code,
    school_name: schoolName,
    student_code: student.studentCode || "",
    student_reference: getStudentReferenceText(student),
    student_name: student.name || "",
    class_id: student.classId || "",
    class_name: student.className || "",
    form_code: student.formCode || "15",
    attendance_rate: "",
    bm_score: "",
    bm_grade: "",
    bm_pass: "",
    sejarah_score: "",
    sejarah_grade: "",
    sejarah_pass: "",
    current_gpa: "",
    target_gpa: "",
    critical_subject: "",
    gps_quality_need: "",
    gps_quantity_need: "",
    risk: "",
    issue_note: "",
    intervention_action: "",
    intervention_owner: "",
    due_date: ""
  }));

  return [
    templateHeaders.join(","),
    ...rows.map((row) => templateHeaders.map((header) => csvCell(row[header])).join(","))
  ].join("\r\n");
}

function downloadCsv(filename, csvText) {
  const blob = new Blob(["\ufeff", csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadSchoolTemplate() {
  try {
    const school = getSelectedEntrySchool();
    const csv = buildStudentTemplateCsv();
    const safeCycle = activeCycleCode.replace(/[^a-z0-9_-]+/gi, "-");
    const fileName = `template-${school.code}-${safeCycle}.csv`;
    downloadCsv(fileName, csv);
    const missingNames = referenceStudents.filter((student) => !student.name).length;
    const nameNote = missingNames ? " Lengkapkan juga kolum student_name kerana nama murid belum dibekalkan oleh sumber data." : "";
    setImportSummary(`${fileName} dimuat turun. Lengkapkan kolum pemantauan dan muat naik semula fail ini.${nameNote}`);
  } catch (error) {
    setImportSummary(error.message || "Template belum dapat dimuat turun.");
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && insideQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);

  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((values) =>
    headers.reduce((record, header, index) => {
      record[header] = (values[index] || "").trim();
      return record;
    }, {})
  );
}

function parseBoolean(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "1", "ya", "y", "lulus", "pass"].includes(normalized)) return true;
  if (["false", "0", "tidak", "n", "gagal", "fail"].includes(normalized)) return false;
  return null;
}

function parseNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRiskValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["red", "merah"].includes(normalized)) return "red";
  if (["amber", "kuning", "yellow"].includes(normalized)) return "amber";
  if (["green", "hijau"].includes(normalized)) return "green";
  return "";
}

function getFocusArea(row) {
  if (row.bmPass === false || row.sejarahPass === false) return "LMS";
  if (row.gpsQualityNeed) return "GPS Kualiti";
  if (row.gpsQuantityNeed) return "GPS Kuantiti";
  if (row.attendanceRate !== null && row.attendanceRate < 90) return "Kehadiran";
  return "Lain-lain";
}

function deriveRiskValue({ bmPass, sejarahPass, gpsQualityNeed, gpsQuantityNeed, attendanceRate }) {
  if (bmPass === false || sejarahPass === false || (attendanceRate !== null && attendanceRate < 85)) {
    return "red";
  }
  if (gpsQualityNeed || gpsQuantityNeed || (attendanceRate !== null && attendanceRate < 90)) {
    return "amber";
  }
  return "green";
}

function normalizeImportRow(raw, index) {
  const selectedSchool = document.querySelector("#entrySchoolSelect")?.value || "";
  const studentCode = String(raw.student_code || "").trim();
  const schoolCode = String(raw.school_code || selectedSchool || "").trim().toUpperCase();
  const candidateMap = new Map(referenceStudents.map((student) => [String(student.studentCode), student]));
  const matchedCandidate = candidateMap.get(studentCode);
  const messages = [];
  const warnings = [];
  const bmPass = parseBoolean(raw.bm_pass);
  const sejarahPass = parseBoolean(raw.sejarah_pass);
  const gpsQualityNeed = parseBoolean(raw.gps_quality_need) === true;
  const gpsQuantityNeed = parseBoolean(raw.gps_quantity_need) === true;
  const attendanceRate = parseNumber(raw.attendance_rate);
  const risk = normalizeRiskValue(raw.risk) || deriveRiskValue({ bmPass, sejarahPass, gpsQualityNeed, gpsQuantityNeed, attendanceRate });
  const importedStudentName = String(raw.student_name || raw.nama_murid || "").trim();

  if (!raw.cycle_code) messages.push("cycle_code kosong");
  if (!studentCode) messages.push("student_code kosong");
  if (!schoolCode) messages.push("school_code kosong");
  if (selectedSchool && schoolCode !== selectedSchool) messages.push("school_code tidak sama dengan pilihan sekolah");
  if (referenceStudents.length && studentCode && !matchedCandidate) warnings.push("murid belum ditemui dalam semakan calon");
  if (!importedStudentName && !matchedCandidate?.name) warnings.push("student_name kosong");

  const normalized = {
    rowNumber: index + 2,
    cycleCode: String(raw.cycle_code || "").trim(),
    schoolCode,
    studentCode,
    studentName: importedStudentName || matchedCandidate?.name || null,
    classId: String(raw.class_id || matchedCandidate?.classId || "").trim() || null,
    className: String(raw.class_name || matchedCandidate?.className || "").trim() || null,
    formCode: String(raw.form_code || "15").trim() || "15",
    attendanceRate,
    bmScore: parseNumber(raw.bm_score),
    bmGrade: String(raw.bm_grade || "").trim() || null,
    bmPass,
    sejarahScore: parseNumber(raw.sejarah_score),
    sejarahGrade: String(raw.sejarah_grade || "").trim() || null,
    sejarahPass,
    currentGpa: parseNumber(raw.current_gpa),
    targetGpa: parseNumber(raw.target_gpa),
    criticalSubject: String(raw.critical_subject || "").trim() || null,
    gpsQualityNeed,
    gpsQuantityNeed,
    risk,
    issueNote: String(raw.issue_note || "").trim() || null,
    interventionAction: String(raw.intervention_action || "").trim(),
    interventionOwner: String(raw.intervention_owner || "").trim() || null,
    dueDate: String(raw.due_date || "").trim() || null,
    valid: messages.length === 0,
    warning: warnings.length > 0,
    messages: [...messages, ...warnings]
  };

  return normalized;
}

function updatePreviewStats() {
  const accepted = importPreviewRows.filter((row) => row.valid).length;
  const rejected = importPreviewRows.length - accepted;
  document.querySelector("#previewTotal").textContent = importPreviewRows.length.toLocaleString("ms-MY");
  document.querySelector("#previewAccepted").textContent = accepted.toLocaleString("ms-MY");
  document.querySelector("#previewRejected").textContent = rejected.toLocaleString("ms-MY");
  document.querySelector("#saveImportBtn").disabled = accepted === 0;
}

function renderImportPreview() {
  const table = document.querySelector("#importPreviewTable");
  if (!table) return;

  updatePreviewStats();

  if (!importPreviewRows.length) {
    table.innerHTML = `<tr><td colspan="8">Preview data akan dipaparkan selepas fail CSV dipilih.</td></tr>`;
    return;
  }

  table.innerHTML = importPreviewRows.slice(0, 30).map((row) => {
    const statusClass = row.valid ? (row.warning ? "warning" : "ready") : "error";
    const statusText = row.valid ? (row.warning ? "Semak" : "Sedia") : "Ralat";
    const studentLabel = row.studentName
      ? `${escapeHtml(row.studentName)}<br><small>${escapeHtml(row.studentCode || "-")}</small>`
      : escapeHtml(row.studentCode || "-");
    return `
      <tr>
        <td><span class="preview-status ${statusClass}">${statusText}</span></td>
        <td><strong>${studentLabel}</strong></td>
        <td>${escapeHtml(row.schoolCode || "-")}</td>
        <td>${escapeHtml(row.className || row.classId || "-")}</td>
        <td>${row.bmPass === null ? "-" : row.bmPass ? "Lulus" : "Belum lulus"}</td>
        <td>${row.sejarahPass === null ? "-" : row.sejarahPass ? "Lulus" : "Belum lulus"}</td>
        <td>${escapeHtml(riskLabel[row.risk] || row.risk)}</td>
        <td>${escapeHtml(row.messages.join(", ") || row.issueNote || "-")}</td>
      </tr>
    `;
  }).join("");
}

async function handleCsvFileChange(event) {
  if (!isDataEntryAllowed()) {
    importPreviewRows = [];
    lastImportFileName = "";
    renderImportPreview();
    setImportSummary("Akaun ini belum dibenarkan untuk mengurus kemasukan data sekolah.");
    return;
  }

  const file = event.target.files?.[0];
  importPreviewRows = [];
  lastImportFileName = file?.name || "";

  if (!file) {
    renderImportPreview();
    setImportSummary("Muat naik fail CSV mengikut template sebelum simpan ke rekod sebenar.");
    return;
  }

  const text = await file.text();
  const rows = parseCsv(text);
  importPreviewRows = rows.map((row, index) => normalizeImportRow(row, index));
  renderImportPreview();
  const ready = importPreviewRows.filter((row) => row.valid).length;
  setImportSummary(`${file.name}: ${ready} daripada ${importPreviewRows.length} baris sedia disimpan.`);
}

async function resolveCycleId(cycleCode) {
  const encoded = encodeURIComponent(cycleCode);
  const rows = await supabaseRequest(`assessment_cycles?select=id,code&code=eq.${encoded}&limit=1`);
  if (!rows?.length) {
    throw new Error(`Kitaran ${cycleCode} belum wujud.`);
  }
  return rows[0].id;
}

function buildMonitoringPayload(validRows, cycleId, batchId, includeStudentName = true) {
  return validRows.map((row) => {
    const payload = {
      cycle_id: cycleId,
      import_batch_id: batchId,
      school_code: row.schoolCode,
      student_code: row.studentCode,
      class_id: row.classId,
      class_name: row.className,
      form_code: row.formCode,
      attendance_rate: row.attendanceRate,
      bm_score: row.bmScore,
      bm_grade: row.bmGrade,
      bm_pass: row.bmPass,
      sejarah_score: row.sejarahScore,
      sejarah_grade: row.sejarahGrade,
      sejarah_pass: row.sejarahPass,
      current_gpa: row.currentGpa,
      target_gpa: row.targetGpa,
      critical_subject: row.criticalSubject,
      gps_quality_need: row.gpsQualityNeed,
      gps_quantity_need: row.gpsQuantityNeed,
      risk: row.risk,
      issue_note: row.issueNote
    };

    if (includeStudentName) {
      payload.student_name = row.studentName;
    }

    return payload;
  });
}

async function saveImportRows() {
  if (!isDataEntryAllowed()) {
    setEntryStatus("Akaun ini belum dibenarkan untuk mengurus kemasukan data sekolah.");
    return;
  }

  const validRows = importPreviewRows.filter((row) => row.valid);
  if (!validRows.length) {
    setEntryStatus("Tiada baris yang sedia disimpan.");
    return;
  }

  const selectedSchool = document.querySelector("#entrySchoolSelect")?.value || validRows[0].schoolCode;
  const cycleCode = validRows[0].cycleCode;
  const mixedCycle = validRows.some((row) => row.cycleCode !== cycleCode);
  const mixedSchool = validRows.some((row) => row.schoolCode !== selectedSchool);

  if (mixedCycle) {
    setEntryStatus("Satu fail hanya boleh mengandungi satu kitaran pemantauan.");
    return;
  }

  if (mixedSchool) {
    setEntryStatus("Satu fail hanya boleh mengandungi satu sekolah.");
    return;
  }

  document.querySelector("#saveImportBtn").disabled = true;
  setEntryStatus("Sedang menyimpan rekod...");

  try {
    const cycleId = await resolveCycleId(cycleCode);
    const batchRows = await supabaseRequest("data_import_batches?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        cycle_id: cycleId,
        school_code: selectedSchool,
        source_type: "excel",
        file_name: lastImportFileName || "upload.csv",
        row_count: importPreviewRows.length,
        accepted_count: validRows.length,
        rejected_count: importPreviewRows.length - validRows.length,
        status: "validated",
        notes: {
          uploadedFrom: "Kemasukan Data",
          warningCount: validRows.filter((row) => row.warning).length
        }
      })
    });
    const batchId = batchRows?.[0]?.id || null;
    let savedWithoutStudentName = false;

    try {
      await supabaseRequest("student_monitoring_records?on_conflict=cycle_id,student_code", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(buildMonitoringPayload(validRows, cycleId, batchId, true))
      });
    } catch (error) {
      if (!String(error.message || "").includes("student_name")) {
        throw error;
      }
      await supabaseRequest("student_monitoring_records?on_conflict=cycle_id,student_code", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(buildMonitoringPayload(validRows, cycleId, batchId, false))
      });
      savedWithoutStudentName = true;
    }

    const interventionsPayload = validRows
      .filter((row) => row.interventionAction)
      .map((row) => ({
        cycle_id: cycleId,
        school_code: row.schoolCode,
        student_code: row.studentCode,
        focus_area: getFocusArea(row),
        risk: row.risk,
        issue: row.issueNote || "Perlu tindakan susulan",
        action: row.interventionAction,
        owner_name: row.interventionOwner,
        due_date: row.dueDate,
        status: "open"
      }));

    if (interventionsPayload.length) {
      await supabaseRequest("student_intervention_records", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(interventionsPayload)
      });
    }

    setEntryStatus(`${validRows.length.toLocaleString("ms-MY")} rekod berjaya disimpan untuk ${cycleCode}.${savedWithoutStudentName ? " Jalankan SQL student_name untuk papar nama murid di dashboard." : ""}`);
    setImportSummary("Rekod telah disimpan. Dashboard real-data boleh dibaca selepas paparan dipindahkan kepada view baharu.");
  } catch (error) {
    setEntryStatus(error.message || "Rekod tidak berjaya disimpan.");
  } finally {
    updatePreviewStats();
  }
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

function isDataEntryAllowed(session = activeSession) {
  return DATA_ENTRY_ALLOWED_EMAILS.has(getUserEmail(session).toLowerCase());
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

function getCurrentRoute() {
  return (window.location.hash || "#ringkasan").replace(/^#/, "") || "ringkasan";
}

function isDataEntryRoute() {
  return getCurrentRoute() === "data-entry";
}

function renderAuthGateText(session) {
  const config = getSupabaseConfig();
  const authGateTitle = document.querySelector("#authGateTitle");
  const authGateText = document.querySelector("#authGateText");
  const label = getUserLabel(session);

  if (!authGateTitle || !authGateText) return;

  if (session?.user && isDataEntryRoute() && !isDataEntryAllowed(session)) {
    authGateTitle.textContent = "Akses kemasukan data belum dibenarkan";
    authGateText.textContent = `Masuk sebagai ${label}. Akaun ini boleh melihat dashboard, tetapi belum dibenarkan mengurus kemasukan rekod sebenar.`;
    return;
  }

  if (session?.user) {
    authGateTitle.textContent = "Akses pengguna aktif";
    authGateText.textContent = `Masuk sebagai ${label}. Paparan ini menunjukkan maklumat yang dibenarkan untuk akaun ini.`;
    return;
  }

  authGateTitle.textContent = config.requireAuth ? "Sila masuk untuk melihat maklumat" : "Akses masuk sedang disediakan";
  authGateText.textContent = config.requireAuth
    ? "Maklumat ini dilindungi. Sila masuk menggunakan akaun Google yang dibenarkan."
    : "Paparan contoh boleh digunakan sementara akses pengguna dilengkapkan.";
}

function syncRouteUi() {
  const route = getCurrentRoute();
  const entryRoute = route === "data-entry";
  const entryAllowed = isDataEntryAllowed();
  const dataEntryNav = document.querySelector("#dataEntryNav");

  document.body.classList.toggle("route-data-entry", entryRoute);
  document.body.classList.toggle("route-dashboard", !entryRoute);
  document.body.classList.toggle("data-entry-authorized", entryAllowed);
  document.body.classList.toggle("data-entry-unauthorized", Boolean(activeSession?.user) && !entryAllowed);

  if (dataEntryNav) {
    dataEntryNav.hidden = !entryAllowed;
  }

  document.querySelectorAll(".nav-list a").forEach((link) => {
    const linkRoute = (link.getAttribute("href") || "").replace(/^#/, "");
    link.classList.toggle("active", linkRoute === route || (!entryRoute && route === "" && linkRoute === "ringkasan"));
  });

  renderAuthGateText(activeSession);

  if (entryRoute && activeSession?.user && !entryAllowed) {
    referenceSchools = [];
    populateEntrySchoolSelect();
    setEntryStatus("Akaun ini belum dibenarkan untuk mengurus kemasukan data sekolah.");
  }

  if (entryRoute && entryAllowed && referenceSchools.length === 0) {
    loadEntrySchools();
  }
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
    renderAuthGateText(session);
    syncRouteUi();
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
  renderAuthGateText(null);
  syncRouteUi();
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
  referenceSchools = [];
  schoolLoadRetryCount = 0;
  window.clearTimeout(schoolLoadRetryId);
  populateEntrySchoolSelect();
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
    const entryLoad = isDataEntryAllowed(session) ? loadEntrySchools({ silent: !isDataEntryRoute() }) : Promise.resolve();
    Promise.all([loadDashboardData(), loadActiveCycleCode(), entryLoad]).then(() => {
      renderAll();
      if (isDataEntryAllowed(session)) scheduleEntrySchoolRetry();
    });
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

function clampPercentage(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

function getAttendanceRisk(school) {
  if (school.attendance < 87) return "red";
  if (school.attendance < 91) return "amber";
  return "green";
}

function getAttendanceAttentionCount(school) {
  const targetGap = Math.max(0, 92 - Number(school.attendance || 0));
  return Math.max(0, Math.round(Number(school.candidates || 0) * targetGap / 100));
}

function getSubjectRisk(school) {
  const lmsRate = school.candidates ? school.lmsNeed / school.candidates : 0;
  if (school.lmsNeed >= 15 || lmsRate >= 0.12) return "red";
  if (school.lmsNeed >= 8 || lmsRate >= 0.07) return "amber";
  return "green";
}

function getSchoolRiskForCurrentView(school) {
  if (schoolViewMode === "attendance") return getAttendanceRisk(school);
  if (schoolViewMode === "subjects") return getSubjectRisk(school);
  return getSchoolRisk(school);
}

function setSchoolViewMode(mode) {
  if (!["performance", "attendance", "subjects"].includes(mode)) return;
  schoolViewMode = mode;
  renderAll();
}

function syncSchoolTabs() {
  document.querySelectorAll("#schoolViewTabs button").forEach((button) => {
    const active = button.dataset.schoolView === schoolViewMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
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
    const schoolRisk = getSchoolRiskForCurrentView(school);
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

function renderCharts(filteredSchools) {
  const source = filteredSchools ?? schools;
  const chart = document.querySelector("#performanceChart");
  const donut = document.querySelector("#riskDonut");
  const legend = document.querySelector("#riskLegend");
  const title = document.querySelector("#risk-chart-title");

  const riskValue = document.querySelector("#riskFilter").value;
  const riskSuffix = { red: " — Merah", amber: " — Kuning", green: " — Hijau" }[riskValue] ?? "";
  if (title) title.innerHTML = `<em>Traffic Light</em> murid${riskSuffix}`;

  const totalCandidates = source.reduce((sum, school) => sum + school.candidates, 0);
  const totalRed = source.reduce((sum, school) => sum + school.red, 0);
  const totalAmber = source.reduce((sum, school) => sum + school.amber, 0);
  const totalGreen = Math.max(totalCandidates - totalRed - totalAmber, 0);
  const redDeg = totalCandidates ? (totalRed / totalCandidates) * 360 : 0;
  const amberDeg = totalCandidates ? redDeg + (totalAmber / totalCandidates) * 360 : redDeg;
  const safeAvg = totalCandidates
    ? Math.round(source.reduce((sum, school) => sum + school.pass * school.candidates, 0) / totalCandidates)
    : 0;

  chart.innerHTML = source.length
    ? source
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
    : `<div class="empty-state">Tiada sekolah sepadan dengan tapisan ini.</div>`;

  donut.style.setProperty("--red-deg", `${redDeg}deg`);
  donut.style.setProperty("--amber-deg", `${amberDeg}deg`);
  donut.dataset.label = totalCandidates ? `${safeAvg}%` : "—";
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
  syncSchoolTabs();

  grid.innerHTML = filteredSchools.length
    ? filteredSchools
    .map((school) => {
      const risk = getSchoolRiskForCurrentView(school);

      if (schoolViewMode === "attendance") {
        const attentionCount = getAttendanceAttentionCount(school);
        const stableCount = Math.max(Number(school.candidates || 0) - attentionCount, 0);
        return `
          <article class="school-card attendance-view ${risk}">
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
              <div><span>Hadir</span><strong>${school.attendance}%</strong></div>
              <div><span>Semak</span><strong>${attentionCount}</strong></div>
            </div>
            <div class="attendance-meter" aria-label="Kehadiran ${school.attendance}%">
              <span style="--attendance-value: ${clampPercentage(school.attendance)}%"></span>
            </div>
            <div class="support-tags" aria-label="Status kehadiran">
              <span>Stabil <strong>${stableCount}</strong></span>
              <span>Pantau <strong>${attentionCount}</strong></span>
              <span>Sasar <strong>92%</strong></span>
            </div>
            <p>Fokus kehadiran: semak murid di bawah paras selamat dan susun tindakan awal bersama guru kelas serta ibu bapa.</p>
          </article>
        `;
      }

      if (schoolViewMode === "subjects") {
        const mainSubject = school.subject && school.subject !== "-" ? school.subject : "Belum dikenal pasti";
        return `
          <article class="school-card subject-view ${risk}">
            <div>
              <div class="traffic ${risk}" aria-label="Risiko ${riskLabel[risk]}">
                <span class="red"></span>
                <span class="amber"></span>
                <span class="green"></span>
              </div>
              <h4>${school.name}</h4>
            </div>
            <div class="school-stats">
              <div><span>LMS</span><strong>${school.lmsNeed}</strong></div>
              <div><span>BM</span><strong>${school.bmNeed}</strong></div>
              <div><span>Sejarah</span><strong>${school.sejarahNeed}</strong></div>
            </div>
            <div class="subject-focus">
              <span>Subjek utama</span>
              <strong>${mainSubject}</strong>
            </div>
            <div class="support-tags" aria-label="Fokus subjek">
              <span>GPS Kualiti <strong>${school.gpsQuality}</strong></span>
              <span>BM belum selamat <strong>${school.bmNeed}</strong></span>
              <span>Sejarah belum selamat <strong>${school.sejarahNeed}</strong></span>
            </div>
            <p>Keutamaan: pastikan Bahasa Melayu dan Sejarah lulus untuk LMS, kemudian beri bimbingan subjek kritikal yang menekan GPS sekolah.</p>
          </article>
        `;
      }

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
  renderCharts(filteredSchools);
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
document.querySelectorAll("#schoolViewTabs button").forEach((button) => {
  button.addEventListener("click", () => setSchoolViewMode(button.dataset.schoolView));
});
window.addEventListener("hashchange", syncRouteUi);
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
document.querySelector("#reloadSchoolsBtn").addEventListener("click", () => loadEntrySchools({ refresh: true }));
document.querySelector("#loadCandidatesBtn").addEventListener("click", loadEntryCandidates);
document.querySelector("#downloadTemplateBtn").addEventListener("click", downloadSchoolTemplate);
document.querySelector("#downloadTemplateInlineBtn").addEventListener("click", downloadSchoolTemplate);
document.querySelector("#entrySchoolSelect").addEventListener("change", handleEntrySchoolChange);
document.querySelector("#entrySchoolSelect").addEventListener("focus", () => {
  if (activeSession && referenceSchools.length === 0) loadEntrySchools();
});
document.querySelector("#entrySchoolSelect").addEventListener("pointerdown", () => {
  if (activeSession && referenceSchools.length === 0) loadEntrySchools();
});
document.querySelector("#csvFileInput").addEventListener("change", handleCsvFileChange);
document.querySelector("#saveImportBtn").addEventListener("click", saveImportRows);

async function initApp() {
  setTodayLabel();
  renderIcons();
  await initAuth();
  await loadActiveCycleCode();
  await loadDashboardData();
  if (isDataEntryAllowed()) {
    await loadEntrySchools({ silent: !isDataEntryRoute() });
    scheduleEntrySchoolRetry();
  }
  renderAll();
  syncRouteUi();
  initPwaStatus();
  checkCameraSupport();
}

initApp();
