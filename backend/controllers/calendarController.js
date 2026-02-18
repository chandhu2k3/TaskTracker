const { google } = require('googleapis');
const User = require('../models/User');
const Task = require('../models/Task');
const { cacheKey, getCache, setCache, invalidateCache } = require('../config/redis');

// Google OAuth2 Client
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/calendar/callback`
  );
};

// Scopes required for Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// @desc    Get Google OAuth URL
// @route   GET /api/calendar/auth-url
// @access  Private
exports.getAuthUrl = async (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: req.user._id.toString(), // Pass user ID to callback
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ message: 'Failed to generate authentication URL' });
  }
};

// @desc    Handle Google OAuth callback
// @route   POST /api/calendar/callback
// @access  Private
exports.handleCallback = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Authorization code required' });
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Update user with Google tokens
    await User.findByIdAndUpdate(req.user._id, {
      'googleCalendar.connected': true,
      'googleCalendar.accessToken': tokens.access_token,
      'googleCalendar.refreshToken': tokens.refresh_token,
      'googleCalendar.tokenExpiry': new Date(tokens.expiry_date),
    });

    await invalidateCache(`user:${req.user._id}:calendar*`);
    res.json({ 
      success: true, 
      message: 'Google Calendar connected successfully!' 
    });
  } catch (error) {
    console.error('Error handling callback:', error);
    res.status(500).json({ message: 'Failed to connect Google Calendar' });
  }
};

// @desc    Check calendar connection status
// @route   GET /api/calendar/status
// @access  Private
exports.getStatus = async (req, res) => {
  try {
    const key = cacheKey(req.user._id, "calendar:status");
    const cached = await getCache(key);
    if (cached) return res.json(cached);

    const user = await User.findById(req.user._id).select('+googleCalendar.connected +googleCalendar.tokenExpiry');
    
    const status = {
      connected: user.googleCalendar?.connected || false,
      tokenExpiry: user.googleCalendar?.tokenExpiry,
    };

    await setCache(key, status, 60); // 60 seconds TTL
    res.json(status);
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ message: 'Failed to get calendar status' });
  }
};

// @desc    Disconnect Google Calendar
// @route   DELETE /api/calendar/disconnect
// @access  Private
exports.disconnect = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      'googleCalendar.connected': false,
      'googleCalendar.accessToken': null,
      'googleCalendar.refreshToken': null,
      'googleCalendar.tokenExpiry': null,
    });

    res.json({ success: true, message: 'Google Calendar disconnected' });
  } catch (error) {
    console.error('Error disconnecting:', error);
    res.status(500).json({ message: 'Failed to disconnect calendar' });
  }
};

// Helper function to get authenticated calendar client
const getCalendarClient = async (userId) => {
  const user = await User.findById(userId).select('+googleCalendar.accessToken +googleCalendar.refreshToken +googleCalendar.tokenExpiry');
  
  if (!user.googleCalendar?.connected || !user.googleCalendar?.accessToken) {
    throw new Error('Google Calendar not connected');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.googleCalendar.accessToken,
    refresh_token: user.googleCalendar.refreshToken,
    expiry_date: user.googleCalendar.tokenExpiry?.getTime(),
  });

  // Handle token refresh
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

// @desc    Create calendar event
// @route   POST /api/calendar/events
// @access  Private
exports.createEvent = async (req, res) => {
  try {
    const { title, description, date, startTime, endTime, durationMinutes = 30, reminderMinutes, taskId } = req.body;

    if (!title || !date) {
      return res.status(400).json({ message: 'Title and date are required' });
    }

    // Duplicate check: if taskId provided, check if task already has a calendar event
    if (taskId) {
      const existingTask = await Task.findOne({ _id: taskId, user: req.user._id });
      if (existingTask && existingTask.calendarEventId) {
        // Verify the event still exists in Google Calendar
        try {
          const calendar = await getCalendarClient(req.user._id);
          const existing = await calendar.events.get({
            calendarId: 'primary',
            eventId: existingTask.calendarEventId,
          });
          if (existing.data && existing.data.status !== 'cancelled') {
            return res.json({
              success: true,
              eventId: existingTask.calendarEventId,
              eventLink: existing.data.htmlLink,
              message: 'Event already exists in Google Calendar!',
              duplicate: true,
            });
          }
        } catch (checkErr) {
          // Event was deleted from Google Calendar - clear stale reference and recreate
          console.log('Previous calendar event not found, creating new one');
          existingTask.calendarEventId = null;
          await existingTask.save();
        }
      }
    }

    const calendar = await getCalendarClient(req.user._id);
    
    // Parse date and times
    const eventDate = new Date(date);
    let startDateTime, endDateTime;

    if (startTime && endTime) {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      startDateTime = new Date(eventDate);
      startDateTime.setHours(startHour, startMin, 0, 0);
      
      endDateTime = new Date(eventDate);
      endDateTime.setHours(endHour, endMin, 0, 0);
    } else if (startTime) {
      const [startHour, startMin] = startTime.split(':').map(Number);
      
      startDateTime = new Date(eventDate);
      startDateTime.setHours(startHour, startMin, 0, 0);
      
      endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
    } else {
      // Default to 9 AM if no time specified
      startDateTime = new Date(eventDate);
      startDateTime.setHours(9, 0, 0, 0);
      endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
    }

    const event = {
      summary: title,
      description: description || 'Task from Task Tracker Pro',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      reminders: reminderMinutes && reminderMinutes > 0
        ? {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: reminderMinutes },
            ],
          }
        : { useDefault: true },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    // Store the calendar event ID on the task to prevent duplicates
    if (taskId) {
      await Task.findByIdAndUpdate(taskId, { calendarEventId: response.data.id });
    }

    res.json({
      success: true,
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      message: 'Event created in Google Calendar!',
    });
  } catch (error) {
    console.error('Error creating event:', error);
    
    if (error.message === 'Google Calendar not connected') {
      return res.status(401).json({ 
        message: 'Google Calendar not connected. Please connect your calendar first.',
        needsConnection: true 
      });
    }
    
    res.status(500).json({ message: 'Failed to create calendar event' });
  }
};

// @desc    Delete calendar event
// @route   DELETE /api/calendar/events/:eventId
// @access  Private
exports.deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const calendar = await getCalendarClient(req.user._id);
    
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    res.json({ success: true, message: 'Event deleted from calendar' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Failed to delete calendar event' });
  }
};
