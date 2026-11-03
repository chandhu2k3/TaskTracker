const mongoose = require("mongoose");

// Conversational AI template-builder session.
// Stores structured state (not just chat text) so a draft survives refresh,
// reopening, and interrupted generation. One session = one in-progress template.
const builderMessageSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, enum: ["user", "assistant"] },
    text: { type: String, required: true, trim: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const builderEventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const STATES = [
  "COLLECTING_REQUIREMENTS",
  "CLARIFICATION_REQUIRED",
  "READY_FOR_CONFIRMATION",
  "GENERATING_DRAFT",
  "VALIDATING_DRAFT",
  "PREVIEW_READY",
  "AWAITING_SAVE_CONFIRMATION",
  "SAVING",
  "SAVED",
  "CANCELLED",
  "ERROR",
];

const templateBuilderSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: { type: String, enum: STATES, default: "COLLECTING_REQUIREMENTS" },
    // Structured requirements extracted from natural language.
    // Shape: { purpose, templateName, activities: [{name, days, durationMinutes,
    // startTime, endTime, category}], fixedCommitments, restDays, availability,
    // breaks, categories, reminders, calendar, quickTodos, confirmed }
    requirements: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Draft template in TaskTemplate shape (never persisted until save).
    draftTemplate: { type: mongoose.Schema.Types.Mixed, default: null },
    validationErrors: { type: [String], default: [] },
    validationWarnings: { type: [String], default: [] },
    draftVersion: { type: Number, default: 0 },
    // Optional: refine an existing template instead of creating new.
    editTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskTemplate",
      default: null,
    },
    savedTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskTemplate",
      default: null,
    },
    idempotencyKey: { type: String, default: null },
    messages: { type: [builderMessageSchema], default: [] },
    events: { type: [builderEventSchema], default: [] },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true },
);

templateBuilderSessionSchema.index({ user: 1, status: 1 });
templateBuilderSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(
  "TemplateBuilderSession",
  templateBuilderSessionSchema,
);
module.exports.STATES = STATES;
