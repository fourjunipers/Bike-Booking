import { describe, expect, it } from "vitest";
import { bookingFee, priceBreakdown, type MarketFeeSettings } from "./fees";

// Test markets. Amounts are minor units (THB: satang, JPY: yen).
const THB: MarketFeeSettings = { currency: "THB", feeMinimum: 50_00 };
const JPY: MarketFeeSettings = { currency: "JPY", feeMinimum: 300 };

describe("bookingFee", () => {
  it("is 10% of the rental after promotions", () => {
    expect(bookingFee(2880_00, THB)).toBe(288_00); // SPEC example
    expect(bookingFee(14000_00, THB)).toBe(1400_00);
  });

  it("rounds to whole currency units, halves up", () => {
    expect(bookingFee(1005_00, THB)).toBe(101_00); // ฿100.50 → ฿101
    expect(bookingFee(1004_00, THB)).toBe(100_00); // ฿100.40 → ฿100
    expect(bookingFee(2880_50, THB)).toBe(288_00); // ฿288.05 → ฿288
  });

  it("rounds to the market's rounding unit", () => {
    const thb10 = { ...THB, feeRoundingUnit: 10 };
    expect(bookingFee(2880_00, thb10)).toBe(290_00); // ฿288 → ฿290
    expect(bookingFee(2840_00, thb10)).toBe(280_00); // ฿284 → ฿280
  });

  it("works in a currency without minor units", () => {
    expect(bookingFee(12_345, JPY)).toBe(1_235); // ¥1,234.5 → ¥1,235
    expect(bookingFee(2_000, JPY)).toBe(300); // minimum
  });

  it("is at least the market's minimum but never more than the rental", () => {
    expect(bookingFee(300_00, THB)).toBe(50_00);
    expect(bookingFee(40_00, THB)).toBe(40_00);
    expect(bookingFee(0, THB)).toBe(0);
  });

  it("rejects fractional amounts and bad settings", () => {
    expect(() => bookingFee(100.5, THB)).toThrow(RangeError);
    expect(() => bookingFee(100_00, { ...THB, currency: "baht" })).toThrow(
      RangeError,
    );
    expect(() => bookingFee(100_00, { ...THB, feeRoundingUnit: 0 })).toThrow(
      RangeError,
    );
  });
});

describe("priceBreakdown", () => {
  it("follows the SPEC 14-day example", () => {
    expect(priceBreakdown(3200_00, 320_00, 0, THB)).toEqual({
      currency: "THB",
      rental: 3200_00,
      discount: 320_00,
      rentalAfterPromotion: 2880_00,
      fee: 288_00,
      rentalAtShop: 2592_00,
      extras: 0,
      dueAtShop: 2592_00,
    });
  });

  it("adds extras to what's paid at the shop, never to the fee", () => {
    const b = priceBreakdown(3200_00, 0, 2800_00, THB);
    expect(b.fee).toBe(320_00);
    expect(b.dueAtShop).toBe(3200_00 - 320_00 + 2800_00);
  });
});
