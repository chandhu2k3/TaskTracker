const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { sendVerificationEmail, sendWelcomeEmail } = require("../utils/emailService");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT Token
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// Generate a secure random verification token
const generateVerificationToken = () => crypto.randomBytes(32).toString("hex");

// @desc    Register new user — sends verification email, does NOT log in
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Please provide all fields" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const userExists = await User.findOne({ email }).select("+emailVerified");
    if (userExists) {
      if (!userExists.emailVerified && userExists.authProvider === "local") {
        return res.status(400).json({ message: "Account exists but email not verified.", unverified: true, email });
      }
      return res.status(400).json({ message: "User already exists" });
    }

    const verificationToken = generateVerificationToken();
    await User.create({
      name, email, password,
      authProvider: "local",
      emailVerified: false,
      verificationToken,
      verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      onboardingComplete: false,
    });

    try { await sendVerificationEmail(name, email, verificationToken); }
    catch (e) { console.error("Verification email failed:", e.message); }

    res.status(201).json({ message: "Account created! Please check your email to verify.", email, requiresVerification: true });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Please provide all fields" });

    const user = await User.findOne({ email }).select("+password +emailVerified");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.emailVerified && user.authProvider === "local") {
      return res.status(403).json({ message: "Please verify your email before logging in.", requiresVerification: true, email });
    }
    if (!user.password) {
      return res.status(401).json({ message: "This account uses Google Sign-In. Please sign in with Google." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    res.json({ _id: user._id, name: user.name, email: user.email, onboardingComplete: user.onboardingComplete || false, emailVerified: true, token: generateToken(user._id) });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login. Please try again." });
  }
};

// @desc    Verify email via token in link
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

    const user = await User.findOne({ verificationToken: token }).select("+verificationToken +verificationTokenExpiry +emailVerified");
    if (!user) return res.redirect(`${FRONTEND_URL}/login?verified=invalid`);
    if (user.verificationTokenExpiry < new Date()) return res.redirect(`${FRONTEND_URL}/login?verified=expired&email=${encodeURIComponent(user.email)}`);

    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    sendWelcomeEmail(user.name, user.email).catch(() => {});
    res.redirect(`${FRONTEND_URL}/login?verified=success`);
  } catch (error) {
    console.error("Verify email error:", error);
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/login?verified=error`);
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email }).select("+emailVerified +verificationToken +verificationTokenExpiry");
    if (!user) return res.status(404).json({ message: "No account found with this email" });
    if (user.emailVerified) return res.status(400).json({ message: "Email already verified. Please log in." });

    const verificationToken = generateVerificationToken();
    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user.name, email, verificationToken);
    res.json({ message: "Verification email resent. Please check your inbox." });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "Failed to resend verification email" });
  }
};

// @desc    Google OAuth Sign-In / Sign-Up
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: "Google credential is required" });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const { sub: googleId, email, name, email_verified } = ticket.getPayload();

    if (!email_verified) return res.status(400).json({ message: "Google account email not verified" });

    let user = await User.findOne({ $or: [{ googleId }, { email }] }).select("+googleId");
    if (user) {
      if (!user.googleId) { user.googleId = googleId; user.authProvider = "google"; user.emailVerified = true; await user.save(); }
    } else {
      user = await User.create({ name, email, googleId, authProvider: "google", emailVerified: true, onboardingComplete: false });
    }

    res.json({ _id: user._id, name: user.name, email: user.email, onboardingComplete: user.onboardingComplete || false, emailVerified: true, token: generateToken(user._id) });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({ message: "Google Sign-In failed. Please try again." });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ _id: user._id, name: user.name, email: user.email, onboardingComplete: user.onboardingComplete || false, emailVerified: user.emailVerified, authProvider: user.authProvider, createdAt: user.createdAt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update onboarding status
// @route   PUT /api/auth/onboarding
// @access  Private
const updateOnboarding = async (req, res) => {
  try {
    const { onboardingComplete } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { onboardingComplete }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ _id: user._id, name: user.name, email: user.email, onboardingComplete: user.onboardingComplete });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { register, login, verifyEmail, resendVerification, googleLogin, getProfile, updateOnboarding };
