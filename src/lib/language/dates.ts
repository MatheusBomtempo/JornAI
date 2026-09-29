import type { DateMatch, Weekday } from "./types";

/**
 * Builds a real Date only when the day/month/year really exist ("31/02"
 * would silently roll over into March, which yields a wrong weekday).
 */
export function calendarDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Runs a global regex over the text and keeps the matches that are real dates. */
export function collectDates(
  text: string,
  re: RegExp,
  toDate: (match: RegExpMatchArray) => Date | null,
): DateMatch[] {
  const found: DateMatch[] = [];
  for (const m of text.matchAll(re)) {
    const date = toDate(m);
    if (date) found.push({ raw: m[0], date });
  }
  return found;
}

/** Name of the weekday of a date, in the pack's language. */
export function weekdayName(weekdays: Weekday[], date: Date): string {
  return weekdays[date.getDay()].name;
}
