const express = require("express");
const router = express.Router();
const {
  startSleep,
  stopSleep,
  getActiveSleep,
  getSleepHistory,
  getSleepAnalytics,
} = require("../controllers/sleepController");
const { protect } = require("../middleware/auth");

router.post("/start", protect, startSleep);
router.put("/stop", protect, stopSleep);
router.get("/active", protect, getActiveSleep);
router.get("/history", protect, getSleepHistory);
router.get("/analytics", protect, getSleepAnalytics);

module.exports = router;
