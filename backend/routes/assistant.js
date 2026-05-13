const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  handleAssistantMessage,
  getAssistantHistory,
  clearAssistantHistory,
  getAssistantStatus,
} = require("../controllers/assistantController");

router.use(protect);
router.post("/message", handleAssistantMessage);
router.get("/history", getAssistantHistory);
router.delete("/history", clearAssistantHistory);
router.get("/status", getAssistantStatus);

module.exports = router;
