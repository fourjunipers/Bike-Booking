/**
 * When the marketplace fee is charged, and what happens to it when a booking
 * changes (SPEC "Payments and cancellation", owner decisions 2026-11-07/08).
 * The fee is the only money the marketplace takes; its states are owned
 * here, not by Mango Works. Pure functions; times are instants.
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

const DAY_MS = 24 * 60 * 60 * 1000;
/** The fee is charged this long before pickup. */
export const CHARGE_LEAD_MS = 3 * DAY_MS;
/** An unpaid fee cancels the booking this long before pickup. */
export const PAYMENT_DEADLINE_MS = 2 * DAY_MS;

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

/** The fee plan when a booking is made. */
export function feeAtBooking(
  kind: BookingKind,
  now: Date,
  start: Date,
): FeePlan {
  if (kind === "now" || start.getTime() - now.getTime() <= CHARGE_LEAD_MS)
    return { status: "due", chargeAt: now };
  if (kind === "request") return { status: "awaiting_shop", chargeAt: null };
  return {
    status: "scheduled",
    chargeAt: new Date(start.getTime() - CHARGE_LEAD_MS),
  };
}

/** The fee plan once the shop accepts a request. */
export function feeWhenAccepted(
  current: FeeStatus,
  now: Date,
  start: Date,
): FeePlan {
  // Already charged at booking (pickup was within 3 days): nothing to do.
  if (current !== "awaiting_shop") return { status: current, chargeAt: null };
  if (start.getTime() - now.getTime() <= CHARGE_LEAD_MS)
    return { status: "due", chargeAt: now };
  return {
    status: "scheduled",
    chargeAt: new Date(start.getTime() - CHARGE_LEAD_MS),
  };
}

/** When an unpaid fee cancels the booking (failed card, unpaid link). */
export function paymentDeadline(start: Date): Date {
  return new Date(start.getTime() - PAYMENT_DEADLINE_MS);
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
      return start.getTime() - now.getTime() > CHARGE_LEAD_MS
        ? refundOrVoid
        : keepOrVoid;
    case "no_show":
      return keepOrVoid;
    case "cancelled_unpaid":
      return { status: "not_charged", action: "cancel_charge" };
  }
}
