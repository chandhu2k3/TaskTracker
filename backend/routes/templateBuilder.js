const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  createSession,
  listSessions,
  getSession,
  postMessage,
  getPreview,
  saveSession,
  deleteSession,
} = require("../controllers/templateBuilderController");

router.use(protect);

router.route("/").post(createSession).get(listSessions);
router.route("/:id").get(getSession).delete(deleteSession);
router.post("/:id/message", postMessage);
router.get("/:id/preview", getPreview);
router.post("/:id/save", saveSession);

module.exports = router;
