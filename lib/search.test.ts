import { describe, expect, it } from "vitest";
import { groupOffers, sortCards, type OfferRow } from "./search";

const row = (over: Partial<OfferRow>): OfferRow => ({
  bike_model_id: "m1",
  shop_id: "s1",
  shop_slug: "bsr",
  shop_name: "BSR",
  catalog_id: "c1",
  catalog_slug: "honda-pcx-160",
  make: "Honda",
  model: "PCX 160",
  year_from: 2026,
  year_to: 2026,
  cc: 160,
  type: "city_scooter",
  transmission: "automatic",
  stock_photo: null,
  photo: "x.webp",
  boost: "normal",
  distance_km: 2,
  days: 7,
  total: 2800,
  per_day: 400,
  deposit: 2000,
  mode: "request",
  free_units: 1,
  ready_today: false,
  ready_updated_at: null,
  walkin_max_days: null,
  rating: null,
  review_count: 0,
  score: 0.4,
  ...over,
});

describe("groupOffers", () => {
  it("makes one card per model with the lowest price and shop count", () => {
    const cards = groupOffers([
      row({}),
      row({
        bike_model_id: "m2",
        shop_id: "s2",
        per_day: 350,
        mode: "instant",
        distance_km: 5,
        score: 0.6,
      }),
      row({ catalog_id: "c2", catalog_slug: "honda-click", model: "Click" }),
    ]);
    expect(cards).toHaveLength(2);
    const pcx = cards.find((c) => c.catalogId === "c1")!;
    expect(pcx).toMatchObject({
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
    row({
      catalog_id: "a",
      model: "A",
      per_day: 500,
      score: 0.3,
      distance_km: 1,
    }),
    row({
      catalog_id: "b",
      model: "B",
      per_day: 300,
      score: 0.9,
      distance_km: 9,
    }),
  ]);
  it("sorts by ranking, price or distance", () => {
    expect(sortCards(cards, "recommended").map((c) => c.model)).toEqual([
      "B",
      "A",
    ]);
    expect(sortCards(cards, "price").map((c) => c.model)).toEqual(["B", "A"]);
    expect(sortCards(cards, "distance").map((c) => c.model)).toEqual([
      "A",
      "B",
    ]);
  });
});
