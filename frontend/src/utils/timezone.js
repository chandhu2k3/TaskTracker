import { DateTime } from "luxon";

/**
 * Timezone Utility for Frontend
 * Automatically detects user's timezone and provides utilities for date handling
 */

// Get user's timezone from browser
export const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch (e) {
    return "Asia/Kolkata";
  }
};

// Get timezone to send with API requests
export const getTimezoneHeader = () => {
  return { "X-Timezone": getUserTimezone() };
};

/**
 * Convert an ISO date string (from server) to a local YYYY-MM-DD string
 * @param {string|Date} date - ISO string or Date object
 * @returns {string} - YYYY-MM-DD
 */
export const formatLocalDate = (date) => {
  if (!date) return DateTime.now().setZone(getUserTimezone()).toFormat("yyyy-MM-dd");
  
  if (typeof date === "string") {
    // Handle both ISO strings and simple YYYY-MM-DD
    if (date.includes("T")) {
      return DateTime.fromISO(date).setZone(getUserTimezone()).toFormat("yyyy-MM-dd");
    }
    return date;
  }
  
  return DateTime.fromJSDate(date).setZone(getUserTimezone()).toFormat("yyyy-MM-dd");
};

// Get current date string in user's timezone
export const getTodayString = () => {
  return DateTime.now().setZone(getUserTimezone()).toFormat("yyyy-MM-dd");
};

// Parse a YYYY-MM-DD string and return a local Date object at midnight
export const parseDate = (dateString) => {
  return DateTime.fromISO(dateString, { zone: getUserTimezone() }).toJSDate();
};

const timezoneUtils = {
  getUserTimezone,
  getTimezoneHeader,
  formatLocalDate,
  getTodayString,
  parseDate,
};

export default timezoneUtils;
