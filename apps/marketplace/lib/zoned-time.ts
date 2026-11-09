/**
 * Calendar arithmetic in any IANA time zone, daylight saving included.
 * Pure: takes instants, returns instants. Uses only the built-in Intl API.
 *
 * Wall-clock times that don't exist (skipped by a spring-forward change) move
 * forward by the size of the gap; times that occur twice (fall-back change)
 * resolve to the earlier instant. This matches Temporal's "compatible" rule.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    // Throws RangeError for an unknown time zone.
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function wallClock(instant: Date, timeZone: string): WallClock {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: ((instant.getTime() % 1000) + 1000) % 1000,
  };
}

/** The wall clock read as if it were UTC, in ms. */
function wallAsUtc(w: WallClock): number {
  return Date.UTC(
    w.year,
    w.month - 1,
    w.day,
    w.hour,
    w.minute,
    w.second,
    w.millisecond,
  );
}

/** The zone's offset from UTC at an instant, in ms. */
function offsetAt(ms: number, timeZone: string): number {
  return wallAsUtc(wallClock(new Date(ms), timeZone)) - ms;
}

/** The instant a wall-clock time happens in a zone (see the module note). */
function instantOf(w: WallClock, timeZone: string): Date {
  const local = wallAsUtc(w);
  const before = offsetAt(local - DAY_MS, timeZone);
  const after = offsetAt(local + DAY_MS, timeZone);
  const valid = [local - before, local - after].filter(
    (ms) => wallAsUtc(wallClock(new Date(ms), timeZone)) === local,
  );
  // Ambiguous: take the earlier. Skipped: use the offset from before the gap,
  // which lands the same distance past the gap.
  return new Date(valid.length ? Math.min(...valid) : local - before);
}

/**
 * Moves an instant by whole calendar days, keeping the same clock time in
 * `timeZone`: 10:00 on 30 March minus 3 days is 10:00 on 27 March there,
 * even when a daylight-saving change falls in between.
 */
export function addCalendarDays(
  instant: Date,
  days: number,
  timeZone: string,
): Date {
  if (!Number.isInteger(days)) {
    throw new RangeError(`Expected whole days, got ${days}`);
  }
  const w = wallClock(instant, timeZone);
  const shifted = new Date(
    Date.UTC(w.year, w.month - 1, w.day + days, w.hour, w.minute, w.second),
  );
  return instantOf(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: w.hour,
      minute: w.minute,
      second: w.second,
      millisecond: w.millisecond,
    },
    timeZone,
  );
}
