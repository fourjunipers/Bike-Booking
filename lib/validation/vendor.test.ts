import { describe, expect, it } from "vitest";
import {
  catalogRequestSchema,
  contactsSchema,
  extraSchema,
  fieldErrors,
  modelSchema,
  parseHours,
  parseInclusionOverrides,
  parsePriceForm,
  shopInclusionsSchema,
  toShopPolicies,
} from "./vendor";

describe("contactsSchema", () => {
  it("normalises phone numbers and accepts BSR's contacts", () => {
    const r = contactsSchema.parse({
      whatsapp: "+66 85 055 0247",
      phone: "+66-85-055-0247",
      line_id: "bsrbikeshop",
      email: "info@bsrbikeshop.com",
    });
    expect(r.whatsapp).toBe("+66850550247");
    expect(r.phone).toBe("+66850550247");
  });

  it("rejects local-format numbers and bad emails", () => {
    const r = contactsSchema.safeParse({
      whatsapp: "085 055 0247",
      email: "x",
    });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!)).toMatchObject({
      whatsapp: "phone",
      email: "email",
    });
  });

  it("allows everything blank", () => {
    expect(
      contactsSchema.parse({
        whatsapp: "",
        phone: " ",
        line_id: "",
        email: "",
      }),
    ).toEqual({});
  });
});

describe("parseHours", () => {
  it("reads open days and skips closed ones", () => {
    const form: Record<string, string> = { closed_0: "on" };
    for (let d = 1; d <= 6; d++) {
      form[`open_${d}`] = d === 6 ? "11:00" : "10:00";
      form[`close_${d}`] = d === 6 ? "16:00" : "18:00";
    }
    const { rows, errors } = parseHours(form);
    expect(errors).toEqual({});
    expect(rows).toHaveLength(6);
    expect(rows[5]).toEqual({ weekday: 6, open: "11:00", close: "16:00" });
  });

  it("requires close after open", () => {
    const { errors } = parseHours({
      open_1: "18:00",
      close_1: "10:00",
      closed_0: "on",
    });
    expect(errors.day_1).toBe("closeAfterOpen");
  });
});

describe("shopInclusionsSchema", () => {
  it("parses the BSR defaults", () => {
    const v = shopInclusionsSchema.parse({
      helmets: "2",
      helmet_type: "",
      helmet_sizes: ["M", "L"],
      gloves: "not_offered",
      jacket: "not_offered",
      rain_gear: "not_offered",
      phone_holder: "on",
      usage_area: "bangkok",
      km_limit: "",
      medical_cover: "on",
      deposit_amount: "2000",
      deposit_methods: ["cash", "card_authorisation"],
      passport: "copy_only",
      deposit_refund_days: "0",
      licence_required: "motorbike",
      min_age: "21",
      notes: "",
    });
    const row = toShopPolicies(v);
    expect(row).toMatchObject({
      helmets: 2,
      helmet_type: null,
      phone_holder: true,
      usb_charger: false,
      km_limit: 0,
      deposit_amount: 2000,
      min_age: 21,
      notes: null,
    });
  });
});

describe("parseInclusionOverrides", () => {
  it("treats blank as 'use shop default' and reads tri-state selects", () => {
    const { overrides, errors } = parseInclusionOverrides(
      {
        gloves: "included",
        usage_area: "thailand",
        top_box: "yes",
        phone_holder: "no",
        helmets: "",
        override_deposit_methods: "on",
      },
      { helmet_sizes: ["XL"], deposit_methods: ["cash"] },
    );
    expect(errors).toEqual({});
    expect(overrides).toEqual({
      gloves: "included",
      usage_area: "thailand",
      top_box: true,
      phone_holder: false,
      deposit_methods: ["cash"],
    });
  });

  it("flags bad values", () => {
    const { errors } = parseInclusionOverrides(
      { gloves: "free", helmets: "9" },
      { helmet_sizes: [], deposit_methods: [] },
    );
    expect(errors).toEqual({ gloves: "invalid", helmets: "range" });
  });
});

describe("modelSchema", () => {
  const base = { qty: "1", booking_mode: "request", visible: "on" };

  it("requires at least one photo", () => {
    const r = modelSchema.safeParse({ ...base, photos: "[]" });
    expect(fieldErrors(r.error!)).toEqual({ photos: "photoRequired" });
  });

  it("parses a model with a deposit override", () => {
    const r = modelSchema.parse({
      ...base,
      photos: JSON.stringify(["s/m/a.webp"]),
      deposit_amount: "5000",
      buffer_after_h: "",
    });
    expect(r).toMatchObject({ qty: 1, deposit_amount: 5000, visible: true });
    expect(r.buffer_after_h).toBeUndefined();
  });
});

describe("parsePriceForm", () => {
  it("reads anchors and manual days, tolerating commas and ฿", () => {
    const { anchors, manual, errors } = parsePriceForm({
      anchor_1: "650",
      anchor_7: "2,800",
      anchor_14: "",
      anchor_30: "฿6,200",
      manual_10: "3500",
    });
    expect(errors).toEqual({});
    expect(anchors).toEqual({ 1: 650, 7: 2800, 30: 6200 });
    expect(manual).toEqual({ 10: 3500 });
  });

  it("requires days 1 and 30", () => {
    const { errors } = parsePriceForm({ anchor_7: "100" });
    expect(errors).toEqual({
      anchor_1: "dayOneRequired",
      anchor_30: "dayThirtyRequired",
    });
  });
});

describe("extraSchema", () => {
  it("time-based: needs a 1-day price and clears the flat price", () => {
    const r = extraSchema.parse({
      name: "Use outside Bangkok",
      price_kind: "time",
      price_rental: "999",
      price_1d: "200",
      price_30d: "4800",
      active: "on",
    });
    expect(r).toMatchObject({
      price_rental: null,
      price_1d: 200,
      price_7d: null,
      price_30d: 4800,
    });
  });

  it("per rental: needs the flat price", () => {
    const r = extraSchema.safeParse({
      name: "Bike passport",
      price_kind: "rental",
    });
    expect(fieldErrors(r.error!)).toEqual({ price_rental: "priceRequired" });
  });
});

describe("catalogRequestSchema", () => {
  it("accepts a request and checks year order", () => {
    expect(
      catalogRequestSchema.safeParse({
        make: "Vespa",
        model: "Primavera 150",
        cc: "150",
        type: "city_scooter",
        transmission: "automatic",
      }).success,
    ).toBe(true);
    const bad = catalogRequestSchema.safeParse({
      make: "Vespa",
      model: "Primavera",
      cc: "150",
      type: "city_scooter",
      transmission: "automatic",
      year_from: "2024",
      year_to: "2020",
    });
    expect(fieldErrors(bad.error!)).toEqual({ year_to: "endAfterStart" });
  });
});
