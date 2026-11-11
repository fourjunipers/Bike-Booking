import { describe, expect, it } from "vitest";
import { CsvError, parseCsv, parseCsvRecords } from "./csv";
import { formatDistance, fromKm, toKm } from "./distance";
import {
  catalogRequestSchema,
  closureSchema,
  dbErrorKey,
  hoursSchema,
  locationSchema,
  modelSchema,
  unitSchema,
} from "./fleet";
import {
  importTemplate,
  isIsoDate,
  planImport,
  type ImportContext,
} from "./fleet-import";
import {
  formatMoney,
  minorExponent,
  moneyInputValue,
  parseMoney,
} from "./money";
import { fromLocalInput, toLocalInput } from "./shop-time";

describe("csv", () => {
  it("reads quoted fields, doubled quotes, and commas and line breaks inside quotes", () => {
    const records = parseCsvRecords(
      'a,b,c\r\n"x, y","say ""hi""","two\nlines"\r\nlast,,\n',
    );
    expect(records.map((r) => r.fields)).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "two\nlines"],
      ["last", "", ""],
    ]);
    // The record after a multi-line field knows its real line.
    expect(records.map((r) => r.line)).toEqual([1, 2, 4]);
  });

  it("drops a byte-order mark and blank lines, and normalises headers", () => {
    const table = parseCsv("﻿Model, Frame Number\n\nPCX, F1\n  ,  \n");
    expect(table.headers).toEqual(["model", "frame_number"]);
    expect(table.rows).toEqual([
      { line: 3, values: { model: "PCX", frame_number: "F1" } },
    ]);
  });

  it("reads semicolon and tab separated exports", () => {
    expect(parseCsv("model;plate\nPCX;1กข-1234").rows[0].values).toEqual({
      model: "PCX",
      plate: "1กข-1234",
    });
    expect(parseCsv("model\tplate\nPCX\tAB 12").rows[0].values.plate).toBe(
      "AB 12",
    );
  });

  it("fills missing trailing fields with blanks", () => {
    expect(parseCsv("model,plate,colour\nPCX").rows[0].values).toEqual({
      model: "PCX",
      plate: "",
      colour: "",
    });
  });

  it("reports an empty file, an unclosed quote and a repeated header", () => {
    const code = (text: string) => {
      try {
        parseCsv(text);
      } catch (error) {
        return error instanceof CsvError ? [error.code, error.line] : error;
      }
    };
    expect(code("")).toEqual(["empty", 1]);
    expect(code('model\nPCX\n"oops')).toEqual(["unclosedQuote", 3]);
    expect(code("model,Model\nPCX,PCX")).toEqual(["duplicateHeader", 1]);
  });
});

describe("distance", () => {
  it("stores km and shows the shop's unit", () => {
    expect(fromKm(1000, "km")).toBe(1000);
    expect(fromKm(1000, "mi")).toBe(621.4);
    expect(toKm(100, "mi")).toBe(160.9);
    expect(toKm(100, "km")).toBe(100);
  });

  it("gives back the miles that were typed", () => {
    for (const miles of [0, 0.1, 12, 999.9, 12345.6, 87654.3])
      expect(fromKm(toKm(miles, "mi"), "mi")).toBe(miles);
  });

  it("formats in the viewer's locale", () => {
    expect(formatDistance(12345, "km", "en-GB")).toBe("12,345 km");
    expect(formatDistance(1609.344, "mi", "en-US")).toBe("1,000 mi");
    expect(formatDistance(12345, "km", "de-DE")).toBe("12.345 km");
  });
});

