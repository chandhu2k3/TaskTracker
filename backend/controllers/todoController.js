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

    // Get all incomplete todos from past dates (overdue) and today's todos — exclude soft-deleted
    const todos = await Todo.find({
      user: req.user._id,
      deleted: { $ne: true },
      $or: [
        { date: today },
        { date: { $lt: today }, completed: false }, // Overdue incomplete todos
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    // Mark overdue: use deadline if set, otherwise use the todo date
    const updatedTodos = await Promise.all(
      todos.map(async (todo) => {
        const isOverdueNow = todo.deadline
          ? todo.deadline < today && !todo.completed   // Overdue = deadline passed
          : todo.date < today && !todo.completed;      // Legacy: date-based overdue

        if (todo.date < today && !todo.completed) {
          // Carry forward to today
          await Todo.findByIdAndUpdate(todo._id, {
            date: today,
            isOverdue: isOverdueNow,
          });
          return { ...todo, date: today, isOverdue: isOverdueNow };
        }
        if (todo.isOverdue !== isOverdueNow) {
          await Todo.findByIdAndUpdate(todo._id, { isOverdue: isOverdueNow });
        }
        return { ...todo, isOverdue: isOverdueNow };
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
    const { text, deadline } = req.body;

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
      deadline: deadline || null,
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

    todo.deleted = true;
    todo.deletedAt = new Date();
    await todo.save();
    await invalidateCache(`user:${req.user._id}:todos*`);
    res.json({ message: "Todo soft deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Clear completed todos
// @route   DELETE /api/todos/clear-completed
// @access  Private
const clearCompleted = async (req, res) => {
  try {
    const result = await Todo.updateMany(
      { user: req.user._id, completed: true, deleted: { $ne: true } },
      { $set: { deleted: true, deletedAt: new Date() } }
    );
    await invalidateCache(`user:${req.user._id}:todos*`);
    res.json({
      message: `Soft deleted ${result.modifiedCount} completed todo(s)` ,
      deletedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get recently deleted todos (last 7 days)
// @route   GET /api/todos/deleted
// @access  Private
const getDeletedTodos = async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const todos = await Todo.find({
      user: req.user._id,
      deleted: true,
      deletedAt: { $gte: since },
    }).sort({ deletedAt: -1 }).lean();
    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Restore a soft-deleted todo
// @route   PUT /api/todos/:id/restore
// @access  Private
const restoreTodo = async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id });
    if (!todo) return res.status(404).json({ message: "Todo not found" });
    todo.deleted = false;
    todo.deletedAt = null;
    await todo.save();
    await invalidateCache(`user:${req.user._id}:todos*`);
    res.json(todo);
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
  getDeletedTodos,
  restoreTodo,
};
