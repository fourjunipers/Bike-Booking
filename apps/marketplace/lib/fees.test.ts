import { describe, expect, it } from "vitest";
import { bookingFee, priceBreakdown } from "./fees";

// The Bangkok market's fee minimum (฿50, whole baht), as in the SPEC examples.
const MIN = 50;

describe("bookingFee", () => {
  it("is 10% of the rental after promotions", () => {
    expect(bookingFee(2880, MIN)).toBe(288); // SPEC example
    expect(bookingFee(14000, MIN)).toBe(1400);
  });

  it("rounds to the nearest unit, halves up", () => {
    expect(bookingFee(1005, MIN)).toBe(101); // 100.5 → 101
    expect(bookingFee(1004, MIN)).toBe(100); // 100.4 → 100
  });

  it("is at least the market's minimum but never more than the rental", () => {
    expect(bookingFee(300, MIN)).toBe(50);
    expect(bookingFee(40, MIN)).toBe(40);
    expect(bookingFee(0, MIN)).toBe(0);
  });

  it("rejects fractional amounts", () => {
    expect(() => bookingFee(100.5, MIN)).toThrow();
  });
});

describe("priceBreakdown", () => {
  it("follows the SPEC 14-day example", () => {
    expect(priceBreakdown(3200, 320, 0, MIN)).toEqual({
      rental: 3200,
      discount: 320,
      rentalAfterPromotion: 2880,
      fee: 288,
      rentalAtShop: 2592,
      extras: 0,
      dueAtShop: 2592,
    });
  });

  it("adds extras to what's paid at the shop, never to the fee", () => {
    const b = priceBreakdown(3200, 0, 2800, MIN);
    expect(b.fee).toBe(320);
    expect(b.dueAtShop).toBe(3200 - 320 + 2800);
  });
});
