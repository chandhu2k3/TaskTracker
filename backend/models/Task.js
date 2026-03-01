const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    default: null,
  },
  duration: {
    type: Number,
    default: 0,
  },
});

const taskSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: [true, "Please add a task name"],
    trim: true,
  },
  category: {
    type: String,
    required: [true, "Please specify a category"],
    trim: true,
  },
  date: {
    type: Date,
    required: [true, "Please specify a date"],
  },
  day: {
    type: String,
    required: [true, "Please specify a day"],
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
  isActive: {
    type: Boolean,
    default: false,
  },
  sessions: [sessionSchema],
  deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  totalTime: {
    type: Number,
    default: 0,
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
  order: {
    type: Number,
    default: 0,
  },
  // Time slot scheduling (optional)
  scheduledStartTime: {
    type: String, // Format: "HH:MM" e.g., "10:00"
    default: null,
  },
  scheduledEndTime: {
    type: String, // Format: "HH:MM" e.g., "12:00"
    default: null,
  },
  notificationsEnabled: {
    type: Boolean,
    default: false,
  },
  notificationTime: {
    type: Number, // Minutes before scheduledStartTime
    default: 30,
  },
  startTime: {
    type: Date,
    default: null,
  },
  calendarEventId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for performance optimization
taskSchema.index({ user: 1, date: 1 }); // Most common query pattern
taskSchema.index({ user: 1, category: 1 }); // For category analytics
taskSchema.index({ user: 1, isActive: 1 }); // For finding active tasks

// Unique compound index to prevent duplicate tasks
taskSchema.index(
  { user: 1, name: 1, category: 1, date: 1 },
  { unique: true }
);

// Update the updatedAt field before saving
taskSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Task", taskSchema);
