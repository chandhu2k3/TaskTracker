const { DateTime } = require("luxon");

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const pad = (value) => String(value).padStart(2, "0");

const toDateString = (dateTime) =>
  `${dateTime.year}-${pad(dateTime.month)}-${pad(dateTime.day)}`;

const normalizePrompt = (prompt) => (prompt || "").trim().replace(/\s+/g, " ");

const addDays = (dateTime, days) => dateTime.plus({ days });

const getNextWeekday = (baseDateTime, weekdayName, includeToday = false) => {
  const targetIndex = WEEKDAYS.indexOf(weekdayName);
  if (targetIndex < 0) return null;

  const currentIndex = baseDateTime.weekday % 7;
  let delta = targetIndex - currentIndex;
  if (delta < 0 || (!includeToday && delta === 0)) {
    delta += 7;
  }
  return baseDateTime.plus({ days: delta });
};

const parseDateReference = (prompt, timezone, baseDate = null) => {
  const text = normalizePrompt(prompt).toLowerCase();
  const base = baseDate
    ? DateTime.fromISO(baseDate, { zone: timezone }).startOf("day")
    : DateTime.now().setZone(timezone).startOf("day");

  if (/\bday after tomorrow\b/.test(text))
    return toDateString(addDays(base, 2));
  if (/\btomorrow\b/.test(text)) return toDateString(addDays(base, 1));
  if (/\btoday\b/.test(text)) return toDateString(base);

  const weekdayMatch = text.match(
    /\b(?:next|this)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (weekdayMatch) {
    const includeToday = /\bthis\s+/.test(text);
    const dateTime = getNextWeekday(base, weekdayMatch[1], includeToday);
    if (dateTime) return toDateString(dateTime);
  }

  const inDaysMatch = text.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDaysMatch) {
    return toDateString(addDays(base, parseInt(inDaysMatch[1], 10)));
  }

  const isoMatch = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const candidate = DateTime.fromObject(
      {
        year: parseInt(isoMatch[1], 10),
        month: parseInt(isoMatch[2], 10),
        day: parseInt(isoMatch[3], 10),
      },
      { zone: timezone },
    );
    if (candidate.isValid) return toDateString(candidate);
  }

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10);
    const day = parseInt(slashMatch[2], 10);
    const rawYear = slashMatch[3] ? parseInt(slashMatch[3], 10) : base.year;
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const candidate = DateTime.fromObject(
      { year, month, day },
      { zone: timezone },
    );
    if (candidate.isValid) return toDateString(candidate);
  }

  return null;
};

const parseDurationMinutes = (prompt) => {
  const text = normalizePrompt(prompt).toLowerCase();
  let minutes = 0;
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/);
  const minuteMatch = text.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/);

  if (hourMatch) {
    minutes += Math.round(parseFloat(hourMatch[1]) * 60);
  }
  if (minuteMatch) {
    minutes += parseInt(minuteMatch[1], 10);
  }
  return minutes > 0 ? minutes : 0;
};

const parseTimeRange = (prompt) => {
  const text = normalizePrompt(prompt).toLowerCase();

  const rangeMatch = text.match(
    /(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/,
  );
  if (rangeMatch) {
    const start = normalizeTime(
      parseInt(rangeMatch[1], 10),
      rangeMatch[2],
      rangeMatch[3],
    );
    const end = normalizeTime(
      parseInt(rangeMatch[4], 10),
      rangeMatch[5],
      rangeMatch[6],
    );
    return { scheduledStartTime: start, scheduledEndTime: end };
  }

  const singleMatch = text.match(
    /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/,
  );
  if (singleMatch) {
    return {
      scheduledStartTime: normalizeTime(
        parseInt(singleMatch[1], 10),
        singleMatch[2],
        singleMatch[3],
      ),
      scheduledEndTime: null,
    };
  }

  return { scheduledStartTime: null, scheduledEndTime: null };
};

const normalizeTime = (hour, minutePart, meridiem) => {
  let adjustedHour = hour;
  const minute = minutePart ? parseInt(minutePart, 10) : 0;

  if (meridiem) {
    const marker = meridiem.toLowerCase();
    if (marker === "pm" && adjustedHour < 12) adjustedHour += 12;
    if (marker === "am" && adjustedHour === 12) adjustedHour = 0;
  }

  return `${pad(adjustedHour)}:${pad(minute)}`;
};

const pickCategory = (prompt, categories = []) => {
  const text = normalizePrompt(prompt).toLowerCase();
  const match = categories.find((category) =>
    text.includes((category.name || "").toLowerCase()),
  );
  return match || categories[0] || null;
};

const stripCommandWords = (prompt) => {
  return normalizePrompt(prompt)
    .replace(
      /^(please\s+)?(add|create|make|set|new|plan|remind me to|remind me|write|log)\s+(a\s+)?(task|todo|deadline|reminder|template)\s*/i,
      "",
    )
    .replace(/\b(?:to|into|in)\s+template\s+[a-z0-9\s-]+/gi, " ")
    .replace(/\btemplate\s+[a-z0-9\s-]+/gi, " ")
    .replace(/\b(?:today|tomorrow|day after tomorrow)\b/gi, " ")
    .replace(
      /\b(?:next|this)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
      " ",
    )
    .replace(
      /\b(?:on|for|by|at)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
      " ",
    )
    .replace(/\bin\s+\d+\s+days?\b/gi, " ")
    .replace(/\b(?:from|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, " ")
    .replace(/\b(?:to|until|till|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, " ")
    .replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/gi, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours)\b/gi, " ")
    .replace(/\b\d+\s*(?:m|min|mins|minute|minutes)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const extractTemplateName = (prompt) => {
  const text = normalizePrompt(prompt);
  const match = text.match(/template\s+([\w\s-]+)/i);
  if (match) {
    return match[1].trim().replace(/\s+(?:to|with|on|for|and).*$/i, "");
  }
  const toMatch = text.match(/(?:to|into|in)\s+([\w\s-]+?)\s+template/i);
  if (toMatch) return toMatch[1].trim();
  return null;
};

const extractDay = (prompt, timezone, baseDate = null) => {
  const text = normalizePrompt(prompt).toLowerCase();
  const weekdayMatch = text.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (weekdayMatch) return weekdayMatch[1];

  const dateString = parseDateReference(prompt, timezone, baseDate);
  if (!dateString) return null;
  return DateTime.fromISO(dateString, { zone: timezone })
    .toFormat("cccc")
    .toLowerCase();
};

const parseTitle = (prompt) => {
  const stripped = stripCommandWords(prompt);
  return stripped || normalizePrompt(prompt);
};

module.exports = {
  WEEKDAYS,
  parseDateReference,
  parseDurationMinutes,
  parseTimeRange,
  pickCategory,
  stripCommandWords,
  extractTemplateName,
  extractDay,
  parseTitle,
  normalizePrompt,
  toDateString,
};
