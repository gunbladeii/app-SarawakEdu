import { createHash } from "node:crypto";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
const PROMPT_VERSION = "myspmcare-intervention-v1";
const DEFAULT_TIMEOUT_MS = 30000;

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

function getBearerToken(request) {
  const header = request.headers?.authorization || request.headers?.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getSupabaseConfig() {
  const supabaseUrl = (env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/$/, "");
  const supabaseAnonKey = env("SUPABASE_ANON_KEY") || env("NEXT_PUBLIC_SUPABASE_ANON_KEY") || env("VITE_SUPABASE_ANON_KEY");
  return { supabaseUrl, supabaseAnonKey };
}

function withTimeout(ms = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Format permintaan tidak sah.");
  }
}

async function verifySupabaseSession(request) {
  const token = getBearerToken(request);
  if (!token) {
    throw new ApiError(401, "Sila log masuk dahulu sebelum jana cadangan.");
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new ApiError(500, "Tetapan Supabase belum lengkap.");
  }

  const { controller, timeout } = withTimeout(15000);
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

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function supabaseFetch(path, token, options = {}) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body?.message || body?.hint || `Supabase ${response.status}`;
    throw new ApiError(response.status, message, body);
  }

  return body;
}

function normalizeRisk(value) {
  const text = String(value || "").trim().toLowerCase();
  if (["red", "merah"].includes(text)) return "red";
  if (["amber", "yellow", "kuning"].includes(text)) return "amber";
  if (["green", "hijau"].includes(text)) return "green";
  return "green";
}

function normalizeStudent(input = {}) {
  return {
    studentCode: String(input.studentCode || input.student_code || "").trim(),
    schoolCode: String(input.schoolCode || input.school_code || "").trim().toUpperCase(),
    name: String(input.name || input.studentName || input.student_name || input.studentCode || "Murid").trim(),
    school: String(input.school || input.schoolName || input.school_name || input.schoolCode || "-").trim(),
    risk: normalizeRisk(input.risk),
    focus: String(input.focus || input.focusArea || input.gpsFocus || input.lmsFocus || "Pemantauan").trim(),
    issue: String(input.issue || input.issue_note || "Perlu pemantauan berkala").trim(),
    intervention: String(input.intervention || "Belum direkod").trim(),
    attendance: input.attendance ?? input.attendance_rate ?? null,
    bmPass: input.bmPass ?? input.bm_pass ?? null,
    sejarahPass: input.sejarahPass ?? input.sejarah_pass ?? null,
    gpsFocus: String(input.gpsFocus || input.gps_focus || "-").trim(),
    lmsFocus: String(input.lmsFocus || input.lms_focus || "").trim()
  };
}

function getStudentFocus(student) {
  if (student.lmsFocus && student.lmsFocus !== "Sedia LMS") return "LMS";
  if (student.gpsFocus && student.gpsFocus !== "-") return student.gpsFocus;
  if (student.focus) return student.focus;
  return "Pemantauan";
}

function fallbackSuggestion(studentInput, source = "rule-fallback") {
  const student = normalizeStudent(studentInput);
  const focus = getStudentFocus(student);
  const attendance = Number(student.attendance);
  const hasAttendanceIssue = Number.isFinite(attendance) && attendance < 90;
  const needsLms = focus === "LMS" || student.bmPass === false || student.sejarahPass === false;
  const steps = ["Sahkan data markah, kehadiran dan isu semasa murid bersama guru kelas sebelum tindakan dimulakan."];
  const owners = new Set(["Guru kelas", "Guru mata pelajaran"]);

  if (needsLms) {
    const subjectText = student.lmsFocus?.replace(/^Perlu bantuan\s+/i, "") || "Bahasa Melayu dan Sejarah";
    steps.push(`Tetapkan klinik LMS berfokus ${subjectText} dengan latihan ringkas dan semakan kemajuan setiap minggu.`);
    owners.add("Penyelaras SPM");
  }

  if (student.gpsFocus === "GPS Kualiti") {
    steps.push("Kenal pasti topik paling lemah dan jalankan latih tubi sasaran berdasarkan item yang kerap gagal.");
    owners.add("Ketua panitia");
  }

  if (student.gpsFocus === "GPS Kuantiti") {
    steps.push("Pastikan murid kekal dalam kumpulan lulus melalui set latihan minimum, semakan tugasan dan bimbingan berkala.");
    owners.add("Mentor akademik");
  }

  if (hasAttendanceIssue) {
    steps.push("Hubungi ibu bapa untuk sahkan punca ketidakhadiran dan tetapkan sokongan harian sehingga kehadiran stabil.");
    owners.add("Ibu bapa");
  }

  if (student.risk === "red") {
    steps.push("Buat semakan status dalam 7 hari dan naikkan kes kepada kaunselor atau komuniti jika murid masih tidak menunjukkan perubahan.");
    owners.add("Kaunselor");
  } else if (student.risk === "amber") {
    steps.push("Pantau semula dalam 14 hari; kekalkan tindakan jika ada peningkatan dan ubah kaedah jika data masih mendatar.");
  } else {
    steps.push("Kekalkan pengukuhan dan beri tugasan pemantapan supaya momentum murid tidak menurun.");
  }

  return {
    priority: student.risk === "red" ? "Tindakan segera" : student.risk === "amber" ? "Pemantauan rapi" : "Pengukuhan",
    review: student.risk === "red" ? "7 hari" : student.risk === "amber" ? "14 hari" : "30 hari",
    owners: [...owners],
    issueSummary: student.issue,
    actionSteps: steps,
    escalation: student.risk === "red" ? "Rujuk kepada kaunselor dan libatkan ibu bapa jika tiada perubahan selepas semakan pertama." : "Kekalkan pemantauan sekolah dan kemas kini status selepas tempoh semakan.",
    source
  };
}

