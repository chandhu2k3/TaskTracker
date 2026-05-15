const mongoose = require("mongoose");

const assistantMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["user", "assistant"],
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const assistantConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messages: {
      type: [assistantMessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

assistantConversationSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model(
  "AssistantConversation",
  assistantConversationSchema,
);
