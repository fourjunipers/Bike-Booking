/**
 * Calendar dates in a shop's time zone, for labels like "Today" and
 * "Tomorrow". Any IANA zone, daylight saving included: the date is read in
 * the zone, then stepped as a calendar date (not by adding 24 hours).
 */

export type CalendarDate = { year: number; month: number; day: number };

/** The calendar date at `instant` in `timeZone`. */
export function dateInZone(instant: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** The date `days` calendar days after `date`. */
export function addCalendarDays(
  date: CalendarDate,
  days: number,
): CalendarDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

/** "Monday 10 November" style label in the viewer's locale. */
export function formatCalendarDate(date: CalendarDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
}
