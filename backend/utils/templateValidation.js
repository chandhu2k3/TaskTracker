// Deterministic validation for AI-generated template drafts.
// The LLM is NEVER the authority — this module decides save eligibility.
// Reuses the TaskTemplate schema rules (backend/models/TaskTemplate.js).

const TASK_DAYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
const TODO_DAYS = new Set([...TASK_DAYS, "sunday"]);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_PLANNED_MS = 24 * 60 * 60 * 1000;
const ALLOWED_REMINDERS = new Set([0, 5, 10, 15, 30, 60, 1440]);

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const normalizeDay = (day) => String(day || "").trim().toLowerCase();

// Overlap check per day for tasks that both carry start+end times.
const findOverlaps = (tasks) => {
  const conflicts = [];
  const byDay = new Map();
  (tasks || []).forEach((t, i) => {
    const day = normalizeDay(t.day);
    if (!TASK_DAYS.has(day)) return;
    if (!TIME_RE.test(t.scheduledStartTime || "") || !TIME_RE.test(t.scheduledEndTime || "")) return;
    if (t.endsNextDay) return; // overnight spans midnight — skip strict overlap
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push({ i, name: t.name, s: toMinutes(t.scheduledStartTime), e: toMinutes(t.scheduledEndTime) });
  });
  for (const [day, list] of byDay) {
    list.sort((a, b) => a.s - b.s);
    for (let k = 1; k < list.length; k += 1) {
      if (list[k].s < list[k - 1].e) {
        conflicts.push(
          `"${list[k - 1].name}" overlaps "${list[k].name}" on ${day} — adjust times or confirm the overlap is intentional.`,
        );
      }
    }
  }
  return conflicts;
};

/**
 * validateDraft(draft, { categoryNames })
 * Returns { valid, errors[], warnings[], normalized }.
 * `valid` is true only when errors is empty (warnings don't block save).
 */
const validateDraft = (draft, { categoryNames = [] } = {}) => {
  const errors = [];
  const warnings = [];
  const known = new Set((categoryNames || []).map((c) => String(c).toLowerCase()));
  const normalized = { name: "", tasks: [], quickTodos: [] };

  if (!draft || typeof draft !== "object") {
    return { valid: false, errors: ["Draft is empty."], warnings, normalized };
  }

  normalized.name = String(draft.name || "").trim();
  if (!normalized.name) errors.push("Template name is required.");

  const tasks = Array.isArray(draft.tasks) ? draft.tasks : [];
  const todos = Array.isArray(draft.quickTodos) ? draft.quickTodos : [];
  if (tasks.length === 0 && todos.length === 0) {
    errors.push("Add at least one task or quick todo.");
  }

  const seenTaskDay = new Set();
  tasks.forEach((t, idx) => {
    const n = idx + 1;
    const name = String(t?.name || "").trim();
    const category = String(t?.category || "").trim();
    const day = normalizeDay(t?.day);
    if (!name) errors.push(`Task #${n}: name is required.`);
    if (!category) errors.push(`Task #${n}: category is required.`);
    else if (known.size > 0 && !known.has(category.toLowerCase())) {
      warnings.push(`Task "${name || `#${n}`}" uses unknown category "${category}" — it will be saved as plain text; consider using an existing category.`);
    }
    if (!TASK_DAYS.has(day)) errors.push(`Task #${n}: day must be monday–sunday.`);
    const planned = Number(t?.plannedTime);
    if (!Number.isFinite(planned) || planned < 0) errors.push(`Task #${n}: plannedTime must be a non-negative number of ms.`);
    else if (planned === 0) warnings.push(`Task "${name || `#${n}`}" has 0 planned time.`);
    else if (planned > MAX_PLANNED_MS) errors.push(`Task #${n}: plannedTime exceeds 24h.`);
    if (t?.scheduledStartTime && !TIME_RE.test(String(t.scheduledStartTime))) {
      errors.push(`Task #${n}: scheduledStartTime must be HH:MM.`);
    }
    if (t?.scheduledEndTime && !TIME_RE.test(String(t.scheduledEndTime))) {
      errors.push(`Task #${n}: scheduledEndTime must be HH:MM.`);
    }
    if (
      TIME_RE.test(String(t?.scheduledStartTime || "")) &&
      TIME_RE.test(String(t?.scheduledEndTime || "")) &&
      !t?.endsNextDay &&
      toMinutes(t.scheduledEndTime) <= toMinutes(t.scheduledStartTime)
    ) {
      errors.push(`Task #${n}: end time must be after start time (or set endsNextDay).`);
    }
    if (t?.reminderMinutes !== undefined && !ALLOWED_REMINDERS.has(Number(t.reminderMinutes))) {
      warnings.push(`Task "${name || `#${n}`}" uses a non-standard reminder (${t.reminderMinutes} min) — Google will still honor it.`);
    }
    const key = `${name.toLowerCase()}|${day}`;
    if (name && TASK_DAYS.has(day)) {
      if (seenTaskDay.has(key)) warnings.push(`Duplicate task "${name}" on ${day}.`);
      seenTaskDay.add(key);
    }
    normalized.tasks.push({
      name,
      category,
      day,
      plannedTime: Number.isFinite(planned) && planned >= 0 ? planned : 0,
      isAutomated: Boolean(t?.isAutomated),
      completionCount: 0,
      scheduledStartTime: t?.scheduledStartTime || null,
      scheduledEndTime: t?.scheduledEndTime || null,
      endsNextDay: Boolean(t?.endsNextDay),
      addToCalendar: Boolean(t?.addToCalendar),
      reminderMinutes: Number(t?.reminderMinutes) || 0,
    });
  });

  todos.forEach((td, idx) => {
    const n = idx + 1;
    const text = String(td?.text || "").trim();
    const day = normalizeDay(td?.day);
    if (!text) errors.push(`Quick todo #${n}: text is required.`);
    if (!TODO_DAYS.has(day)) errors.push(`Quick todo #${n}: day must be sunday–saturday.`);
    if (td?.reminderTime && !TIME_RE.test(String(td.reminderTime))) {
      errors.push(`Quick todo #${n}: reminderTime must be HH:MM.`);
    }
    normalized.quickTodos.push({
      text,
      day: TODO_DAYS.has(day) ? day : "monday",
      deadlineOffsetDays: Number(td?.deadlineOffsetDays) || 0,
      reminderMinutes: Number(td?.reminderMinutes) || 0,
      reminderTime: td?.reminderTime || "09:00",
    });
  });

  // Hard conflicts surface as warnings (user decides), except same-day overlaps
  // which we report as warnings too — never silently move user commitments.
  const overlaps = findOverlaps(normalized.tasks);
  warnings.push(...overlaps);

  return { valid: errors.length === 0, errors, warnings, normalized };
};

module.exports = { validateDraft, TASK_DAYS, TODO_DAYS };
