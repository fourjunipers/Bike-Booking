/**
 * Third round of stage A (owner, 13 Nov 2026): the Fleet view is one line per
 * product; no make or model anywhere on the platform's screens; the CSV
 * import takes a product name per row; buffers are typed in hours.
 */
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import th from "../messages/th.json";
import { parseCsv } from "./csv";
import { hoursToMinutes, listingSchema, minutesToHours } from "./fleet";
import {
  importColumns,
  importTemplate,
  planImport,
  type ImportContext,
} from "./fleet-import";
import {
  buildFleetList,
  defaultFleetList,
  fleetFilterCount,
  matchesText,
  parseFleetList,
  type ListProduct,
  type ListUnit,
} from "./fleet-list";
import { splitMakeModel } from "./known-models";
import {
  catalogOptions,
  inventoryModelOptions,
  shopModelOptions,
} from "./model-options";

let n = 0;
const unit = (extra: Partial<ListUnit> = {}): ListUnit => ({
  id: `u${++n}`,
  plate: `AA-${n}`,
  frame_number: null,
  engine_number: null,
  status: "active",
  location_id: "11111111-1111-4111-8111-111111111111",
  model_year: null,
  ...extra,
});
const product = (
  name: string,
  units: ListUnit[],
  extra: Partial<ListProduct<ListUnit>> = {},
): ListProduct<ListUnit> => ({
  id: name,
  name,
  kind: "motorbike",
  categories: ["city_scooter"],
  retired: false,
  units,
  ...extra,
});

