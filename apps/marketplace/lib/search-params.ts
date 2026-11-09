/**
 * The customer search lives in the URL so every search has a shareable link:
 * /search?lat=…&lng=…&place=Asok&from=2026-12-01T10:00&to=2026-12-08T10:00&type=…
 * Pure parsing and building; invalid values are dropped, not errors.
 */

import { bangkokDateTime } from "@mango/core/time";

export const BIKE_TYPES = [
  "city_scooter",
  "touring",
  "adventure",
  "sport",
  "classic",
  "off_road",
] as const;
export type BikeType = (typeof BIKE_TYPES)[number];

export const TRANSMISSIONS = ["automatic", "semi_auto", "manual"] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const SORTS = ["recommended", "price", "distance", "rating"] as const;
export type Sort = (typeof SORTS)[number];

/** "Near you" radius in km (owner decision, 2026-11-07). */
export const NEAR_KM = 15;

export type SearchParams = {
  lat?: number;
  lng?: number;
  /** What the customer picked: a station name, an address, or "my location". */
  place?: string;
  /** Bangkok wall-clock "YYYY-MM-DDTHH:MM". */
  from?: string;
  to?: string;
  /** Get your bike now (walk-ins). */
  now: boolean;
  type?: BikeType;
  transmission?: Transmission;
  ccMin?: number;
  ccMax?: number;
  priceMax?: number;
  passportNotHeld: boolean;
  minRating?: number;
  sort: Sort;
  /** Search beyond NEAR_KM. */
  anyDistance: boolean;
  view: "list" | "map";
};

type Raw = Record<string, string | string[] | undefined>;

const first = (raw: Raw, key: string) => {
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
};

function num(raw: Raw, key: string, min: number, max: number) {
  const v = first(raw, key);
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function oneOf<T extends string>(raw: Raw, key: string, values: readonly T[]) {
  const v = first(raw, key);
  return (values as readonly string[]).includes(v ?? "") ? (v as T) : undefined;
}

const LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/** A Bangkok wall-clock "YYYY-MM-DDTHH:MM" as an instant, or undefined. */
export function localToInstant(value: string | undefined): Date | undefined {
  const m = value ? LOCAL.exec(value) : null;
  if (!m) return undefined;
  try {
    return bangkokDateTime(m[1], m[2]);
  } catch {
    return undefined;
  }
}

export function parseSearchParams(raw: Raw): SearchParams {
  const lat = num(raw, "lat", -90, 90);
  const lng = num(raw, "lng", -180, 180);
  const hasPoint = lat !== undefined && lng !== undefined;
  // Dates count only as a valid pair with the return after the pickup.
  const start = localToInstant(first(raw, "from"));
  const end = localToInstant(first(raw, "to"));
  const dated = start !== undefined && end !== undefined && end > start;
  const from = dated ? first(raw, "from") : undefined;
  const to = dated ? first(raw, "to") : undefined;
  const place = first(raw, "place")?.trim().slice(0, 80);
  return {
    lat: hasPoint ? lat : undefined,
    lng: hasPoint ? lng : undefined,
    place: hasPoint && place ? place : undefined,
    from,
    to,
    now: first(raw, "now") === "1",
    type: oneOf(raw, "type", BIKE_TYPES),
    transmission: oneOf(raw, "transmission", TRANSMISSIONS),
    ccMin: num(raw, "ccMin", 50, 2500),
    ccMax: num(raw, "ccMax", 50, 2500),
    priceMax: num(raw, "priceMax", 1, 1_000_000),
    passportNotHeld: first(raw, "passport") === "copy",
    minRating: num(raw, "rating", 1, 5),
    sort: oneOf(raw, "sort", SORTS) ?? "recommended",
    anyDistance: first(raw, "anywhere") === "1",
    view: first(raw, "view") === "map" ? "map" : "list",
  };
}

/** Query string for a search, leaving out defaults. */
export function searchQuery(
  p: Partial<SearchParams>,
  overrides: Partial<SearchParams> = {},
): string {
  const v = { ...p, ...overrides };
  const q = new URLSearchParams();
  if (v.lat !== undefined && v.lng !== undefined) {
    q.set("lat", v.lat.toFixed(5));
    q.set("lng", v.lng.toFixed(5));
    if (v.place) q.set("place", v.place);
  }
  if (v.from && v.to) {
    q.set("from", v.from);
    q.set("to", v.to);
  }
  if (v.now) q.set("now", "1");
  if (v.type) q.set("type", v.type);
  if (v.transmission) q.set("transmission", v.transmission);
  if (v.ccMin !== undefined) q.set("ccMin", String(v.ccMin));
  if (v.ccMax !== undefined) q.set("ccMax", String(v.ccMax));
  if (v.priceMax !== undefined) q.set("priceMax", String(v.priceMax));
  if (v.passportNotHeld) q.set("passport", "copy");
  if (v.minRating !== undefined) q.set("rating", String(v.minRating));
  if (v.sort && v.sort !== "recommended") q.set("sort", v.sort);
  if (v.anyDistance) q.set("anywhere", "1");
  if (v.view === "map") q.set("view", "map");
  const s = q.toString();
  return s ? `?${s}` : "";
}