describe("money", () => {
  it("knows each currency's minor units", () => {
    expect(minorExponent("THB")).toBe(2);
    expect(minorExponent("JPY")).toBe(0);
    expect(minorExponent("VND")).toBe(0);
    expect(minorExponent("KWD")).toBe(3);
  });

  it("parses major units into integer minor units without floats", () => {
    expect(parseMoney("45000", "THB")).toBe(4500000);
    expect(parseMoney("45,000.50", "THB")).toBe(4500050);
    expect(parseMoney("0.07", "THB")).toBe(7);
    expect(parseMoney("1200000", "VND")).toBe(1200000);
    expect(parseMoney("1.234", "KWD")).toBe(1234);
  });

  it("refuses what isn't an amount in that currency", () => {
    expect(parseMoney("12.5", "JPY")).toBeNull();
    expect(parseMoney("12.345", "THB")).toBeNull();
    expect(parseMoney("-5", "THB")).toBeNull();
    expect(parseMoney("฿500", "THB")).toBeNull();
    expect(parseMoney("", "THB")).toBeNull();
    expect(parseMoney("99999999999999999999", "THB")).toBeNull();
  });

  it("round-trips through a form field and formats by locale", () => {
    expect(moneyInputValue(4500050, "THB")).toBe("45000.50");
    expect(moneyInputValue(7, "THB")).toBe("0.07");
    expect(moneyInputValue(1200000, "VND")).toBe("1200000");
    expect(parseMoney(moneyInputValue(4500050, "THB"), "THB")).toBe(4500050);
    expect(formatMoney(4500050, "THB", "en-US")).toMatch(/45,000\.50/);
    expect(formatMoney(1200000, "JPY", "ja-JP")).toMatch(/1,200,000/);
  });
});

describe("times typed in a location's time zone", () => {
  it("converts both ways with no fixed offset", () => {
    const bangkok = fromLocalInput("2026-11-10T09:30", "Asia/Bangkok")!;
    expect(bangkok.toISOString()).toBe("2026-11-10T02:30:00.000Z");
    expect(toLocalInput(bangkok, "Asia/Bangkok")).toBe("2026-11-10T09:30");
    // London: winter and summer differ by an hour.
    expect(
      fromLocalInput("2026-01-15T09:00", "Europe/London")!.toISOString(),
    ).toBe("2026-01-15T09:00:00.000Z");
    expect(
      fromLocalInput("2026-07-15T09:00", "Europe/London")!.toISOString(),
    ).toBe("2026-07-15T08:00:00.000Z");
  });

  it("handles the hour that is skipped and the hour that repeats", () => {
    // 29 Mar 2026, London: 01:30 doesn't exist; it moves forward to 02:30 BST.
    expect(
      fromLocalInput("2026-03-29T01:30", "Europe/London")!.toISOString(),
    ).toBe("2026-03-29T01:30:00.000Z");
    // 25 Oct 2026, London: 01:30 happens twice; take the earlier (BST).
    expect(
      fromLocalInput("2026-10-25T01:30", "Europe/London")!.toISOString(),
    ).toBe("2026-10-25T00:30:00.000Z");
  });

  it("refuses text that isn't a date and time", () => {
    expect(fromLocalInput("2026-02-30T10:00", "Asia/Bangkok")).toBeNull();
    expect(fromLocalInput("2026-11-10", "Asia/Bangkok")).toBeNull();
    expect(fromLocalInput("2026-11-10T25:00", "Asia/Bangkok")).toBeNull();
  });
});

