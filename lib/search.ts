/**
 * Model-first search (SPEC "Customer screens"). The data adapter returns one
 * offer per shop listing; the marketplace ranks them (ranking stays here, not
 * on the platform), applies its own filters, and shows one card per catalog
 * model with the lowest "From ฿X/day" and how many shops offer it.
 * Pure functions.
 */

import type { Offer, RankingWeights, ShopSignals } from "./data/types";
import { rankScore } from "./ranking";
import type { Sort } from "./search-params";

export type RankedOffer = Offer & {
  score: number;
  /** Marketplace rating, counted only from 3 reviews. */
  rating: number | null;
  reviewCount: number;
};

/** Scores offers with the shops' signals, distance normalised over the set. */
export function rankOffers(
  offers: readonly Offer[],
  signals: readonly ShopSignals[],
  weights: RankingWeights,
): RankedOffer[] {
  const byShop = new Map(signals.map((s) => [s.shopId, s]));
  const km = offers
    .map((o) => o.distanceKm)
    .filter((d): d is number => d !== null);
  const nearest = km.length ? Math.min(...km) : null;
  const furthest = km.length ? Math.max(...km) : null;
  return offers.map((o) => {
    const s = byShop.get(o.shop.id);
    return {
      ...o,
      score: rankScore(
        {
          boost: o.boost,
          rating: s?.rating ?? null,
          reviewCount: s?.reviewCount ?? 0,
          responseRate: s?.responseRate ?? null,
          cancellationRate: s?.cancellationRate ?? null,
          distanceKm: o.distanceKm,
        },
        nearest,
        furthest,
        weights,
      ),
      rating: s && s.reviewCount >= 3 ? s.rating : null,
      reviewCount: s?.reviewCount ?? 0,
    };
  });
}

/** The rating filter: only shops with at least 3 reviews averaging minRating. */
export function filterByRating(
  offers: readonly RankedOffer[],
  minRating: number | undefined,
): RankedOffer[] {
  if (minRating === undefined) return [...offers];
  return offers.filter((o) => o.rating !== null && o.rating >= minRating);
}

export type ModelCard = Pick<
  Offer["model"],
  | "slug"
  | "make"
  | "model"
  | "yearFrom"
  | "yearTo"
  | "cc"
  | "type"
  | "transmission"
  | "thumbUrl"
> & {
  catalogId: string;
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

export function groupOffers(offers: readonly RankedOffer[]): ModelCard[] {
  const cards = new Map<string, ModelCard>();
  for (const o of offers) {
    const card = cards.get(o.model.id);
    if (!card) {
      cards.set(o.model.id, {
        catalogId: o.model.id,
        slug: o.model.slug,
        make: o.model.make,
        model: o.model.model,
        yearFrom: o.model.yearFrom,
        yearTo: o.model.yearTo,
        cc: o.model.cc,
        type: o.model.type,
        transmission: o.model.transmission,
        thumbUrl: o.model.thumbUrl,
        fromPerDay: o.perDay,
        shops: 1,
        instant: o.mode === "instant",
        request: o.mode === "request",
        readyNow: o.readyNow,
        featured: o.boost === "featured",
        score: o.score,
        nearestKm: o.distanceKm,
        bestRating: o.rating,
      });
      continue;
    }
    card.fromPerDay = Math.min(card.fromPerDay, o.perDay);
    card.shops += 1;
    card.instant ||= o.mode === "instant";
    card.request ||= o.mode === "request";
    card.readyNow ||= o.readyNow;
    card.featured ||= o.boost === "featured";
    card.score = Math.max(card.score, o.score);
    if (o.distanceKm !== null)
      card.nearestKm =
        card.nearestKm === null
          ? o.distanceKm
          : Math.min(card.nearestKm, o.distanceKm);
    if (o.rating !== null)
      card.bestRating = Math.max(card.bestRating ?? 0, o.rating);
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
export function sortOffers(
  offers: readonly RankedOffer[],
  sort: Sort,
): RankedOffer[] {
  const sorted = [...offers];
  const last = Number.POSITIVE_INFINITY;
  sorted.sort((a, b) => {
    switch (sort) {
      case "price":
        return a.total - b.total;
      case "distance":
        return (a.distanceKm ?? last) - (b.distanceKm ?? last);
      case "rating":
        return (b.rating ?? 0) - (a.rating ?? 0);
      default:
        return b.score - a.score;
    }
  });
  return sorted;
}
