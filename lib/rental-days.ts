/**
 * Rental length in days (owner decision, 2026-11-07): every started 24 hours
 * is a day. 10:00 Mon → 10:00 Tue is 1 day; → 10:00 Wed is 2 days; → 10:30
 * Tue is 2 days. There is no grace period on the price: the turnaround time
 * between rentals is the shop's "buffer after return".
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function rentalDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (!(ms > 0)) {
    throw new RangeError("The return must be after the pickup");
  }
  return Math.ceil(ms / DAY_MS);
}
