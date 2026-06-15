const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  clearCompleted,
  deleteAllTodos,
  getDeletedTodos,
  restoreTodo,
} = require("../controllers/todoController");

// All routes protected
router.use(protect);

router.route("/").get(getTodos).post(createTodo);

// Specific routes MUST come before /:id wildcard
router.delete("/clear-completed", clearCompleted);
router.delete("/delete-all", deleteAllTodos);
router.get("/deleted", getDeletedTodos);

router.route("/:id").put(updateTodo).delete(deleteTodo);
router.put("/:id/restore", restoreTodo);

module.exports = router;
