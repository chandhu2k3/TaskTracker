const express = require("express");
const router = express.Router();
const {
  getTasksByDateRange,
  getTasksByWeek,
  createTask,
  updateTask,
  deleteTask,
  deleteTasksByDay,
  deleteTasksByWeek,
  getWeeklyAnalytics,
  getMonthlyAnalytics,
  getCategoryAnalytics,
} = require("../controllers/taskController");
const { protect } = require("../middleware/auth");

// Apply authentication to all routes
router.use(protect);

// Task routes
router.route("/").post(createTask);

router.get("/range", getTasksByDateRange);
router.get("/week/:year/:month/:weekNumber", getTasksByWeek);

// Bulk delete routes
router.delete("/day/:date", deleteTasksByDay);
router.delete("/week/:year/:month/:weekNumber", deleteTasksByWeek);

// Analytics routes
router.get("/analytics/week/:year/:month/:weekNumber", getWeeklyAnalytics);
router.get("/analytics/month/:year/:month", getMonthlyAnalytics);
router.get("/analytics/category/:category", getCategoryAnalytics);

// Individual task routes
router.route("/:id").put(updateTask).delete(deleteTask);

module.exports = router;
