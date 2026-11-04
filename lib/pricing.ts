/**
 * Day-price tables (SPEC "Pricing"). Pure functions, whole baht only.
 *
 * A vendor sets up to five anchor totals (days 1, 7, 14, 21, 30). Every day in
 * between is filled at equal steps, rounded to the nearest ฿10. A day the
 * vendor edits by hand is "manual" and is never overwritten by the fill.
 *
 * Bike models need the day-1 and day-30 anchors. Time-based shop extras use
 * the same rule with a required day-1 price and optional day-7 and day-30
 * prices, so the fill also handles a table whose last anchor is before day 30.
 */

import { assertWholeBaht } from "./money";

export const ANCHOR_DAYS = [1, 7, 14, 21, 30] as const;
export type AnchorDay = (typeof ANCHOR_DAYS)[number];

/** Anchor totals by day. Missing or undefined = not set. */
export type Anchors = Partial<Record<AnchorDay, number>>;

/** Hand-edited totals by day (2–30, never an anchor day). */
export type ManualDays = Partial<Record<number, number>>;

export const TABLE_DAYS = 30;

export type DayPrice = {
  day: number;
  total: number;
  isAnchor: boolean;
  isManual: boolean;
};

export type PricingWarning =
  | { kind: "cheaper_than_shorter"; day: number; shorterDay: number }
  | { kind: "below_day_one"; day: number };

function isAnchorDay(day: number): day is AnchorDay {
  return (ANCHOR_DAYS as readonly number[]).includes(day);
}

function assertPrice(total: number, what: string): void {
  assertWholeBaht(total);
  if (total <= 0)
    throw new RangeError(`${what} must be more than ฿0, got ${total}`);
}

/** The anchors that are set, in day order. Throws on bad values. */
function setAnchors(anchors: Anchors): Array<[AnchorDay, number]> {
  const set: Array<[AnchorDay, number]> = [];
  for (const day of ANCHOR_DAYS) {
    const total = anchors[day];
    if (total === undefined) continue;
    assertPrice(total, `Day-${day} price`);
    set.push([day, total]);
  }
  if (set[0]?.[0] !== 1) throw new RangeError("The day-1 price is required");
  return set;
}

/**
 * a + (b − a) × (d − da) ÷ (db − da), rounded to the nearest ฿10 (halves round
 * up). Integer arithmetic only, so there are no floating-point surprises.
 */
function interpolate(
  da: number,
  a: number,
  db: number,
  b: number,
  d: number,
): number {
  const span = db - da;
  const numerator = a * span + (b - a) * (d - da);
  return Math.floor((numerator + 5 * span) / (10 * span)) * 10;
}

/**
 * Past the last anchor (extras only): continue at that anchor's daily rate.
 * With only a day-1 price this is exactly price × days; otherwise it is
 * rounded to the nearest ฿10 like the rest of the fill.
 */
function extrapolate(dl: number, last: number, d: number): number {
  if (dl === 1) return last * d;
  return Math.floor((last * d + 5 * dl) / (10 * dl)) * 10;
}

/**
 * The full 30-day table. Anchors keep their exact totals, manual days keep the
 * vendor's value, every other day is filled from the anchors around it.
 */
export function fillDays(
  anchors: Anchors,
  manual: ManualDays = {},
): DayPrice[] {
  const set = setAnchors(anchors);

  for (const [key, total] of Object.entries(manual)) {
    const day = Number(key);
    if (total === undefined) continue;
    if (!Number.isInteger(day) || day < 1 || day > TABLE_DAYS) {
      throw new RangeError(`Manual day must be 1–${TABLE_DAYS}, got ${key}`);
    }
    if (isAnchorDay(day) && anchors[day] !== undefined) {
      throw new RangeError(
        `Day ${day} is an anchor; change the anchor instead`,
      );
    }
    assertPrice(total, `Day-${day} price`);
  }

  const table: DayPrice[] = [];
  for (let day = 1; day <= TABLE_DAYS; day++) {
    const anchor = set.find(([d]) => d === day);
    if (anchor) {
      table.push({ day, total: anchor[1], isAnchor: true, isManual: false });
      continue;
    }
    const manualTotal = manual[day];
    if (manualTotal !== undefined) {
      table.push({ day, total: manualTotal, isAnchor: false, isManual: true });
      continue;
    }
    const before = set.filter(([d]) => d < day).at(-1)!;
    const after = set.find(([d]) => d > day);
    const total = after
      ? interpolate(before[0], before[1], after[0], after[1], day)
      : extrapolate(before[0], before[1], day);
    table.push({ day, total, isAnchor: false, isManual: false });
  }
  return table;
}

