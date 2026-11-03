// Conversational AI Template Builder — orchestration layer.
// Owns the session state machine; the LLM only proposes, this controller disposes:
// extraction -> clarification -> planning -> deterministic validation -> preview -> save.

const TemplateBuilderSession = require("../models/TemplateBuilderSession");
const TaskTemplate = require("../models/TaskTemplate");
const Category = require("../models/Category");
const { validateDraft } = require("../utils/templateValidation");
const builderLLM = require("../utils/templateBuilderLLM");
const { invalidateCache } = require("../config/redis");

const MAX_MESSAGE_LEN = 2000;
const MAX_MESSAGES = 100;

const TRANSITIONS = {
  COLLECTING_REQUIREMENTS: new Set(["CLARIFICATION_REQUIRED", "READY_FOR_CONFIRMATION", "GENERATING_DRAFT", "CANCELLED", "ERROR"]),
  CLARIFICATION_REQUIRED: new Set(["COLLECTING_REQUIREMENTS", "READY_FOR_CONFIRMATION", "GENERATING_DRAFT", "CANCELLED", "ERROR"]),
  READY_FOR_CONFIRMATION: new Set(["GENERATING_DRAFT", "COLLECTING_REQUIREMENTS", "CANCELLED", "ERROR"]),
  GENERATING_DRAFT: new Set(["VALIDATING_DRAFT", "ERROR", "CANCELLED"]),
  VALIDATING_DRAFT: new Set(["PREVIEW_READY", "CLARIFICATION_REQUIRED", "ERROR", "CANCELLED"]),
  PREVIEW_READY: new Set(["AWAITING_SAVE_CONFIRMATION", "GENERATING_DRAFT", "COLLECTING_REQUIREMENTS", "CANCELLED", "ERROR"]),
  AWAITING_SAVE_CONFIRMATION: new Set(["SAVING", "GENERATING_DRAFT", "COLLECTING_REQUIREMENTS", "CANCELLED", "ERROR"]),
  SAVING: new Set(["SAVED", "ERROR"]),
  SAVED: new Set([]),
  CANCELLED: new Set([]),
  ERROR: new Set(["COLLECTING_REQUIREMENTS", "CANCELLED"]),
};

const canTransition = (from, to) => TRANSITIONS[from]?.has(to);

const setStatus = (session, next, event) => {
  if (session.status === next) return true;
  if (!canTransition(session.status, next)) return false;
  session.status = next;
  if (event) session.events.push({ type: event });
  return true;
};

const pushMessage = (session, role, text) => {
  session.messages.push({ role, text: String(text).slice(0, MAX_MESSAGE_LEN) });
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
};

const summarizeRequirements = (req = {}) => {
  const lines = [];
  if (req.purpose || req.templateName) lines.push(`Purpose: ${req.templateName || req.purpose}`);
  (req.activities || []).forEach((a) => {
    const days = (a.days || []).join(", ") || "days TBD";
    const dur = a.durationMinutes ? `${a.durationMinutes} min` : "duration TBD";
    const time = a.startTime ? ` @ ${a.startTime}${a.endTime ? `–${a.endTime}` : ""}` : "";
    lines.push(`- ${a.name}: ${days}, ${dur}${time}`);
  });
  if (req.fixedCommitments?.length) lines.push(`Fixed: ${req.fixedCommitments.join("; ")}`);
  if (req.restDays?.length) lines.push(`Rest: ${req.restDays.join(", ")}`);
  return lines.length > 0 ? lines.join("\n") : "No requirements captured yet.";
};

const CONFIRM_RE = /\b(yes|looks good|confirm|generate|create (the )?template|build it|proceed)\b/i;
const SAVE_RE = /\b(save( it| the template)?|persist)\b/i;
const MODIFY_RE = /\b(move|change|add|remove|delete|drop|increase|decrease|reduce|more|less|instead|evening|morning|reschedule|rename)\b/i;

