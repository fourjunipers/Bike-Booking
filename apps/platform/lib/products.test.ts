import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import th from "../messages/th.json";
import { buildHistory, historyValue, type AuditRow } from "./history";
import {
  knownModels,
  splitMakeModel,
  suggestKnown,
  type KnownModel,
} from "./known-models";
import {
  buildProductsView,
  defaultProductsView,
  parseProductsView,
  productsFilterCount,
  type ProductInput,
} from "./products-view";
import { catalogSubmitSchema, modelSchema } from "./fleet";
import { adminAreas, canSeeArea, roles } from "./roles";
import { categoriesFor } from "./vehicle-kinds";

const catalog = [
  {
    id: "pcx-21",
    make: "Honda",
    model: "PCX 160",
    year_from: 2021,
    year_to: 2024,
    cc: 157,
    transmission: "automatic" as const,
    type: "city_scooter",
  },
  {
    id: "pcx-25",
    make: "Honda",
    model: "PCX 160",
    year_from: 2025,
    year_to: null,
    cc: 157,
    transmission: "automatic" as const,
    type: "city_scooter",
  },
  {
    id: "click",
    make: "Honda",
    model: "Click 160",
    year_from: null,
    year_to: null,
    cc: 157,
    transmission: "automatic" as const,
    type: "city_scooter",
  },
  {
    id: "classic",
    make: "Royal Enfield",
    model: "Classic 350",
    year_from: 2022,
    year_to: 2022,
    cc: 349,
    transmission: "manual" as const,
    type: "classic",
  },
];
const known: KnownModel[] = knownModels(catalog);
const ids = (models: KnownModel[]) => models.map((m) => m.id);

