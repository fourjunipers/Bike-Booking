/**
 * Money (root CLAUDE.md › Built for any country): integer minor units by the
 * currency's ISO 4217 exponent (THB ×100, JPY and VND ×1), always with a
 * currency code, formatted in the viewer's locale. No floats in storage.
 */

/** Decimal places of a currency: 2 for THB, 0 for JPY and VND, 3 for KWD. */
export function minorExponent(currency: string): number {
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

/**
 * Parses an amount typed in major units ("45000", "45,000.50") into minor
 * units. Returns null when it isn't a non-negative amount or has more decimal
 * places than the currency allows. String arithmetic, so no float rounding.
 */
export function parseMoney(input: string, currency: string): number | null {
  const text = input.trim().replace(/[\s,_]/g, "");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;
  const exponent = minorExponent(currency);
  const fraction = match[2] ?? "";
  if (fraction.length > exponent) return null;
  const minor = Number(match[1] + fraction.padEnd(exponent, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units as a plain major-unit string for a form field: 4500050 → "45000.50". */
export function moneyInputValue(minor: number, currency: string): string {
  const exponent = minorExponent(currency);
  if (exponent === 0) return String(minor);
  const digits = String(minor).padStart(exponent + 1, "0");
  return `${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

/** "฿45,000.00" / "₫1,200,000" in the viewer's locale. */
export function formatMoney(
  minor: number,
  currency: string,
  locale: string,
): string {
  const exponent = minorExponent(currency);
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    minor / 10 ** exponent,
  );
}