const publicSession = (s) => ({
  id: s._id,
  status: s.status,
  requirements: s.requirements,
  draftTemplate: s.draftTemplate,
  validationErrors: s.validationErrors,
  validationWarnings: s.validationWarnings,
  draftVersion: s.draftVersion,
  editTemplateId: s.editTemplateId,
  savedTemplateId: s.savedTemplateId,
  messages: s.messages,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

// ---------- handlers ----------

const createSession = async (req, res) => {
  try {
    const { mode = "create", sourceTemplateId = null } = req.body || {};
    let requirements = {};
    let draftTemplate = null;
    let status = "COLLECTING_REQUIREMENTS";
    let editTemplateId = null;

    if (mode === "edit" && sourceTemplateId) {
      const tpl = await TaskTemplate.findOne({ _id: sourceTemplateId, user: req.user._id }).lean();
      if (!tpl) return res.status(404).json({ message: "Source template not found" });
      editTemplateId = tpl._id;
      draftTemplate = { name: tpl.name, tasks: tpl.tasks, quickTodos: tpl.quickTodos };
      requirements = { templateName: tpl.name, purpose: `Refine ${tpl.name}`, activities: [] };
      status = "PREVIEW_READY";
    }

    const session = await TemplateBuilderSession.create({
      user: req.user._id,
      status,
      requirements,
      draftTemplate,
      editTemplateId,
      events: [{ type: "ai_template_creation_started" }],
      messages: [
        {
          role: "assistant",
          text: mode === "edit"
            ? "I loaded your template below. Tell me what to change — for example: move gym to the evening."
            : "I can build your weekly template from a description. Tell me what you want — activities, days, durations, fixed commitments (like college 9 AM–4 PM), and rest days.",
        },
      ],
    });
    return res.status(201).json({ session: publicSession(session) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listSessions = async (req, res) => {
  try {
    const sessions = await TemplateBuilderSession.find({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();
    return res.json({ sessions: sessions.map((s) => ({ ...s, id: s._id })) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getSession = async (req, res) => {
  try {
    const session = await TemplateBuilderSession.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) return res.status(404).json({ message: "Session not found" });
    const categories = await Category.find({ user: req.user._id }).lean();
    let validation = { valid: true, errors: session.validationErrors, warnings: session.validationWarnings };
    if (session.draftTemplate) {
      const v = validateDraft(session.draftTemplate, { categoryNames: categories.map((c) => c.name) });
      validation = { valid: v.valid, errors: v.errors, warnings: v.warnings };
    }
    return res.json({ session: publicSession(session), validation });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const postMessage = async (req, res) => {
  try {
    const { message, expectedVersion } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "Please provide a message." });
    }
    if (String(message).length > MAX_MESSAGE_LEN) {
      return res.status(400).json({ message: `Message too long (max ${MAX_MESSAGE_LEN} chars).` });
    }
    const session = await TemplateBuilderSession.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (["SAVED", "CANCELLED"].includes(session.status)) {
      return res.status(409).json({ message: `Session is ${session.status.toLowerCase()} and read-only.` });
    }
    if (expectedVersion !== undefined && Number(expectedVersion) !== session.draftVersion) {
      return res.status(409).json({ message: "Draft changed elsewhere — refresh and retry.", draftVersion: session.draftVersion });
    }

    const text = String(message).trim();
    pushMessage(session, "user", text);
    const categories = await Category.find({ user: req.user._id }).lean();
    const catNames = categories.map((c) => c.name);

    // Explicit save intent never persists — it only stages confirmation.
    if (SAVE_RE.test(text) && session.draftTemplate) {
      const v = validateDraft(session.draftTemplate, { categoryNames: catNames });
      session.validationErrors = v.errors;
      session.validationWarnings = v.warnings;
      if (!v.valid) {
        setStatus(session, "CLARIFICATION_REQUIRED", "ai_template_validation_failed");
        pushMessage(session, "assistant", `I can't save yet — please fix:\n- ${v.errors.join("\n- ")}`);
        await session.save();
        return res.json({
          session: publicSession(session),
          reply: session.messages[session.messages.length - 1].text,
          validation: { valid: false, errors: v.errors, warnings: v.warnings },
          suggestedActions: ["edit"],
        });
      }
      setStatus(session, "AWAITING_SAVE_CONFIRMATION", "ai_template_preview_opened");
      const reply = `Ready to save "${session.draftTemplate.name}" (${session.draftTemplate.tasks?.length || 0} tasks, ${session.draftTemplate.quickTodos?.length || 0} todos)? Press Save template — saving won't apply it to any week.`;
      pushMessage(session, "assistant", reply);
      await session.save();
      return res.json({
        session: publicSession(session),
        reply,
        validation: { valid: true, errors: [], warnings: v.warnings },
        suggestedActions: ["save", "refine"],
      });
    }

    // Merge newly stated requirements (LLM + heuristic fallback).
    const { requirements } = await builderLLM.extractRequirements({
      message: text,
      current: session.requirements || {},
      categories,
    });
    session.requirements = requirements;

    // Refinement of an existing draft takes precedence over generation.
    if (session.draftTemplate && MODIFY_RE.test(text) && !CONFIRM_RE.test(text)) {
      setStatus(session, "GENERATING_DRAFT");
      const { draft } = await builderLLM.refineDraft({
        message: text,
        requirements,
        draft: session.draftTemplate,
        categories,
      });
      setStatus(session, "VALIDATING_DRAFT");
      const v = validateDraft(draft, { categoryNames: catNames });
      session.draftTemplate = v.normalized.name || draft.name ? { name: draft.name || v.normalized.name, tasks: v.normalized.tasks, quickTodos: v.normalized.quickTodos } : v.normalized;
      session.validationErrors = v.errors;
      session.validationWarnings = v.warnings;
      session.draftVersion += 1;
      if (!v.valid) {
        setStatus(session, "CLARIFICATION_REQUIRED", "ai_template_validation_failed");
        const reply = `I applied your change (v${session.draftVersion}) but validation failed:\n- ${v.errors.join("\n- ")}\nTell me how to resolve it.`;
        pushMessage(session, "assistant", reply);
        await session.save();
        return res.json({ session: publicSession(session), reply, validation: { valid: false, errors: v.errors, warnings: v.warnings }, suggestedActions: ["edit"] });
      }
      setStatus(session, "PREVIEW_READY", "ai_template_refined");
      const warn = v.warnings.length > 0 ? `\nWarnings:\n- ${v.warnings.join("\n- ")}` : "";
      const reply = `Updated draft (v${session.draftVersion}): ${draft.changes?.[0] || "change applied."}${warn}\nReview the preview — say "save" when ready, or keep refining.`;
      pushMessage(session, "assistant", reply);
      await session.save();
      return res.json({ session: publicSession(session), reply, validation: { valid: true, errors: [], warnings: v.warnings }, suggestedActions: ["save", "refine"] });
    }

    // Requirement collection / confirmation.
    const missing = builderLLM.completeness(requirements);
    const userConfirmed = CONFIRM_RE.test(text);

    if (missing.length > 0 && !userConfirmed) {
      setStatus(session, missing.length > 0 ? "CLARIFICATION_REQUIRED" : "COLLECTING_REQUIREMENTS", "ai_template_clarification_requested");
      const question = builderLLM.clarificationQuestion(missing);
      const reply = `${question}\n\nSo far:\n${summarizeRequirements(requirements)}`;
      pushMessage(session, "assistant", reply);
      await session.save();
      return res.json({
        session: publicSession(session),
        reply,
        missing,
        validation: { valid: false, errors: [], warnings: [] },
        suggestedActions: ["answer"],
      });
    }

    if (missing.length > 0 && userConfirmed) {
      setStatus(session, "CLARIFICATION_REQUIRED", "ai_template_clarification_requested");
      const reply = `I still need: ${missing.join("; ")}.\n${builderLLM.clarificationQuestion(missing)}`;
      pushMessage(session, "assistant", reply);
      await session.save();
      return res.json({ session: publicSession(session), reply, missing, validation: { valid: false, errors: [], warnings: [] }, suggestedActions: ["answer"] });
    }

    // Sufficient requirements — generate (or regenerate on explicit confirm).
    if (!session.draftTemplate || userConfirmed || ["COLLECTING_REQUIREMENTS", "CLARIFICATION_REQUIRED", "READY_FOR_CONFIRMATION"].includes(session.status)) {
      setStatus(session, "GENERATING_DRAFT", "ai_template_requirements_completed");
      const { draft } = await builderLLM.planDraft({ requirements, categories });
      setStatus(session, "VALIDATING_DRAFT");
      const v = validateDraft(draft, { categoryNames: catNames });
      session.draftTemplate = { name: draft.name || v.normalized.name, tasks: v.normalized.tasks, quickTodos: v.normalized.quickTodos };
      session.validationErrors = v.errors;
      session.validationWarnings = v.warnings;
      session.draftVersion += 1;
      if (!v.valid) {
        setStatus(session, "CLARIFICATION_REQUIRED", "ai_template_draft_generated");
        const reply = `I drafted "${session.draftTemplate.name}" (v${session.draftVersion}) but found problems:\n- ${v.errors.join("\n- ")}\nHow should I fix them?${draft.rationale ? `\nPlan notes: ${draft.rationale}` : ""}`;
        pushMessage(session, "assistant", reply);
        await session.save();
        return res.json({ session: publicSession(session), reply, validation: { valid: false, errors: v.errors, warnings: v.warnings }, suggestedActions: ["edit"] });
      }
      setStatus(session, "PREVIEW_READY", "ai_template_draft_generated");
      const warn = v.warnings.length > 0 ? `\nWarnings:\n- ${v.warnings.join("\n- ")}` : "";
      const reply = `Draft ready (v${session.draftVersion}): "${session.draftTemplate.name}" — ${session.draftTemplate.tasks.length} task(s), ${session.draftTemplate.quickTodos.length} todo(s).${warn}${draft.rationale ? `\nWhy: ${draft.rationale}` : ""}\nReview the preview below. Say "save" to stage it, or tell me what to change.`;
      pushMessage(session, "assistant", reply);
      await session.save();
      return res.json({ session: publicSession(session), reply, validation: { valid: true, errors: [], warnings: v.warnings }, suggestedActions: ["save", "refine"] });
    }

    // Fallback: confirm summary of current requirements.
    setStatus(session, "READY_FOR_CONFIRMATION", "ai_template_requirements_completed");
    const reply = `Here's what I have:\n${summarizeRequirements(requirements)}\nReply "generate" to build the draft, or add more details.`;
    pushMessage(session, "assistant", reply);
    await session.save();
    return res.json({ session: publicSession(session), reply, missing, validation: { valid: false, errors: [], warnings: [] }, suggestedActions: ["generate"] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getPreview = async (req, res) => {
  try {
    const session = await TemplateBuilderSession.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (!session.draftTemplate) return res.status(404).json({ message: "No draft yet" });
    const categories = await Category.find({ user: req.user._id }).lean();
    const v = validateDraft(session.draftTemplate, { categoryNames: categories.map((c) => c.name) });
    return res.json({
      draft: session.draftTemplate,
      draftVersion: session.draftVersion,
      validation: { valid: v.valid, errors: v.errors, warnings: v.warnings },
      canSave: v.valid && ["PREVIEW_READY", "AWAITING_SAVE_CONFIRMATION"].includes(session.status),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const saveSession = async (req, res) => {
  try {
    const { idempotencyKey, updateExisting = false } = req.body || {};
    const session = await TemplateBuilderSession.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Idempotent replay: same key returns the already-saved template.
    if (session.status === "SAVED" && session.savedTemplateId) {
      const existing = await TaskTemplate.findById(session.savedTemplateId).lean();
      return res.json({ template: existing, idempotent: true });
    }
    if (idempotencyKey && session.idempotencyKey && session.idempotencyKey === idempotencyKey && session.savedTemplateId) {
      const existing = await TaskTemplate.findById(session.savedTemplateId).lean();
      return res.json({ template: existing, idempotent: true });
    }

    if (!["PREVIEW_READY", "AWAITING_SAVE_CONFIRMATION"].includes(session.status)) {
      return res.status(409).json({ message: "Confirm the draft in chat before saving." });
    }
    if (!session.draftTemplate) return res.status(400).json({ message: "No draft to save." });

    const categories = await Category.find({ user: req.user._id }).lean();
    const v = validateDraft(session.draftTemplate, { categoryNames: categories.map((c) => c.name) });
    if (!v.valid) {
      session.validationErrors = v.errors;
      setStatus(session, "CLARIFICATION_REQUIRED", "ai_template_validation_failed");
      await session.save();
      return res.status(400).json({ message: "Draft is invalid", errors: v.errors, warnings: v.warnings });
    }

    setStatus(session, "SAVING");
    await session.save();

    let template;
    if (updateExisting && session.editTemplateId) {
      const owned = await TaskTemplate.findOne({ _id: session.editTemplateId, user: req.user._id });
      if (!owned) return res.status(404).json({ message: "Template to update not found" });
      template = await TaskTemplate.findOneAndUpdate(
        { _id: session.editTemplateId, user: req.user._id },
        { name: v.normalized.name, tasks: v.normalized.tasks, quickTodos: v.normalized.quickTodos },
        { new: true },
      );
    } else {
      const clash = await TaskTemplate.findOne({ user: req.user._id, name: v.normalized.name });
      if (clash) {
        setStatus(session, "AWAITING_SAVE_CONFIRMATION");
        await session.save();
        return res.status(409).json({ message: `Template "${v.normalized.name}" already exists — rename or update it instead.` });
      }
      template = await TaskTemplate.create({
        user: req.user._id,
        name: v.normalized.name,
        tasks: v.normalized.tasks,
        quickTodos: v.normalized.quickTodos,
      });
    }

    session.savedTemplateId = template._id;
    if (idempotencyKey) session.idempotencyKey = String(idempotencyKey);
    pushMessage(session, "assistant", `Saved "${template.name}". Use Apply to put it on a week — I didn't apply anything automatically.`);
    setStatus(session, "SAVED", "ai_template_saved");
    await session.save();
    await invalidateCache(`user:${req.user._id}:templates*`);
    return res.status(201).json({ template });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteSession = async (req, res) => {
  try {
    const session = await TemplateBuilderSession.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.status !== "SAVED") {
      session.status = "CANCELLED";
      session.events.push({ type: "ai_template_cancelled" });
      await session.save();
    }
    return res.json({ message: "Session discarded" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createSession,
  listSessions,
  getSession,
  postMessage,
  getPreview,
  saveSession,
  deleteSession,
  TRANSITIONS,
};
