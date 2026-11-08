/**
 * Money helpers. Amounts are whole Thai baht everywhere in the app and the
 * database. Satang (1/100 baht) exist only at the Stripe boundary, and these
 * are the only functions that convert between the two.
 */

const SATANG_PER_BAHT = 100;

/** Whole baht → satang, for amounts sent to Stripe. */
export function bahtToSatang(baht: number): number {
  assertWholeBaht(baht);
  return baht * SATANG_PER_BAHT;
}

/** Satang from Stripe → whole baht. Throws if the amount has a satang part. */
export function satangToBaht(satang: number): number {
  if (!Number.isInteger(satang) || satang % SATANG_PER_BAHT !== 0) {
    throw new RangeError(
      `Expected a whole number of baht in satang, got ${satang}`,
    );
  }
  return satang / SATANG_PER_BAHT;
}

const bahtFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 2592 → "฿2,592", -320 → "−฿320". */
export function formatBaht(baht: number): string {
  assertWholeBaht(baht);
  const sign = baht < 0 ? "−" : "";
  return `${sign}฿${bahtFormat.format(Math.abs(baht))}`;
}

export function assertWholeBaht(baht: number): void {
  if (!Number.isSafeInteger(baht)) {
    throw new RangeError(`Expected a whole number of baht, got ${baht}`);
  }
}
