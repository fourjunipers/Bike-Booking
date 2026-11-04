import { describe, expect, it } from "vitest";
import {
  effectiveDeposit,
  effectiveInclusions,
  INCLUSION_FIELDS,
  INCLUSION_GROUPS,
  minimalOverrides,
  type Inclusions,
} from "./inclusions";

// BSR shop defaults (seed).
const shop: Inclusions = {
  helmets: 2,
  helmet_type: null,
  helmet_sizes: [],
  gloves: "not_offered",
  jacket: "not_offered",
  rain_gear: "not_offered",
  phone_holder: true,
  usb_charger: false,
  top_box: false,
  side_panniers: false,
  usage_area: "bangkok",
  km_limit: 0,
  medical_cover: true,
  deposit_methods: ["cash", "card_authorisation"],
  passport: "copy_only",
  deposit_refund_days: 0,
  licence_required: "motorbike",
  min_age: 21,
  experience_required: false,
  notes: "Free luggage storage.",
};

// NX500 overrides (seed).
const touring = {
  gloves: "included",
  usb_charger: true,
  top_box: true,
  side_panniers: true,
  usage_area: "thailand",
  experience_required: true,
} as const;

describe("effectiveInclusions", () => {
  it("is the shop default when there are no overrides", () => {
    const result = effectiveInclusions(shop, null);
    expect(result).toEqual({ ...shop, overridden: [] });
  });

  it("applies overrides and lists the fields that differ", () => {
    const result = effectiveInclusions(shop, { ...touring, helmets: null });
    expect(result.gloves).toBe("included");
    expect(result.usage_area).toBe("thailand");
    expect(result.helmets).toBe(2); // null = shop default
    expect(result.min_age).toBe(21);
    expect(result.overridden.sort()).toEqual(
      [
        "experience_required",
        "gloves",
        "side_panniers",
        "top_box",
        "usage_area",
        "usb_charger",
      ].sort(),
    );
  });

  it("an override equal to the default isn't reported as overridden", () => {
    const result = effectiveInclusions(shop, {
      helmets: 2,
      deposit_methods: ["cash", "card_authorisation"],
    });
    expect(result.overridden).toEqual([]);
  });

  it("false and 0 are real overrides, not 'use default'", () => {
    const result = effectiveInclusions(shop, {
      phone_holder: false,
      helmets: 0,
    });
    expect(result.phone_holder).toBe(false);
    expect(result.helmets).toBe(0);
    expect(result.overridden.sort()).toEqual(["helmets", "phone_holder"]);
  });
});

describe("minimalOverrides", () => {
  it("drops values equal to the shop default", () => {
    expect(
      minimalOverrides(shop, { ...touring, helmets: 2, phone_holder: true }),
    ).toEqual(touring);
  });
});

describe("effectiveDeposit", () => {
  it("uses the model's own amount when set", () => {
    expect(effectiveDeposit(2000, 5000)).toBe(5000);
    expect(effectiveDeposit(2000, null)).toBe(2000);
    expect(effectiveDeposit(null, null)).toBeNull();
  });
});

describe("field groups", () => {
  it("cover every field exactly once", () => {
    const grouped = INCLUSION_GROUPS.flatMap((g) => g.fields);
    expect([...grouped].sort()).toEqual([...INCLUSION_FIELDS].sort());
  });
});
