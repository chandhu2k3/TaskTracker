const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  handleAssistantMessage,
  getAssistantHistory,
  clearAssistantHistory,
  getAssistantStatus,
  getDailyInsight,
  getWeeklyInsight,
  getMonthlyInsight,
} = require("../controllers/assistantController");

router.use(protect);
router.post("/message", handleAssistantMessage);
router.get("/history", getAssistantHistory);
router.delete("/history", clearAssistantHistory);
router.get("/status", getAssistantStatus);
router.get("/daily-insight/:date", getDailyInsight);
router.get("/weekly-insight/:year/:month/:week", getWeeklyInsight);
router.get("/monthly-insight/:year/:month", getMonthlyInsight);

module.exports = router;
