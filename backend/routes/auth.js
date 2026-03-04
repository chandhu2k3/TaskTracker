const express = require("express");
const router = express.Router();
const {
  register,
  login,
  verifyEmail,
  resendVerification,
  googleLogin,
  getProfile,
  updateOnboarding,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/google", googleLogin);
router.get("/profile", protect, getProfile);
router.put("/onboarding", protect, updateOnboarding);

module.exports = router;

