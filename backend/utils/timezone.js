/**
 * Timezone Utility Module
 * Uses Luxon for timezone-aware date handling
 * 
 * This module provides consistent timezone handling across the application.
 * The timezone is detected from the client and passed via request headers.
 */

const { DateTime } = require("luxon");

// Default timezone (used if client doesn't send timezone)
const DEFAULT_TIMEZONE = "Asia/Kolkata"; // IST

/**
 * Get timezone from request headers or use default
 * @param {Request} req - Express request object
 * @returns {string} - IANA timezone string (e.g., "Asia/Kolkata")
 */
const getTimezoneFromRequest = (req) => {
  return req.headers["x-timezone"] || req.query.timezone || DEFAULT_TIMEZONE;
};

/**
 * Get current date string in user's timezone (YYYY-MM-DD format)
 * @param {string} timezone - IANA timezone string
 * @returns {string} - Date string in YYYY-MM-DD format
 */
const getTodayString = (timezone = DEFAULT_TIMEZONE) => {
  return DateTime.now().setZone(timezone).toFormat("yyyy-MM-dd");
};

/**
 * Get current DateTime in user's timezone
 * @param {string} timezone - IANA timezone string
 * @returns {DateTime} - Luxon DateTime object
 */
const getNow = (timezone = DEFAULT_TIMEZONE) => {
  return DateTime.now().setZone(timezone);
};

/**
 * Convert a date to the user's timezone and return as YYYY-MM-DD string
 * @param {Date|string} date - JavaScript Date or ISO string
 * @param {string} timezone - IANA timezone string
 * @returns {string} - Date string in YYYY-MM-DD format
 */
const dateToString = (date, timezone = DEFAULT_TIMEZONE) => {
  return DateTime.fromJSDate(new Date(date)).setZone(timezone).toFormat("yyyy-MM-dd");
};

/**
 * Parse a date string in user's timezone and return JS Date (for MongoDB)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {string} timezone - IANA timezone string
 * @returns {Date} - JavaScript Date object
 */
const parseDate = (dateString, timezone = DEFAULT_TIMEZONE) => {
  return DateTime.fromISO(dateString, { zone: timezone }).toJSDate();
};

/**
 * Get start and end of day in user's timezone
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {string} timezone - IANA timezone string
 * @returns {Object} - { startOfDay: Date, endOfDay: Date }
 */
const getDayBounds = (dateString, timezone = DEFAULT_TIMEZONE) => {
  const dt = DateTime.fromISO(dateString, { zone: timezone });
  return {
    startOfDay: dt.startOf("day").toJSDate(),
    endOfDay: dt.endOf("day").toJSDate(),
  };
};

/**
 * Get week dates for a given year, month, and week number
 * Week 1 = days 1-7, Week 2 = days 8-14, etc.
 * @param {number} year 
 * @param {number} month - 0-indexed (0 = January)
 * @param {number} weekNumber 
 * @param {string} timezone 
 * @returns {Object} - { startDate: Date, endDate: Date }
 */
const getWeekDates = (year, month, weekNumber, timezone = DEFAULT_TIMEZONE) => {
  const startDay = 1 + (weekNumber - 1) * 7;
  
  // Create start date at beginning of day
  const startDt = DateTime.fromObject(
    { year, month: month + 1, day: startDay },
    { zone: timezone }
  ).startOf("day");
  
  // Create end date at end of day (6 days later)
  const endDt = DateTime.fromObject(
    { year, month: month + 1, day: startDay + 6 },
    { zone: timezone }
  ).endOf("day");
  
  return {
    startDate: startDt.toJSDate(),
    endDate: endDt.toJSDate(),
  };
};

/**
 * Get day name from a date
 * @param {Date|string} date 
 * @param {string} timezone 
 * @returns {string} - Lowercase day name (e.g., "monday")
 */
const getDayName = (date, timezone = DEFAULT_TIMEZONE) => {
  const dt = DateTime.fromJSDate(new Date(date)).setZone(timezone);
  return dt.toFormat("cccc").toLowerCase();
};

/**
 * Check if a date is today in the given timezone
 * @param {Date|string} date 
 * @param {string} timezone 
 * @returns {boolean}
 */
const isToday = (date, timezone = DEFAULT_TIMEZONE) => {
  const today = getTodayString(timezone);
  const dateStr = dateToString(date, timezone);
  return today === dateStr;
};

/**
 * Check if a date is in the past (before today) in the given timezone
 * @param {Date|string} date 
 * @param {string} timezone 
 * @returns {boolean}
 */
const isPast = (date, timezone = DEFAULT_TIMEZONE) => {
  const today = DateTime.now().setZone(timezone).startOf("day");
  const checkDate = DateTime.fromJSDate(new Date(date)).setZone(timezone).startOf("day");
  return checkDate < today;
};

/**
 * Check if a date is today or in the past
 * @param {Date|string} date 
 * @param {string} timezone 
 * @returns {boolean}
 */
const isTodayOrPast = (date, timezone = DEFAULT_TIMEZONE) => {
  return isToday(date, timezone) || isPast(date, timezone);
};

/**
 * Create a date with specific time in user's timezone
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {number} hour 
 * @param {number} minute 
 * @param {string} timezone 
 * @returns {Date}
 */
const createDateTime = (dateString, hour, minute, timezone = DEFAULT_TIMEZONE) => {
  return DateTime.fromISO(dateString, { zone: timezone })
    .set({ hour, minute, second: 0, millisecond: 0 })
    .toJSDate();
};

/**
 * Format duration in milliseconds to human readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - e.g., "2h 30m"
 */
const formatDuration = (ms) => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

module.exports = {
  DEFAULT_TIMEZONE,
  getTimezoneFromRequest,
  getTodayString,
  getNow,
  dateToString,
  parseDate,
  getDayBounds,
  getWeekDates,
  getDayName,
  isToday,
  isPast,
  isTodayOrPast,
  createDateTime,
  formatDuration,
};
