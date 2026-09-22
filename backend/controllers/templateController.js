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
    return null; // Not connected - skip calendar silently
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
    const template = await TaskTemplate.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const updatedTemplate = {
      name: req.body.name || template.name,
      tasks: req.body.tasks || template.tasks,
      quickTodos: req.body.todos || req.body.quickTodos || template.quickTodos, // Handle both names
    };

    const savedTemplate = await TaskTemplate.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updatedTemplate,
      { new: true },
    );

    // Invalidate caches on template update
    await invalidateCache(`user:${req.user._id}:templates*`);
    const { deleteCache, cacheKey: buildKey } = require("../config/redis");
    await deleteCache(buildKey(req.user._id, `templates:${req.params.id}`));
    res.json(savedTemplate);
  } catch (error) {
    console.error("updateTemplate ERROR:", error);
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
    const { deleteCache: delCache, cacheKey: buildKey2 } = require("../config/redis");
    await delCache(buildKey2(req.user._id, `templates:${req.params.id}`));
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
    const w = parseInt(weekNumber, 10);
    if (!Number.isFinite(w) || w < 1 || w > 4) {
      return res.status(400).json({ message: "Invalid weekNumber. Must be 1-4." });
    }
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
    const { startDate, endDate } = tz.getWeekDates(
      parseInt(year),
      parseInt(month),
      parseInt(weekNumber),
      timezone,
    );

    const startDtLuxon = DateTime.fromJSDate(startDate).setZone(timezone).startOf("day");
    const endDtLuxon = DateTime.fromJSDate(endDate).setZone(timezone).endOf("day");

    // "Apply from today" - if we're mid-week, only create tasks for today onwards.
    // If the week hasn't started yet (future week), apply from the week start.
    const todayDt = DateTime.now().setZone(timezone).startOf("day");
    const effectiveStartDt = todayDt > startDtLuxon ? todayDt : startDtLuxon;

    // Map Luxon weekday numbers (1=Mon..7=Sun) to template day names for fast lookup
    const luxonWeekdayMap = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
      friday: 5, saturday: 6, sunday: 7,
    };

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

      const targetLuxonWeekday = luxonWeekdayMap[templateTask.day];
      if (targetLuxonWeekday === undefined) {
        console.log(`Skipping task ${templateTask.name}: unknown day "${templateTask.day}"`);
        continue;
      }

      // Find the first calendar date ON OR AFTER today that matches this weekday,
      // within the week range. Starting from effectiveStartDt (not startDtLuxon)
      // ensures that for week 4 with repeated weekdays (e.g., two Mondays: June 22 & 29),
      // we pick the one that falls on or after today, not the earlier one that was skipped.
      let dayDt = effectiveStartDt;
      while (dayDt.weekday !== targetLuxonWeekday && dayDt <= endDtLuxon) {
        dayDt = dayDt.plus({ days: 1 });
      }

      if (dayDt > endDtLuxon) {
        console.log(`Skipping ${templateTask.name}: day "${templateTask.day}" not found on/after today in week range`);
        continue;
      }

      const dateStr = dayDt.toFormat("yyyy-MM-dd");
      const targetDate = tz.parseDate(dateStr, timezone);
      // Build a day-range filter immune to UTC/IST midnight mismatches
      const { startOfDay, endOfDay } = tz.getDayBounds(dateStr, timezone);

      // Check if task already exists (non-deleted) for this date
      const existing = await Task.findOne({
        user: req.user._id,
        name: templateTask.name,
        category: templateTask.category,
        date: { $gte: startOfDay, $lte: endOfDay }, // day-range, not exact timestamp
        deleted: { $ne: true }, // Only find live (non-deleted) tasks
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

            console.log(`[Calendar Debug] Creating template event for ${existing.name}:`, {
              dateStr,
              scheduled: `${existing.scheduledStartTime}-${existing.scheduledEndTime}`,
              startISO,
              endISO,
              timezone
            });

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
            // IMPORTANT: use the same parsed Date object used by findOne / createTask.
            // Passing `dateStr` (a raw string) causes Mongoose to call new Date(string)
            // which gives UTC midnight - a different value from tz.parseDate() IST midnight,
            // causing a guaranteed E11000 duplicate key error on the unique index.
            date: targetDate,
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
          // If duplicate key error (code 11000), a soft-deleted task with the same
          // unique key exists. Find it (including deleted ones) and restore + update it.
          if (err.code === 11000) {
            console.log(
              "Duplicate key on create - finding task by day range to restore/handle...",
            );
            // Use day-range to be immune to timestamp mismatches
            const anyExisting = await Task.findOne({
              user: req.user._id,
              name: templateTask.name,
              category: templateTask.category,
              date: { $gte: startOfDay, $lte: endOfDay },
            });
            if (anyExisting) {
              // Restore and bring up to date with template values
              anyExisting.deleted = false;
              anyExisting.deletedAt = null;
              anyExisting.plannedTime = templateTask.plannedTime || 0;
              anyExisting.isAutomated = templateTask.isAutomated || false;
              anyExisting.scheduledStartTime = templateTask.scheduledStartTime || null;
              anyExisting.scheduledEndTime = templateTask.scheduledEndTime || null;

              // Only reset completion data if the task hasn't been worked on
              if (anyExisting.totalTime === 0 && anyExisting.sessions.length === 0) {
                anyExisting.completionCount = 0;
                if (anyExisting.isAutomated && anyExisting.plannedTime > 0) {
                  if (tz.isTodayOrPast(dateStr, timezone)) {
                    const completionTime = anyExisting.plannedTime;
                    const startTime = tz.createDateTimeFromSlot(dateStr, anyExisting.scheduledStartTime || "09:00", timezone);
                    const endTime = new Date(startTime.getTime() + completionTime);
                    anyExisting.sessions = [{ startTime, endTime, duration: completionTime }];
                    anyExisting.totalTime = completionTime;
                    anyExisting.completionCount = 1;
                  }
                }
              }

              await anyExisting.save();
              createdTasks.push(anyExisting);
              console.log("Task found via day-range and handled:", anyExisting._id);
              continue; // Move to next template task
            }
          }
          throw err; // Re-throw if not a duplicate error or task not found
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
      const targetLuxonWeekday = luxonWeekdayMap[templateTodo.day];
      if (targetLuxonWeekday === undefined) continue;

      // Find the first calendar date ON OR AFTER today that matches this weekday
      let dayDt = effectiveStartDt;
      while (dayDt.weekday !== targetLuxonWeekday && dayDt <= endDtLuxon) {
        dayDt = dayDt.plus({ days: 1 });
      }

      if (dayDt > endDtLuxon) continue;

      const todoDateStr = dayDt.toFormat("yyyy-MM-dd");
      const deadlineOffsetDays = Number(templateTodo.deadlineOffsetDays || 0);

      // Calculate deadline using Luxon for accuracy
      const deadlineDate = dayDt.plus({ days: deadlineOffsetDays }).toJSDate();
      const deadlineDateStr = tz.dateToString(deadlineDate, timezone);

      const existingTodo = await Todo.findOne({
        user: req.user._id,
        text: templateTodo.text,
        date: todoDateStr,
        deleted: { $ne: true },
      });

      if (existingTodo) {
        existingTodo.deadline = deadlineDateStr;
        existingTodo.deleted = false;
        existingTodo.deletedAt = null;
        await existingTodo.save();
        createdTodos.push(existingTodo);
        // Add calendar reminder if configured and not already in calendar
        if (templateTodo.reminderMinutes > 0 && calendarClient && !existingTodo.calendarEventId) {
          try {
            const timeStr = templateTodo.reminderTime || "09:00";
            const startDt = tz.createDateTimeFromSlot(deadlineDateStr, timeStr, timezone);
            const startISO = DateTime.fromJSDate(startDt).setZone(timezone).toISO();
            const endDt = new Date(startDt.getTime() + 30 * 60000); // 30 minutes duration
            const endISO = DateTime.fromJSDate(endDt).setZone(timezone).toISO();

            const calResponse = await calendarClient.events.insert({
              calendarId: "primary",
              resource: {
                summary: `✓ ${existingTodo.text}`,
                description: `Quick todo from Tracku template: ${template.name}`,
                start: {
                  dateTime: startISO,
                  timeZone: timezone,
                },
                end: {
                  dateTime: endISO,
                  timeZone: timezone,
                },
                reminders: {
                  useDefault: false,
                  overrides: [{ method: "popup", minutes: templateTodo.reminderMinutes }],
                },
              },
            });
            existingTodo.calendarEventId = calResponse.data.id;
            await existingTodo.save();
            calendarEventsCreated++;
          } catch (calErr) {
            console.error("Calendar reminder create failed for existing todo:", calErr.message);
          }
        }
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

      // Add calendar reminder if configured
      if (templateTodo.reminderMinutes > 0 && calendarClient) {
        try {
          const timeStr = templateTodo.reminderTime || "09:00";
          const startDt = tz.createDateTimeFromSlot(deadlineDateStr, timeStr, timezone);
          const startISO = DateTime.fromJSDate(startDt).setZone(timezone).toISO();
          const endDt = new Date(startDt.getTime() + 30 * 60000); // 30 minutes duration
          const endISO = DateTime.fromJSDate(endDt).setZone(timezone).toISO();

          const calResponse = await calendarClient.events.insert({
            calendarId: "primary",
            resource: {
              summary: `✓ ${newTodo.text}`,
              description: `Quick todo from Tracku template: ${template.name}`,
              start: {
                dateTime: startISO,
                timeZone: timezone,
              },
              end: {
                dateTime: endISO,
                timeZone: timezone,
              },
              reminders: {
                useDefault: false,
                overrides: [{ method: "popup", minutes: templateTodo.reminderMinutes }],
              },
            },
          });
          newTodo.calendarEventId = calResponse.data.id;
          await newTodo.save();
          calendarEventsCreated++;
        } catch (calErr) {
          console.error("Calendar reminder create failed for new todo:", calErr.message);
        }
      }

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

// --- Schedule Image Extraction (OpenRouter Vision) ---
//
// Uses OpenRouter's free vision models via OpenAI-compatible API.
// Default: qwen/qwen-2.5-vl-72b-instruct:free  (very capable, handles blur/handwriting)
// Fallback: meta-llama/llama-3.2-11b-vision-instruct:free
//
// Required env: OPENROUTER_API_KEY  (get free key at openrouter.ai)
// Optional env: SCHEDULE_VISION_MODEL

const VISION_API_KEY  = process.env.OPENROUTER_API_KEY;
const VISION_MODEL    = process.env.SCHEDULE_VISION_MODEL || "qwen/qwen-2.5-vl-72b-instruct:free";
const VISION_BASE_URL = "https://openrouter.ai/api/v1";

const VALID_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const VISION_SYSTEM_PROMPT = `You are a schedule extraction assistant. Your ONLY job is to analyse the provided schedule image and return a JSON array of tasks/activities.

Rules:
- Return ONLY a valid JSON array - no markdown, no explanation, no extra text, no code fences.
- Each item must have exactly these fields:
  { "name": string, "day": string, "scheduledStartTime": string|null, "scheduledEndTime": string|null, "plannedTime": number }
- "day" must be one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday (lowercase).
- "scheduledStartTime" and "scheduledEndTime" must be "HH:MM" 24-hour format or null.
- "plannedTime" is duration in milliseconds (e.g. 60 min = 3600000). Infer from start/end times; use 0 if unknown.
- If the image shows a repeating weekly timetable, expand entries across all applicable days.
- If day cannot be determined, default to "monday".
- If no schedule is found, return: []
- Do NOT include a category field.`;

// @desc    Extract schedule tasks from an uploaded image via OpenRouter Vision
// @route   POST /api/templates/extract-schedule
// @access  Private
const extractScheduleFromImage = async (req, res) => {
  const { imageBase64, mimeType } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ message: "No image data provided." });
  }
  if (!VISION_API_KEY) {
    return res.status(503).json({
      message: "OPENROUTER_API_KEY not configured. Get a free key at openrouter.ai and add it to .env.",
    });
  }

  const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const resolvedMime = supportedTypes.includes(mimeType) ? mimeType : "image/jpeg";

  try {
    console.log(`[extractSchedule] Calling OpenRouter vision model: ${VISION_MODEL}`);

    const apiResponse = await fetch(`${VISION_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VISION_API_KEY}`,
        "HTTP-Referer": "https://tasktracker.app",
        "X-Title": "TaskTracker Schedule Import",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${resolvedMime};base64,${imageBase64}` },
              },
              {
                type: "text",
                text: "Extract all schedule tasks from this image and return the JSON array.",
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!apiResponse.ok) {
      const errBody = await apiResponse.text();
      console.error("[extractSchedule] OpenRouter error:", apiResponse.status, errBody);
      return res.status(502).json({
        message: `Vision API returned ${apiResponse.status}. Check OPENROUTER_API_KEY in .env.`,
        detail: errBody,
      });
    }

    const data = await apiResponse.json();
    const rawContent = data?.choices?.[0]?.message?.content || "[]";
    console.log(`[extractSchedule] Raw model response:\n${rawContent}`);

    // Strip markdown code fences if model wraps JSON in them
    const cleaned = rawContent
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    let tasks;
    try {
      tasks = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[extractSchedule] JSON parse error. Raw:", rawContent);
      return res.status(422).json({
        message: "AI returned a response that could not be parsed. Try a clearer image.",
      });
    }

    if (!Array.isArray(tasks)) {
      return res.status(422).json({
        message: "AI did not return a task list. Try a clearer schedule image.",
      });
    }

    // Sanitise and normalise
    const sanitised = tasks
      .filter((t) => t && typeof t.name === "string" && t.name.trim())
      .map((t) => ({
        name: String(t.name).trim().slice(0, 100),
        day: VALID_DAYS.includes(String(t.day).toLowerCase())
          ? String(t.day).toLowerCase()
          : "monday",
        scheduledStartTime:
          typeof t.scheduledStartTime === "string" && /^\d{2}:\d{2}$/.test(t.scheduledStartTime)
            ? t.scheduledStartTime
            : null,
        scheduledEndTime:
          typeof t.scheduledEndTime === "string" && /^\d{2}:\d{2}$/.test(t.scheduledEndTime)
            ? t.scheduledEndTime
            : null,
        plannedTime: Number.isFinite(Number(t.plannedTime)) ? Math.max(0, Number(t.plannedTime)) : 0,
        isAutomated: false,
        completionCount: 0,
        addToCalendar: false,
        reminderMinutes: 0,
      }));

    console.log(`[extractSchedule] Extracted ${sanitised.length} tasks via ${VISION_MODEL}`);
    return res.json({ tasks: sanitised, count: sanitised.length });

  } catch (err) {
    console.error("[extractSchedule] Unexpected error:", err);
    return res.status(500).json({ message: "Failed to extract schedule: " + err.message });
  }
};

module.exports = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
  extractScheduleFromImage,
};
