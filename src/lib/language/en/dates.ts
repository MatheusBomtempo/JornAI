import { calendarDate, collectDates } from "../dates";
import type { DateMatch, Weekday } from "../types";

// Sunday first, to match Date#getDay().
export const WEEKDAYS: Weekday[] = [
  { name: "sunday", sourceStem: "sunday", pattern: /\bsunday\b/i },
  { name: "monday", sourceStem: "monday", pattern: /\bmonday\b/i },
  { name: "tuesday", sourceStem: "tuesday", pattern: /\btuesday\b/i },
  { name: "wednesday", sourceStem: "wednesday", pattern: /\bwednesday\b/i },
  { name: "thursday", sourceStem: "thursday", pattern: /\bthursday\b/i },
  { name: "friday", sourceStem: "friday", pattern: /\bfriday\b/i },
  { name: "saturday", sourceStem: "saturday", pattern: /\bsaturday\b/i },
];

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function monthNumber(name: string): number {
  const key = name.toLowerCase().replace(/\.$/, "");
  return MONTHS.findIndex((m) => m === key || m.slice(0, 3) === key.slice(0, 3)) + 1;
}

const MONTH_NAME = "(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?";

/**
 * The date formats an English-language source usually carries:
 *   - 08/19/2026 (US month/day/year — day-first is ambiguous, so not read)
 *   - 2026-08-19 (ISO)
 *   - August 19, 2026 / Aug. 19 2026
 *   - 19 August 2026
 */
export function findDates(text: string): DateMatch[] {
  return [
    ...collectDates(text, /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m) =>
      calendarDate(Number(m[3]), Number(m[1]), Number(m[2])),
    ),
    ...collectDates(text, /\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) =>
      calendarDate(Number(m[1]), Number(m[2]), Number(m[3])),
    ),
    ...collectDates(
      text,
      new RegExp(`\\b${MONTH_NAME}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"),
      (m) => calendarDate(Number(m[3]), monthNumber(m[1]), Number(m[2])),
    ),
    ...collectDates(
      text,
      new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_NAME},?\\s+(\\d{4})\\b`, "gi"),
      (m) => calendarDate(Number(m[3]), monthNumber(m[2]), Number(m[1])),
    ),
  ];
}

export function weekdayLine(rawDate: string, weekday: string): string {
  return `Day of the week for ${rawDate} (computed automatically — use this, do not compute it yourself): ${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
}
