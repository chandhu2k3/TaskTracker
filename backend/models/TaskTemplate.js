const mongoose = require("mongoose");

const templateTaskSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  day: {
    type: String,
    required: true,
    enum: [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ],
    lowercase: true,
  },
  plannedTime: {
    type: Number,
    default: 0,
  },
  isAutomated: {
    type: Boolean,
    default: false,
  },
  completionCount: {
    type: Number,
    default: 0,
  },
  scheduledStartTime: {
    type: String,
    default: null,
  },
  scheduledEndTime: {
    type: String,
    default: null,
  },
});

const taskTemplateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: [true, "Please add a template name"],
    trim: true,
  },
  tasks: [templateTaskSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure unique template names per user
taskTemplateSchema.index({ user: 1, name: 1 }, { unique: true });

taskTemplateSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("TaskTemplate", taskTemplateSchema);
