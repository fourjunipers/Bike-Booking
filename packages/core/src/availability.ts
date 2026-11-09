/**
 * Availability of one bike model (SPEC "Data model", owner decisions
 * 2026-11-05). Pure functions; the SQL function available_offer() follows the
 * same rules and a DB test checks they agree.
 *
 * Bikes are a pool: no booking is tied to a particular bike. A unit is free
 * for a period when, at the busiest moment of that period, fewer units are
 * held than the model has in service. Bookings are widened by the buffers
 * before pickup and after return; units out of service are counted per
 * Bangkok calendar day until their back-on date.
 *
 * The quantity is split three ways: Instant units confirm automatically,
 * Request units need the shop's OK, and the rest are walk-ins only. A new
 * advance booking is Instant while Instant bookings overlapping it are fewer
 * than the Instant units, else Request while Request bookings are fewer than
 * the Request units. Walk-ins ("now") use the pool only.
 */

import { bangkokDateString } from "./time";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type BookingKind = "instant" | "request" | "now";

/** A booking that holds a unit (confirmed_unpaid, paid, picked_up, …). */
export type HeldBooking = { start: Date; end: Date; kind: BookingKind };

/** Units out of service; back in service from `backOn` (Bangkok date). */
export type Repair = { units: number; backOn: string | null };

export type ModelStock = {
  qty: number;
  instantQty: number;
  requestQty: number;
  bufferBeforeH: number;
  bufferAfterH: number;
  repairs: Repair[];
  bookings: HeldBooking[];
};

export type Offer = {
  /** Units free in the pool for the whole period. */
  free: number;
  /** How a new advance booking would confirm, or null if it can't be made. */
  mode: "instant" | "request" | null;
};

function widen(b: { start: Date; end: Date }, before: number, after: number) {
  return {
    start: b.start.getTime() - before * HOUR_MS,
    end: b.end.getTime() + after * HOUR_MS,
  };
}

function inRepair(repairs: Repair[], at: number): number {
  const day = bangkokDateString(new Date(at));
  return repairs.reduce(
    (sum, r) => (r.backOn === null || r.backOn > day ? sum + r.units : sum),
    0,
  );
}

/**
 * Points where the counts can change inside [from, to): the start, every
 * widened booking edge, and every Bangkok midnight (repairs end on dates).
 */
function checkpoints(stock: ModelStock, from: number, to: number): number[] {
  const points = new Set<number>([from]);
  for (const b of stock.bookings) {
    const w = widen(b, stock.bufferBeforeH, stock.bufferAfterH);
    if (w.start > from && w.start < to) points.add(w.start);
    if (w.end > from && w.end < to) points.add(w.end);
  }
  // Bangkok midnight = 17:00 UTC the day before.
  let midnight =
    Math.floor((from + 7 * HOUR_MS) / DAY_MS) * DAY_MS - 7 * HOUR_MS + DAY_MS;
  for (; midnight < to; midnight += DAY_MS) points.add(midnight);
  return [...points].sort((a, b) => a - b);
}

/** The most units held / of each kind at any moment in [from, to). */
function peak(stock: ModelStock, from: number, to: number) {
  let used = 0;
  let instant = 0;
  let request = 0;
  for (const p of checkpoints(stock, from, to)) {
    let held = 0;
    let heldInstant = 0;
    let heldRequest = 0;
    for (const b of stock.bookings) {
      const w = widen(b, stock.bufferBeforeH, stock.bufferAfterH);
      if (w.start <= p && p < w.end) {
        held++;
        if (b.kind === "instant") heldInstant++;
        if (b.kind === "request") heldRequest++;
      }
    }
    used = Math.max(used, held + inRepair(stock.repairs, p));
    instant = Math.max(instant, heldInstant);
    request = Math.max(request, heldRequest);
  }
  return { used, instant, request };
}

/** Free units and the booking mode for a new advance booking. */
export function offerFor(stock: ModelStock, start: Date, end: Date): Offer {
  if (end <= start) throw new RangeError("The return must be after the pickup");
  const w = widen({ start, end }, stock.bufferBeforeH, stock.bufferAfterH);
  const p = peak(stock, w.start, w.end);
  const free = Math.max(stock.qty - p.used, 0);
  let mode: Offer["mode"] = null;
  if (free > 0 && p.instant < stock.instantQty) mode = "instant";
  else if (free > 0 && p.request < stock.requestQty) mode = "request";
  return { free, mode };
}

/**
 * The longest walk-in rental (whole days) starting at `start` that still
 * leaves a unit free throughout, up to `maxDays`. 0 = none free now.
 */
export function longestWalkIn(
  stock: ModelStock,
  start: Date,
  maxDays = 90,
): number {
  let best = 0;
  for (let days = 1; days <= maxDays; days++) {
    const end = new Date(start.getTime() + days * DAY_MS);
    if (offerFor(stock, start, end).free < 1) break;
    best = days;
  }
  return best;
}
