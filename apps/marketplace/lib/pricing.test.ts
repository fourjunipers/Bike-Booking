import { describe, expect, it } from "vitest";
import {
  bikeAnchorErrors,
  extraAnchorErrors,
  fillDays,
  priceForDays,
  pricingWarnings,
  type Anchors,
} from "./pricing";

const SPEC_ANCHORS: Anchors = { 1: 300, 7: 1800, 14: 3200, 21: 4400, 30: 5500 };

// The table in SPEC "Pricing", days 1–30.
// prettier-ignore
const SPEC_TABLE = [
  300, 550, 800, 1050, 1300, 1550, 1800,
  2000, 2200, 2400, 2600, 2800, 3000, 3200,
  3370, 3540, 3710, 3890, 4060, 4230, 4400,
  4520, 4640, 4770, 4890, 5010, 5130, 5260, 5380, 5500,
];

const totals = (anchors: Anchors, manual = {}) =>
  fillDays(anchors, manual).map((d) => d.total);

describe("fillDays", () => {
  it("reproduces the SPEC example exactly", () => {
    expect(totals(SPEC_ANCHORS)).toEqual(SPEC_TABLE);
  });

  it("marks anchors and only anchors", () => {
    const anchorDays = fillDays(SPEC_ANCHORS)
      .filter((d) => d.isAnchor)
      .map((d) => d.day);
    expect(anchorDays).toEqual([1, 7, 14, 21, 30]);
  });

  it("skips blank optional anchors and fills between the ones set", () => {
    const table = totals({ 1: 300, 30: 5500 });
    expect(table[0]).toBe(300);
    expect(table[29]).toBe(5500);
    // 300 + 5200 × 14/29 = 2810.3 → 2810
    expect(table[14]).toBe(2810);
    const withSeven = totals({ 1: 300, 7: 1800, 30: 5500 });
    expect(withSeven.slice(0, 7)).toEqual(SPEC_TABLE.slice(0, 7));
  });

  it("rounds halves up to the next ฿10", () => {
    // Day 2 between 300 (day 1) and 310 (day 3)... use day 1 → day 7:
    // 100 + (130 − 100) × 1/6 = 105 → 110
    expect(totals({ 1: 100, 7: 130, 30: 1000 })[1]).toBe(110);
  });

  it("keeps manual days and never overwrites them when anchors change", () => {
    const manual = { 10: 2500 };
    const before = fillDays(SPEC_ANCHORS, manual);
    expect(before[9]).toMatchObject({ total: 2500, isManual: true });
    const after = fillDays({ ...SPEC_ANCHORS, 14: 3600 }, manual);
    expect(after[9]).toMatchObject({ total: 2500, isManual: true });
    expect(after[10].total).not.toBe(before[10].total); // day 11 refilled
  });

  it("refuses a manual value on an anchor day", () => {
    expect(() => fillDays(SPEC_ANCHORS, { 7: 1700 })).toThrow(/anchor/);
  });

  it("requires a day-1 price and positive whole baht", () => {
    expect(() => fillDays({ 30: 5500 })).toThrow(/day-1/);
    expect(() => fillDays({ 1: 0, 30: 5500 })).toThrow();
    expect(() => fillDays({ 1: 300.5, 30: 5500 })).toThrow();
    expect(() => fillDays(SPEC_ANCHORS, { 5: -10 })).toThrow();
  });
});

describe("priceForDays", () => {
  const table = fillDays(SPEC_ANCHORS);

  it.each([
    [1, 300],
    [7, 1800],
    [10, 2400],
    [30, 5500],
    [31, 5683], // 5,500 × 31 / 30 = 5,683.3
    [45, 8250], // owner's examples
    [60, 11000],
    [90, 16500],
  ])("%i days = ฿%i", (days, expected) => {
    expect(priceForDays(table, days)).toBe(expected);
  });

  it("rounds half a baht up", () => {
    // 3,015 × 33 / 30 = 3,316.5 → 3,317
    const totals = Array.from({ length: 30 }, (_, i) =>
      i === 29 ? 3015 : 100,
    );
    expect(priceForDays(totals, 33)).toBe(3317);
  });

  it("accepts a plain array of totals", () => {
    expect(priceForDays(SPEC_TABLE, 45)).toBe(8250);
  });

  it("rejects bad lengths", () => {
    expect(() => priceForDays(table, 0)).toThrow();
    expect(() => priceForDays(table, 1.5)).toThrow();
    expect(() => priceForDays(SPEC_TABLE.slice(1), 3)).toThrow();
  });
});

describe("pricingWarnings", () => {
  it("is quiet for the SPEC example", () => {
    expect(pricingWarnings(fillDays(SPEC_ANCHORS))).toEqual([]);
  });

  it("flags a longer rental cheaper than a shorter one", () => {
    const table = fillDays(SPEC_ANCHORS, { 9: 1700 });
    expect(pricingWarnings(table)).toContainEqual({
      kind: "cheaper_than_shorter",
      day: 9,
      shorterDay: 8,
    });
  });

  it("flags a day below the 1-day price", () => {
    const table = fillDays(SPEC_ANCHORS, { 2: 250 });
    expect(pricingWarnings(table)).toContainEqual({
      kind: "below_day_one",
      day: 2,
    });
  });
});

