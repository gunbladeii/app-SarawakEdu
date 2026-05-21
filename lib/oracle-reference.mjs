const ORACLE_BASE_URL = "https://enazir.moe.gov.my/oracle_api.php";
const DEFAULT_PAGE_LIMIT = 1000;
const MAX_PAGES = 80;
const DEFAULT_MAX_STUDENT_SCHOOLS = 12;
const REQUEST_TIMEOUT_MS = 20000;
const DEFAULT_CACHE_TTL_SECONDS = 6 * 60 * 60;
const DEFAULT_STALE_TTL_SECONDS = 3 * 24 * 60 * 60;
const SERIAN_REFERENCE_SCHOOLS = [
  { code: "YEB8204", name: "SMK Balai Ringin", ppdCode: "Y082" },
  { code: "YEA1306", name: "SMK Padawan", ppdCode: "Y082" },
  { code: "YEB8205", name: "SMK Serian", ppdCode: "Y082" },
  { code: "YEE1302", name: "SMK Siburan", ppdCode: "Y082" },
  { code: "YEA8201", name: "SMK Taee", ppdCode: "Y082" },
  { code: "YEB8203", name: "SMK Tarat", ppdCode: "Y082" },
  { code: "YEB8202", name: "SMK Tebakang", ppdCode: "Y082" },
  { code: "YEA8202", name: "SMK Tebedu", ppdCode: "Y082" },
  { code: "YEB1301", name: "SMK Tun Abdul Razak", ppdCode: "Y082" }
];
const FORM_LABELS = {
  10: "Peralihan",
  11: "Tingkatan 1",
  12: "Tingkatan 2",
  13: "Tingkatan 3",
  14: "Tingkatan 4",
  15: "Tingkatan 5",
  16: "Tingkatan 6 Rendah",
  17: "Tingkatan 6 Atas"
};

class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const referenceCache = globalThis.__MYSPMCARE_REFERENCE_CACHE || new Map();
globalThis.__MYSPMCARE_REFERENCE_CACHE = referenceCache;

function env(name) {
  return (process.env[name] || "").trim();
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload));
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function assertCode(value, label, maxLength = 30) {
  if (!value) {
    return "";
  }

  const normalized = normalizeCode(value);
  if (!new RegExp(`^[A-Z0-9_-]{1,${maxLength}}$`).test(normalized)) {
    throw new ApiError(400, `${label} tidak sah.`);
  }

  return normalized;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function getCacheSettings() {
  return {
    ttlMs: clampInteger(env("ENAZIR_REFERENCE_CACHE_SECONDS"), DEFAULT_CACHE_TTL_SECONDS, 60, 7 * 24 * 60 * 60) * 1000,
    staleMs: clampInteger(env("ENAZIR_REFERENCE_STALE_SECONDS"), DEFAULT_STALE_TTL_SECONDS, 60, 14 * 24 * 60 * 60) * 1000
  };
}

function getCacheKey(scope, searchParams) {
  const pairs = [...searchParams.entries()]
    .filter(([key]) => !["refresh", "_"].includes(key))
    .sort(([left], [right]) => left.localeCompare(right));
  return `${scope}:${pairs.map(([key, value]) => `${key}=${value}`).join("&")}`;
}

function getCachedPayload(key, allowStale = false) {
  const cached = referenceCache.get(key);
  if (!cached) return null;

  const ageMs = Date.now() - cached.storedAt;
  const { ttlMs, staleMs } = getCacheSettings();

  if (ageMs <= ttlMs || (allowStale && ageMs <= staleMs)) {
    return {
      payload: cached.payload,
      cacheState: ageMs <= ttlMs ? "server_cache" : "server_stale",
      ageSeconds: Math.max(0, Math.round(ageMs / 1000))
    };
  }

  referenceCache.delete(key);
  return null;
}

function setCachedPayload(key, payload) {
  referenceCache.set(key, {
    payload,
    storedAt: Date.now()
  });
}

function withCacheMeta(payload, cacheState, ageSeconds = 0, warning = null) {
  return {
    ...payload,
    meta: {
      ...(payload.meta || {}),
      cache: cacheState,
      cacheAgeSeconds: ageSeconds,
      warning: warning || payload.meta?.warning || null
    }
  };
}

async function withReferenceCache(scope, searchParams, loader) {
  const key = getCacheKey(scope, searchParams);
  const refresh = searchParams.get("refresh") === "1";
  const fresh = refresh ? null : getCachedPayload(key, false);

  if (fresh) {
    return withCacheMeta(fresh.payload, fresh.cacheState, fresh.ageSeconds);
  }

  try {
    const payload = await loader();
    setCachedPayload(key, payload);
    return withCacheMeta(payload, "live", 0);
  } catch (error) {
    const stale = getCachedPayload(key, true);
    if (stale) {
      return withCacheMeta(stale.payload, stale.cacheState, stale.ageSeconds, error.message);
    }
    throw error;
  }
}

function withTimeout() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return { controller, timeout };
}

function unwrapRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload?.result)) {
    return payload.result;
  }

  if (Array.isArray(payload?.data?.rows)) {
    return payload.data.rows;
  }

  if (payload && typeof payload === "object" && Object.keys(payload).length) {
    return [payload];
  }

  return [];
}

async function fetchOracle(endpoint, params = {}) {
  const apiKey = env("ENAZIR_ORACLE_API_KEY");
  if (!apiKey) {
    throw new ApiError(500, "Tetapan capaian data belum lengkap.");
  }

  const url = new URL(`${ORACLE_BASE_URL}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  url.searchParams.set("api_key", apiKey);

  const { controller, timeout } = withTimeout();
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json"
      },
      signal: controller.signal
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiError(502, "Maklum balas data tidak dapat dibaca.");
    }

    if (!response.ok) {
      throw new ApiError(response.status, "Gagal mendapatkan data rujukan.", payload);
    }

    return unwrapRows(payload);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError(504, "Capaian data mengambil masa terlalu lama.");
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(502, "Gagal menyambung kepada sumber data.");
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOracleAll(endpoint, baseParams = {}, options = {}) {
  const limit = clampInteger(options.limit ?? baseParams.limit, DEFAULT_PAGE_LIMIT, 1, DEFAULT_PAGE_LIMIT);
  let offset = clampInteger(options.offset ?? baseParams.offset, 0, 0, 100000);
  const maxPages = clampInteger(options.maxPages, MAX_PAGES, 1, MAX_PAGES);
  const rows = [];

  for (let page = 0; page < maxPages; page += 1) {
    const batch = await fetchOracle(endpoint, {
      ...baseParams,
      limit,
      offset
    });

    rows.push(...batch);

    if (batch.length < limit) {
      break;
    }

    offset += limit;
  }

  return rows;
}

function getFirst(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return "";
}

function normalizeSchool(row, includeRaw = false) {
  const school = {
    code: normalizeCode(getFirst(row, ["KODSEKOLAH", "KOD_SEKOLAH", "kod_sekolah", "code"])),
    name: String(getFirst(row, ["NAMASEKOLAH", "NAMA_SEKOLAH", "NAMA", "name"])).trim(),
    ppdCode: normalizeCode(getFirst(row, ["KODPPD", "KOD_PPD", "ppdCode"])),
    stateCode: normalizeCode(getFirst(row, ["KODNEGERI", "KOD_NEGERI", "stateCode"])),
    typeCode: normalizeCode(getFirst(row, ["KODJENISSEKOLAH", "KOD_JENIS_SEKOLAH", "typeCode"])),
    streamCode: normalizeCode(getFirst(row, ["KODALIRAN", "KOD_ALIRAN", "streamCode"]))
  };

  if (includeRaw) {
    school.raw = row;
  }

  return school;
}

function normalizeStudent(row, schoolCode, includeRaw = false, classMap = new Map()) {
  const classId = String(getFirst(row, ["IDKELAS", "ID_KELAS", "classId"])).trim();
  const classInfo = classMap.get(classId) || {};
  const student = {
    studentCode: String(getFirst(row, [
      "IDMURID",
      "ID_MURID",
      "KPM_ID",
      "KPMID",
      "NOKP",
      "NO_KP",
      "NOIC",
      "KP",
      "KPUTAMA",
      "student_code"
    ])).trim(),
    name: String(getFirst(row, ["NAMA", "NAMAMURID", "NAMA_MURID", "name"])).trim(),
    schoolCode: normalizeCode(getFirst(row, ["KODSEKOLAH", "KOD_SEKOLAH", "kod_sekolah"])) || schoolCode,
    classId,
    className: String(getFirst(row, ["KELAS", "NAMA_KELAS", "className"])).trim() || classInfo.className || "",
    formCode: String(getFirst(row, ["IDKODTINGKATANTAHUN", "TINGKATAN", "TING", "TAHUN", "formCode"])).trim() || classInfo.formCode || "",
    form: String(getFirst(row, ["KETERANGANTINGKATANTAHUN", "KETERANGAN_TINGKATAN", "form"])).trim() || classInfo.form || "",
    gender: String(getFirst(row, ["KODJANTINA", "JANTINA", "gender"])).trim(),
    citizenshipCode: String(getFirst(row, ["KODSTATUSKEWARGANEGARAAN", "citizenshipCode"])).trim(),
    okuStatus: String(getFirst(row, ["STATUSOKU", "okuStatus"])).trim(),
    program: String(getFirst(row, ["PROGRAM", "program"])).trim(),
    hostel: String(getFirst(row, ["ASRAMA", "hostel"])).trim(),
    status: String(getFirst(row, ["STATUS", "STATUS_MURID", "status"])).trim()
  };

  if (includeRaw) {
    student.raw = row;
  }

  return student;
}

function normalizeClass(row, includeRaw = false) {
  const formCode = String(getFirst(row, ["IDKODTINGKATANTAHUN", "formCode"])).trim();
  const classItem = {
    classId: String(getFirst(row, ["IDKELAS", "ID_KELAS", "classId"])).trim(),
    className: String(getFirst(row, ["NAMAKELAS", "NAMA_KELAS", "className"])).trim(),
    formCode,
    form: String(getFirst(row, ["KETERANGANTINGKATANTAHUN", "form"])).trim() || FORM_LABELS[formCode] || "",
    session: String(getFirst(row, ["SESIKELAS", "session"])).trim(),
    schoolCode: normalizeCode(getFirst(row, ["KODSEKOLAH", "KOD_SEKOLAH", "schoolCode"])),
    streamCode: String(getFirst(row, ["INTALIRAN", "streamCode"])).trim(),
    fieldCode: String(getFirst(row, ["INTBIDANG", "fieldCode"])).trim()
  };

  if (includeRaw) {
    classItem.raw = row;
  }

  return classItem;
}

function normalizeEnrolment(row, schoolCode, includeRaw = false) {
  const formCode = String(getFirst(row, ["IDKODTINGKATANTAHUN", "formCode"])).trim();
  const item = {
    schoolCode: normalizeCode(getFirst(row, ["KODSEKOLAH", "KOD_SEKOLAH", "schoolCode"])) || schoolCode,
    formCode,
    form: String(getFirst(row, ["KETERANGANTINGKATANTAHUN", "form"])).trim() || FORM_LABELS[formCode] || "",
    count: Number(getFirst(row, ["BILANGAN_MURID", "BIL", "count"])) || 0
  };

  if (includeRaw) {
    item.raw = row;
  }

  return item;
}

async function fetchClassMap(schoolCode, includeRaw = false) {
  const rows = await fetchOracleAll("kelas", { kod_sekolah: schoolCode }, { maxPages: 5 });
  const classes = rows.map((row) => normalizeClass(row, includeRaw));
  return {
    classes,
    map: new Map(classes.map((item) => [item.classId, item]))
  };
}

function looksLikeSecondarySchool(school) {
  const name = school.name.toUpperCase();
  return /\bSMK\b/.test(name) || /\bSM\b/.test(name) || name.includes("SEKOLAH MENENGAH");
}

function getTargetConfig(searchParams) {
  const queryPpdCode = searchParams.get("kod_ppd");
  const ppdCode = assertCode(queryPpdCode || env("ENAZIR_PPD_CODE"), "Kod PPD", 20);
  const querySchoolCodes = splitCsv(searchParams.get("kod_sekolah_list")).map((code) => assertCode(code, "Kod sekolah"));
  const envSchoolCodes = splitCsv(env("ENAZIR_ALLOWED_SCHOOL_CODES")).map((code) => assertCode(code, "Kod sekolah"));
  const allowedSchoolCodes = querySchoolCodes.length ? querySchoolCodes : envSchoolCodes;
  const schoolLevel = (searchParams.get("peringkat") || env("ENAZIR_SCHOOL_LEVEL") || "menengah").toLowerCase();

  if (!ppdCode && allowedSchoolCodes.length === 0) {
    throw new ApiError(
      400,
      "Sila tetapkan kod PPD Serian atau senarai kod sekolah Serian sebelum data diminta."
    );
  }

  return {
    ppdCode,
    allowedSchoolCodes,
    schoolLevel
  };
}

async function fetchSchoolByCode(code, includeRaw) {
  const normalizedCode = assertCode(code, "Kod sekolah");
  let rows = await fetchOracle("profil_sekolah", { kod_sekolah: normalizedCode, limit: 1, offset: 0 });

  if (!rows.length) {
    rows = await fetchOracle("sekolah", { kod_sekolah: normalizedCode, limit: 1, offset: 0 });
  }

  return rows.map((row) => normalizeSchool(row, includeRaw)).find((school) => school.code) || null;
}

function filterTargetSchools(schools, target) {
  const allowedSet = new Set(target.allowedSchoolCodes);
  const hasAllowedList = allowedSet.size > 0;

  return schools.filter((school) => {
    if (!school.code) {
      return false;
    }

    if (hasAllowedList && !allowedSet.has(school.code)) {
      return false;
    }

    if (target.ppdCode && school.ppdCode !== target.ppdCode) {
      return false;
    }

    if (!hasAllowedList && target.schoolLevel !== "semua" && !looksLikeSecondarySchool(school)) {
      return false;
    }

    return true;
  });
}

function getFallbackTargetSchools(target) {
  return filterTargetSchools(
    SERIAN_REFERENCE_SCHOOLS.map((school) => ({
      code: school.code,
      name: school.name,
      ppdCode: school.ppdCode,
      stateCode: "",
      typeCode: "",
      streamCode: ""
    })),
    target
  );
}

async function resolveTargetSchools(searchParams, includeRaw) {
  const target = getTargetConfig(searchParams);

  if (target.allowedSchoolCodes.length) {
    const schools = await Promise.all(
      target.allowedSchoolCodes.map((code) => fetchSchoolByCode(code, includeRaw))
    );
    return {
      target,
      schools: filterTargetSchools(schools.filter(Boolean), target)
    };
  }

  const rows = await fetchOracleAll("profil_sekolah", {
    limit: DEFAULT_PAGE_LIMIT,
    offset: 0
  });
  const schools = rows.map((row) => normalizeSchool(row, includeRaw));

  return {
    target,
    schools: filterTargetSchools(schools, target)
  };
}

async function resolveTargetSchoolsSafe(searchParams, includeRaw) {
  let target = getTargetConfig(searchParams);

  try {
    const result = await resolveTargetSchools(searchParams, includeRaw);
    target = result.target;

    if (result.schools.length) {
      return {
        ...result,
        referenceSource: "sumber_semasa"
      };
    }
  } catch (error) {
    const fallbackSchools = getFallbackTargetSchools(target);
    if (!fallbackSchools.length) {
      throw error;
    }

    return {
      target,
      schools: fallbackSchools,
      referenceSource: "senarai_serian",
      referenceWarning: error.message
    };
  }

  const fallbackSchools = getFallbackTargetSchools(target);
  return {
    target,
    schools: fallbackSchools,
    referenceSource: "senarai_serian",
    referenceWarning: fallbackSchools.length ? "Senarai sekolah semasa tidak memulangkan rekod." : null
  };
}

function getBearerToken(request) {
  const header = request.headers?.authorization || request.headers?.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getSupabaseServerConfig() {
  const supabaseUrl = (env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/$/, "");
  const supabaseAnonKey = env("SUPABASE_ANON_KEY") || env("NEXT_PUBLIC_SUPABASE_ANON_KEY") || env("VITE_SUPABASE_ANON_KEY");
  return { supabaseUrl, supabaseAnonKey };
}

async function verifySupabaseSession(request) {
  if (env("ORACLE_REFERENCE_REQUIRE_AUTH").toLowerCase() === "false") {
    return null;
  }

  const token = getBearerToken(request);
  if (!token) {
    throw new ApiError(401, "Sila log masuk dahulu sebelum mendapatkan data.");
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseServerConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new ApiError(500, "Tetapan keselamatan belum lengkap.");
  }

  const { controller, timeout } = withTimeout();
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new ApiError(401, "Sesi log masuk tidak sah atau telah tamat.");
    }

    const user = await response.json();
    const allowedEmails = splitCsv(env("ORACLE_REFERENCE_ALLOWED_EMAILS")).map((email) => email.toLowerCase());
    const userEmail = String(user?.email || "").toLowerCase();

    if (allowedEmails.length && !allowedEmails.includes(userEmail)) {
      throw new ApiError(403, "Akaun ini belum dibenarkan untuk mendapatkan data.");
    }

    return user;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error.name === "AbortError") {
      throw new ApiError(504, "Semakan log masuk mengambil masa terlalu lama.");
    }
    throw new ApiError(502, "Gagal menyemak sesi log masuk.");
  } finally {
    clearTimeout(timeout);
  }
}

async function handleSchools(searchParams) {
  const includeRaw = env("ENAZIR_ALLOW_RAW_REFERENCE").toLowerCase() === "true" && searchParams.get("include_raw") === "1";
  const { target, schools, referenceSource, referenceWarning } = await resolveTargetSchoolsSafe(searchParams, includeRaw);

  return {
    success: true,
    scope: "schools",
    count: schools.length,
    data: schools,
    meta: {
      ppdCode: target.ppdCode || null,
      source: referenceSource || (target.allowedSchoolCodes.length ? "school_codes" : "ppd_code"),
      schoolLevel: target.schoolLevel,
      warning: referenceWarning || null
    }
  };
}

async function handleStudents(searchParams) {
  const includeRaw = env("ENAZIR_ALLOW_RAW_REFERENCE").toLowerCase() === "true" && searchParams.get("include_raw") === "1";
  const requestedSchoolCode = assertCode(searchParams.get("kod_sekolah"), "Kod sekolah");
  const maxStudentSchools = clampInteger(env("ENAZIR_MAX_STUDENT_SCHOOLS"), DEFAULT_MAX_STUDENT_SCHOOLS, 1, 50);
  const { target, schools, referenceSource, referenceWarning } = await resolveTargetSchoolsSafe(searchParams, includeRaw);
  const targetCodes = new Set(schools.map((school) => school.code));

  let selectedSchools = schools;
  if (requestedSchoolCode) {
    if (!targetCodes.has(requestedSchoolCode)) {
      throw new ApiError(403, "Kod sekolah ini tidak berada dalam senarai sasaran Serian.");
    }
    selectedSchools = schools.filter((school) => school.code === requestedSchoolCode);
  }

  if (!selectedSchools.length) {
    return {
      success: true,
      scope: "students",
      count: 0,
      data: [],
      meta: {
        schoolCount: 0,
        ppdCode: target.ppdCode || null
      }
    };
  }

  if (!requestedSchoolCode && selectedSchools.length > maxStudentSchools) {
    throw new ApiError(
      400,
      `Carian murid dihadkan kepada ${maxStudentSchools} sekolah sekali jalan. Pilih satu kod sekolah atau kecilkan senarai sasaran.`
    );
  }

  const limit = clampInteger(searchParams.get("limit"), DEFAULT_PAGE_LIMIT, 1, DEFAULT_PAGE_LIMIT);
  const offset = clampInteger(searchParams.get("offset"), 0, 0, 100000);
  const spmOnly = searchParams.get("spm_only") === "1";
  const chunks = await Promise.all(
    selectedSchools.map(async (school) => {
      let classMap = new Map();
      try {
        classMap = (await fetchClassMap(school.code, false)).map;
      } catch {
        classMap = new Map();
      }

      const rows = await fetchOracleAll("murid", {
        kod_sekolah: school.code,
        limit,
        offset
      }, {
        limit,
        offset,
        maxPages: requestedSchoolCode ? MAX_PAGES : 3
      });
      const students = rows.map((row) => normalizeStudent(row, school.code, includeRaw, classMap));
      return spmOnly ? students.filter((student) => student.formCode === "15") : students;
    })
  );
  const students = chunks.flat();

  return {
    success: true,
    scope: "students",
    count: students.length,
    data: students,
    meta: {
      schoolCount: selectedSchools.length,
      schools: selectedSchools.map((school) => ({ code: school.code, name: school.name })),
      spmOnly,
      ppdCode: target.ppdCode || null,
      source: referenceSource || null,
      warning: referenceWarning || null
    }
  };
}

async function handleClasses(searchParams) {
  const includeRaw = env("ENAZIR_ALLOW_RAW_REFERENCE").toLowerCase() === "true" && searchParams.get("include_raw") === "1";
  const requestedSchoolCode = assertCode(searchParams.get("kod_sekolah"), "Kod sekolah");
  const { target, schools, referenceSource, referenceWarning } = await resolveTargetSchoolsSafe(searchParams, false);
  const targetCodes = new Set(schools.map((school) => school.code));

  let selectedSchools = schools;
  if (requestedSchoolCode) {
    if (!targetCodes.has(requestedSchoolCode)) {
      throw new ApiError(403, "Kod sekolah ini tidak berada dalam senarai sasaran Serian.");
    }
    selectedSchools = schools.filter((school) => school.code === requestedSchoolCode);
  }

  const chunks = await Promise.all(
    selectedSchools.map(async (school) => {
      const { classes } = await fetchClassMap(school.code, includeRaw);
      return classes;
    })
  );
  const classes = chunks.flat();

  return {
    success: true,
    scope: "classes",
    count: classes.length,
    data: classes,
    meta: {
      schoolCount: selectedSchools.length,
      schools: selectedSchools.map((school) => ({ code: school.code, name: school.name })),
      ppdCode: target.ppdCode || null,
      source: referenceSource || null,
      warning: referenceWarning || null
    }
  };
}

async function handleEnrolment(searchParams) {
  const includeRaw = env("ENAZIR_ALLOW_RAW_REFERENCE").toLowerCase() === "true" && searchParams.get("include_raw") === "1";
  const requestedSchoolCode = assertCode(searchParams.get("kod_sekolah"), "Kod sekolah");
  const { target, schools, referenceSource, referenceWarning } = await resolveTargetSchoolsSafe(searchParams, false);
  const targetCodes = new Set(schools.map((school) => school.code));

  let selectedSchools = schools;
  if (requestedSchoolCode) {
    if (!targetCodes.has(requestedSchoolCode)) {
      throw new ApiError(403, "Kod sekolah ini tidak berada dalam senarai sasaran Serian.");
    }
    selectedSchools = schools.filter((school) => school.code === requestedSchoolCode);
  }

  const chunks = await Promise.all(
    selectedSchools.map(async (school) => {
      const rows = await fetchOracleAll("enrolmen", { kod_sekolah: school.code }, { maxPages: 5 });
      return rows.map((row) => normalizeEnrolment(row, school.code, includeRaw));
    })
  );
  const enrolment = chunks.flat();

  return {
    success: true,
    scope: "enrolment",
    count: enrolment.length,
    data: enrolment,
    meta: {
      schoolCount: selectedSchools.length,
      schools: selectedSchools.map((school) => ({ code: school.code, name: school.name })),
      ppdCode: target.ppdCode || null,
      source: referenceSource || null,
      warning: referenceWarning || null
    }
  };
}

async function handleSummary(searchParams) {
  const { target, schools, referenceSource, referenceWarning } = await resolveTargetSchoolsSafe(searchParams, false);

  return {
    success: true,
    scope: "summary",
    data: {
      schoolCount: schools.length,
      schools: schools.map((school) => ({ code: school.code, name: school.name }))
    },
    meta: {
      ppdCode: target.ppdCode || null,
      source: referenceSource || (target.allowedSchoolCodes.length ? "school_codes" : "ppd_code"),
      schoolLevel: target.schoolLevel,
      warning: referenceWarning || null
    }
  };
}

export async function handleOracleReferenceRequest(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { success: false, message: "Kaedah capaian tidak disokong." });
    return;
  }

  try {
    await verifySupabaseSession(request);

    const url = new URL(request.url, "http://localhost");
    const scope = (url.searchParams.get("scope") || "summary").toLowerCase();

    if (scope === "schools") {
      sendJson(response, 200, await withReferenceCache(scope, url.searchParams, () => handleSchools(url.searchParams)));
      return;
    }

    if (scope === "students") {
      sendJson(response, 200, await withReferenceCache(scope, url.searchParams, () => handleStudents(url.searchParams)));
      return;
    }

    if (scope === "classes") {
      sendJson(response, 200, await withReferenceCache(scope, url.searchParams, () => handleClasses(url.searchParams)));
      return;
    }

    if (scope === "enrolment") {
      sendJson(response, 200, await withReferenceCache(scope, url.searchParams, () => handleEnrolment(url.searchParams)));
      return;
    }

    if (scope === "summary") {
      sendJson(response, 200, await withReferenceCache(scope, url.searchParams, () => handleSummary(url.searchParams)));
      return;
    }

    throw new ApiError(400, "Jenis data tidak disokong. Gunakan schools, students, classes, enrolment atau summary.");
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Ralat tidak dijangka.";
    const payload = { success: false, message };

    if (env("NODE_ENV") !== "production" && error?.details) {
      payload.details = error.details;
    }

    sendJson(response, status, payload);
  }
}
