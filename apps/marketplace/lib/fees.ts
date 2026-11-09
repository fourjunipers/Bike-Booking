/**
 * The marketplace booking fee (SPEC "Payments and cancellation"): 10% of the
 * rental after promotions, rounded to whole currency units (halves up), at
 * least the market's fee minimum, never more than the rental itself. Extras
 * are paid at the shop and never count towards the fee.
 *
 * Amounts are integer minor units of the market's currency, by its ISO 4217
 * exponent (THB ×100, JPY and VND ×1). The fee minimum and rounding unit are
 * market settings (decisions 2026-11-08 and 2026-11-09), so callers pass
 * them in; this module assumes no currency.
 */

export const FEE_RATE_PERCENT = 10;

export type MarketFeeSettings = {
  /** ISO 4217 code, e.g. "THB". */
  currency: string;
  /** The smallest fee, in minor units. */
  feeMinimum: number;
  /**
   * The fee is rounded to a multiple of this many whole currency units
   * (e.g. 10 → nearest ฿10). Default 1: whole units.
   */
  feeRoundingUnit?: number;
};

export function bookingFee(
  rentalAfterPromotion: number,
  market: MarketFeeSettings,
): number {
  assertMinorUnits(rentalAfterPromotion);
  assertMinorUnits(market.feeMinimum);
  const step = roundingStep(market);
  if (rentalAfterPromotion <= 0) return 0;
  // Integer arithmetic: round(rental × 10% / step) × step, halves up.
  const percent =
    Math.floor(
      (rentalAfterPromotion * FEE_RATE_PERCENT + 50 * step) / (100 * step),
    ) * step;
  return Math.min(Math.max(percent, market.feeMinimum), rentalAfterPromotion);
}

export type PriceBreakdown = {
  currency: string;
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
  market: MarketFeeSettings,
): PriceBreakdown {
  for (const n of [rental, discount, extras]) assertMinorUnits(n);
  const rentalAfterPromotion = Math.max(rental - discount, 0);
  const fee = bookingFee(rentalAfterPromotion, market);
  const rentalAtShop = rentalAfterPromotion - fee;
  return {
    currency: market.currency,
    rental,
    discount,
    rentalAfterPromotion,
    fee,
    rentalAtShop,
    extras,
    dueAtShop: rentalAtShop + extras,
  };
}

/** The rounding unit in minor units, e.g. 1 whole THB → 100. */
function roundingStep(market: MarketFeeSettings): number {
  const units = market.feeRoundingUnit ?? 1;
  if (!Number.isSafeInteger(units) || units < 1) {
    throw new RangeError(`Expected a whole rounding unit ≥ 1, got ${units}`);
  }
  return units * 10 ** currencyExponent(market.currency);
}

/** Minor-unit digits of a currency (THB 2, JPY 0). Throws if unknown. */
function currencyExponent(currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new RangeError(`Expected an ISO 4217 code, got ${currency}`);
  }
  return new Intl.NumberFormat("en", { style: "currency", currency })
    .resolvedOptions().maximumFractionDigits!;
}

function assertMinorUnits(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Expected an integer amount, got ${amount}`);
  }
}