describe("anchor rules", () => {
  it("bikes need days 1 and 30", () => {
    expect(bikeAnchorErrors(SPEC_ANCHORS)).toEqual([]);
    expect(bikeAnchorErrors({ 1: 300 })).toHaveLength(1);
    expect(bikeAnchorErrors({})).toHaveLength(2);
  });

  it("extras need day 1 and take only 1, 7 and 30", () => {
    expect(extraAnchorErrors({ 1: 200 })).toEqual([]);
    expect(extraAnchorErrors({ 1: 200, 7: 1000, 30: 3000 })).toEqual([]);
    expect(extraAnchorErrors({ 7: 1000 })).toHaveLength(1);
    expect(extraAnchorErrors({ 1: 200, 14: 2000 })).toHaveLength(1);
  });
});

describe("time-based extras", () => {
  it("1-day price only = price × days", () => {
    const table = fillDays({ 1: 255 });
    expect(priceForDays(table, 3)).toBe(765);
    expect(priceForDays(table, 30)).toBe(7650);
  });

  it("BSR use outside Bangkok, 110–125cc: ฿200/day, ฿4,800/30 days", () => {
    const table = fillDays({ 1: 200, 30: 4800 });
    expect(priceForDays(table, 3)).toBe(520);
    expect(priceForDays(table, 7)).toBe(1150);
    expect(priceForDays(table, 10)).toBe(1630);
    expect(priceForDays(table, 30)).toBe(4800);
  });

  it("BSR damage/theft cover, 450–699cc: ฿300 / ฿1,500 / ฿4,500", () => {
    const table = fillDays({ 1: 300, 7: 1500, 30: 4500 });
    expect(priceForDays(table, 7)).toBe(1500);
    // 1500 + 3000 × 3/23 = 1891.3 → 1890
    expect(priceForDays(table, 10)).toBe(1890);
    expect(pricingWarnings(table)).toEqual([]);
  });

  it("continues past the last anchor at its daily rate", () => {
    // 1,000 per 7 days → day 10 = 1000 × 10/7 = 1428.6 → 1430
    expect(totals({ 1: 200, 7: 1000 })[9]).toBe(1430);
  });
});

// BSR_SEED.md Part 2 (Base dropped, owner decision 3 Nov 2026).
const BSR: Array<[string, [number, number, number, number, number]]> = [
  ["Honda Click 125i", [300, 1400, 2100, 2600, 3000]],
  ["Yamaha Grand Filano", [300, 1400, 2300, 2800, 3200]],
  ["Honda Scoopy", [300, 1500, 2500, 3000, 3500]],
  ["Honda Lead", [300, 1500, 2500, 3000, 3500]],
  ["Yamaha Fazzio", [350, 1500, 2500, 3000, 3500]],
  ["Honda Click 150i", [350, 1500, 2500, 3000, 3500]],
  ["Honda Scoopy (New Gen)", [350, 1700, 2700, 3400, 3900]],
  ["Honda Giorno", [350, 1700, 2700, 3400, 3900]],
  ["Honda Lead (New Gen)", [400, 1800, 2800, 3500, 4000]],
  ["Yamaha Aerox 155 (1st Gen)", [400, 1800, 2800, 3500, 4000]],
  ["Honda Click 160", [400, 1900, 2900, 3700, 4500]],
  ["Yamaha Aerox 155 (2nd Gen)", [500, 2200, 3500, 4500, 5400]],
  ["Yamaha NMAX", [600, 2500, 3900, 5000, 5900]],
  ["Benelli Leoncino 250", [600, 2500, 3900, 5000, 5900]],
  ["Honda PCX 160", [650, 2800, 4200, 5400, 6200]],
  ["Honda ADV 160", [650, 3000, 4400, 5700, 6500]],
  ["Honda NX500", [2100, 14000, 22000, 28000, 34000]],
  ["Honda CB500X 2022–2023", [1800, 12000, 20000, 26000, 31000]],
  ["Honda CB500X 2019–2021", [1500, 10000, 18000, 23000, 28000]],
  ["Honda CB500X 2016–2018", [1200, 8000, 15000, 21000, 26000]],
  ["Honda Forza 350", [1100, 7000, 13000, 17000, 21000]],
  ["Honda CB300R", [900, 6000, 10000, 15000, 19000]],
  ["Honda CRF300L", [1100, 7000, 13000, 18000, 22000]],
  ["Yamaha WR155", [700, 4500, 8000, 11500, 14000]],
];

describe("BSR fleet anchors", () => {
  it.each(BSR)(
    "%s fills cleanly with no warnings",
    (_name, [d1, d7, d14, d21, d30]) => {
      const anchors: Anchors = { 1: d1, 7: d7, 14: d14, 21: d21, 30: d30 };
      const table = fillDays(anchors);
      expect(bikeAnchorErrors(anchors)).toEqual([]);
      expect(pricingWarnings(table)).toEqual([]);
      expect([1, 7, 14, 21, 30].map((d) => table[d - 1].total)).toEqual([
        d1,
        d7,
        d14,
        d21,
        d30,
      ]);
      for (const row of table) expect(row.total % 10).toBe(0);
    },
  );

  it("PCX 160 for 14 days is ฿4,200 (seed booking)", () => {
    const table = fillDays({ 1: 650, 7: 2800, 14: 4200, 21: 5400, 30: 6200 });
    expect(priceForDays(table, 14)).toBe(4200);
  });
});
