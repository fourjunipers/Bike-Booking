import { describe, expect, it } from "vitest";
import type { Offer, ShopSignals } from "./data/types";
import { DEFAULT_WEIGHTS } from "./ranking";
import {
  filterByRating,
  groupOffers,
  rankOffers,
  sortCards,
  type RankedOffer,
} from "./search";

const offer = (
  over: Partial<Offer> & {
    modelId?: string;
    modelName?: string;
    shopId?: string;
  } = {},
): Offer => {
  const {
    modelId = "c1",
    modelName = "PCX 160",
    shopId = "s1",
    ...rest
  } = over;
  return {
    listingId: `${shopId}-${modelId}`,
    shop: { id: shopId, slug: shopId, name: shopId, location: null },
    model: {
      id: modelId,
      slug: `honda-${modelId}`,
      make: "Honda",
      model: modelName,
      yearFrom: 2026,
      yearTo: 2026,
      cc: 160,
      type: "city_scooter",
      transmission: "automatic",
      thumbUrl: "/x.svg",
    },
    thumbUrl: "/x.svg",
    distanceKm: 2,
    days: 7,
    total: 2800,
    perDay: 400,
    deposit: 2000,
    mode: "request",
    freeUnits: 1,
    readyNow: false,
    readyUpdatedAt: null,
    walkinMaxDays: null,
    boost: "normal",
    ...rest,
  };
};

const ranked = (o: Offer, score = 0.4): RankedOffer => ({
  ...o,
  score,
  rating: null,
  reviewCount: 0,
});

describe("rankOffers", () => {
  it("puts a boosted shop above an otherwise equal one", () => {
    const [featured, normal] = rankOffers(
      [
        offer({ shopId: "a", boost: "featured" }),
        offer({ shopId: "b", boost: "normal" }),
      ],
      [],
      DEFAULT_WEIGHTS,
    );
    expect(featured.score).toBeGreaterThan(normal.score);
  });

  it("uses the shop's signals and counts ratings from 3 reviews", () => {
    const signals: ShopSignals[] = [
      {
        shopId: "a",
        rating: 4.8,
        reviewCount: 2,
        responseRate: null,
        cancellationRate: null,
      },
      {
        shopId: "b",
        rating: 4.2,
        reviewCount: 10,
        responseRate: 1,
        cancellationRate: 0,
      },
    ];
    const [a, b] = rankOffers(
      [offer({ shopId: "a" }), offer({ shopId: "b" })],
      signals,
      DEFAULT_WEIGHTS,
    );
    expect(a.rating).toBeNull();
    expect(b.rating).toBe(4.2);
    expect(b.score).toBeGreaterThan(a.score);
  });

  it("filters by rating only shops with enough reviews", () => {
    const offers = [
      { ...ranked(offer({ shopId: "a" })), rating: 4.5, reviewCount: 5 },
      { ...ranked(offer({ shopId: "b" })), rating: null, reviewCount: 1 },
    ];
    expect(filterByRating(offers, 4).map((o) => o.shop.id)).toEqual(["a"]);
    expect(filterByRating(offers, undefined)).toHaveLength(2);
  });
});

describe("groupOffers", () => {
  it("makes one card per model with the lowest price and shop count", () => {
    const cards = groupOffers([
      ranked(offer({})),
      ranked(
        offer({ shopId: "s2", perDay: 350, mode: "instant", distanceKm: 5 }),
        0.6,
      ),
      ranked(offer({ modelId: "c2", modelName: "Click" })),
    ]);
    expect(cards).toHaveLength(2);
    expect(cards.find((c) => c.catalogId === "c1")).toMatchObject({
      fromPerDay: 350,
      shops: 2,
      instant: true,
      request: true,
      nearestKm: 2,
      score: 0.6,
    });
  });
});

describe("sortCards", () => {
  const cards = groupOffers([
    ranked(
      offer({ modelId: "a", modelName: "A", perDay: 500, distanceKm: 1 }),
      0.3,
    ),
    ranked(
      offer({ modelId: "b", modelName: "B", perDay: 300, distanceKm: 9 }),
      0.9,
    ),
  ]);
  it("sorts by ranking, price or distance", () => {
    const names = (sort: Parameters<typeof sortCards>[1]) =>
      sortCards(cards, sort).map((c) => c.model);
    expect(names("recommended")).toEqual(["B", "A"]);
    expect(names("price")).toEqual(["B", "A"]);
    expect(names("distance")).toEqual(["A", "B"]);
  });
});
