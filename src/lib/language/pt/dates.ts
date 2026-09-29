import { calendarDate, collectDates } from "../dates";
import type { DateMatch, Weekday } from "../types";

// Sunday first, to match Date#getDay().
export const WEEKDAYS: Weekday[] = [
  { name: "domingo", sourceStem: "domingo", pattern: /\bdomingo\b/i },
  { name: "segunda-feira", sourceStem: "segunda", pattern: /\bsegunda(-feira)?\b/i },
  { name: "terça-feira", sourceStem: "terça", pattern: /\bterça(-feira)?\b/i },
  { name: "quarta-feira", sourceStem: "quarta", pattern: /\bquarta(-feira)?\b/i },
  { name: "quinta-feira", sourceStem: "quinta", pattern: /\bquinta(-feira)?\b/i },
  { name: "sexta-feira", sourceStem: "sexta", pattern: /\bsexta(-feira)?\b/i },
  { name: "sábado", sourceStem: "sábado", pattern: /\bsábado\b/i },
];

/** dd/mm/yyyy — the only date format Brazilian documents use. */
export function findDates(text: string): DateMatch[] {
  return collectDates(text, /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m) =>
    calendarDate(Number(m[3]), Number(m[2]), Number(m[1])),
  );
}

export function weekdayLine(rawDate: string, weekday: string): string {
  return `Dia da semana de ${rawDate} (calculado automaticamente — use este, não calcule): ${weekday}`;
}
