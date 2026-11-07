import "server-only";
import {
  getRankingWeights,
  getShopSignals,
  searchOffers,
  type SearchQuery,
} from "@/lib/data";
import { filterByRating, rankOffers, type RankedOffer } from "./search";
import { localToInstant, NEAR_KM, type SearchParams } from "./search-params";

/**
 * A customer search: offers from the data adapter, ranked and filtered by the
 * marketplace's own rules. `only` narrows it to one model or one shop (those
 * pages show every shop, at any distance).
 */
export async function runSearch(
  p: SearchParams,
  only: { catalogId?: string; shopId?: string } = {},
): Promise<RankedOffer[]> {
  const query: SearchQuery = {
    near:
      p.lat !== undefined && p.lng !== undefined
        ? { lat: p.lat, lng: p.lng }
        : undefined,
    radiusKm:
      p.anyDistance || only.catalogId || only.shopId ? undefined : NEAR_KM,
    start: localToInstant(p.from),
    end: localToInstant(p.to),
    now: p.now,
    type: p.type,
    transmission: p.transmission,
    ccMin: p.ccMin,
    ccMax: p.ccMax,
    maxPricePerDay: p.priceMax,
    passportNotHeld: p.passportNotHeld,
    catalogId: only.catalogId,
    shopId: only.shopId,
  };
  const offers = await searchOffers(query);
  const [signals, weights] = await Promise.all([
    getShopSignals(offers.map((o) => o.shop.id)),
    getRankingWeights(),
  ]);
  return filterByRating(rankOffers(offers, signals, weights), p.minRating);
}
