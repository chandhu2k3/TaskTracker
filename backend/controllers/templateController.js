const TaskTemplate = require("../models/TaskTemplate");
const Task = require("../models/Task");

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

// @desc    Get all user's templates
// @route   GET /api/templates
// @access  Private
const getTemplates = async (req, res) => {
  try {
    const templates = await TaskTemplate.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single template by ID
// @route   GET /api/templates/:id
// @access  Private
const getTemplate = async (req, res) => {
  try {
    const template = await TaskTemplate.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new template
// @route   POST /api/templates
// @access  Private
const createTemplate = async (req, res) => {
  try {
    const { name, tasks } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Please provide template name" });
    }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res
        .status(400)
        .json({ message: "Please provide at least one task" });
    }

    // Validate tasks
    for (const task of tasks) {
      if (!task.name || !task.category || !task.day) {
        return res.status(400).json({
          message: "Each task must have name, category, and day",
        });
      }
    }

    // Check if template name already exists for this user
    const existingTemplate = await TaskTemplate.findOne({
      user: req.user._id,
      name: name,
    });

    if (existingTemplate) {
      return res
        .status(400)
        .json({ message: "Template with this name already exists" });
    }

    const template = await TaskTemplate.create({
      user: req.user._id,
      name,
      tasks,
    });

    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update template
// @route   PUT /api/templates/:id
// @access  Private
const updateTemplate = async (req, res) => {
  try {
    const { name, tasks } = req.body;

    console.log(
      "Updating template with tasks:",
      JSON.stringify(tasks, null, 2)
    );

    const template = await TaskTemplate.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    if (name) template.name = name;
    if (tasks) template.tasks = tasks;
    template.updatedAt = Date.now();

    await template.save();

    // Re-fetch to verify what was actually saved
    const savedTemplate = await TaskTemplate.findById(req.params.id);
    console.log(
      "Template after save (re-fetched):",
      JSON.stringify(savedTemplate.tasks, null, 2)
    );

    res.json(savedTemplate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete template
// @route   DELETE /api/templates/:id
// @access  Private
const deleteTemplate = async (req, res) => {
  try {
    const template = await TaskTemplate.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    await template.deleteOne();
    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Apply template to specific week
// @route   POST /api/templates/:id/apply/:year/:month/:weekNumber
// @access  Private
const applyTemplate = async (req, res) => {
  try {
    const { id, year, month, weekNumber } = req.params;

    // Get template
    const template = await TaskTemplate.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!template || template.tasks.length === 0) {
      return res
        .status(404)
        .json({ message: "Template not found or has no tasks" });
    }

    // Calculate week dates using calendar-based system (Week 1 = days 1-7)
    const startDay = 1 + (parseInt(weekNumber) - 1) * 7;

    // Get the actual day of week for the start date (0 = Sunday, 1 = Monday, etc.)
    const startDate = new Date(parseInt(year), parseInt(month), startDay);
    const startDayOfWeek = startDate.getDay();

    // Map template days to actual day of week indices (0 = Sunday, 6 = Saturday)
    const templateDayToWeekday = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const createdTasks = [];

    for (const templateTask of template.tasks) {
      console.log("Processing template task:", {
        name: templateTask.name,
        isAutomated: templateTask.isAutomated,
        plannedTime: templateTask.plannedTime,
      });

      const targetWeekday = templateDayToWeekday[templateTask.day];

      // Calculate offset from start date to target weekday
      let dayOffset = targetWeekday - startDayOfWeek;
      if (dayOffset < 0) {
        dayOffset += 7; // Adjust for next week if target day is before start day
      }

      const dayOfMonth = startDay + dayOffset;

      // Create date at noon to avoid timezone issues
      const taskDate = new Date(
        parseInt(year),
        parseInt(month),
        dayOfMonth,
        12,
        0,
        0,
        0
      );

      // Check if date is valid and in the same month
      if (taskDate.getMonth() !== parseInt(month)) {
        continue; // Skip if date would be in next/previous month
      }

      // Format date as YYYY-MM-DD for database
      const dateStr = `${year}-${String(parseInt(month) + 1).padStart(
        2,
        "0"
      )}-${String(dayOfMonth).padStart(2, "0")}`;

      // Check if task already exists for this date
      const existing = await Task.findOne({
        user: req.user._id,
        name: templateTask.name,
        category: templateTask.category,
        date: dateStr,
      });

      if (existing) {
        // Update existing task with template values
        console.log("Updating existing task from template:", {
          _id: existing._id,
          name: templateTask.name,
          oldPlannedTime: existing.plannedTime,
          newPlannedTime: templateTask.plannedTime,
          oldIsAutomated: existing.isAutomated,
          newIsAutomated: templateTask.isAutomated,
        });

        existing.plannedTime = templateTask.plannedTime || 0;
        existing.isAutomated = templateTask.isAutomated || false;
        existing.scheduledStartTime = templateTask.scheduledStartTime || null;
        existing.scheduledEndTime = templateTask.scheduledEndTime || null;
        
        // Only reset completion if the task hasn't been worked on yet
        if (existing.totalTime === 0 && existing.sessions.length === 0) {
          existing.completionCount = 0;
          
          // Auto-complete if automated task is for today or past
          if (existing.isAutomated && existing.plannedTime > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const taskDateObj = new Date(dateStr);
            taskDateObj.setHours(0, 0, 0, 0);

            if (taskDateObj <= today) {
              console.log("Auto-completing updated automated task...");
              const completionTime = existing.plannedTime;
              existing.sessions = [{
                startTime: new Date(taskDateObj.getTime() + 9 * 60 * 60 * 1000),
                endTime: new Date(taskDateObj.getTime() + 9 * 60 * 60 * 1000 + completionTime),
                duration: completionTime,
              }];
              existing.totalTime = completionTime;
              existing.completionCount = 1;
            }
          }
        }
        
        await existing.save();
        createdTasks.push(existing);
        console.log("Task updated from template");
      } else {
        console.log("Creating task from template:", {
          name: templateTask.name,
          isAutomated: templateTask.isAutomated,
          plannedTime: templateTask.plannedTime,
          date: dateStr,
        });

        const newTask = await Task.create({
          user: req.user._id,
          name: templateTask.name,
          category: templateTask.category,
          date: dateStr,
          day: templateTask.day,
          isActive: false,
          sessions: [],
          totalTime: 0,
          plannedTime: templateTask.plannedTime || 0,
          isAutomated: templateTask.isAutomated || false,
          completionCount: 0,
          scheduledStartTime: templateTask.scheduledStartTime || null,
          scheduledEndTime: templateTask.scheduledEndTime || null,
        });

        console.log("Task created:", {
          _id: newTask._id,
          name: newTask.name,
          isAutomated: newTask.isAutomated,
          totalTime: newTask.totalTime,
          sessions: newTask.sessions.length,
        });

        // Auto-complete if automated task is for today or past
        if (newTask.isAutomated && newTask.plannedTime > 0) {
          console.log(
            "Task is automated with plannedTime, checking if should auto-complete..."
          );
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const taskDateObj = new Date(dateStr);
          taskDateObj.setHours(0, 0, 0, 0);

          console.log("Date comparison:", {
            taskDate: taskDateObj,
            today,
            shouldComplete: taskDateObj <= today,
          });

          if (taskDateObj <= today) {
            console.log("Auto-completing task...");
            const completionTime = newTask.plannedTime;
            newTask.sessions.push({
              startTime: new Date(taskDateObj.getTime() + 9 * 60 * 60 * 1000), // 9 AM
              endTime: new Date(
                taskDateObj.getTime() + 9 * 60 * 60 * 1000 + completionTime
              ),
              duration: completionTime,
            });
            newTask.totalTime = completionTime;
            newTask.completionCount = 1;
            await newTask.save();
            console.log("Task auto-completed:", {
              _id: newTask._id,
              totalTime: newTask.totalTime,
              sessions: newTask.sessions.length,
            });
          }
        }

        createdTasks.push(newTask);
      }
    }

    res.json({
      message: `Applied template with ${createdTasks.length} tasks`,
      tasks: createdTasks,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
};
