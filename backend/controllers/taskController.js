const Task = require("../models/Task");
const Category = require("../models/Category");
const Sleep = require("../models/Sleep");

// Helper function to get day name from date
const getDayName = (date) => {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[new Date(date).getDay()];
};

// Helper function to get week start and end dates
const getWeekDates = (year, month, weekNumber) => {
  // Calendar-based weeks: Week 1 = days 1-7, Week 2 = 8-14, etc.
  const startDay = 1 + (weekNumber - 1) * 7;
  const startDate = new Date(year, month, startDay, 0, 0, 0, 0);
  const endDate = new Date(year, month, startDay + 6, 23, 59, 59, 999);

  return { startDate, endDate };
};

// @desc    Get tasks by date range
// @route   GET /api/tasks/range?startDate=...&endDate=...&page=1&limit=50
// @access  Private
const getTasksByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 50 } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Please provide startDate and endDate" });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const tasks = await Task.find({
      user: req.user._id,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    })
      .sort({ date: 1, createdAt: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination info
    const total = await Task.countDocuments({
      user: req.user._id,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });

    res.json({
      tasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get tasks for specific week
// @route   GET /api/tasks/week/:year/:month/:weekNumber
// @access  Private
const getTasksByWeek = async (req, res) => {
  try {
    const { year, month, weekNumber } = req.params;
    const { startDate, endDate } = getWeekDates(
      parseInt(year),
      parseInt(month),
      parseInt(weekNumber)
    );

    const tasks = await Task.find({
      user: req.user._id,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    }).sort({ date: 1, order: 1, createdAt: 1 }).lean();

    // Auto-complete automated tasks for today and past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const task of tasks) {
      if (task.isAutomated && !task.isActive && task.plannedTime > 0) {
        const taskDate = new Date(task.date);
        taskDate.setHours(0, 0, 0, 0);

        // If task is for today or past, and hasn't been completed yet
        if (
          taskDate <= today &&
          task.totalTime === 0 &&
          task.sessions.length === 0
        ) {
          // Use scheduled time or default to start of day
          let startTime;
          let endTime;
          
          if (task.scheduledStartTime && task.scheduledEndTime) {
            // Parse scheduled time (format: "HH:MM")
            const [startHour, startMin] = task.scheduledStartTime.split(':').map(Number);
            const [endHour, endMin] = task.scheduledEndTime.split(':').map(Number);
            
            startTime = new Date(taskDate);
            startTime.setHours(startHour, startMin, 0, 0);
            
            endTime = new Date(taskDate);
            endTime.setHours(endHour, endMin, 0, 0);
          } else {
            // No scheduled time - complete at start of day
            startTime = new Date(taskDate.getTime() + 1 * 60 * 60 * 1000); // 1 AM
            endTime = new Date(startTime.getTime() + task.plannedTime);
          }

          // Mark as completed automatically with planned time
          // Use findByIdAndUpdate since we're using lean() queries (plain objects don't have .save())
          const newSession = {
            startTime: startTime,
            endTime: endTime,
            duration: task.plannedTime,
          };
          
          await Task.findByIdAndUpdate(task._id, {
            $push: { sessions: newSession },
            $set: { 
              totalTime: task.plannedTime,
              completionCount: (task.completionCount || 0) + 1
            }
          });
          
          // Update local task object for response
          task.sessions.push(newSession);
          task.totalTime = task.plannedTime;
          task.completionCount = (task.completionCount || 0) + 1;
        }
      }
    }

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
const createTask = async (req, res) => {
  try {
    const {
      name,
      category,
      date,
      plannedTime,
      isAutomated,
      scheduledStartTime,
      scheduledEndTime,
    } = req.body;

    if (!name || !category || !date) {
      return res
        .status(400)
        .json({ message: "Please provide task name, category, and date" });
    }

    // Fetch the category to get its name (category in req.body is the ID)
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return res.status(404).json({ message: "Category not found" });
    }

    const taskDate = new Date(date);
    const day = getDayName(taskDate);

    const task = await Task.create({
      user: req.user._id,
      name,
      category: categoryDoc.name, // Store category name, not ID
      date: taskDate,
      day,
      isActive: false,
      sessions: [],
      totalTime: 0,
      plannedTime: plannedTime || 0,
      isAutomated: isAutomated || false,
      completionCount: 0,
      startTime: null,
      scheduledStartTime: scheduledStartTime || null,
      scheduledEndTime: scheduledEndTime || null,
    });

    // Auto-complete if automated task is for today or past
    if (task.isAutomated && task.plannedTime > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkDate = new Date(taskDate);
      checkDate.setHours(0, 0, 0, 0);

      if (checkDate <= today) {
        // Use scheduled time or default to start of day
        let startTime;
        let endTime;
        
        if (task.scheduledStartTime && task.scheduledEndTime) {
          // Parse scheduled time (format: "HH:MM")
          const [startHour, startMin] = task.scheduledStartTime.split(':').map(Number);
          const [endHour, endMin] = task.scheduledEndTime.split(':').map(Number);
          
          startTime = new Date(checkDate);
          startTime.setHours(startHour, startMin, 0, 0);
          
          endTime = new Date(checkDate);
          endTime.setHours(endHour, endMin, 0, 0);
        } else {
          // No scheduled time - complete at start of day
          startTime = new Date(checkDate.getTime() + 1 * 60 * 60 * 1000); // 1 AM
          endTime = new Date(startTime.getTime() + task.plannedTime);
        }

        task.sessions.push({
          startTime: startTime,
          endTime: endTime,
          duration: task.plannedTime,
        });
        task.totalTime = task.plannedTime;
        task.completionCount = 1;
        await task.save();
      }
    }

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update task (toggle, time tracking with sessions)
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Handle toggle with sessions
    if (req.body.hasOwnProperty("isActive")) {
      if (req.body.isActive) {
        // Check if task date is today
        const taskDate = new Date(task.date);
        const today = new Date();
        const isToday =
          taskDate.getFullYear() === today.getFullYear() &&
          taskDate.getMonth() === today.getMonth() &&
          taskDate.getDate() === today.getDate();

        if (!isToday) {
          return res
            .status(400)
            .json({ message: "You can only start/stop today's tasks" });
        }

        // Starting a new session
        task.isActive = true;
        task.startTime = new Date();
      } else {
        // Stopping current session
        if (task.startTime) {
          const endTime = new Date();
          const duration = endTime - new Date(task.startTime);

          // Add completed session
          task.sessions.push({
            startTime: task.startTime,
            endTime: endTime,
            duration: duration,
          });

          // Update total time
          task.totalTime += duration;
        }
        task.isActive = false;
        task.startTime = null;
      }
    }

    // Update other fields if provided
    if (req.body.name) task.name = req.body.name;
    if (req.body.category) task.category = req.body.category;

    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    await task.deleteOne();
    res.json({ message: "Task removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete all tasks for a specific day
// @route   DELETE /api/tasks/day/:date
// @access  Private
const deleteTasksByDay = async (req, res) => {
  try {
    const { date } = req.params;
    
    const result = await Task.deleteMany({
      user: req.user._id,
      date: date,
    });

    res.json({ 
      message: `Deleted ${result.deletedCount} task(s)`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete all tasks for a specific week
// @route   DELETE /api/tasks/week/:year/:month/:weekNumber
// @access  Private
const deleteTasksByWeek = async (req, res) => {
  try {
    const { year, month, weekNumber } = req.params;
    const weekNum = parseInt(weekNumber);
    const startDay = (weekNum - 1) * 7 + 1;
    const endDay = weekNum * 7;

    const startDate = new Date(parseInt(year), parseInt(month), startDay);
    const endDate = new Date(parseInt(year), parseInt(month), endDay, 23, 59, 59);

    const result = await Task.deleteMany({
      user: req.user._id,
      date: {
        $gte: startDate.toISOString().split('T')[0],
        $lte: endDate.toISOString().split('T')[0],
      },
    });

    res.json({ 
      message: `Deleted ${result.deletedCount} task(s) from week ${weekNum}`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get weekly analytics
// @route   GET /api/tasks/analytics/week/:year/:month/:weekNumber
// @access  Private
const getWeeklyAnalytics = async (req, res) => {
  try {
    const { year, month, weekNumber } = req.params;
    const { startDate, endDate } = getWeekDates(
      parseInt(year),
      parseInt(month),
      parseInt(weekNumber)
    );

    // Fetch tasks and sleep in parallel for speed
    const [tasks, sleepSessions] = await Promise.all([
      Task.find({
        user: req.user._id,
        date: { $gte: startDate, $lte: endDate },
      }).lean(), // Use lean() for faster queries
      Sleep.find({
        user: req.user._id,
        date: { $gte: startDate, $lte: endDate },
        isActive: false,
      }).lean(),
    ]);

    // Calculate analytics - optimized
    const analytics = {
      totalTasks: tasks.length,
      completedTasks: 0,
      activeTasks: 0,
      totalTime: 0,
      totalPlannedTime: 0,
      byDay: {},
      byCategory: {},
      averagePerDay: 0,
      sessionCount: 0,
    };

    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    days.forEach((day) => {
      analytics.byDay[day] = {
        taskCount: 0,
        totalTime: 0,
        plannedTime: 0,
        sessions: 0,
      };
    });

    tasks.forEach((task) => {
      let taskTime = task.totalTime;
      const isActive = task.isActive;
      
      if (isActive && task.startTime) {
        taskTime += Date.now() - new Date(task.startTime).getTime();
        analytics.activeTasks++;
      } else if (!isActive && taskTime > 0) {
        analytics.completedTasks++;
      }

      const sessionsCount = task.sessions?.length || 0;
      analytics.totalTime += taskTime;
      analytics.totalPlannedTime += task.plannedTime || 0;
      analytics.sessionCount += sessionsCount + (isActive ? 1 : 0);

      // By day
      const dayKey = task.day;
      if (analytics.byDay[dayKey]) {
        analytics.byDay[dayKey].taskCount++;
        analytics.byDay[dayKey].totalTime += taskTime;
        analytics.byDay[dayKey].plannedTime += task.plannedTime || 0;
        analytics.byDay[dayKey].sessions += sessionsCount;
      }

      // By category
      const categoryName = task.category || "Uncategorized";
      if (!analytics.byCategory[categoryName]) {
        analytics.byCategory[categoryName] = {
          taskCount: 0,
          totalTime: 0,
          plannedTime: 0,
          sessions: 0,
        };
      }
      analytics.byCategory[categoryName].taskCount++;
      analytics.byCategory[categoryName].totalTime += taskTime;
      analytics.byCategory[categoryName].plannedTime += task.plannedTime || 0;
      analytics.byCategory[categoryName].sessions += sessionsCount;
    });

    // Add sleep data to analytics
    if (sleepSessions.length > 0) {
      const totalSleepTime = sleepSessions.reduce(
        (sum, session) => sum + session.duration,
        0
      );
      analytics.byCategory["Sleep"] = {
        taskCount: sleepSessions.length,
        totalTime: totalSleepTime,
        plannedTime: 0,
        sessions: sleepSessions.length,
      };
      analytics.totalTime += totalSleepTime;
      analytics.sessionCount += sleepSessions.length;
    }

    analytics.averagePerDay = analytics.totalTime / 7;

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get monthly analytics
// @route   GET /api/tasks/analytics/month/:year/:month
// @access  Private
const getMonthlyAnalytics = async (req, res) => {
  try {
    const { year, month } = req.params;
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, parseInt(month) + 1, 0, 23, 59, 59, 999);

    // Fetch tasks and sleep in parallel
    const [tasks, sleepSessions] = await Promise.all([
      Task.find({
        user: req.user._id,
        date: { $gte: startDate, $lte: endDate },
      }).lean(),
      Sleep.find({
        user: req.user._id,
        date: { $gte: startDate, $lte: endDate },
        isActive: false,
      }).lean(),
    ]);

    const analytics = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => !t.isActive && t.totalTime > 0)
        .length,
      totalTime: 0,
      byCategory: {},
      byWeek: {},
      sessionCount: 0,
    };

    tasks.forEach((task) => {
      let taskTime = task.totalTime;
      if (task.isActive && task.startTime) {
        taskTime += Date.now() - new Date(task.startTime).getTime();
      }

      analytics.totalTime += taskTime;
      analytics.sessionCount += task.sessions.length;

      // By category - task.category is already the name string
      const categoryName = task.category || "Uncategorized";
      if (!analytics.byCategory[categoryName]) {
        analytics.byCategory[categoryName] = { taskCount: 0, totalTime: 0 };
      }
      analytics.byCategory[categoryName].taskCount++;
      analytics.byCategory[categoryName].totalTime += taskTime;

      // By week
      const weekNum = Math.ceil(task.date.getDate() / 7);
      if (!analytics.byWeek[`week${weekNum}`]) {
        analytics.byWeek[`week${weekNum}`] = { taskCount: 0, totalTime: 0 };
      }
      analytics.byWeek[`week${weekNum}`].taskCount++;
      analytics.byWeek[`week${weekNum}`].totalTime += taskTime;
    });

    // Add sleep data to monthly analytics
    if (sleepSessions.length > 0) {
      const totalSleepTime = sleepSessions.reduce(
        (sum, session) => sum + session.duration,
        0
      );
      analytics.byCategory["Sleep"] = {
        taskCount: sleepSessions.length,
        totalTime: totalSleepTime,
      };
      analytics.totalTime += totalSleepTime;
      analytics.sessionCount += sleepSessions.length;
    }

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get category-based analytics
// @route   GET /api/tasks/analytics/category/:category
// @access  Private
const getCategoryAnalytics = async (req, res) => {
  try {
    const { category } = req.params;
    const { startDate, endDate } = req.query;

    const query = {
      user: req.user._id,
      category: category,
    };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const tasks = await Task.find(query).sort({ date: 1 }).lean();

    // Category is already the name string
    const categoryName = category || "Unknown";

    const analytics = {
      category: categoryName,
      categoryId: category,
      totalTasks: tasks.length,
      totalTime: 0,
      totalPlannedTime: 0,
      totalSessions: 0,
      byDate: {},
    };

    tasks.forEach((task) => {
      let taskTime = task.totalTime;
      if (task.isActive && task.startTime) {
        taskTime += Date.now() - new Date(task.startTime).getTime();
      }

      analytics.totalTime += taskTime;
      analytics.totalPlannedTime += task.plannedTime || 0;
      analytics.totalSessions += task.sessions.length;

      const dateKey = task.date.toISOString().split("T")[0];
      if (!analytics.byDate[dateKey]) {
        analytics.byDate[dateKey] = { taskCount: 0, totalTime: 0, sessions: 0 };
      }
      analytics.byDate[dateKey].taskCount++;
      analytics.byDate[dateKey].totalTime += taskTime;
      analytics.byDate[dateKey].sessions += task.sessions.length;
    });

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
};