describe("a product is a kind and a name; details come with the Moto Mangos request", () => {
  const base = {
    name: " Honda PCX 160 ",
    description: "",
    bookable_online: undefined,
    buffer_before_minutes: "",
    buffer_after_minutes: "",
    min_age: "",
    licence_class: "",
    instant_units: "0",
    request_units: "0",
    ready_now: "0",
  };

  it("the product form needs a name and takes no make, model or list entry", () => {
    expect(modelSchema.safeParse(base).data?.name).toBe("Honda PCX 160");
    expect(modelSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
    for (const extra of [{ make: "Honda" }, { catalog_id: "x" }, { cc: "160" }])
      expect(modelSchema.safeParse({ ...base, ...extra }).success).toBe(false);
  });

  it("sending for review needs make, model, engine size and transmission", () => {
    const full = {
      make: " Honda ",
      model: "PCX 160",
      cc: "157",
      transmission: "automatic",
      year_from: "",
      year_to: "",
      note: "",
    };
    expect(catalogSubmitSchema.safeParse(full).data).toMatchObject({
      make: "Honda",
      model: "PCX 160",
      cc: 157,
      transmission: "automatic",
    });
    for (const [field, value] of [
      ["make", ""],
      ["model", " "],
      ["cc", ""],
      ["cc", "0"],
      ["cc", "abc"],
      ["transmission", ""],
      ["transmission", "cvt"],
    ] as const) {
      const result = catalogSubmitSchema.safeParse({ ...full, [field]: value });
      expect(result.success, `${field}=${value}`).toBe(false);
    }
    expect(
      catalogSubmitSchema.safeParse({
        ...full,
        year_from: "2024",
        year_to: "2020",
      }).success,
    ).toBe(false);
  });
});

describe("matching a product's name against known models (the Moto Mangos panel)", () => {
  it("labels a known model with its make, model and years", () => {
    expect(known.map((m) => m.label)).toEqual([
      "Honda PCX 160 (2021–2024)",
      "Honda PCX 160 (2025)",
      "Honda Click 160",
      "Royal Enfield Classic 350 (2022)",
    ]);
  });

  it("suggests nothing until two characters are typed", () => {
    expect(suggestKnown("", known)).toEqual([]);
    expect(suggestKnown("h", known)).toEqual([]);
    expect(suggestKnown("ho", known)).toHaveLength(3);
  });

  it("matches every typed word, in any order and any case", () => {
    expect(ids(suggestKnown("pcx", known))).toEqual(["pcx-21", "pcx-25"]);
    expect(ids(suggestKnown("PCX hon", known))).toEqual(["pcx-21", "pcx-25"]);
    expect(ids(suggestKnown("160 click", known))).toEqual(["click"]);
    expect(ids(suggestKnown("enfield", known))).toEqual(["classic"]);
  });

  it("ignores spacing, so pcx160 finds PCX 160", () => {
    expect(ids(suggestKnown("pcx160", known))).toEqual(["pcx-21", "pcx-25"]);
  });

  it("puts labels that start with the text first, and stops at the limit", () => {
    expect(ids(suggestKnown("honda c", known))[0]).toBe("click");
    expect(suggestKnown("honda", known, 2)).toHaveLength(2);
  });

  it("suggests nothing for a model nobody knows: the owner keeps typing", () => {
    expect(suggestKnown("Yamaha Aerox 155", known)).toEqual([]);
  });

  it("splits typed text into make and model", () => {
    expect(splitMakeModel("Yamaha Aerox 155")).toEqual({
      make: "Yamaha",
      model: "Aerox 155",
    });
    expect(splitMakeModel("  Vespa  ")).toEqual({ make: "Vespa", model: "" });
    expect(splitMakeModel("")).toEqual({ make: "", model: "" });
    // A make of two words is kept whole when the list knows it.
    expect(
      splitMakeModel("royal enfield Hunter 350", ["Honda", "Royal Enfield"]),
    ).toEqual({ make: "Royal Enfield", model: "Hunter 350" });
    expect(splitMakeModel("Royal Enfield Hunter 350")).toEqual({
      make: "Royal",
      model: "Enfield Hunter 350",
    });
  });
});

const product = (extra: Partial<ProductInput> = {}): ProductInput => ({
  id: extra.name ?? "p",
  name: "Honda PCX 160",
  type: "vehicle",
  make: "Honda",
  model: "PCX 160",
  vehicle_type: "motorbike",
  categories: ["city_scooter"],
  cc: 157,
  transmission: "automatic",
  photos: [],
  retired_at: null,
  marketplace_listed: false,
  catalog_rejected_at: null,
  entry_status: null,
  units: [],
  ...extra,
});

describe("the Products list", () => {
  const products = [
    product({
      name: "PCX red",
      entry_status: "approved",
      marketplace_listed: true,
      units: [
        { status: "active" },
        { status: "maintenance" },
        { status: "sold" },
      ],
    }),
    product({
      name: "Aerox",
      make: "Yamaha",
      model: "Aerox 155",
      categories: ["sport", "city_scooter"],
      entry_status: "requested",
    }),
    product({
      name: "Old Wave",
      make: "Honda",
      model: "Wave 110",
      retired_at: "2026-11-01T00:00:00Z",
      units: [{ status: "retired" }],
    }),
    product({
      name: "Yaris",
      make: "Toyota",
      model: "Yaris",
      vehicle_type: "car",
      categories: ["hatchback"],
      cc: null,
      transmission: null,
    }),
  ];
  const names = (view: Partial<typeof defaultProductsView>) =>
    buildProductsView(products, { ...defaultProductsView, ...view }).rows.map(
      (row) => row.name,
    );

  it("lists products in use by name, and counts every product", () => {
    const { rows, total } = buildProductsView(products, defaultProductsView);
    expect(rows.map((row) => row.name)).toEqual(["Aerox", "PCX red", "Yaris"]);
    expect(total).toBe(4);
  });

  it("counts units in the fleet apart from sold and retired ones", () => {
    const row = buildProductsView(products, defaultProductsView).rows.find(
      (r) => r.name === "PCX red",
    )!;
    expect([row.inFleet, row.past]).toEqual([2, 1]);
  });

  it("shows retired products only when asked", () => {
    expect(names({ scope: "retired" })).toEqual(["Old Wave"]);
    expect(names({ scope: "all" })).toHaveLength(4);
  });

  it("filters by kind, by any of a product's categories, and by text", () => {
    expect(names({ kind: "car" })).toEqual(["Yaris"]);
    expect(names({ category: "city_scooter" })).toEqual(["Aerox", "PCX red"]);
    expect(names({ q: "yamaha" })).toEqual(["Aerox"]);
    expect(names({ q: "pcx 160" })).toEqual(["PCX red"]);
    expect(names({ q: "nothing like it" })).toEqual([]);
  });

  it("filters by where a product stands on Moto Mangos; a car has no standing", () => {
    expect(names({ listing: "listed" })).toEqual(["PCX red"]);
    expect(names({ listing: "inReview" })).toEqual(["Aerox"]);
    expect(names({ listing: "notListed" })).toEqual([]);
    const yaris = buildProductsView(products, defaultProductsView).rows.find(
      (r) => r.name === "Yaris",
    )!;
    expect(yaris.listing).toBeNull();
  });

  it("reads a view from the address and ignores what it doesn't know", () => {
    expect(
      parseProductsView({
        q: "  pcx ",
        scope: "retired",
        kind: "car",
        category: "suv",
        listing: "listed",
      }),
    ).toEqual({
      q: "pcx",
      scope: "retired",
      kind: "car",
      category: "suv",
      listing: "listed",
    });
    expect(
      parseProductsView({
        scope: "everything",
        kind: "DROP TABLE",
        category: "1bad",
        listing: "maybe",
        q: ["a", "b"],
      }),
    ).toEqual(defaultProductsView);
    expect(productsFilterCount(defaultProductsView)).toBe(0);
    expect(
      productsFilterCount({ ...defaultProductsView, q: "x", kind: "car" }),
    ).toBe(2);
  });
});

describe("a product's history", () => {
  const row = (extra: Partial<AuditRow>): AuditRow => ({
    id: 1,
    entity: "products",
    entity_id: "p",
    action: "update",
    actor: "user-1",
    before: null,
    after: null,
    at: "2026-11-13T02:00:00Z",
    ...extra,
  });

  it("lists what an update changed, from and to", () => {
    const [entry] = buildHistory([
      row({
        before: { name: "PCX", deposit: null },
        after: { name: "PCX red", deposit: 300000 },
      }),
    ]);
    expect(entry.changes).toEqual([
      { field: "name", from: "PCX", to: "PCX red" },
      { field: "deposit", from: null, to: 300000 },
    ]);
  });

  it("leaves out an update that touched only housekeeping columns", () => {
    expect(
      buildHistory([
        row({
          before: { ready_updated_at: null },
          after: { ready_updated_at: "2026-11-13T02:00:00Z" },
        }),
      ]),
    ).toEqual([]);
  });

  it("keeps additions, deletions and named actions, without a change list", () => {
    const entries = buildHistory([
      row({ id: 3, action: "insert", after: { name: "PCX" } }),
      row({
        id: 2,
        action: "delete",
        entity: "units",
        before: { plate: "A1" },
      }),
      row({ id: 1, action: "clamp_booking_counts", actor: null }),
    ]);
    expect(entries.map((e) => [e.action, e.changes.length])).toEqual([
      ["insert", 0],
      ["delete", 0],
      ["clamp_booking_counts", 0],
    ]);
    expect(entries[2].actor).toBeNull();
  });

  it("words a stored value for a reader", () => {
    const words = { empty: "(empty)", yes: "yes", no: "no" };
    expect(historyValue(null, words)).toBe("(empty)");
    expect(historyValue("", words)).toBe("(empty)");
    expect(historyValue([], words)).toBe("(empty)");
    expect(historyValue(true, words)).toBe("yes");
    expect(historyValue(false, words)).toBe("no");
    expect(historyValue(["sport", "touring"], words)).toBe("sport, touring");
    expect(historyValue(125, words)).toBe("125");
    expect(historyValue("x".repeat(200), words)).toHaveLength(78);
  });
});

describe("menu and wording", () => {
  it("Products is in the menu, before Fleet, for every role", () => {
    expect(adminAreas.slice(0, 2)).toEqual(["products", "fleet"]);
    for (const role of roles) expect(canSeeArea(role, "products")).toBe(true);
  });

  /** Every text under a namespace, as "key: text" lines. */
  const flat = (node: unknown, path = ""): string[] =>
    typeof node === "string"
      ? [`${path}: ${node}`]
      : Object.entries(node as Record<string, unknown>).flatMap(
          ([key, value]) => flat(value, path ? `${path}.${key}` : key),
        );

  it("the new texts exist in both languages, key for key", () => {
    const keys = (lines: string[]) => lines.map((line) => line.split(": ")[0]);
    expect(keys(flat(th.Products))).toEqual(keys(flat(en.Products)));
    expect(keys(flat(th.Fleet.what))).toEqual(keys(flat(en.Fleet.what)));
    expect(th.Nav.products).toBe("สินค้า");
  });

  it("no screen text says make & model, inventory or Manually enter any more", () => {
    const texts = [
      ...flat(en.Fleet),
      ...flat(en.Products),
      ...flat(en.FormErrors),
    ]
      .map((line) => line.slice(line.indexOf(": ") + 2))
      .join("\n");
    expect(texts).not.toMatch(/make & model|makes & models/i);
    expect(texts).not.toMatch(/inventory/i);
    expect(texts).not.toMatch(/manually enter/i);
  });

  it("the create form asks for a kind and a name: the type-ahead texts are gone", () => {
    expect(en.Fleet.what.kindLegend).toBe("What kind of product is it?");
    expect(en.Fleet.model.detailsTitle).toBe("Product details");
    expect(en.Fleet.model.namePlaceholder).toBe("e.g. Honda PCX 160");
    for (const gone of [
      "typeIt",
      "useList",
      "notInList",
      "makeModel",
      "suggestions",
      "notKnown",
    ])
      expect(Object.keys(en.Fleet.what)).not.toContain(gone);
    // The tip no longer speaks of picking from a list on this form.
    expect(Object.keys(en.Fleet.what.tip)).toEqual(["label", "text"]);
    expect(en.Fleet.what.tip.text).not.toMatch(
      /this list|from the list above/i,
    );
  });

  it("Off-road offers ATV, UTV and Dirt bike, labelled in both languages", () => {
    expect(categoriesFor("atv")).toEqual(["atv", "utv", "dirt_bike"]);
    expect(en.Fleet.category.dirt_bike).toBe("Dirt bike");
    expect(th.Fleet.category.dirt_bike).toBeTruthy();
  });
});
