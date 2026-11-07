/**
 * Model-first search (SPEC "Customer screens"): search_offers() returns one
 * row per shop offer; customers see one card per catalog model with the
 * lowest "From ฿X/day" and how many shops offer it. Pure functions.
 */

import type { Database } from "./supabase/database.types";
import type { Sort } from "./search-params";

type GeneratedRow =
  Database["public"]["Functions"]["search_offers"]["Returns"][number];

/** A search_offers() row. Generated types can't tell which columns may be null. */
export type OfferRow = Omit<
  GeneratedRow,
  | "year_from"
  | "year_to"
  | "stock_photo"
  | "photo"
  | "distance_km"
  | "deposit"
  | "mode"
  | "free_units"
  | "ready_updated_at"
  | "walkin_max_days"
  | "rating"
> & {
  year_from: number | null;
  year_to: number | null;
  stock_photo: string | null;
  photo: string | null;
  distance_km: number | null;
  deposit: number | null;
  /** "instant" | "request" for advance bookings, "now" for walk-ins. */
  mode: "instant" | "request" | "now" | null;
  free_units: number | null;
  ready_updated_at: string | null;
  walkin_max_days: number | null;
  rating: number | null;
};

export type ModelCard = {
  catalogId: string;
  slug: string;
  make: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
  cc: number;
  type: OfferRow["type"];
  transmission: OfferRow["transmission"];
  stockPhoto: string | null;
  /** Lowest price per day among the shops (for the chosen dates). */
  fromPerDay: number;
  shops: number;
  /** Shown as badges: any Instant, any Request, any ready for walk-ins. */
  instant: boolean;
  request: boolean;
  readyNow: boolean;
  featured: boolean;
  /** Best ranking score among the model's offers. */
  score: number;
  nearestKm: number | null;
  bestRating: number | null;
};

export function groupOffers(rows: readonly OfferRow[]): ModelCard[] {
  const cards = new Map<string, ModelCard>();
  for (const r of rows) {
    const card = cards.get(r.catalog_id);
    const rating = r.review_count >= 3 ? Number(r.rating) : null;
    if (!card) {
      cards.set(r.catalog_id, {
        catalogId: r.catalog_id,
        slug: r.catalog_slug,
        make: r.make,
        model: r.model,
        yearFrom: r.year_from,
        yearTo: r.year_to,
        cc: r.cc,
        type: r.type,
        transmission: r.transmission,
        stockPhoto: r.stock_photo,
        fromPerDay: r.per_day,
        shops: 1,
        instant: r.mode === "instant",
        request: r.mode === "request",
        readyNow: r.ready_today,
        featured: r.boost === "featured",
        score: r.score,
        nearestKm: r.distance_km,
        bestRating: rating,
      });
      continue;
    }
    card.fromPerDay = Math.min(card.fromPerDay, r.per_day);
    card.shops += 1;
    card.instant ||= r.mode === "instant";
    card.request ||= r.mode === "request";
    card.readyNow ||= r.ready_today;
    card.featured ||= r.boost === "featured";
    card.score = Math.max(card.score, r.score);
    if (r.distance_km !== null)
      card.nearestKm =
        card.nearestKm === null
          ? r.distance_km
          : Math.min(card.nearestKm, r.distance_km);
    if (rating !== null)
      card.bestRating = Math.max(card.bestRating ?? 0, rating);
  }
  return [...cards.values()];
}

const byName = (a: ModelCard, b: ModelCard) =>
  `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`);

/** Recommended = ranking score; ties and missing values fall back to name. */
export function sortCards(cards: ModelCard[], sort: Sort): ModelCard[] {
  const sorted = [...cards];
  const last = Number.POSITIVE_INFINITY;
  sorted.sort((a, b) => {
    switch (sort) {
      case "price":
        return a.fromPerDay - b.fromPerDay || byName(a, b);
      case "distance":
        return (a.nearestKm ?? last) - (b.nearestKm ?? last) || byName(a, b);
      case "rating":
        return (b.bestRating ?? 0) - (a.bestRating ?? 0) || byName(a, b);
      default:
        return b.score - a.score || byName(a, b);
    }
  });
  return sorted;
}

/** One model's offers, best first (for the model page). */
export function sortOffers(rows: readonly OfferRow[], sort: Sort): OfferRow[] {
  const sorted = [...rows];
  const last = Number.POSITIVE_INFINITY;
  sorted.sort((a, b) => {
    switch (sort) {
      case "price":
        return a.total - b.total;
      case "distance":
        return (a.distance_km ?? last) - (b.distance_km ?? last);
      case "rating":
        return Number(b.rating ?? 0) - Number(a.rating ?? 0);
      default:
        return b.score - a.score;
    }
  });
  return sorted;
}
