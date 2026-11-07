import { describe, expect, it } from "vitest";
import {
  distanceScore,
  rankScore,
  ratingScore,
  type ShopSignals,
} from "./ranking";

const shop = (over: Partial<ShopSignals> = {}): ShopSignals => ({
  boost: "normal",
  rating: null,
  reviewCount: 0,
  responseRate: null,
  cancellationRate: null,
  distanceKm: null,
  ...over,
});

describe("ratingScore", () => {
  it("is neutral below 3 reviews, else scaled 1–5 → 0–1", () => {
    expect(ratingScore(5, 2)).toBe(0.5);
    expect(ratingScore(5, 3)).toBe(1);
    expect(ratingScore(3, 10)).toBe(0.5);
    expect(ratingScore(null, 0)).toBe(0.5);
  });
});

describe("distanceScore", () => {
  it("scores the nearest 1 and the furthest 0", () => {
    expect(distanceScore(1, 1, 5)).toBe(1);
    expect(distanceScore(5, 1, 5)).toBe(0);
    expect(distanceScore(3, 1, 5)).toBe(0.5);
    expect(distanceScore(null, null, null)).toBe(0.5);
  });
});

describe("rankScore", () => {
  it("puts a boosted shop first among otherwise equal shops", () => {
    const featured = rankScore(shop({ boost: "featured" }), null, null);
    const normal = rankScore(shop(), null, null);
    expect(featured).toBeGreaterThan(normal);
  });

  it("matches the SPEC weights for a new, normal shop", () => {
    // 0.3×0.3 + 0.2×0.5 + 0.15×0.5 + 0.15×0.5 + 0.2×0.5 = 0.44
    expect(rankScore(shop(), null, null)).toBeCloseTo(0.44, 6);
  });

  it("rewards being closer", () => {
    const near = rankScore(shop({ distanceKm: 1 }), 1, 10);
    const far = rankScore(shop({ distanceKm: 10 }), 1, 10);
    expect(near).toBeGreaterThan(far);
  });
});
