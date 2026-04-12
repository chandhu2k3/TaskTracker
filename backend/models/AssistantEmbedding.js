const mongoose = require("mongoose");

const assistantEmbeddingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["task", "todo", "template", "category"],
    },
    itemId: {
      type: String,
      required: true,
      trim: true,
    },
    itemVersion: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

assistantEmbeddingSchema.index(
  { user: 1, type: 1, itemId: 1 },
  { unique: true },
);
assistantEmbeddingSchema.index({ user: 1, type: 1, itemVersion: 1 });

module.exports = mongoose.model("AssistantEmbedding", assistantEmbeddingSchema);
