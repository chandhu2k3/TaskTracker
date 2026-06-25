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
  markTodoMissed,
  getMissedTodos,
} = require("../controllers/todoController");

// All routes protected                      
router.use(protect);

router.route("/").get(getTodos).post(createTodo);

// Specific routes MUST come before /:id wildcard
router.delete("/clear-completed", clearCompleted);
router.delete("/delete-all", deleteAllTodos);
router.get("/deleted", getDeletedTodos);
router.get("/missed", getMissedTodos);

router.route("/:id").put(updateTodo).delete(deleteTodo);
router.put("/:id/restore", restoreTodo);
router.put("/:id/missed", markTodoMissed);

module.exports = router;
