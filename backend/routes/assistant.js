const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  handleAssistantMessage,
} = require("../controllers/assistantController");

router.use(protect);
router.post("/message", handleAssistantMessage);

module.exports = router;
