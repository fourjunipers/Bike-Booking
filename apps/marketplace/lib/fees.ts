/**
 * The marketplace booking fee (SPEC "Payments and cancellation"): 10% of the
 * rental after promotions, at least the market's fee minimum, rounded to the
 * nearest unit (halves up), never more than the rental itself. Extras are
 * paid at the shop and never count towards the fee.
 *
 * Amounts are integers in one currency's unit: whatever unit the caller's
 * amounts are in (whole baht today; minor units by ISO 4217 exponent after
 * the adapter switch). The fee minimum belongs to the market (decisions
 * 2026-11-08), so callers pass it in; this module assumes no currency.
 */

export const FEE_RATE_PERCENT = 10;

export function bookingFee(
  rentalAfterPromotion: number,
  feeMinimum: number,
): number {
  assertIntegerAmount(rentalAfterPromotion);
  assertIntegerAmount(feeMinimum);
  if (rentalAfterPromotion <= 0) return 0;
  // Integer arithmetic: round(rental × 10 / 100), halves up.
  const percent = Math.floor(
    (rentalAfterPromotion * FEE_RATE_PERCENT + 50) / 100,
  );
  return Math.min(Math.max(percent, feeMinimum), rentalAfterPromotion);
}

export type PriceBreakdown = {
  rental: number;
  discount: number;
  rentalAfterPromotion: number;
  /** Paid online to the marketplace. */
  fee: number;
  /** Rental after promotion − fee: paid to the shop. */
  rentalAtShop: number;
  /** Extras, paid to the shop. */
  extras: number;
  /** Everything paid to the shop. */
  dueAtShop: number;
};

/** SPEC order: rental → minus promotion → fee → rest and extras at the shop. */
export function priceBreakdown(
  rental: number,
  discount: number,
  extras: number,
  feeMinimum: number,
): PriceBreakdown {
  for (const n of [rental, discount, extras]) assertIntegerAmount(n);
  const rentalAfterPromotion = Math.max(rental - discount, 0);
  const fee = bookingFee(rentalAfterPromotion, feeMinimum);
  const rentalAtShop = rentalAfterPromotion - fee;
  return {
    rental,
    discount,
    rentalAfterPromotion,
    fee,
    rentalAtShop,
    extras,
    dueAtShop: rentalAtShop + extras,
  };
}

function assertIntegerAmount(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Expected an integer amount, got ${amount}`);
  }
}
