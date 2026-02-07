/**
 * Timezone Utility for Frontend
 * Automatically detects user's timezone and provides utilities for date handling
 */

// Get user's timezone from browser
export const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    // Fallback to IST if detection fails
    return "Asia/Kolkata";
  }
};

// Get timezone to send with API requests
export const getTimezoneHeader = () => {
  return { "X-Timezone": getUserTimezone() };
};

// Format a date to local YYYY-MM-DD string
export const formatLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Get current date string in user's timezone
export const getTodayString = () => {
  return formatLocalDate(new Date());
};

// Parse a date string and return a Date object
export const parseDate = (dateString) => {
  return new Date(dateString + "T00:00:00");
};

const timezoneUtils = {
  getUserTimezone,
  getTimezoneHeader,
  formatLocalDate,
  getTodayString,
  parseDate,
};

export default timezoneUtils;