describe("the Fleet view: one line per product", () => {
  const blockedUnit = unit({ plate: "PCX-2" });
  const products = [
    product("honda PCX 160", [
      unit({ plate: "PCX-1" }),
      blockedUnit,
      unit({ plate: "PCX-3", status: "maintenance" }),
      unit({ plate: "PCX-4", status: "sold" }),
    ]),
    product("Yamaha Aerox 155", [unit({ plate: "AER-1", model_year: 2024 })]),
    product("Brand new", []),
    product("Zoomer", [unit({ plate: "ZOO-1", status: "retired" })], {
      retired: true,
    }),
    product("Avanza", [unit({ plate: "AVA-10" }), unit({ plate: "AVA-2" })], {
      kind: "car",
      categories: ["van"],
    }),
  ];
  const blocked = new Set([blockedUnit.id]);
  const list = (view: Partial<typeof defaultFleetList> = {}) =>
    buildFleetList(products, blocked, { ...defaultFleetList, ...view });

  it("lists products A to Z by name, whatever their case, with no headings", () => {
    expect(list().rows.map((row) => row.name)).toEqual([
      "Avanza",
      "Brand new",
      "honda PCX 160",
      "Yamaha Aerox 155",
    ]);
  });

  it("counts a product's vehicles in the fleet, and those available now", () => {
    const pcx = list().rows.find((row) => row.name === "honda PCX 160")!;
    // Four vehicles: one sold (not in the fleet), one in maintenance and one
    // in downtime right now (in the fleet, not available).
    expect([pcx.vehicles, pcx.available]).toEqual([3, 1]);
    expect(pcx.units.map((u) => u.plate)).toEqual(["PCX-1", "PCX-2", "PCX-3"]);
    const fresh = list().rows.find((row) => row.name === "Brand new")!;
    expect([fresh.vehicles, fresh.available]).toEqual([0, 0]);
  });

  it("counts the whole shop: in the fleet, and sold or retired", () => {
    expect([list().current, list().past]).toEqual([6, 2]);
  });

  it("sorts a product's vehicles by plate, numbers in order", () => {
    const avanza = list().rows.find((row) => row.name === "Avanza")!;
    expect(avanza.units.map((u) => u.plate)).toEqual(["AVA-2", "AVA-10"]);
  });

  it("leaves a retired product out of the current fleet, and shows it with the past", () => {
    expect(list().rows.map((r) => r.name)).not.toContain("Zoomer");
    expect(list({ scope: "past" }).rows.map((r) => r.name)).toEqual([
      "honda PCX 160",
      "Zoomer",
    ]);
    expect(list({ scope: "all" }).rows).toHaveLength(5);
  });

  it("searches product names and plates in one box", () => {
    // A name: the product with all its vehicles.
    const byName = list({ q: "pcx 160" });
    expect(byName.rows.map((r) => r.name)).toEqual(["honda PCX 160"]);
    expect(byName.rows[0].units).toHaveLength(3);
    // A plate: its product, with just that vehicle.
    const byPlate = list({ q: "aer-1" });
    expect(byPlate.rows.map((r) => r.name)).toEqual(["Yamaha Aerox 155"]);
    expect(byPlate.shown).toBe(1);
    expect(list({ q: "nothing like it" }).rows).toEqual([]);
  });

  it("filters by product, kind, category, status and year", () => {
    expect(list({ product: "Avanza" }).rows.map((r) => r.name)).toEqual([
      "Avanza",
    ]);
    expect(list({ kind: "car" }).rows.map((r) => r.name)).toEqual(["Avanza"]);
    expect(list({ category: "van" }).rows.map((r) => r.name)).toEqual([
      "Avanza",
    ]);
    const inMaintenance = list({ status: "maintenance" });
    expect(inMaintenance.rows.map((r) => r.name)).toEqual(["honda PCX 160"]);
    expect(inMaintenance.rows[0].units.map((u) => u.plate)).toEqual(["PCX-3"]);
    // The counts on the line are the product's own, whatever the filter.
    expect(inMaintenance.rows[0].vehicles).toBe(3);
    expect(list({ year: 2024 }).rows.map((r) => r.name)).toEqual([
      "Yamaha Aerox 155",
    ]);
  });

  it("keeps a product with no vehicles in sight, until a vehicle filter is on", () => {
    expect(list().rows.map((r) => r.name)).toContain("Brand new");
    expect(list({ status: "active" }).rows.map((r) => r.name)).not.toContain(
      "Brand new",
    );
  });

  it("reads the view from the address: no make, model, group or sort", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(
      parseFleetList({
        q: " pcx ",
        scope: "past",
        product: id,
        status: "sold",
        kind: "car",
        category: "van",
        year: "2024",
        make: "Honda",
        group: "make",
        sort: "cc",
      }),
    ).toEqual({
      q: "pcx",
      scope: "past",
      product: id,
      status: "sold",
      location: "",
      kind: "car",
      category: "van",
      year: 2024,
    });
    // An old link's "model" is the product.
    expect(parseFleetList({ model: id }).product).toBe(id);
    expect(
      parseFleetList({ product: "x", year: "24", status: "gone" }),
    ).toEqual(defaultFleetList);
    expect(fleetFilterCount(defaultFleetList)).toBe(0);
    expect(fleetFilterCount({ ...defaultFleetList, q: "x", year: 2024 })).toBe(
      2,
    );
  });

  it("finds a vehicle by plate, frame or engine number", () => {
    const one = unit({
      plate: "1กข-1234",
      frame_number: "FRAME9",
      engine_number: "ENG7",
    });
    for (const q of ["กข", "frame9", "eng7", ""])
      expect(matchesText(one, q)).toBe(true);
    expect(matchesText(one, "honda")).toBe(false);
  });
});

describe("product dropdowns: one list, A to Z by name", () => {
  const products = [
    { id: "b", name: "yamaha NMAX", retired_at: null },
    { id: "a", name: "Honda PCX 160 2024", retired_at: null },
    { id: "c", name: "Honda PCX 160 2019", retired_at: "2026-11-01T00:00:00Z" },
  ];

  it("Add vehicle offers every product by name, in order", () => {
    expect(inventoryModelOptions(products)).toEqual([
      { value: "model:c", label: "Honda PCX 160 2019" },
      { value: "model:a", label: "Honda PCX 160 2024" },
      { value: "model:b", label: "yamaha NMAX" },
    ]);
  });

  it("a filter leaves a retired product out", () => {
    expect(shopModelOptions(products).map((o) => o.label)).toEqual([
      "Honda PCX 160 2024",
      "yamaha NMAX",
    ]);
  });

  it("the Moto Mangos list is one dropdown of make, model and years", () => {
    expect(
      catalogOptions([
        {
          id: "2",
          make: "Yamaha",
          model: "NMAX",
          year_from: 2020,
          year_to: 2024,
        },
        {
          id: "1",
          make: "Honda",
          model: "PCX 160",
          year_from: 2021,
          year_to: 2021,
        },
      ]),
    ).toEqual([
      { value: "1", label: "Honda PCX 160 (2021)" },
      { value: "2", label: "Yamaha NMAX (2020–2024)" },
    ]);
  });
});

