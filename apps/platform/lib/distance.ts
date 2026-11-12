/**
 * Distances (SPEC › Fleet › Distance unit): always stored in km, shown in the
 * shop's unit. One decimal place is kept, so a reading typed in miles comes
 * back as the same number of miles.
 */
export type DistanceUnit = "km" | "mi";

const KM_PER_MILE = 1.609344;

/** km (as stored) to the shop's unit, rounded to 0.1. */
export function fromKm(km: number, unit: DistanceUnit): number {
  const value = unit === "mi" ? km / KM_PER_MILE : km;
  return Math.round(value * 10) / 10;
}

/** A value in the shop's unit to km for storage, rounded to 0.1. */
export function toKm(value: number, unit: DistanceUnit): number {
  const km = unit === "mi" ? value * KM_PER_MILE : value;
  return Math.round(km * 10) / 10;
}

/** "12,345 km" / "7,671 mi" in the viewer's locale. */
export function formatDistance(
  km: number,
  unit: DistanceUnit,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: unit === "mi" ? "mile" : "kilometer",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(fromKm(km, unit));
}
