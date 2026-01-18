const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: [true, "Please add a category name"],
    trim: true,
  },
  color: {
    type: String,
    default: "#6366f1",
  },
  icon: {
    type: String,
    default: "📋",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure unique category names per user
categorySchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
