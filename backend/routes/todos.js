const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  clearCompleted,
} = require("../controllers/todoController");

// All routes protected
router.use(protect);

router.route("/").get(getTodos).post(createTodo);

router.delete("/clear-completed", clearCompleted);

router.route("/:id").put(updateTodo).delete(deleteTodo);

module.exports = router;