function buildSourceHash(student) {
  const payload = {
    studentCode: student.studentCode,
    schoolCode: student.schoolCode,
    risk: student.risk,
    focus: getStudentFocus(student),
    issue: student.issue,
    attendance: student.attendance,
    bmPass: student.bmPass,
    sejarahPass: student.sejarahPass,
    gpsFocus: student.gpsFocus,
    lmsFocus: student.lmsFocus
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function fetchStudentFromDb(token, studentCode, snapshot) {
  if (!studentCode) return normalizeStudent(snapshot);

  const encoded = encodeURIComponent(studentCode);
  const paths = [
    `dashboard_real_student_risks?select=id,student_code,school_code,name,school,risk,issue,intervention,attendance_rate,gps_focus,lms_focus,bm_pass,sejarah_pass&student_code=eq.${encoded}&limit=1`,
    `dashboard_student_risks?select=id,student_code,name,school,risk,issue,intervention,attendance_rate,gps_focus,lms_focus,bm_pass,sejarah_pass&student_code=eq.${encoded}&limit=1`
  ];

  for (const path of paths) {
    try {
      const rows = await supabaseFetch(path, token);
      if (Array.isArray(rows) && rows[0]) {
        return normalizeStudent({
          ...snapshot,
          ...rows[0],
          studentCode: rows[0].student_code,
          schoolCode: rows[0].school_code || snapshot?.schoolCode,
          attendance: rows[0].attendance_rate,
          gpsFocus: rows[0].gps_focus,
          lmsFocus: rows[0].lms_focus,
          bmPass: rows[0].bm_pass,
          sejarahPass: rows[0].sejarah_pass
        });
      }
    } catch {
      // The app can still generate a suggestion from the safe snapshot.
    }
  }

  return normalizeStudent(snapshot);
}

async function fetchCachedSuggestion(token, student, sourceHash) {
  if (!student.studentCode) return null;

  try {
    const rows = await supabaseFetch(
      `student_ai_suggestions?select=id,suggestion,provider,model,created_at&student_code=eq.${encodeURIComponent(student.studentCode)}&source_hash=eq.${sourceHash}&prompt_version=eq.${PROMPT_VERSION}&status=eq.generated&order=created_at.desc&limit=1`,
      token
    );
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

async function saveSuggestion(token, student, sourceHash, provider, model, suggestion) {
  if (!student.studentCode) return null;

  try {
    const rows = await supabaseFetch("student_ai_suggestions?on_conflict=student_code,source_hash,prompt_version&select=id", token, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        student_code: student.studentCode,
        school_code: student.schoolCode || null,
        student_name: student.name,
        risk: student.risk,
        focus_area: getStudentFocus(student),
        source_hash: sourceHash,
        prompt_version: PROMPT_VERSION,
        provider,
        model,
        suggestion,
        status: "generated"
      })
    });
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

function buildGeminiPrompt(student) {
  const safeProfile = {
    studentCode: student.studentCode || "Tidak dipaparkan",
    school: student.school,
    risk: student.risk,
    focus: getStudentFocus(student),
    issue: student.issue,
    attendance: student.attendance,
    bmPass: student.bmPass,
    sejarahPass: student.sejarahPass,
    gpsFocus: student.gpsFocus,
    lmsFocus: student.lmsFocus
  };

  return [
    "Anda ialah pembantu intervensi akademik untuk MySPMCare Daerah Serian.",
    "Tugas anda ialah mencadangkan pelan intervensi awal yang ringkas, praktikal dan sesuai untuk pihak sekolah/PPD.",
    "Gunakan Bahasa Malaysia profesional yang mudah difahami.",
    "Jangan reka maklumat peribadi baharu. Jangan masukkan nombor telefon, alamat atau data sensitif.",
    "Konteks LMS: Bahasa Melayu dan Sejarah mesti lulus untuk layak mendapat sijil.",
    "Konteks GPS: GPS Kualiti fokus meningkatkan purata gred; GPS Kuantiti fokus mengekalkan atau menambah bilangan murid lulus.",
    "Kembalikan JSON sahaja dengan keys: priority, review, owners, issueSummary, actionSteps, escalation.",
    "Pastikan actionSteps mengandungi 3 hingga 5 tindakan praktikal.",
    "",
    `Profil murid: ${JSON.stringify(safeProfile)}`
  ].join("\n");
}

function normalizeAiSuggestion(value, student) {
  const fallback = fallbackSuggestion(student, "rule-fallback");
  const suggestion = value && typeof value === "object" ? value : {};
  const actionSteps = Array.isArray(suggestion.actionSteps)
    ? suggestion.actionSteps.filter(Boolean).slice(0, 5)
    : fallback.actionSteps;
  const owners = Array.isArray(suggestion.owners)
    ? suggestion.owners.filter(Boolean).slice(0, 6)
    : fallback.owners;

  return {
    priority: String(suggestion.priority || fallback.priority),
    review: String(suggestion.review || fallback.review),
    owners: owners.length ? owners : fallback.owners,
    issueSummary: String(suggestion.issueSummary || fallback.issueSummary),
    actionSteps: actionSteps.length ? actionSteps : fallback.actionSteps,
    escalation: String(suggestion.escalation || fallback.escalation)
  };
}

async function generateWithGemini(student) {
  const apiKey = env("GEMINI_API_KEY");
  const model = env("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
  if (!apiKey) {
    return { suggestion: fallbackSuggestion(student, "rule-fallback"), provider: "local", model: "rule-fallback" };
  }

  const { controller, timeout } = withTimeout(Number(env("GEMINI_TIMEOUT_MS")) || DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "Jawab hanya dalam JSON mengikut skema yang diminta." }]
        },
        contents: [{ parts: [{ text: buildGeminiPrompt(student) }] }],
        generationConfig: {
          temperature: 0.35,
          response_mime_type: "application/json"
        }
      }),
      signal: controller.signal
    });

    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(response.status, data?.error?.message || "Cadangan AI belum dapat dijana.", data);
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    const parsed = JSON.parse(text);
    return {
      suggestion: normalizeAiSuggestion(parsed, student),
      provider: "gemini",
      model
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleAiInterventionRequest(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { success: false, message: "Kaedah capaian tidak disokong." });
    return;
  }

  try {
    await verifySupabaseSession(request);
    const token = getBearerToken(request);
    const body = await readJsonBody(request);
    const snapshot = normalizeStudent(body.student || body);
    const student = await fetchStudentFromDb(token, body.studentCode || snapshot.studentCode, snapshot);
    const sourceHash = buildSourceHash(student);
    const cached = await fetchCachedSuggestion(token, student, sourceHash);

    if (cached?.suggestion) {
      sendJson(response, 200, {
        success: true,
        cached: true,
        provider: cached.provider || "cache",
        model: cached.model || "cached",
        student,
        suggestion: cached.suggestion
      });
      return;
    }

    let generated;
    try {
      generated = await generateWithGemini(student);
    } catch (error) {
      generated = {
        suggestion: fallbackSuggestion(student, "rule-fallback"),
        provider: "local",
        model: "rule-fallback",
        warning: error.message
      };
    }

    if (generated.provider !== "local") {
      await saveSuggestion(token, student, sourceHash, generated.provider, generated.model, generated.suggestion);
    }

    sendJson(response, 200, {
      success: true,
      cached: false,
      provider: generated.provider,
      model: generated.model,
      warning: generated.warning || null,
      student,
      suggestion: generated.suggestion
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Cadangan AI belum dapat dijana.";
    sendJson(response, status, { success: false, message });
  }
}
