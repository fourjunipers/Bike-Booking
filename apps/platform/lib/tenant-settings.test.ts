import { describe, expect, it } from "vitest";
import {
  canonicalLocale,
  isCountry,
  isTimeZone,
  settingsOptions,
  tenantSettingsSchema,
} from "./tenant-settings";

const valid = {
  name: "  BSR Bike Shop ",
  country: "th",
  currency: "thb",
  distance_unit: "km",
  locale: "th-th",
};

describe("tenantSettingsSchema", () => {
  it("accepts and normalises a valid shop", () => {
    expect(tenantSettingsSchema.parse(valid)).toEqual({
      name: "BSR Bike Shop",
      country: "TH",
      currency: "THB",
      distance_unit: "km",
      locale: "th-TH",
    });
  });

  it("works for shops outside Thailand", () => {
    const shops = [
      {
        country: "VN",
        currency: "VND",
        distance_unit: "km",
        locale: "vi-VN",
      },
      { country: "JP", currency: "JPY", distance_unit: "km", locale: "ja" },
      { country: "US", currency: "USD", distance_unit: "mi", locale: "en-US" },
      {
        country: "GB",
        currency: "GBP",
        distance_unit: "km",
        locale: "en-GB",
      },
    ];
    for (const shop of shops) {
      const result = tenantSettingsSchema.safeParse({ name: "Shop", ...shop });
      expect(result.success).toBe(true);
    }
  });

  it("rejects unknown values with a message key", () => {
    const errors = (input: Partial<typeof valid>) =>
      tenantSettingsSchema
        .safeParse({ ...valid, ...input })
        .error?.issues.map((i) => i.message);
    expect(errors({ name: "   " })).toEqual(["required"]);
    expect(errors({ country: "XX" })).toEqual(["invalidCountry"]);
    expect(errors({ country: "EU" })).toEqual(["invalidCountry"]);
    expect(errors({ currency: "BAHT" })).toEqual(["invalidCurrency"]);
    expect(errors({ currency: "ZZZ" })).toEqual(["invalidCurrency"]);
    expect(errors({ distance_unit: "furlongs" })).toEqual([
      "invalidDistanceUnit",
    ]);
    expect(errors({ locale: "not a locale" })).toEqual(["invalidLocale"]);
  });
});

describe("helpers", () => {
  it("knows countries", () => {
    expect(isCountry("TH")).toBe(true);
    expect(isCountry("th")).toBe(false);
    expect(isCountry("ZZ")).toBe(false);
  });

  it("knows time zones, including ones with daylight saving", () => {
    expect(isTimeZone("Europe/Berlin")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("")).toBe(false);
  });

  it("canonicalises locale tags", () => {
    expect(canonicalLocale("EN-gb")).toBe("en-GB");
    expect(canonicalLocale("??")).toBeNull();
  });

  it("lists countries, currencies and zones for the form", () => {
    const options = settingsOptions("en");
    expect(options.countries.find((c) => c.code === "TH")?.name).toBe(
      "Thailand",
    );
    expect(options.countries.some((c) => c.code === "ZZ")).toBe(false);
    expect(options.currencies.some((c) => c.code === "VND")).toBe(true);
    expect(options.timeZones).toContain("Asia/Tokyo");
  });
});
