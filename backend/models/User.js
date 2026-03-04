const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a name"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Please add an email"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email",
    ],
  },
  password: {
    type: String,
    minlength: 6,
    select: false,
    // Not required for Google OAuth users
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  googleId: {
    type: String,
    sparse: true,
    select: false,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    select: false,
  },
  verificationTokenExpiry: {
    type: Date,
    select: false,
  },
  onboardingComplete: {
    type: Boolean,
    default: false,
  },
  // Google Calendar Integration
  googleCalendar: {
    connected: { type: Boolean, default: false },
    accessToken: { type: String, select: false },
    refreshToken: { type: String, select: false },
    tokenExpiry: { type: Date },
    calendarId: { type: String, default: 'primary' },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Note: email index is automatically created by unique: true in schema
// No need for explicit index({ email: 1 }) to avoid duplicate index warning

// Hash password before saving (skip for Google OAuth users)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
