const ORACLE_BASE_URL = "https://enazir.moe.gov.my/oracle_api.php";
const DEFAULT_PAGE_LIMIT = 1000;
const MAX_PAGES = 80;
const DEFAULT_MAX_STUDENT_SCHOOLS = 12;
const REQUEST_TIMEOUT_MS = 20000;

class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

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

  const { controller, timeout } = withTimeout();
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`
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

function normalizeStudent(row, schoolCode, includeRaw = false) {
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
    form: String(getFirst(row, ["TINGKATAN", "TING", "TAHUN", "form"])).trim(),
    className: String(getFirst(row, ["KELAS", "NAMA_KELAS", "className"])).trim(),
    gender: String(getFirst(row, ["JANTINA", "gender"])).trim(),
    status: String(getFirst(row, ["STATUS", "STATUS_MURID", "status"])).trim()
  };

  if (includeRaw) {
    student.raw = row;
  }

  return student;
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
  const { target, schools } = await resolveTargetSchools(searchParams, includeRaw);

  return {
    success: true,
    scope: "schools",
    count: schools.length,
    data: schools,
    meta: {
      ppdCode: target.ppdCode || null,
      source: target.allowedSchoolCodes.length ? "school_codes" : "ppd_code",
      schoolLevel: target.schoolLevel
    }
  };
}

async function handleStudents(searchParams) {
  const includeRaw = env("ENAZIR_ALLOW_RAW_REFERENCE").toLowerCase() === "true" && searchParams.get("include_raw") === "1";
  const requestedSchoolCode = assertCode(searchParams.get("kod_sekolah"), "Kod sekolah");
  const maxStudentSchools = clampInteger(env("ENAZIR_MAX_STUDENT_SCHOOLS"), DEFAULT_MAX_STUDENT_SCHOOLS, 1, 50);
  const { target, schools } = await resolveTargetSchools(searchParams, includeRaw);
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
  const chunks = await Promise.all(
    selectedSchools.map(async (school) => {
      const rows = await fetchOracleAll("murid", {
        kod_sekolah: school.code,
        limit,
        offset
      }, {
        limit,
        offset,
        maxPages: requestedSchoolCode ? MAX_PAGES : 3
      });
      return rows.map((row) => normalizeStudent(row, school.code, includeRaw));
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
      ppdCode: target.ppdCode || null
    }
  };
}

async function handleSummary(searchParams) {
  const { target, schools } = await resolveTargetSchools(searchParams, false);

  return {
    success: true,
    scope: "summary",
    data: {
      schoolCount: schools.length,
      schools: schools.map((school) => ({ code: school.code, name: school.name }))
    },
    meta: {
      ppdCode: target.ppdCode || null,
      source: target.allowedSchoolCodes.length ? "school_codes" : "ppd_code",
      schoolLevel: target.schoolLevel
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
      sendJson(response, 200, await handleSchools(url.searchParams));
      return;
    }

    if (scope === "students") {
      sendJson(response, 200, await handleStudents(url.searchParams));
      return;
    }

    if (scope === "summary") {
      sendJson(response, 200, await handleSummary(url.searchParams));
      return;
    }

    throw new ApiError(400, "Jenis data tidak disokong. Gunakan schools, students atau summary.");
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
