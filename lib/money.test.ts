import { describe, expect, it } from "vitest";
import { bahtToSatang, formatBaht, satangToBaht } from "./money";

describe("bahtToSatang", () => {
  it("multiplies whole baht by 100", () => {
    expect(bahtToSatang(288)).toBe(28800);
    expect(bahtToSatang(50)).toBe(5000);
    expect(bahtToSatang(0)).toBe(0);
  });

  it("rejects fractional baht", () => {
    expect(() => bahtToSatang(28.8)).toThrow(RangeError);
    expect(() => bahtToSatang(Number.NaN)).toThrow(RangeError);
  });
});

describe("satangToBaht", () => {
  it("converts whole-baht satang amounts", () => {
    expect(satangToBaht(28800)).toBe(288);
  });

  it("round-trips with bahtToSatang", () => {
    expect(satangToBaht(bahtToSatang(2592))).toBe(2592);
  });

  it("rejects amounts with a satang part", () => {
    expect(() => satangToBaht(28850)).toThrow(RangeError);
  });
});

describe("formatBaht", () => {
  it("formats with the baht sign and thousands separators", () => {
    expect(formatBaht(2592)).toBe("฿2,592");
    expect(formatBaht(50)).toBe("฿50");
    expect(formatBaht(8870)).toBe("฿8,870");
  });

  it("formats discounts with a minus sign", () => {
    expect(formatBaht(-320)).toBe("−฿320");
  });
});
