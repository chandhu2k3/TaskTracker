const TaskTemplate = require("../models/TaskTemplate");
const Task = require("../models/Task");
const { google } = require('googleapis');
const User = require('../models/User');
const { cacheKey, getCache, setCache, invalidateCache, TTL } = require("../config/redis");

// Helper: get authenticated Google Calendar client
const getCalendarClient = async (userId) => {
  const user = await User.findById(userId).select('+googleCalendar.accessToken +googleCalendar.refreshToken +googleCalendar.tokenExpiry');
  
  if (!user.googleCalendar?.connected || !user.googleCalendar?.accessToken) {
    return null; // Not connected — skip calendar silently
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/calendar/callback`
  );
  oauth2Client.setCredentials({
    access_token: user.googleCalendar.accessToken,
    refresh_token: user.googleCalendar.refreshToken,
    expiry_date: user.googleCalendar.tokenExpiry?.getTime(),
  });

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await User.findByIdAndUpdate(userId, {
        'googleCalendar.accessToken': tokens.access_token,
        'googleCalendar.tokenExpiry': new Date(tokens.expiry_date),
      });
    }
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
};

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
    const key = cacheKey(req.user._id, "templates");
    const cached = await getCache(key);
    if (cached) return res.json(cached);

    const templates = await TaskTemplate.find({ user: req.user._id }).sort({
      createdAt: -1,
    }).lean();
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

    // Calculate week dates (Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-end)
    // Always 4 weeks per month
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

    // Get calendar client once if any task needs calendar
    const hasCalendarTasks = template.tasks.some(t => t.addToCalendar);
    let calendarClient = null;
    if (hasCalendarTasks) {
      calendarClient = await getCalendarClient(req.user._id);
    }

    const createdTasks = [];
    let calendarEventsCreated = 0;

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

        // Auto-add to Google Calendar if enabled (skip if already has event)
        if (templateTask.addToCalendar && calendarClient && existing.scheduledStartTime && !existing.calendarEventId) {
          try {
            const taskDateObj = new Date(dateStr);
            const [sh, sm] = existing.scheduledStartTime.split(':').map(Number);
            const startDt = new Date(taskDateObj); startDt.setHours(sh, sm, 0, 0);
            let endDt;
            if (existing.scheduledEndTime) {
              const [eh, em] = existing.scheduledEndTime.split(':').map(Number);
              endDt = new Date(taskDateObj); endDt.setHours(eh, em, 0, 0);
            } else {
              endDt = new Date(startDt.getTime() + (existing.plannedTime || 30 * 60000));
            }
            const reminderMins = templateTask.reminderMinutes || 0;
            const calResponse = await calendarClient.events.insert({
              calendarId: 'primary',
              resource: {
                summary: `📋 ${existing.name}`,
                description: `Task from Task Tracker Pro template: ${template.name}`,
                start: { dateTime: startDt.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                end: { dateTime: endDt.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                reminders: reminderMins > 0
                  ? { useDefault: false, overrides: [{ method: 'popup', minutes: reminderMins }] }
                  : { useDefault: true },
              },
            });
            existing.calendarEventId = calResponse.data.id;
            await existing.save();
            calendarEventsCreated++;
          } catch (calErr) { console.error('Calendar event create failed for updated task:', calErr.message); }
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
            console.log("Task already exists (concurrent request), fetching existing...");
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

        // Auto-add to Google Calendar if enabled (skip if already has event)
        if (templateTask.addToCalendar && calendarClient && newTask.scheduledStartTime && !newTask.calendarEventId) {
          try {
            const taskDateObj2 = new Date(dateStr);
            const [sh2, sm2] = newTask.scheduledStartTime.split(':').map(Number);
            const startDt2 = new Date(taskDateObj2); startDt2.setHours(sh2, sm2, 0, 0);
            let endDt2;
            if (newTask.scheduledEndTime) {
              const [eh2, em2] = newTask.scheduledEndTime.split(':').map(Number);
              endDt2 = new Date(taskDateObj2); endDt2.setHours(eh2, em2, 0, 0);
            } else {
              endDt2 = new Date(startDt2.getTime() + (newTask.plannedTime || 30 * 60000));
            }
            const reminderMins2 = templateTask.reminderMinutes || 0;
            const calResponse2 = await calendarClient.events.insert({
              calendarId: 'primary',
              resource: {
                summary: `📋 ${newTask.name}`,
                description: `Task from Task Tracker Pro template: ${template.name}`,
                start: { dateTime: startDt2.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                end: { dateTime: endDt2.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                reminders: reminderMins2 > 0
                  ? { useDefault: false, overrides: [{ method: 'popup', minutes: reminderMins2 }] }
                  : { useDefault: true },
              },
            });
            newTask.calendarEventId = calResponse2.data.id;
            await newTask.save();
            calendarEventsCreated++;
          } catch (calErr) { console.error('Calendar event create failed for new task:', calErr.message); }
        }
      }
    }

    await invalidateCache(`user:${req.user._id}:tasks*`);
    await invalidateCache(`user:${req.user._id}:analytics*`);

    res.json({
      message: `Applied template with ${createdTasks.length} tasks${calendarEventsCreated > 0 ? ` (${calendarEventsCreated} calendar events created)` : ''}`,
      tasks: createdTasks,
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
