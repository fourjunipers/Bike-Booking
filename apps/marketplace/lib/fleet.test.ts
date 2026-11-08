import { describe, expect, it } from "vitest";
import { effectiveRule, shrinkSplit, walkinOnlyUnits } from "./fleet";

describe("walkinOnlyUnits", () => {
  it("is what's left after Instant and Request", () => {
    expect(walkinOnlyUnits(4, 2, 1)).toBe(1);
    expect(walkinOnlyUnits(4, 0, 0)).toBe(4);
    expect(walkinOnlyUnits(4, 2, 2)).toBe(0);
  });
});

describe("shrinkSplit", () => {
  it("leaves the split alone while it still fits", () => {
    expect(shrinkSplit(2, 1, 4)).toEqual({ instant_qty: 2, request_qty: 1 });
  });

  it("takes from Request first, then Instant", () => {
    expect(shrinkSplit(2, 2, 3)).toEqual({ instant_qty: 2, request_qty: 1 });
    expect(shrinkSplit(2, 2, 1)).toEqual({ instant_qty: 1, request_qty: 0 });
    expect(shrinkSplit(2, 2, 0)).toEqual({ instant_qty: 0, request_qty: 0 });
  });
});

describe("effectiveRule", () => {
  it("uses the model's value, else the shop default", () => {
    expect(effectiveRule(3, 1)).toBe(3);
    expect(effectiveRule(null, 1)).toBe(1);
    expect(effectiveRule(0, 24)).toBe(0);
  });
});
