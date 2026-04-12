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

const toDateString = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const nextWeekday = (baseDate, weekdayIndex, includeToday = false) => {
  const result = new Date(baseDate);
  const currentDay = result.getDay();
  let delta = weekdayIndex - currentDay;

  if (delta < 0 || (!includeToday && delta === 0)) {
    delta += 7;
  }

  return addDays(result, delta);
};

const parseDeadlineDate = (prompt, baseDate = new Date()) => {
  const text = prompt.toLowerCase();

  if (/\bday after tomorrow\b/.test(text)) {
    return toDateString(addDays(baseDate, 2));
  }

  if (/\btomorrow\b/.test(text)) {
    return toDateString(addDays(baseDate, 1));
  }

  if (/\btoday\b/.test(text)) {
    return toDateString(baseDate);
  }

  const relativeMatch = text.match(
    /\b(?:next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );

  if (relativeMatch) {
    const weekdayIndex = WEEKDAYS.indexOf(relativeMatch[1]);
    const isThis = text.includes("this ");
    return toDateString(nextWeekday(baseDate, weekdayIndex, isThis));
  }

  const inDaysMatch = text.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDaysMatch) {
    return toDateString(addDays(baseDate, parseInt(inDaysMatch[1], 10)));
  }

  const explicitDateMatch = text.match(
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b|\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,
  );

  if (explicitDateMatch) {
    if (explicitDateMatch[1]) {
      const year = parseInt(explicitDateMatch[1], 10);
      const month = parseInt(explicitDateMatch[2], 10);
      const day = parseInt(explicitDateMatch[3], 10);
      const candidate = new Date(year, month - 1, day);
      if (!Number.isNaN(candidate.getTime())) {
        return toDateString(candidate);
      }
    } else {
      const month = parseInt(explicitDateMatch[4], 10);
      const day = parseInt(explicitDateMatch[5], 10);
      const year = explicitDateMatch[6]
        ? parseInt(explicitDateMatch[6], 10)
        : baseDate.getFullYear();
      const normalizedYear = year < 100 ? 2000 + year : year;
      const candidate = new Date(normalizedYear, month - 1, day);
      if (!Number.isNaN(candidate.getTime())) {
        return toDateString(candidate);
      }
    }
  }

  return null;
};

const stripDeadlinePhrases = (prompt) =>
  prompt
    .replace(/\bday after tomorrow\b/gi, "")
    .replace(/\btomorrow\b/gi, "")
    .replace(/\btoday\b/gi, "")
    .replace(
      /\b(?:next|this)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
      "",
    )
    .replace(/\bin\s+\d+\s+days?\b/gi, "")
    .replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/gi, "")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, "")
    .replace(/\bby\b/gi, " ");

const stripLeadIn = (prompt) =>
  prompt
    .replace(
      /^\s*(remind me to|remind me|add a todo to|add todo to|add todo|create todo|create a todo|todo|task|please|i need to|need to)\s+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

const parseTodoPrompt = (prompt) => {
  const normalized = (prompt || "").trim();
  if (!normalized) {
    return { text: "", deadline: "" };
  }

  const deadline = parseDeadlineDate(normalized);
  const textOnly = stripLeadIn(stripDeadlinePhrases(normalized))
    .replace(/\s+/g, " ")
    .trim();

  return {
    text: textOnly,
    deadline: deadline || "",
  };
};

export { parseTodoPrompt, parseDeadlineDate, toDateString };
