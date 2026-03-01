// Calendar Integration Service
// Integrates with Google Calendar API for automatic event creation

import api from './api';

const calendarService = {
  /**
   * Check if Google Calendar is connected
   * @returns {Promise<{connected: boolean}>}
   */
  getStatus: async () => {
    try {
      const response = await api.get(`/api/calendar/status`);
      return response.data;
    } catch (error) {
      console.error('Error checking calendar status:', error);
      return { connected: false };
    }
  },

  /**
   * Get Google OAuth URL for connection
   * @returns {Promise<{authUrl: string}>}
   */
  getAuthUrl: async () => {
    const response = await api.get(`/api/calendar/auth-url`);
    return response.data;
  },

  /**
   * Handle OAuth callback with authorization code
   * @param {string} code - Authorization code from Google
   * @returns {Promise<{success: boolean, message: string}>}
   */
  handleCallback: async (code) => {
    const response = await api.post(`/api/calendar/callback`, { code });
    return response.data;
  },

  /**
   * Disconnect Google Calendar
   * @returns {Promise<{success: boolean}>}
   */
  disconnect: async () => {
    const response = await api.delete(`/api/calendar/disconnect`);
    return response.data;
  },

  /**
   * Create event in Google Calendar (API method - automatic)
   * @param {Object} options - Event options
   * @returns {Promise<{success: boolean, eventId: string, eventLink: string}>}
   */
  createEvent: async (options) => {
    try {
      const response = await api.post(`/api/calendar/events`, options);
      return response.data;
    } catch (error) {
      // If not connected, return special flag
      if (error.response?.data?.needsConnection) {
        return { 
          success: false, 
          needsConnection: true,
          message: error.response.data.message 
        };
      }
      throw error;
    }
  },

  /**
   * Delete event from Google Calendar
   * @param {string} eventId - Google Calendar event ID
   * @returns {Promise<{success: boolean}>}
   */
  deleteEvent: async (eventId) => {
    const response = await api.delete(`/api/calendar/events/${eventId}`);
    return response.data;
  },

  /**
   * Generate a Google Calendar event URL (fallback - opens in new tab)
   * @param {Object} options - Event options
   * @param {string} options.title - Event title
   * @param {string} options.description - Event description
   * @param {Date|string} options.date - Event date
   * @param {string} options.startTime - Start time in HH:MM format (optional)
   * @param {string} options.endTime - End time in HH:MM format (optional)
   * @param {number} options.durationMinutes - Duration in minutes (default: 30)
   * @returns {string} Google Calendar URL
   */
  generateGoogleCalendarUrl: ({
    title,
    description = "",
    date,
    startTime,
    endTime,
    durationMinutes = 30,
  }) => {
    const baseUrl = "https://calendar.google.com/calendar/render";
    
    // Parse the date
    const eventDate = new Date(date);
    
    let startDateTime, endDateTime;
    
    if (startTime && endTime) {
      // Use provided start and end times
      const [startHour, startMin] = startTime.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);
      
      startDateTime = new Date(eventDate);
      startDateTime.setHours(startHour, startMin, 0, 0);
      
      endDateTime = new Date(eventDate);
      endDateTime.setHours(endHour, endMin, 0, 0);
    } else if (startTime) {
      // Use start time with default duration
      const [startHour, startMin] = startTime.split(":").map(Number);
      
      startDateTime = new Date(eventDate);
      startDateTime.setHours(startHour, startMin, 0, 0);
      
      endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
    } else {
      // Default to current time or 2 PM (afternoon)
      startDateTime = new Date(eventDate);
      const now = new Date();
      if (eventDate.toDateString() === now.toDateString()) {
        // Today - use current time rounded to next 15 min
        const minutes = Math.ceil(now.getMinutes() / 15) * 15;
        startDateTime.setHours(now.getHours(), minutes, 0, 0);
      } else {
        // Future date - default to 2 PM (afternoon)
        startDateTime.setHours(14, 0, 0, 0);
      }
      endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
    }
    
    // Format dates for Google Calendar (YYYYMMDDTHHmmss)
    const formatDateTime = (dt) => {
      return dt.toISOString().replace(/[-:]/g, "").split(".")[0];
    };
    
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${formatDateTime(startDateTime)}/${formatDateTime(endDateTime)}`,
      details: description,
    });
    
    // Add popup reminder (minutes before)
    if (durationMinutes) {
      params.append("rem", String(durationMinutes < 60 ? 15 : 30));
    }
    
    return `${baseUrl}?${params.toString()}`;
  },

  /**
   * Open Google Calendar to add an event (fallback method)
   * @param {Object} options - Same as generateGoogleCalendarUrl
   */
  addToGoogleCalendar: (options) => {
    const url = calendarService.generateGoogleCalendarUrl(options);
    window.open(url, "_blank", "noopener,noreferrer");
  },

  /**
   * Smart add - uses API to create event silently in the background.
   * Never redirects. If not connected, calls onNeedsConnection.
   * @param {Object} options - Event options
   * @param {Function} onNeedsConnection - Callback when calendar needs connection
   * @returns {Promise<{success: boolean, method: string}>}
   */
  smartAddToCalendar: async (options, onNeedsConnection) => {
    try {
      const result = await calendarService.createEvent(options);

      if (result.needsConnection) {
        // Explicitly not connected — prompt to connect
        if (onNeedsConnection) onNeedsConnection();
        return { success: false, method: 'needs_connection' };
      }

      return { success: true, method: 'api', ...result };
    } catch (error) {
      console.error('Calendar API error:', error);
      // Only show connect prompt when the API says needsConnection (401)
      // A 500 is a server error, not a connection issue
      if (error.response?.data?.needsConnection) {
        if (onNeedsConnection) onNeedsConnection();
        return { success: false, method: 'needs_connection' };
      }
      // For all other errors, propagate so caller can show a generic error
      throw error;
    }
  },

  /**
   * Generate an ICS file content for download (works with any calendar app)
   * @param {Object} options - Event options
   * @returns {string} ICS file content
   */
  generateICSContent: ({
    title,
    description = "",
    date,
    startTime,
    endTime,
    durationMinutes = 30,
    reminderMinutes = 15,
  }) => {
    const eventDate = new Date(date);
    let startDateTime, endDateTime;
    
    if (startTime && endTime) {
      const [startHour, startMin] = startTime.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);
      
      startDateTime = new Date(eventDate);
      startDateTime.setHours(startHour, startMin, 0, 0);
      
      endDateTime = new Date(eventDate);
      endDateTime.setHours(endHour, endMin, 0, 0);
    } else if (startTime) {
      const [startHour, startMin] = startTime.split(":").map(Number);
      
      startDateTime = new Date(eventDate);
      startDateTime.setHours(startHour, startMin, 0, 0);
      
      endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
    } else {
      startDateTime = new Date(eventDate);
      // Default to 2 PM (afternoon) for future dates
      const now = new Date();
      if (eventDate.toDateString() === now.toDateString()) {
        const minutes = Math.ceil(now.getMinutes() / 15) * 15;
        startDateTime.setHours(now.getHours(), minutes, 0, 0);
      } else {
        startDateTime.setHours(14, 0, 0, 0);
      }
      endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
    }
    
    const formatICSDate = (dt) => {
      return dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };
    
    const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@tasktracker`;
    
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Task Tracker//NONSGML v1.0//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDateTime)}
DTEND:${formatICSDate(endDateTime)}
SUMMARY:${title}
DESCRIPTION:${description.replace(/\n/g, "\\n")}
BEGIN:VALARM
TRIGGER:-PT${reminderMinutes}M
ACTION:DISPLAY
DESCRIPTION:Reminder: ${title}
END:VALARM
END:VEVENT
END:VCALENDAR`;
  },

  /**
   * Download an ICS file
   * @param {Object} options - Event options
   */
  downloadICS: (options) => {
    const content = calendarService.generateICSContent(options);
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `${options.title.replace(/[^a-z0-9]/gi, "_")}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

export default calendarService;
