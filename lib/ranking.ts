/**
 * Ranking score for search (SPEC "Admin screens and ranking"). Each factor is
 * 0–1; weights are admin settings (ranking_settings). The SQL function
 * shop_rank_score() follows the same rules and a DB test checks they agree.
 */

export type RankingWeights = {
  boost: number;
  rating: number;
  response: number;
  cancellation: number;
  distance: number;
};

/** SPEC starting point. */
export const DEFAULT_WEIGHTS: RankingWeights = {
  boost: 0.3,
  rating: 0.2,
  response: 0.15,
  cancellation: 0.15,
  distance: 0.2,
};

export const BOOST_SCORE = {
  featured: 1,
  preferred: 0.6,
  normal: 0.3,
} as const;
export type BoostLevel = keyof typeof BOOST_SCORE;

/** Fewer reviews than this count as neutral (0.5). */
export const MIN_REVIEWS = 3;

export type ShopSignals = {
  boost: BoostLevel;
  /** Average platform rating 1–5, or null. */
  rating: number | null;
  reviewCount: number;
  /** Share of requests answered in the window, 0–1; null = no requests yet. */
  responseRate: number | null;
  /** Share of confirmed bookings the shop cancelled, 0–1; null = none yet. */
  cancellationRate: number | null;
  /** Km from the search location; null = no location given. */
  distanceKm: number | null;
};

export function ratingScore(rating: number | null, count: number): number {
  if (rating === null || count < MIN_REVIEWS) return 0.5;
  return Math.min(Math.max((rating - 1) / 4, 0), 1);
}

/**
 * Closer is better, normalised within the results: the nearest shop scores 1,
 * the furthest 0. Without a location (or one shop) everyone scores 0.5.
 */
export function distanceScore(
  km: number | null,
  nearest: number | null,
  furthest: number | null,
): number {
  if (km === null || nearest === null || furthest === null) return 0.5;
  if (furthest - nearest < 0.001) return 1;
  return 1 - (km - nearest) / (furthest - nearest);
}

export function rankScore(
  s: ShopSignals,
  nearest: number | null,
  furthest: number | null,
  w: RankingWeights = DEFAULT_WEIGHTS,
): number {
  const total = w.boost + w.rating + w.response + w.cancellation + w.distance;
  const score =
    w.boost * BOOST_SCORE[s.boost] +
    w.rating * ratingScore(s.rating, s.reviewCount) +
    w.response * (s.responseRate ?? 0.5) +
    w.cancellation *
      (s.cancellationRate === null ? 0.5 : 1 - s.cancellationRate) +
    w.distance * distanceScore(s.distanceKm, nearest, furthest);
  return total > 0 ? score / total : 0;
}