describe("form rules", () => {
  const catalogId = "0b0e3b52-6f0e-4f3a-9a52-2a1c4f3f9d11";
  const otherId = "7c1f9a5e-1d2b-4c3d-8e4f-5a6b7c8d9e0f";

  it("a model needs a name and a catalog entry", () => {
    const ok = modelSchema.safeParse({
      name: " PCX 160 white ",
      catalog_id: catalogId,
      description: "",
      bookable_online: "on",
      buffer_before_minutes: "",
      buffer_after_minutes: "1440",
      min_age: "21",
      licence_class: "",
      instant_units: "",
      request_units: "2",
      ready_now: "0",
    });
    expect(ok.data).toMatchObject({
      name: "PCX 160 white",
      description: null,
      bookable_online: true,
      buffer_before_minutes: null,
      buffer_after_minutes: 1440,
      min_age: 21,
      instant_units: 0,
      request_units: 2,
    });
    const bad = modelSchema.safeParse({ name: " ", catalog_id: "" });
    expect(bad.error?.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining(["required"]),
    );
  });

  const unit = {
    model_id: catalogId,
    location_id: otherId,
    plate: "",
    plate_pending: "",
    frame_number: "",
    engine_number: "",
    colour: "",
    first_registered: "",
    status: "active",
    active_from: "",
    active_to: "",
    notes: "",
  };

  it("a unit needs a plate or the plate-pending flag", () => {
    expect(
      unitSchema.safeParse(unit).error?.issues.map((i) => i.message),
    ).toEqual(["plateOrPending"]);
    expect(
      unitSchema.parse({ ...unit, plate_pending: "on" }).plate_pending,
    ).toBe(true);
    // Any country's plate, and a plate clears the pending flag.
    const thai = unitSchema.parse({
      ...unit,
      plate: " 1กข-1234 ",
      plate_pending: "on",
    });
    expect(thai).toMatchObject({ plate: "1กข-1234", plate_pending: false });
  });

  it("a unit's dates must be real and in order", () => {
    const messages = (extra: object) =>
      unitSchema
        .safeParse({ ...unit, plate: "A1", ...extra })
        .error?.issues.map((i) => i.message);
    expect(messages({ first_registered: "2026-02-30" })).toEqual([
      "invalidDate",
    ]);
    expect(
      messages({ active_from: "2026-05-01", active_to: "2026-04-01" }),
    ).toEqual(["endBeforeStart"]);
  });

  it("a location takes any time zone and international phones only", () => {
    const location = {
      name: "Main shop",
      timezone: "America/New_York",
      address: "79/37 Soi Phumichit",
      maps_url: "",
      phone: "+66 85 055 0247",
      whatsapp: "",
      line_id: "",
      email: "",
    };
    expect(locationSchema.parse(location)).toMatchObject({
      phone: "+66850550247",
      whatsapp: null,
      maps_url: null,
    });
    const messages = (extra: object) =>
      locationSchema
        .safeParse({ ...location, ...extra })
        .error?.issues.map((i) => i.message);
    expect(messages({ phone: "085 055 0247" })).toEqual(["invalidPhone"]);
    expect(messages({ timezone: "Asia/Atlantis" })).toEqual([
      "invalidTimezone",
    ]);
    expect(messages({ maps_url: "javascript:alert(1)" })).toEqual([
      "invalidUrl",
    ]);
    expect(messages({ email: "not-an-email" })).toEqual(["invalidEmail"]);
  });

  it("hours and closures must end after they start", () => {
    expect(
      hoursSchema.safeParse({ weekday: 1, open: "10:00", close: "18:00" })
        .success,
    ).toBe(true);
    expect(
      hoursSchema.safeParse({ weekday: 1, open: "18:00", close: "10:00" })
        .success,
    ).toBe(false);
    expect(
      closureSchema.safeParse({
        start_date: "2027-04-13",
        end_date: "2027-04-15",
        note: "Songkran",
        repeats_yearly: "on",
      }).data,
    ).toMatchObject({ repeats_yearly: true });
    expect(
      closureSchema.safeParse({
        start_date: "2027-04-15",
        end_date: "2027-04-13",
        note: "",
        repeats_yearly: "",
      }).success,
    ).toBe(false);
  });

  it("a catalog request needs the fields search depends on", () => {
    const request = {
      make: "Honda",
      model: "Wave 110i",
      year_from: "2020",
      year_to: "",
      type: "city_scooter",
      transmission: "semi_auto",
      cc: "110",
      note: "",
    };
    expect(catalogRequestSchema.parse(request)).toMatchObject({
      cc: 110,
      year_to: null,
    });
    expect(catalogRequestSchema.safeParse({ ...request, cc: "" }).success).toBe(
      false,
    );
    expect(
      catalogRequestSchema.safeParse({ ...request, transmission: "cvt" })
        .success,
    ).toBe(false);
  });

  it("names database refusals", () => {
    expect(dbErrorKey({ code: "23P01", message: "conflicting key" })).toBe(
      "blockOverlap",
    );
    expect(
      dbErrorKey({ code: "23505", message: 'violates "units_plate_idx"' }),
    ).toBe("plateExists");
    expect(
      dbErrorKey({ code: "P0001", message: "unit_has_future_blocks" }),
    ).toBe("unit_has_future_blocks");
    expect(dbErrorKey({ code: "42501", message: "row-level security" })).toBe(
      "notAllowed",
    );
    expect(dbErrorKey({ code: "XX000", message: "boom" })).toBe("saveFailed");
  });
});

