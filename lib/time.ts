/**
 * Time helpers. Timestamps are stored in UTC; every business rule (shop hours,
 * cut-offs, "today", the 3-days-before payment date) runs in Asia/Bangkok.
 *
 * This is the only module allowed to call `new Date()` for the current time.
 * Everything else asks `now()`, so tests can control the clock.
 *
 * Thailand has used a fixed UTC+7 offset with no daylight saving since 1920,
 * so plain offset arithmetic is exact here and no timezone library is needed.
 */

export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BANGKOK_OFFSET_MS = 7 * HOUR_MS;

/** The current instant. */
export function now(): Date {
  return new Date();
}

export type BangkokParts = {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
};

/** Calendar fields of an instant as seen on a clock in Bangkok. */
export function toBangkok(instant: Date): BangkokParts {
  const shifted = new Date(instant.getTime() + BANGKOK_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** The Bangkok calendar date of an instant, as "YYYY-MM-DD". */
export function bangkokDateString(instant: Date): string {
  const { year, month, day } = toBangkok(instant);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 0 = Sunday … 6 = Saturday, in Bangkok. */
export function bangkokWeekday(instant: Date): number {
  return toBangkok(instant).weekday;
}

/** The instant of 00:00 Bangkok time on the day containing `instant`. */
export function startOfBangkokDay(instant: Date): Date {
  return bangkokDateTime(bangkokDateString(instant), "00:00");
}

/** The instant of a Bangkok wall-clock time, e.g. ("2026-11-03", "10:00"). */
export function bangkokDateTime(date: string, time: string): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) {
    throw new RangeError(`Invalid Bangkok date/time: ${date} ${time}`);
  }
  const [, y, mo, d] = dateMatch.map(Number);
  const [, h, mi] = timeMatch.map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    throw new RangeError(`Invalid Bangkok date/time: ${date} ${time}`);
  }
  return new Date(utc - BANGKOK_OFFSET_MS);
}

/** Moves an instant by whole days (exact, since Bangkok has no DST). */
export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * DAY_MS);
}

/** Moves an instant by hours, e.g. for pickup and return buffers. */
export function addHours(instant: Date, hours: number): Date {
  return new Date(instant.getTime() + hours * HOUR_MS);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
