const TaskTemplate = require("../models/TaskTemplate");
const Task = require("../models/Task");
const Todo = require("../models/Todo");
const { google } = require("googleapis");
const User = require("../models/User");
const {
  cacheKey,
  getCache,
  setCache,
  invalidateCache,
  TTL,
} = require("../config/redis");
const tz = require("../utils/timezone");
const { DateTime } = require("luxon");

// Helper: get authenticated Google Calendar client
const getCalendarClient = async (userId) => {
  const user = await User.findById(userId).select(
    "+googleCalendar.accessToken +googleCalendar.refreshToken +googleCalendar.tokenExpiry",
  );

  if (!user.googleCalendar?.connected || !user.googleCalendar?.accessToken) {
    return null; // Not connected — skip calendar silently
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.FRONTEND_URL}/calendar/callback`,
  );
  oauth2Client.setCredentials({
    access_token: user.googleCalendar.accessToken,
    refresh_token: user.googleCalendar.refreshToken,
    expiry_date: user.googleCalendar.tokenExpiry?.getTime(),
  });

  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await User.findByIdAndUpdate(userId, {
        "googleCalendar.accessToken": tokens.access_token,
        "googleCalendar.tokenExpiry": new Date(tokens.expiry_date),
      });
    }
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
};

// Map template days to actual day of week indices (0 = Sunday, 6 = Saturday)
const dayToWeekday = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// @desc    Get all user's templates
// @route   GET /api/templates
// @access  Private
const getTemplates = async (req, res) => {
  try {
    const key = cacheKey(req.user._id, "templates");
    const cached = await getCache(key);
    if (cached) return res.json(cached);

    const templates = await TaskTemplate.find({ user: req.user._id })
      .sort({
        createdAt: -1,
      })
      .lean();
    await setCache(key, templates, TTL.TEMPLATES);
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
    const key = cacheKey(req.user._id, "templates", req.params.id);
    const cached = await getCache(key);
    if (cached) return res.json(cached);

    const template = await TaskTemplate.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).lean();

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    await setCache(key, template, TTL.TEMPLATES);
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
    const { name, tasks = [], quickTodos = [] } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Please provide template name" });
    }

    if (
      (!tasks || !Array.isArray(tasks) || tasks.length === 0) &&
      (!quickTodos || !Array.isArray(quickTodos) || quickTodos.length === 0)
    ) {
      return res
        .status(400)
        .json({ message: "Please provide at least one task or quick todo" });
    }

    // Validate tasks
    for (const task of tasks) {
      if (!task.name || !task.category || !task.day) {
        return res.status(400).json({
          message: "Each task must have name, category, and day",
        });
      }
    }

    for (const todo of quickTodos) {
      if (!todo.text || !todo.day) {
        return res.status(400).json({
          message: "Each quick todo must have text and day",
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
      quickTodos,
    });

    await invalidateCache(`user:${req.user._id}:templates*`);
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
    const { name, tasks, quickTodos } = req.body;

    console.log(
      "Updating template with tasks:",
      JSON.stringify(tasks, null, 2),
    );

    const template = await TaskTemplate.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    if (name) template.name = name;
    if (Array.isArray(tasks)) template.tasks = tasks;
    if (Array.isArray(quickTodos)) template.quickTodos = quickTodos;
    template.updatedAt = Date.now();

    await template.save();

    // Re-fetch to verify what was actually saved
    const savedTemplate = await TaskTemplate.findById(req.params.id);
    console.log(
      "Template after save (re-fetched):",
      JSON.stringify(savedTemplate.tasks, null, 2),
    );

    await invalidateCache(`user:${req.user._id}:templates*`);
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
    await invalidateCache(`user:${req.user._id}:templates*`);
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
    const timezone = tz.getTimezoneFromRequest(req);
    console.log("Applying template with timezone:", timezone);

    // Get template
    const template = await TaskTemplate.findOne({
      _id: id,
      user: req.user._id,
    });

    if (
      !template ||
      ((template.tasks || []).length === 0 &&
        (template.quickTodos || []).length === 0)
    ) {
      return res
        .status(404)
        .json({ message: "Template not found or has no tasks/quick todos" });
    }

    // Calculate week dates using timezone utilities
    const { startDate } = tz.getWeekDates(
      parseInt(year),
      parseInt(month),
      parseInt(weekNumber),
      timezone,
    );

    const startDay = startDate.getDate();
    const startDayOfWeek = startDate.getDay();

    const calendarClient = await getCalendarClient(req.user._id);

    const createdTasks = [];
    const createdTodos = [];
    let calendarEventsCreated = 0;

    for (const templateTask of template.tasks || []) {
      console.log("Processing template task:", {
        name: templateTask.name,
        isAutomated: templateTask.isAutomated,
        plannedTime: templateTask.plannedTime,
      });

      const targetWeekday = dayToWeekday[templateTask.day];

      // Calculate offset from start date to target weekday
      let dayOffset = targetWeekday - startDayOfWeek;
      if (dayOffset < 0) {
        dayOffset += 7; // Adjust for next week if target day is before start day
      }

      const dayOfMonth = startDay + dayOffset;

      // Create date and format as YYYY-MM-DD for database
      const taskDateObj = tz.createDateTime(
        `${year}-${String(parseInt(month) + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`,
        12, // Noon to avoid boundary issues
        0,
        timezone,
      );

      // Check if date is valid and in the same month
      if (taskDateObj.getMonth() !== parseInt(month)) {
        console.log(`Skipping template task ${templateTask.name} - outside target month:`, {
          taskMonth: taskDateObj.getMonth(),
          targetMonth: parseInt(month)
        });
        continue; // Skip if date would be in next/previous month
      }

      const dateStr = tz.dateToString(taskDateObj, timezone);

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
        existing.deleted = false;
        existing.deletedAt = null;

        // Only reset completion if the task hasn't been worked on yet
        if (existing.totalTime === 0 && existing.sessions.length === 0) {
          existing.completionCount = 0;

          // Auto-complete if automated task is for today or past
          if (existing.isAutomated && existing.plannedTime > 0) {
            if (tz.isTodayOrPast(dateStr, timezone)) {
              console.log("Auto-completing existing task...");
              const completionTime = existing.plannedTime;
              const startTime = tz.createDateTimeFromSlot(dateStr, existing.scheduledStartTime || "09:00", timezone);
              const endTime = new Date(startTime.getTime() + completionTime);
              
              existing.sessions = [
                {
                  startTime,
                  endTime,
                  duration: completionTime,
                },
              ];
              existing.totalTime = completionTime;
              existing.completionCount = 1;
            }
          }
        }

        await existing.save();
        createdTasks.push(existing);
        console.log("Task updated from template");

        // Auto-add to Google Calendar if enabled (skip if already has event)
        if (
          templateTask.addToCalendar &&
          calendarClient &&
          existing.scheduledStartTime &&
          !existing.calendarEventId
        ) {
          try {
            const startDt = tz.createDateTimeFromSlot(dateStr, existing.scheduledStartTime, timezone);
            const startISO = DateTime.fromJSDate(startDt).setZone(timezone).toISO();
            
            let endDt;
            if (existing.scheduledEndTime) {
              endDt = tz.createDateTimeFromSlot(dateStr, existing.scheduledEndTime, timezone);
            } else {
              endDt = new Date(
                startDt.getTime() + (existing.plannedTime || 30 * 60000),
              );
            }
            const endISO = DateTime.fromJSDate(endDt).setZone(timezone).toISO();

            console.log("Google Calendar Event Time Debug:", {
              task: existing.name,
              dateStr,
              startTime: existing.scheduledStartTime,
              timezone,
              startDt_raw: startDt,
              startISO,
              endISO
            });

            const reminderMins = templateTask.reminderMinutes || 0;
            const calResponse = await calendarClient.events.insert({
              calendarId: "primary",
              resource: {
                summary: `📋 ${existing.name}`,
                description: `Task from Tracku template: ${template.name}`,
                start: {
                  dateTime: startISO,
                  timeZone: timezone,
                },
                end: {
                  dateTime: endISO,
                  timeZone: timezone,
                },
                reminders:
                  reminderMins > 0
                    ? {
                        useDefault: false,
                        overrides: [{ method: "popup", minutes: reminderMins }],
                      }
                    : { useDefault: true },
              },
            });
            existing.calendarEventId = calResponse.data.id;
            await existing.save();
            calendarEventsCreated++;
          } catch (calErr) {
            console.error(
              "Calendar event create failed for updated task:",
              calErr.message,
            );
          }
        }
      } else {
        console.log("Creating task from template:", {
          name: templateTask.name,
          isAutomated: templateTask.isAutomated,
          plannedTime: templateTask.plannedTime,
          date: dateStr,
        });

        let newTask;
        try {
          newTask = await Task.create({
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
        } catch (err) {
          // If duplicate key error (code 11000), task was created by concurrent request
          if (err.code === 11000) {
            console.log(
              "Task already exists (concurrent request), fetching existing...",
            );
            newTask = await Task.findOne({
              user: req.user._id,
              name: templateTask.name,
              category: templateTask.category,
              date: dateStr,
            });
            if (newTask) {
              createdTasks.push(newTask);
              continue; // Skip to next template task
            }
          }
          throw err; // Re-throw if not duplicate error
        }

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
            "Task is automated with plannedTime, checking if should auto-complete...",
          );
          console.log("Date comparison using tz:", {
            taskDate: dateStr,
            today: tz.getTodayString(timezone),
            shouldComplete: tz.isTodayOrPast(dateStr, timezone),
          });

          if (tz.isTodayOrPast(dateStr, timezone)) {
            console.log("Auto-completing task...");
            const completionTime = newTask.plannedTime;
            const startTime = tz.createDateTimeFromSlot(dateStr, newTask.scheduledStartTime || "09:00", timezone);
            const endTime = new Date(startTime.getTime() + completionTime);
            
            newTask.sessions.push({
              startTime,
              endTime,
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

        // Auto-add to Google Calendar if enabled (skip if already has event)
        if (
          templateTask.addToCalendar &&
          calendarClient &&
          newTask.scheduledStartTime &&
          !newTask.calendarEventId
        ) {
          try {
            const startDt = tz.createDateTimeFromSlot(dateStr, newTask.scheduledStartTime, timezone);
            const startISO = DateTime.fromJSDate(startDt).setZone(timezone).toISO();
            
            let endDt;
            if (newTask.scheduledEndTime) {
              endDt = tz.createDateTimeFromSlot(dateStr, newTask.scheduledEndTime, timezone);
            } else {
              endDt = new Date(
                startDt.getTime() + (newTask.plannedTime || 30 * 60000),
              );
            }
            const endISO = DateTime.fromJSDate(endDt).setZone(timezone).toISO();

            const reminderMins = templateTask.reminderMinutes || 0;
            const calResponse = await calendarClient.events.insert({
              calendarId: "primary",
              resource: {
                summary: `📋 ${newTask.name}`,
                description: `Task from Tracku template: ${template.name}`,
                start: {
                  dateTime: startISO,
                  timeZone: timezone,
                },
                end: {
                  dateTime: endISO,
                  timeZone: timezone,
                },
                reminders:
                  reminderMins > 0
                    ? {
                        useDefault: false,
                        overrides: [
                          { method: "popup", minutes: reminderMins },
                        ],
                      }
                    : { useDefault: true },
              },
            });
            newTask.calendarEventId = calResponse.data.id;
            await newTask.save();
            calendarEventsCreated++;
          } catch (calErr) {
            console.error(
              "Calendar event create failed for new task:",
              calErr.message,
            );
          }
        }
      }
    }

    for (const templateTodo of template.quickTodos || []) {
      const targetWeekday = dayToWeekday[templateTodo.day];
      if (targetWeekday === undefined) continue;

      let dayOffset = targetWeekday - startDayOfWeek;
      if (dayOffset < 0) {
        dayOffset += 7;
      }

      const dayOfMonth = startDay + dayOffset;
      const todoDateObj = tz.createDateTime(
        `${year}-${String(parseInt(month) + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`,
        12,
        0,
        timezone,
      );
      if (todoDateObj.getMonth() !== parseInt(month)) {
        continue;
      }

      const todoDateStr = tz.dateToString(todoDateObj, timezone);
      const deadlineOffsetDays = Number(templateTodo.deadlineOffsetDays || 0);
      
      // Calculate deadline using Luxon for accuracy
      const deadlineDate = DateTime.fromJSDate(todoDateObj)
        .plus({ days: deadlineOffsetDays })
        .toJSDate();
      const deadlineDateStr = tz.dateToString(deadlineDate, timezone);

      const existingTodo = await Todo.findOne({
        user: req.user._id,
        text: templateTodo.text,
        date: todoDateStr,
      });

      if (existingTodo) {
        existingTodo.deadline = deadlineDateStr;
        existingTodo.deleted = false;
        existingTodo.deletedAt = null;
        await existingTodo.save();
        createdTodos.push(existingTodo);
        continue;
      }

      const newTodo = await Todo.create({
        user: req.user._id,
        text: templateTodo.text,
        completed: false,
        date: todoDateStr,
        deadline: deadlineDateStr,
        isOverdue: false,
      });

      createdTodos.push(newTodo);
    }

    await invalidateCache(`user:${req.user._id}:tasks*`);
    await invalidateCache(`user:${req.user._id}:todos*`);
    await invalidateCache(`user:${req.user._id}:analytics*`);

    res.json({
      message: `Applied template with ${createdTasks.length} tasks and ${createdTodos.length} quick todos${calendarEventsCreated > 0 ? ` (${calendarEventsCreated} calendar events created)` : ""}`,
      tasks: createdTasks,
      todos: createdTodos,
      calendarEventsCreated,
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