describe("fleet import", () => {
  let next = 0;
  const context = (extra: Partial<ImportContext> = {}): ImportContext => ({
    currency: "THB",
    distanceUnit: "km",
    locations: [
      { id: "loc-main", name: "Main shop", isDefault: true },
      { id: "loc-2", name: "Airport", isDefault: false },
    ],
    models: [{ id: "model-pcx", name: "Honda PCX 160" }],
    catalog: [
      { id: "cat-pcx", slug: "honda-pcx-160-2026" },
      { id: "cat-click", slug: "honda-click-160-2023-2025" },
    ],
    plates: ["OLD-1"],
    newId: () => `new-${++next}`,
    ...extra,
  });
  const plan = (csv: string, extra?: Partial<ImportContext>) => {
    next = 0;
    return planImport(parseCsv(csv), context(extra));
  };

  it("adds units to an existing model and creates new models from the catalog", () => {
    const result = plan(
      [
        "model,catalog,plate,frame_number,odometer,location,purchase_date,purchase_price,purchased_from",
        "Honda PCX 160,,DEMO-1,F1,1200,,2026-01-10,95000,Dealer",
        "Honda Click 160,honda-click-160-2023-2025,DEMO-2,F2,,Airport,,,",
        "honda click 160,,,F3,,,,,",
      ].join("\n"),
    );
    expect(result.errors).toEqual([]);
    expect(result.models).toEqual([
      { id: "new-1", catalog_id: "cat-click", name: "Honda Click 160" },
    ]);
    expect(result.units).toHaveLength(3);
    expect(result.units[0]).toMatchObject({
      model_id: "model-pcx",
      location_id: "loc-main",
      plate: "DEMO-1",
      plate_pending: false,
      current_odometer_km: 1200,
      purchase_price: 9500000,
      purchase_date: "2026-01-10",
    });
    expect(result.units[1]).toMatchObject({
      model_id: "new-1",
      location_id: "loc-2",
    });
    // No plate: allowed, flagged as pending. Same new model, any letter case.
    expect(result.units[2]).toMatchObject({
      model_id: "new-1",
      plate: null,
      plate_pending: true,
    });
  });

  it("reads the odometer in the shop's unit and money in its currency", () => {
    const result = plan(
      "model,odometer,purchase_price\nHonda PCX 160,1000,1200000",
      { distanceUnit: "mi", currency: "VND" },
    );
    expect(result.units[0]).toMatchObject({
      current_odometer_km: 1609.3,
      purchase_price: 1200000,
    });
  });

  it("reports every problem with its line and column, and saves nothing", () => {
    const result = plan(
      [
        "model,catalog,plate,first_registered,odometer,location,purchase_price",
        ",,A-1,,,,",
        "New Bike,,A-2,,,,",
        "Other Bike,no-such-entry,A-3,,,,",
        "Honda PCX 160,,OLD-1,,,,",
        "Honda PCX 160,,a-1,,,,",
        "Honda PCX 160,,A-6,2026-13-01,12km,Nowhere,12.345",
      ].join("\n"),
    );
    expect(result.models).toEqual([]);
    expect(result.units).toEqual([]);
    expect(result.errors.map((e) => `${e.line}:${e.column}:${e.code}`)).toEqual(
      [
        "2:model:required",
        "3:catalog:catalogNeeded",
        "4:catalog:catalogUnknown",
        "5:plate:plateExists",
        "6:plate:plateDuplicateInFile",
        "7:odometer:invalidNumber",
        "7:location:locationUnknown",
        "7:purchase_price:invalidMoney",
        "7:first_registered:invalidDate",
      ],
    );
  });

  it("refuses one new model name on two catalog entries", () => {
    const result = plan(
      [
        "model,catalog,plate",
        "Scooter,honda-pcx-160-2026,B-1",
        "Scooter,honda-click-160-2023-2025,B-2",
      ].join("\n"),
    );
    expect(result.errors.map((e) => `${e.line}:${e.code}`)).toEqual([
      "3:catalogMismatch",
    ]);
  });

  it("refuses unknown columns, a missing model column and an empty file", () => {
    const codes = (csv: string) => plan(csv).errors.map((e) => e.code);
    expect(codes("model,price\nHonda PCX 160,5")).toEqual(["unknownColumn"]);
    expect(codes("plate\nA-1")).toEqual(["missingModelColumn"]);
    expect(codes("model,plate")).toEqual(["noRows"]);
  });

  it("ships a template that imports cleanly", () => {
    const result = plan(importTemplate());
    expect(result.errors).toEqual([]);
    expect(result.units).toHaveLength(1);
  });

  it("checks calendar dates", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("29/02/2028")).toBe(false);
  });
});
