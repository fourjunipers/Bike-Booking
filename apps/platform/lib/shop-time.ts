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

/** The wall-clock parts of `instant` in `timeZone`. */
function wallClock(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** `instant` as a `datetime-local` value ("2026-11-10T09:30") in `timeZone`. */
export function toLocalInput(instant: Date, timeZone: string): string {
  const w = wallClock(instant, timeZone);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/**
 * The instant a wall-clock time ("2026-11-10T09:30") happens in `timeZone`,
 * or null if the text isn't one. Daylight saving is handled without a fixed
 * offset: a time skipped by a spring-forward change moves forward by the gap,
 * and a repeated one takes the earlier instant.
 */
export function fromLocalInput(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wanted);
  if (
    check.getUTCDate() !== day ||
    check.getUTCMonth() !== month - 1 ||
    hour > 23 ||
    minute > 59
  )
    return null;
  const asUtc = (guess: number) => {
    const w = wallClock(new Date(guess), timeZone);
    return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  };
  // The zone's offset a day before and a day after; they differ only when a
  // clock change falls in between.
  const oneDay = 24 * 60 * 60 * 1000;
  const before = asUtc(wanted - oneDay) - (wanted - oneDay);
  const after = asUtc(wanted + oneDay) - (wanted + oneDay);
  const candidates = [wanted - before, wanted - after].filter(
    (c) => asUtc(c) === wanted,
  );
  if (candidates.length > 0) return new Date(Math.min(...candidates));
  // Skipped by a clock change: read it with the offset from before the change,
  // which lands the same distance past the gap.
  return new Date(wanted - before);
}

/** A date and time in `timeZone`, in the viewer's locale. */
export function formatInstant(
  instant: Date,
  timeZone: string,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(instant);
}
