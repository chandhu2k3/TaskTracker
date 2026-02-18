const Todo = require("../models/Todo");
const tz = require("../utils/timezone");
const { cacheKey, getCache, setCache, invalidateCache, TTL } = require("../config/redis");

// @desc    Get todos for today (with overdue carryover)
// @route   GET /api/todos
// @access  Private
const getTodos = async (req, res) => {
  try {
    const timezone = tz.getTimezoneFromRequest(req);
    const today = tz.getTodayString(timezone);

    // Get all incomplete todos from past dates (overdue) and today's todos
    const todos = await Todo.find({
      user: req.user._id,
      $or: [
        { date: today },
        { date: { $lt: today }, completed: false }, // Overdue incomplete todos
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    // Mark overdue todos and update their dates to today
    const updatedTodos = await Promise.all(
      todos.map(async (todo) => {
        if (todo.date < today && !todo.completed) {
          // Update the todo in the database
          await Todo.findByIdAndUpdate(todo._id, {
            date: today,
            isOverdue: true,
          });
          return { ...todo, date: today, isOverdue: true };
        }
        return todo;
      })
    );

    res.json(updatedTodos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new todo
// @route   POST /api/todos
// @access  Private
const createTodo = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Please provide todo text" });
    }

    const timezone = tz.getTimezoneFromRequest(req);
    const today = tz.getTodayString(timezone);

    const todo = await Todo.create({
      user: req.user._id,
      text: text.trim(),
      completed: false,
      date: today,
      isOverdue: false,
    });

    await invalidateCache(`user:${req.user._id}:todos*`);
    res.status(201).json(todo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle todo completion
// @route   PUT /api/todos/:id
// @access  Private
const updateTodo = async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({ message: "Todo not found" });
    }

    if (todo.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Update fields if provided
    if (req.body.hasOwnProperty("completed")) {
      todo.completed = req.body.completed;
    }
    if (req.body.text) {
      todo.text = req.body.text.trim();
    }

    await todo.save();
    await invalidateCache(`user:${req.user._id}:todos*`);
    res.json(todo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete todo
// @route   DELETE /api/todos/:id
// @access  Private
const deleteTodo = async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({ message: "Todo not found" });
    }

    if (todo.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    await todo.deleteOne();
    await invalidateCache(`user:${req.user._id}:todos*`);
    res.json({ message: "Todo removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Clear completed todos
// @route   DELETE /api/todos/clear-completed
// @access  Private
const clearCompleted = async (req, res) => {
  try {
    const result = await Todo.deleteMany({
      user: req.user._id,
      completed: true,
    });

    await invalidateCache(`user:${req.user._id}:todos*`);
    res.json({
      message: `Cleared ${result.deletedCount} completed todo(s)`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  clearCompleted,
};