describe("CSV import: a product name per row", () => {
  let ids = 0;
  const context = (extra: Partial<ImportContext> = {}): ImportContext => ({
    currency: "THB",
    distanceUnit: "km",
    locations: [{ id: "loc", name: "Main", isDefault: true }],
    products: [{ id: "pcx", name: "Honda PCX 160 2024" }],
    plates: ["OLD-1"],
    newId: () => `new-${++ids}`,
    ...extra,
  });
  const plan = (rows: string[], extra?: Partial<ImportContext>) =>
    planImport(parseCsv(rows.join("\n")), context(extra));

  it("has no make, model, engine size or transmission column", () => {
    expect(importColumns).toContain("product");
    for (const gone of [
      "make",
      "model",
      "cc",
      "transmission",
      "name",
      "model_year",
    ])
      expect(importColumns).not.toContain(gone);
    expect(importTemplate().split("\n")[0]).toBe(importColumns.join(","));
    expect(
      plan(["make,model,plate", "Honda,PCX,A-1"]).errors.map((e) => e.code),
    ).toEqual(["unknownColumn", "unknownColumn", "missingColumns"]);
  });

  it("puts a vehicle on the product of that name, ignoring case and spacing", () => {
    const result = plan(["product,plate,year", "honda  pcx160 2024,A-1,2024"]);
    expect(result.errors).toEqual([]);
    expect(result.products).toEqual([]);
    expect(result.units).toMatchObject([
      { product_id: "pcx", plate: "A-1", model_year: 2024, location_id: "loc" },
    ]);
  });

  it("creates a product for a new name, once, with its kind and categories", () => {
    const result = plan([
      "product,vehicle_type,category,plate",
      "Honda CB500X 2022-2024,,adventure; touring,B-1",
      "honda cb500x 2022-2024,,,B-2",
      "Toyota Avanza,car,van,C-1",
    ]);
    expect(result.errors).toEqual([]);
    expect(result.products).toEqual([
      {
        id: expect.any(String),
        name: "Honda CB500X 2022-2024",
        vehicle_type: "motorbike",
        categories: ["touring", "adventure"],
      },
      {
        id: expect.any(String),
        name: "Toyota Avanza",
        vehicle_type: "car",
        categories: ["van"],
      },
    ]);
    expect(result.units.map((u) => u.product_id)).toEqual([
      result.products[0].id,
      result.products[0].id,
      result.products[1].id,
    ]);
    // Nothing about a make or a model is sent to the database.
    for (const created of result.products)
      expect(Object.keys(created).sort()).toEqual([
        "categories",
        "id",
        "name",
        "vehicle_type",
      ]);
  });

  it("reports each problem with its line and column, and saves nothing", () => {
    const result = plan([
      "product,vehicle_type,category,plate,year,odometer",
      ",,,D-1,,",
      "New scooter,,,D-2,,",
      "New thing,spaceship,,D-3,,",
      "New car,car,scooter,D-4,,",
      "Honda PCX 160 2024,,,OLD-1,24,abc",
    ]);
    expect(result.units).toEqual([]);
    expect(result.products).toEqual([]);
    expect(result.errors.map((e) => `${e.line} ${e.column} ${e.code}`)).toEqual(
      [
        "2 product required",
        "3 category ownNeedsCategory",
        "4 vehicle_type invalidVehicleType",
        "5 category invalidCategory",
        "6 year invalidYear",
        "6 plate plateExists",
        "6 odometer invalidNumber",
      ],
    );
  });

  it("tells the shop where a make, model and years can go", () => {
    for (const messages of [en, th]) {
      expect(messages.Fleet.import.columnsHelp).toContain("“product”");
      expect(messages.Fleet.import.columnsHelp).not.toContain("“make”");
    }
    expect(en.Fleet.import.columnsHelp).toMatch(
      /put the make, model and years in the product’s name or description/,
    );
  });
});

describe("the review form's first guess at a make and model", () => {
  it("splits a product's name: the first word, or a make the list knows", () => {
    expect(splitMakeModel("Vespa GTX300")).toEqual({
      make: "Vespa",
      model: "GTX300",
    });
    expect(splitMakeModel("  Vespa  ")).toEqual({ make: "Vespa", model: "" });
    expect(splitMakeModel("")).toEqual({ make: "", model: "" });
    expect(
      splitMakeModel("royal enfield Hunter 350", ["Honda", "Royal Enfield"]),
    ).toEqual({ make: "Royal Enfield", model: "Hunter 350" });
  });
});

