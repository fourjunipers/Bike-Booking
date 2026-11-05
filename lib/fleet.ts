/**
 * Fleet helpers. A model's quantity is split three ways (owner decision
 * 2026-11-05): Instant units confirm automatically, Request units need the
 * shop's OK, and the rest are walk-ins only. Ready for walk-ins is a separate
 * count on top that can use any unit.
 */

export type ModeSplit = { instant_qty: number; request_qty: number };

/** Units that can't be booked in advance. */
export function walkinOnlyUnits(
  qty: number,
  instant: number,
  request: number,
): number {
  return Math.max(qty - instant - request, 0);
}

/**
 * The split after the quantity drops to `qty`: walk-ins-only units go first,
 * then Request, then Instant.
 */
export function shrinkSplit(
  instant: number,
  request: number,
  qty: number,
): ModeSplit {
  const over = Math.max(instant + request - qty, 0);
  const fromRequest = Math.min(over, request);
  return {
    instant_qty: Math.max(instant - (over - fromRequest), 0),
    request_qty: request - fromRequest,
  };
}

/** Each override falls back to the shop default (null = shop default). */
export function effectiveRule(
  modelValue: number | null | undefined,
  shopValue: number,
): number {
  return modelValue ?? shopValue;
}