/** Bike models need the day-1 and day-30 anchors (SPEC). */
export function bikeAnchorErrors(anchors: Anchors): string[] {
  const errors: string[] = [];
  if (anchors[1] === undefined) errors.push("The 1-day price is required");
  if (anchors[30] === undefined) errors.push("The 30-day price is required");
  return errors;
}

/** Time-based extras need a day-1 price; 7 and 30 days are optional. */
export function extraAnchorErrors(anchors: Anchors): string[] {
  const errors: string[] = [];
  if (anchors[1] === undefined) errors.push("The 1-day price is required");
  if (anchors[14] !== undefined || anchors[21] !== undefined) {
    errors.push("Extras take 1-, 7- and 30-day prices only");
  }
  return errors;
}

function totalsOf(table: readonly (DayPrice | number)[]): number[] {
  const totals = table.map((row) =>
    typeof row === "number" ? row : row.total,
  );
  if (totals.length !== TABLE_DAYS) {
    throw new RangeError(
      `Expected ${TABLE_DAYS} day totals, got ${totals.length}`,
    );
  }
  totals.forEach((t) => assertWholeBaht(t));
  return totals;
}

/**
 * Total for a rental of `days` days.
 *
 * Bike models pass `dailyAfter30` (required for bikes, owner decision
 * 2026-11-04): days 31+ cost that much each, and each further 30 days never
 * costs more than the 30-day price. Example: 30 days ฿5,500 and ฿150/day after
 * → 45 days = 5,500 + 15 × 150 = 7,750.
 *
 * Without it (time-based extras): full months × the 30-day price, plus the
 * remaining days from the table, capped at the 30-day price.
 * Example: 45 days = 5,500 + 3,370 = 8,870.
 */
export function priceForDays(
  table: readonly (DayPrice | number)[],
  days: number,
  dailyAfter30?: number,
): number {
  if (!Number.isInteger(days) || days < 1) {
    throw new RangeError(
      `Rental length must be a whole number of days ≥ 1, got ${days}`,
    );
  }
  const totals = totalsOf(table);
  const month = totals[TABLE_DAYS - 1];
  if (dailyAfter30 !== undefined) {
    assertPrice(dailyAfter30, "Daily price after 30 days");
    if (days <= TABLE_DAYS) return totals[days - 1];
    const extra = days - TABLE_DAYS;
    const extraMonths = Math.floor(extra / TABLE_DAYS);
    const extraRest = extra % TABLE_DAYS;
    const fullExtraMonth = Math.min(TABLE_DAYS * dailyAfter30, month);
    return (
      month +
      extraMonths * fullExtraMonth +
      Math.min(extraRest * dailyAfter30, month)
    );
  }
  const fullMonths = Math.floor(days / TABLE_DAYS);
  const rest = days % TABLE_DAYS;
  const restTotal = rest === 0 ? 0 : Math.min(totals[rest - 1], month);
  return fullMonths * month + restTotal;
}

/**
 * Editor warnings (SPEC "Validation"): a longer rental cheaper than a shorter
 * one, or a day total below the 1-day price. Warnings never block saving.
 */
export function pricingWarnings(
  table: readonly (DayPrice | number)[],
): PricingWarning[] {
  const totals = totalsOf(table);
  const warnings: PricingWarning[] = [];
  let maxDay = 1;
  for (let day = 2; day <= TABLE_DAYS; day++) {
    const total = totals[day - 1];
    if (total < totals[0]) warnings.push({ kind: "below_day_one", day });
    if (total < totals[maxDay - 1]) {
      warnings.push({ kind: "cheaper_than_shorter", day, shorterDay: maxDay });
    } else {
      maxDay = day;
    }
  }
  return warnings;
}
