/**
 * When the marketplace fee is charged, and what happens to it when a booking
 * changes (SPEC "Payments and cancellation", owner decisions 2026-11-07/08/09).
 * The fee is the only money the marketplace takes; its states are owned
 * here, not by Mango Works. Pure functions; times are instants.
 *
 * Deadlines are calendar days at the same clock time in the shop's time zone
 * (decision 2026-11-09): pickup 10:00 on the 30th → charged 10:00 on the
 * 27th, unpaid fee cancels at 10:00 on the 28th, even across a
 * daylight-saving change.
 *
 * Charging:
 * - Pickup within 3 days (including walk-ins): charged at booking, for
 *   Instant, Request and walk-in bookings alike.
 * - Otherwise: the card is saved and charged 3 days before pickup. A Request
 *   booking is only scheduled once the shop accepts.
 *
 * Outcome when a booking ends early:
 * - The shop is at fault (declines, lets the request expire, cancels): the
 *   fee is refunded if it was paid, otherwise never charged.
 * - The customer cancels more than 3 days before pickup: refunded / never
 *   charged. Within 3 days, or a no-show: the fee is kept.
 */

import { addCalendarDays } from "./zoned-time";

/** The fee is charged this many calendar days before pickup. */
export const CHARGE_LEAD_DAYS = 3;
/** An unpaid fee cancels the booking this many calendar days before pickup. */
export const PAYMENT_DEADLINE_DAYS = 2;

export type FeeStatus =
  /** Request waiting for the shop; nothing charged or scheduled yet. */
  | "awaiting_shop"
  /** Card saved; charged at `chargeAt`. */
  | "scheduled"
  /** To be paid now (at booking, or a failed charge awaiting the customer). */
  | "due"
  | "paid"
  | "refunded"
  | "kept"
  /** The booking ended before anything was charged. */
  | "not_charged";

export type BookingKind = "instant" | "request" | "now";

export type FeePlan = { status: FeeStatus; chargeAt: Date | null };

/** When the fee is charged for a pickup: 3 calendar days before, shop time. */
export function chargeDate(start: Date, shopTimeZone: string): Date {
  return addCalendarDays(start, -CHARGE_LEAD_DAYS, shopTimeZone);
}

/** When an unpaid fee cancels the booking (failed card, unpaid link). */
export function paymentDeadline(start: Date, shopTimeZone: string): Date {
  return addCalendarDays(start, -PAYMENT_DEADLINE_DAYS, shopTimeZone);
}

/** Pickup is within 3 days: the charge date has come. */
function withinChargeLead(now: Date, chargeAt: Date): boolean {
  return now.getTime() >= chargeAt.getTime();
}

/** The fee plan when a booking is made. */
export function feeAtBooking(
  kind: BookingKind,
  now: Date,
  start: Date,
  shopTimeZone: string,
): FeePlan {
  const chargeAt = chargeDate(start, shopTimeZone);
  if (kind === "now" || withinChargeLead(now, chargeAt))
    return { status: "due", chargeAt: now };
  if (kind === "request") return { status: "awaiting_shop", chargeAt: null };
  return { status: "scheduled", chargeAt };
}

/** The fee plan once the shop accepts a request. */
export function feeWhenAccepted(
  current: FeeStatus,
  now: Date,
  start: Date,
  shopTimeZone: string,
): FeePlan {
  // Already charged at booking (pickup was within 3 days): nothing to do.
  if (current !== "awaiting_shop") return { status: current, chargeAt: null };
  const chargeAt = chargeDate(start, shopTimeZone);
  if (withinChargeLead(now, chargeAt)) return { status: "due", chargeAt: now };
  return { status: "scheduled", chargeAt };
}

export type EndingEvent =
  | "declined"
  | "expired"
  | "cancelled_vendor"
  | "cancelled_customer"
  | "no_show"
  | "cancelled_unpaid";

export type FeeAction = "refund" | "cancel_charge" | "none";

/** The fee's new state, and what to do with money, when a booking ends. */
export function feeWhenEnded(
  event: EndingEvent,
  current: FeeStatus,
  now: Date,
  start: Date,
  shopTimeZone: string,
): { status: FeeStatus; action: FeeAction } {
  const paid = current === "paid";
  // Already settled: never refund twice or keep a refunded fee.
  if (current === "refunded" || current === "kept" || current === "not_charged")
    return { status: current, action: "none" };

  const refundOrVoid = paid
    ? { status: "refunded" as const, action: "refund" as const }
    : { status: "not_charged" as const, action: "cancel_charge" as const };
  const keepOrVoid = paid
    ? { status: "kept" as const, action: "none" as const }
    : { status: "not_charged" as const, action: "cancel_charge" as const };

  switch (event) {
    case "declined":
    case "expired":
    case "cancelled_vendor":
      return refundOrVoid;
    case "cancelled_customer":
      return withinChargeLead(now, chargeDate(start, shopTimeZone))
        ? keepOrVoid
        : refundOrVoid;
    case "no_show":
      return keepOrVoid;
    case "cancelled_unpaid":
      return { status: "not_charged", action: "cancel_charge" };
  }
}
