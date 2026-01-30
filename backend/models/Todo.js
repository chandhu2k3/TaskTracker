const mongoose = require("mongoose");

const todoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: {
    type: String,
    required: [true, "Please add todo text"],
    trim: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
  },
  isOverdue: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for fast user + date queries
todoSchema.index({ user: 1, date: 1 });
todoSchema.index({ user: 1, completed: 1 });

module.exports = mongoose.model("Todo", todoSchema);
