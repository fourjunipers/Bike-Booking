/**
 * Marketplace data types: what the customer site works with. They describe
 * shop data owned by the Mango Works platform (shops, bikes, prices,
 * availability, bookings) plus a few things the marketplace owns itself
 * (stations, boost levels, ranking weights). See docs/INTEGRATION.md.
 *
 * No database rows leak through here, so the platform API can replace the
 * current implementation without touching the UI.
 */

import type { Inclusions } from "@/lib/inclusions";

export type BikeType =
  "city_scooter" | "touring" | "adventure" | "sport" | "classic" | "off_road";
export type Transmission = "automatic" | "semi_auto" | "manual";

/** Marketplace-owned: how much the admin promotes a shop in ranking. */
export type BoostLevel = "featured" | "preferred" | "normal";

/** Instant / Request for advance bookings; "now" for walk-ins. */
export type BookingKind = "instant" | "request" | "now";

export type Point = { lat: number; lng: number };

/** Marketplace-owned: a BTS/MRT/ARL/SRT station for the location picker. */
export type Station = Point & {
  id: string;
  nameEn: string;
  nameTh: string | null;
  lines: string[];
};

export type OpeningHours = { weekday: number; open: string; close: string };

export type Closure = {
  startDate: string;
  endDate: string;
  note: string | null;
  repeatsYearly: boolean;
};

export type ShopSummary = {
  id: string;
  slug: string;
  name: string;
  nearestStation: string | null;
  /** Small image for cards. */
  thumbUrl: string;
};

export type Shop = ShopSummary & {
  about: string | null;
  photoUrls: string[];
  location: Point | null;
  mapsUrl: string | null;
  /** Google Business Profile place ID, for Google rating and reviews. */
  googlePlaceId: string | null;
  hours: OpeningHours[];
  closures: Closure[];
};

/** A bike model from the shared catalog (make / model / years). */
export type CatalogModel = {
  id: string;
  slug: string;
  make: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
  cc: number;
  type: BikeType;
  transmission: Transmission;
  abs: boolean | null;
  underseatStorage: boolean | null;
  usbCharger: boolean | null;
  keyType: "keyless" | "keyed" | null;
  description: string | null;
  photoUrl: string;
  thumbUrl: string;
};

/** What a customer is looking for. Dates are instants (UTC). */
export type SearchQuery = {
  near?: Point;
  /** Only shops this close to `near`; omit for any distance. */
  radiusKm?: number;
  start?: Date;
  end?: Date;
  /** Walk-ins: bikes ready to ride away now ("Get your bike now"). */
  now: boolean;
  type?: BikeType;
  transmission?: Transmission;
  ccMin?: number;
  ccMax?: number;
  maxPricePerDay?: number;
  /** Only shops that keep a passport copy, not the passport. */
  passportNotHeld: boolean;
  catalogId?: string;
  shopId?: string;
};

/**
 * One shop's offer of one catalog model that matches a search: availability
 * and price come from the platform for the asked dates.
 */
export type Offer = {
  listingId: string;
  shop: { id: string; slug: string; name: string; location: Point | null };
  model: Pick<
    CatalogModel,
    | "id"
    | "slug"
    | "make"
    | "model"
    | "yearFrom"
    | "yearTo"
    | "cc"
    | "type"
    | "transmission"
    | "thumbUrl"
  >;
  /** The shop's own photo of this bike (thumbnail). */
  thumbUrl: string;
  distanceKm: number | null;
  /** Rental length the price is for (1 when no dates were given). */
  days: number;
  total: number;
  perDay: number;
  deposit: number | null;
  /** How a booking would confirm; null = can't be booked for these dates. */
  mode: BookingKind | null;
  freeUnits: number | null;
  readyNow: boolean;
  readyUpdatedAt: string | null;
  /** Walk-ins: the longest rental possible from now. */
  walkinMaxDays: number | null;
  /** Marketplace-owned. */
  boost: BoostLevel;
};

export type Extra = {
  id: string;
  name: string;
  description: string | null;
  terms: string | null;
  price:
    | { kind: "rental"; amount: number }
    | {
        kind: "time";
        perDay: number;
        per7Days: number | null;
        per30Days: number | null;
      };
};

/** One shop's offer of one model, for its listing page. */
export type Listing = {
  listingId: string;
  photoUrls: string[];
  deposit: number | null;
  /** Totals for 1–30 days (index 0 = 1 day). */
  dayPrices: number[];
  pricePerDayAfter30: number | null;
  inclusions: Inclusions | null;
  extras: Extra[];
};

export type Availability = {
  freeUnits: number;
  mode: BookingKind | null;
  walkinMaxDays: number | null;
};

export type Quote = { days: number; total: number; perDay: number };

/** Signals the marketplace ranks shops by (docs/INTEGRATION.md). */
export type ShopSignals = {
  shopId: string;
  /** Average 1–5 from marketplace reviews; null = none. */
  rating: number | null;
  reviewCount: number;
  /** Share of requests answered in the window, 0–1; null = no requests. */
  responseRate: number | null;
  /** Share of confirmed bookings the shop cancelled, 0–1; null = none. */
  cancellationRate: number | null;
};

export type Review = { rating: number; text: string | null; createdAt: string };

export type RankingWeights = {
  boost: number;
  rating: number;
  response: number;
  cancellation: number;
  distance: number;
};

/** Sent to the platform; it keeps a customer record per shop. */
export type BookingCustomer = {
  name: string;
  email: string;
  phone: string | null;
  nationality: string | null;
  lineId: string | null;
};

export type NewBooking = {
  listingId: string;
  start: Date;
  end: Date;
  kind: BookingKind;
  extraIds: string[];
  customer: BookingCustomer;
  /** Marketplace customer account, for "My bookings". */
  customerAccountId: string;
  /**
   * How the customer pays. Today only the marketplace fee is paid online
   * (charged 3 days before pickup); the rest is paid to the shop under its
   * own settings. Full online payment may come later.
   */
  payment:
    | { kind: "fee_only"; fee: number; currency: "THB" }
    | { kind: "full"; amount: number; fee: number; currency: "THB" };
  referralCode: string | null;
  /** Always "marketplace" for bookings made here. */
  channel: "marketplace";
};

export type BookingStatus =
  | "pending_vendor"
  | "declined"
  | "expired"
  | "confirmed_unpaid"
  | "paid"
  | "picked_up"
  | "returned"
  | "cancelled_customer"
  | "cancelled_vendor"
  | "cancelled_unpaid"
  | "no_show";

export type Booking = {
  id: string;
  code: string;
  status: BookingStatus;
  listingId: string;
  shopId: string;
  start: Date;
  end: Date;
  kind: BookingKind;
  rentalTotal: number;
  fee: number;
  dueAtShop: number;
  requestExpiresAt: Date | null;
  paymentDueAt: Date | null;
};