describe("buffers are typed in hours and stored in minutes", () => {
  it("turns hours, decimals allowed, into minutes", () => {
    expect(hoursToMinutes("")).toBeNull();
    expect(hoursToMinutes("  ")).toBeNull();
    expect(hoursToMinutes("0")).toBe(0);
    expect(hoursToMinutes("0.5")).toBe(30);
    expect(hoursToMinutes("0,5")).toBe(30);
    expect(hoursToMinutes("1.25")).toBe(75);
    expect(hoursToMinutes("24")).toBe(1440);
    expect(hoursToMinutes("168")).toBe(10080);
  });

  it("refuses what isn't a number of hours, or more than a week", () => {
    for (const bad of ["abc", "-1", "1.234", "169", "1e3", "1 hour"])
      expect(hoursToMinutes(bad), bad).toBe("invalid");
  });

  it("shows stored minutes as hours", () => {
    expect(minutesToHours(null)).toBe("");
    expect(minutesToHours(0)).toBe("0");
    expect(minutesToHours(30)).toBe("0.5");
    expect(minutesToHours(90)).toBe("1.5");
    expect(minutesToHours(1440)).toBe("24");
    // What was saved in minutes before reads back to the nearest hundredth.
    expect(minutesToHours(20)).toBe("0.33");
    for (const hours of ["0.5", "2", "1.25", "12"])
      expect(minutesToHours(hoursToMinutes(hours) as number)).toBe(hours);
  });

  it("the labels say hours, in both languages", () => {
    expect(en.Fleet.model.bufferBefore).toBe("Buffer before pickup (hours)");
    expect(en.Fleet.model.bufferAfter).toBe("Buffer after return (hours)");
    expect(th.Fleet.model.bufferBefore).toContain("ชั่วโมง");
  });
});

describe("no make or model on the platform's screens", () => {
  /** Every text under a node, as "key: text" lines. */
  const flat = (node: unknown, path = ""): string[] =>
    typeof node === "string"
      ? [`${path}: ${node}`]
      : Object.entries(node as Record<string, unknown>).flatMap(
          ([key, value]) => flat(value, path ? `${path}.${key}` : key),
        );
  // The one place that asks: the Moto Mangos panel (and its tip, and the
  // import help that says where a make and model can go).
  const allowed =
    /^(motoMangos\.|what\.(make|model|cc|transmission|tip)|import\.columnsHelp|model\.nameHelp|transmission\.)/;

  it("no Fleet or Products text mentions a make, a model, engine size or transmission outside the Moto Mangos panel", () => {
    const stray = [
      ...flat(en.Fleet),
      ...flat(en.Products).map((l) => `Products.${l}`),
    ]
      .filter((line) => !allowed.test(line))
      .filter((line) =>
        /\b(make|makes|model|models|engine size|transmission|brand)\b/i.test(
          line.slice(line.indexOf(": ") + 2),
        ),
      );
    expect(stray).toEqual([]);
  });

  it("the listing settings take whole counts", () => {
    expect(
      listingSchema.safeParse({
        listed: "on",
        instant_units: "2",
        request_units: "",
        ready_now: "1",
      }).data,
    ).toEqual({
      listed: true,
      instant_units: 2,
      request_units: 0,
      ready_now: 1,
    });
    expect(
      listingSchema.safeParse({
        listed: undefined,
        instant_units: "-1",
        request_units: "0",
        ready_now: "0",
      }).success,
    ).toBe(false);
  });

  it("the Moto Mangos panel's texts are the owner's", () => {
    const mm = en.Fleet.motoMangos;
    expect(mm.submitTitle).toBe("List it on Moto Mangos");
    expect(mm.selectFromList).toBe("Select your make and model from the list");
    expect(mm.notInList).toBe(
      "Don’t see your bike above? Send us the details and we’ll get it added",
    );
    expect(mm.bikeYear).toBe("Year of your bike");
    for (const key of Object.keys(mm))
      expect(Object.keys(th.Fleet.motoMangos), key).toContain(key);
  });
});
