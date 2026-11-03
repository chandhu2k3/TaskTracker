// LLM layer for the conversational template builder.
// Reuses the existing assistant provider config (ASSISTANT_* env, OpenAI-compatible
// chat/completions, timeouts). Returns structured JSON; NEVER throws — callers
// fall back to deterministic heuristics when the model is unavailable/malformed.

const {
  parseDurationMinutes,
  parseTimeRange,
  extractDay,
  normalizePrompt,
  WEEKDAYS,
} = require("./assistantParser");

const MODEL = process.env.ASSISTANT_MODEL || "gpt-5.4-mini";
const BASE_URL = (process.env.ASSISTANT_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const API_KEY =
  process.env.ASSISTANT_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
const TIMEOUT_MS = Number(process.env.ASSISTANT_REQUEST_TIMEOUT_MS || 12000);
const TOKEN_BUDGET = Math.max(1200, Number(process.env.ASSISTANT_MAX_TOKENS || 500));

const configured = () => Boolean(API_KEY);

const callJson = async (system, user) => {
  if (!configured()) return { ok: false, reason: "unconfigured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: TOKEN_BUDGET,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const cleaned = String(raw).replace(/```json|```/g, "").trim();
    return { ok: true, json: JSON.parse(cleaned) };
  } catch (err) {
    return { ok: false, reason: err?.name === "AbortError" ? "timeout" : "parse_or_network" };
  } finally {
    clearTimeout(timer);
  }
};

// ---------- Heuristic fallback (no LLM) ----------

const DAY_RE = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi;
const KNOWN_ACTIVITIES = [
  "dsa", "dsa prep", "dsa preparation", "dbms", "gate", "study", "revision",
  "gym", "workout", "exercise", "running", "yoga", "college", "office", "work",
  "learning", "reading", "coding", "project", "meditation", "sleep",
];

const heuristicExtract = (message, current = {}, categories = []) => {
  const text = normalizePrompt(message).toLowerCase();
  const req = JSON.parse(JSON.stringify(current || {}));
  req.activities = Array.isArray(req.activities) ? req.activities : [];

  // Template name hints: "called X", "named X", "for GATE" etc.
  const nameMatch =
    message.match(/(?:called|named|title|name)\s+["']?([\w\s-]{2,40})["']?/i) ||
    message.match(/\bfor\s+([A-Z]{2,}(?:\s+\w+)?)/);
  if (nameMatch && !req.templateName) req.templateName = nameMatch[1].trim().slice(0, 60);

  const minutes = parseDurationMinutes(message);
  const time = parseTimeRange(message);
  const days = [...new Set([...text.matchAll(DAY_RE)].map((m) => m[1].toLowerCase()))];
  const weekendsFree = /\bweekends?\s+free\b|\bsunday.*free\b|\bkeep\s+sunday.*free\b/.test(text);
  const weekdaysOnly = /\bweekdays?\b|\bmon.*fri\b|\bmonday.*friday\b/.test(text);

  KNOWN_ACTIVITIES.forEach((act) => {
    if (text.includes(act) && !req.activities.some((a) => a.name.toLowerCase() === act)) {
      req.activities.push({
        name: act.length <= 4 ? act.toUpperCase() : act[0].toUpperCase() + act.slice(1),
        days: days.length > 0 ? days : weekdaysOnly || weekendsFree ? ["monday", "tuesday", "wednesday", "thursday", "friday"] : [],
        durationMinutes: minutes || 60,
        startTime: time.scheduledStartTime || null,
        endTime: time.scheduledEndTime || null,
        category: null,
      });
    }
  });

  // Attach parsed duration/time to the most recent activity lacking them.
  if (req.activities.length > 0) {
    const last = req.activities[req.activities.length - 1];
    if (minutes && !last._heuristicDuration && (!last.durationMinutes || last.durationMinutes === 60)) {
      last.durationMinutes = minutes;
      last._heuristicDuration = true;
    }
    if (time.scheduledStartTime && !last.startTime) {
      last.startTime = time.scheduledStartTime;
      last.endTime = time.scheduledEndTime;
    }
    delete last._heuristicDuration;
  }

  if (weekendsFree || /\brest.*sunday\b|\bsunday.*rest\b/.test(text)) {
    req.restDays = [...new Set([...(req.restDays || []), "sunday"])];
  }
  const avail = message.match(/(?:college|office|work|school).*?(\d{1,2}\s*(?:am|pm)?\s*(?:to|-|until)\s*\d{1,2}\s*(?:am|pm)?)/i);
  if (avail && !req.fixedCommitments) req.fixedCommitments = [avail[0].trim()];

  // Category reuse: match known category names mentioned in text.
  const catNames = (categories || []).map((c) => (typeof c === "string" ? c : c.name));
  const mentioned = catNames.filter((n) => text.includes(String(n).toLowerCase()));
  if (mentioned.length > 0) req.categories = [...new Set([...(req.categories || []), ...mentioned])];

  return req;
};

const completeness = (req = {}) => {
  const missing = [];
  if (!req.templateName && !req.purpose) missing.push("templateName");
  if (!req.activities || req.activities.length === 0) missing.push("activities");
  else {
    const noDays = req.activities.filter((a) => !a.days || a.days.length === 0);
    if (noDays.length > 0) missing.push(`days for ${noDays.map((a) => a.name).join(", ")}`);
    const noDur = req.activities.filter((a) => !a.durationMinutes);
    if (noDur.length > 0) missing.push(`duration for ${noDur.map((a) => a.name).join(", ")}`);
  }
  return missing;
};

const clarificationQuestion = (missing = []) => {
  if (missing.includes("activities")) {
    return "What activities should this weekly template include? For example: DSA study, gym, college.";
  }
  const daysMiss = missing.find((m) => m.startsWith("days for"));
  if (daysMiss) return `Which days should ${daysMiss.replace("days for ", "")} run on? (e.g. weekdays, Mon–Fri, daily)`;
  const durMiss = missing.find((m) => m.startsWith("duration for"));
  if (durMiss) return `How much time per session for ${durMiss.replace("duration for ", "")}? (e.g. 2 hours)`;
  if (missing.includes("templateName")) return "What should I call this template? (e.g. GATE Preparation)";
  return "Anything else to add — fixed commitments, rest days, or preferred times?";
};

// ---------- LLM-backed steps ----------

const EXTRACT_SYSTEM = `You extract weekly-template requirements from one user message into JSON.
Merge with CURRENT_REQUIREMENTS (keep prior answers; only add/override what the message states).
Never invent durations, days, or commitments. Use null when unknown.
Return ONLY JSON: {"requirements": {...same shape...}, "notes": "short string"}.`;

const PLAN_SYSTEM = `You plan a weekly TaskTemplate draft as JSON.
Use REQUIREMENTS + CATEGORY_NAMES (reuse exact category names when relevant, else null -> planner maps to General).
Days must be lowercase monday-sunday. plannedTime is milliseconds. Times HH:MM or null.
Respect restDays (no tasks those days) and fixedCommitments (avoid those windows; explain in rationale).
Keep tasks minimal and non-overlapping.
Return ONLY JSON: {"name": "...", "tasks": [{name, category, day, plannedTime, scheduledStartTime, scheduledEndTime, endsNextDay, addToCalendar, reminderMinutes}], "quickTodos": [{text, day, deadlineOffsetDays, reminderMinutes, reminderTime}], "rationale": "..."}.`;

const REFINE_SYSTEM = `You modify an existing template draft per the user message.
Return the FULL updated draft as JSON (same shape as PLAN_SYSTEM) plus "changes": ["..."].
Preserve unrelated tasks exactly. Never silently drop user commitments; explain conflicts in rationale.`;

const extractRequirements = async ({ message, current, categories }) => {
  const catNames = (categories || []).map((c) => (typeof c === "string" ? c : c.name));
  const llm = await callJson(
    EXTRACT_SYSTEM,
    JSON.stringify({ CURRENT_REQUIREMENTS: current || {}, MESSAGE: message, CATEGORY_NAMES: catNames }).slice(0, 6000),
  );
  if (llm.ok && llm.json?.requirements) {
    const merged = { ...(current || {}), ...llm.json.requirements };
    if (!Array.isArray(merged.activities)) merged.activities = current?.activities || [];
    return { requirements: merged, source: "llm" };
  }
  return { requirements: heuristicExtract(message, current, categories), source: llm.reason || "heuristic" };
};

const planDraft = async ({ requirements, categories }) => {
  const catNames = (categories || []).map((c) => (typeof c === "string" ? c : c.name));
  const llm = await callJson(
    PLAN_SYSTEM,
    JSON.stringify({ REQUIREMENTS: requirements, CATEGORY_NAMES: catNames }).slice(0, 8000),
  );
  if (llm.ok && (llm.json?.tasks || llm.json?.quickTodos)) return { draft: llm.json, source: "llm" };
  // Deterministic planner fallback: one task per activity per day.
  const tasks = [];
  (requirements.activities || []).forEach((a) => {
    const days = a.days && a.days.length > 0 ? a.days : ["monday", "tuesday", "wednesday", "thursday", "friday"];
    days.forEach((d) => {
      if ((requirements.restDays || []).includes(d)) return;
      tasks.push({
        name: a.name,
        category: a.category || catNames[0] || "General",
        day: d,
        plannedTime: (a.durationMinutes || 60) * 60000,
        scheduledStartTime: a.startTime || null,
        scheduledEndTime: a.endTime || null,
        endsNextDay: false,
        addToCalendar: false,
        reminderMinutes: 0,
      });
    });
  });
  return {
    draft: {
      name: requirements.templateName || requirements.purpose || "Weekly Plan",
      tasks,
      quickTodos: requirements.quickTodos || [],
      rationale: "Deterministic fallback plan (LLM unavailable).",
    },
    source: llm.reason || "heuristic",
  };
};

const refineDraft = async ({ message, requirements, draft, categories }) => {
  const catNames = (categories || []).map((c) => (typeof c === "string" ? c : c.name));
  const llm = await callJson(
    REFINE_SYSTEM,
    JSON.stringify({ MESSAGE: message, REQUIREMENTS: requirements, DRAFT: draft, CATEGORY_NAMES: catNames }).slice(0, 9000),
  );
  if (llm.ok && (llm.json?.tasks || llm.json?.name)) return { draft: llm.json, source: "llm" };
  // Heuristic refinement: support "move X to <day/evening>" + duration bumps.
  const updated = JSON.parse(JSON.stringify(draft));
  const day = extractDay(message, "Asia/Kolkata");
  const mins = parseDurationMinutes(message);
  const time = parseTimeRange(message);
  const evening = /\bevening\b/i.test(message) && !time.scheduledStartTime ? "18:00" : null;
  let changed = false;
  (updated.tasks || []).forEach((t) => {
    if (message.toLowerCase().includes(String(t.name).toLowerCase())) {
      if (day) { t.day = day; changed = true; }
      if (mins) { t.plannedTime = mins * 60000; changed = true; }
      if (time.scheduledStartTime || evening) {
        t.scheduledStartTime = time.scheduledStartTime || evening;
        if (time.scheduledEndTime) t.scheduledEndTime = time.scheduledEndTime;
        changed = true;
      }
    }
  });
  updated.changes = changed ? ["Applied requested change heuristically."] : [];
  return { draft: updated, source: "heuristic", changed };
};

module.exports = {
  configured,
  extractRequirements,
  planDraft,
  refineDraft,
  heuristicExtract,
  completeness,
  clarificationQuestion,
};
