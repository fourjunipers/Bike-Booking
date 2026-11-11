import { describe, expect, it } from "vitest";
import {
  editDistance,
  exactPresets,
  normName,
  sameMakeModel,
  suggestCatalog,
} from "./catalog-match";
import { parseCsv } from "./csv";
import { buildBoard, placeItem } from "./dashboard";
import {
  isIsoDate,
  isRentable,
  ownModelSchema,
  parseModelChoice,
  renewalSchema,
  unitSchema,
  unitStatuses,
  vehicleTypes,
  yearBandSchema,
} from "./fleet";
import {
  catalogName,
  importTemplate,
  planImport,
  type ImportContext,
} from "./fleet-import";
import {
  activeFilterCount,
  buildFleetView,
  defaultView,
  parseView,
  viewQuery,
  type FleetViewOptions,
  type ViewBand,
  type ViewModel,
  type ViewUnit,
} from "./fleet-view";
import {
  currentRenewals,
  daysUntil,
  reminderSettingsSchema,
  renewalState,
  renewalsToShow,
  type Renewal,
} from "./renewals";

describe("bike form rules", () => {
  const unit = {
    location_id: "7c1f9a5e-1d2b-4c3d-8e4f-5a6b7c8d9e0f",
    plate: "",
    plate_pending: "",
    frame_number: "",
    engine_number: "",
    colour: "",
    model_year: "",
    notes: "",
  };

  it("a bike needs a plate or the plate-pending flag", () => {
    expect(
      unitSchema.safeParse(unit).error?.issues.map((i) => i.message),
    ).toEqual(["plateOrPending"]);
    expect(
      unitSchema.parse({ ...unit, plate_pending: "on" }).plate_pending,
    ).toBe(true);
    // Any country's plate, and a plate clears the pending flag.
    expect(
      unitSchema.parse({ ...unit, plate: " 1กข-1234 ", plate_pending: "on" }),
    ).toMatchObject({ plate: "1กข-1234", plate_pending: false });
  });

  it("a model year is a year, or blank", () => {
    expect(unitSchema.parse({ ...unit, plate: "A1" }).model_year).toBeNull();
    expect(
      unitSchema.parse({ ...unit, plate: "A1", model_year: "2024" }).model_year,
    ).toBe(2024);
    for (const bad of ["24", "1900", "2024.5", "new"])
      expect(
        unitSchema
          .safeParse({ ...unit, plate: "A1", model_year: bad })
          .error?.issues.map((i) => i.message),
        bad,
      ).toEqual(["invalidYear"]);
  });

  it("no longer has first-registered, borrowed dates or a status field", () => {
    for (const gone of [
      "first_registered",
      "active_from",
      "active_to",
      "status",
    ])
      expect(
        unitSchema.safeParse({ ...unit, plate: "A1", [gone]: "2026-01-01" })
          .success,
        gone,
      ).toBe(false);
    expect(unitStatuses).toEqual(["active", "maintenance", "retired", "sold"]);
    expect(unitStatuses.filter(isRentable)).toEqual(["active"]);
  });

  it("reads the model chosen in the make and model dropdowns", () => {
    const id = "0b0e3b52-6f0e-4f3a-9a52-2a1c4f3f9d11";
    expect(parseModelChoice(`model:${id}`)).toEqual({ kind: "model", id });
    expect(parseModelChoice(`catalog:${id}`)).toEqual({ kind: "catalog", id });
    expect(parseModelChoice(id)).toBeNull();
    expect(parseModelChoice("")).toBeNull();
  });

  it("year bands and renewals must end after they start", () => {
    expect(
      yearBandSchema.parse({ year_from: "2020", year_to: "2023" }),
    ).toEqual({
      year_from: 2020,
      year_to: 2023,
    });
    expect(
      yearBandSchema.safeParse({ year_from: "2024", year_to: "2020" }).success,
    ).toBe(false);
    const renewal = {
      kind: "road_tax",
      provider: "",
      reference_no: "",
      starts_at: "2026-01-01",
      expires_at: "2026-12-31",
    };
    expect(renewalSchema.parse(renewal)).toMatchObject({ provider: null });
    expect(
      renewalSchema
        .safeParse({ ...renewal, expires_at: "2025-12-31" })
        .error?.issues.map((i) => i.message),
    ).toEqual(["endBeforeStart"]);
    expect(renewalSchema.safeParse({ ...renewal, kind: "mot" }).success).toBe(
      false,
    );
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
  });
});

describe("fleet import: make, then model, from the catalog", () => {
  let next = 0;
  const context = (extra: Partial<ImportContext> = {}): ImportContext => ({
    currency: "THB",
    distanceUnit: "km",
    locations: [
      { id: "loc-main", name: "Main shop", isDefault: true },
      { id: "loc-2", name: "Airport", isDefault: false },
    ],
    models: [
      {
        id: "model-pcx",
        name: "Our PCX",
        catalog_id: "cat-pcx",
        make: "Honda",
        model: "PCX 160",
      },
      // One of the shop's own: not in the catalog.
      {
        id: "model-own",
        name: "Old Wave",
        catalog_id: null,
        make: "Honda",
        model: "Wave 100",
      },
    ],
    catalog: [
      {
        id: "cat-pcx",
        make: "Honda",
        model: "PCX 160",
        year_from: 2026,
        year_to: 2026,
      },
      {
        id: "cat-click",
        make: "Honda",
        model: "Click 160",
        year_from: 2023,
        year_to: 2025,
      },
      {
        id: "cat-cb-old",
        make: "Honda",
        model: "CB500X",
        year_from: 2019,
        year_to: 2021,
      },
      {
        id: "cat-cb-new",
        make: "Honda",
        model: "CB500X",
        year_from: 2022,
        year_to: 2023,
      },
      {
        id: "cat-forza",
        make: "Honda",
        model: "Forza 350",
        year_from: null,
        year_to: null,
      },
    ],
    plates: ["OLD-1"],
    newId: () => `new-${++next}`,
    ...extra,
  });
  const plan = (csv: string, extra?: Partial<ImportContext>) => {
    next = 0;
    return planImport(parseCsv(csv), context(extra));
  };
  const codes = (csv: string, extra?: Partial<ImportContext>) =>
    plan(csv, extra).errors.map((e) => `${e.line}:${e.column}:${e.code}`);

  it("uses the shop's model on that catalog entry, or creates one named from the catalog", () => {
    const result = plan(
      [
        "make,model,model_year,plate,frame_number,odometer,location,purchase_date,purchase_price",
        "Honda,PCX 160,2026,DEMO-1,F1,1200,,2026-01-10,95000",
        "honda,click 160,2024,DEMO-2,F2,,Airport,,",
        "Honda,Click 160,,,F3,,,,",
        "Honda,Forza 350,2021,DEMO-4,,,,,",
      ].join("\n"),
    );
    expect(result.errors).toEqual([]);
    expect(result.models).toEqual([
      {
        id: "new-1",
        catalog_id: "cat-click",
        name: "Honda Click 160 (2023–2025)",
      },
      { id: "new-2", catalog_id: "cat-forza", name: "Honda Forza 350" },
    ]);
    expect(result.units).toHaveLength(4);
    expect(result.units[0]).toMatchObject({
      model_id: "model-pcx",
      location_id: "loc-main",
      plate: "DEMO-1",
      model_year: 2026,
      current_odometer_km: 1200,
      purchase_price: 9500000,
    });
    expect(result.units[1]).toMatchObject({
      model_id: "new-1",
      location_id: "loc-2",
      model_year: 2024,
    });
    // No plate: allowed, flagged as pending. Same new model, no year needed.
    expect(result.units[2]).toMatchObject({
      model_id: "new-1",
      plate: null,
      plate_pending: true,
      model_year: null,
    });
  });

  it("picks the catalog generation from the bike's model year", () => {
    const result = plan(
      "make,model,model_year,plate\nHonda,CB500X,2020,C-1\nHonda,CB500X,2023,C-2",
    );
    expect(result.models.map((m) => m.catalog_id)).toEqual([
      "cat-cb-old",
      "cat-cb-new",
    ]);
    expect(result.models.map((m) => m.name)).toEqual([
      "Honda CB500X (2019–2021)",
      "Honda CB500X (2022–2023)",
    ]);
    // Without a year, or with one no generation covers, it can't tell.
    expect(codes("make,model,model_year,plate\nHonda,CB500X,,C-3")).toEqual([
      "2:model_year:modelNeedsYear",
    ]);
    expect(codes("make,model,model_year,plate\nHonda,CB500X,2010,C-3")).toEqual(
      ["2:model_year:modelNeedsYear"],
    );
  });

  it("lets a shop name its own models, several to a catalog entry", () => {
    const result = plan(
      [
        "make,model,name,plate",
        "Honda,PCX 160,PCX with top box,N-1",
        "Honda,PCX 160,pcx WITH top box,N-2",
        "Honda,PCX 160,Our PCX,N-3",
      ].join("\n"),
    );
    expect(result.errors).toEqual([]);
    expect(result.models).toEqual([
      { id: "new-1", catalog_id: "cat-pcx", name: "PCX with top box" },
    ]);
    expect(result.units.map((u) => u.model_id)).toEqual([
      "new-1",
      "new-1",
      "model-pcx",
    ]);
    // Two models on the entry and no name given: ask which.
    const two = {
      models: [
        {
          id: "a",
          name: "PCX A",
          catalog_id: "cat-pcx",
          make: "Honda",
          model: "PCX 160",
        },
        {
          id: "b",
          name: "PCX B",
          catalog_id: "cat-pcx",
          make: "Honda",
          model: "PCX 160",
        },
      ],
    };
    expect(codes("make,model,plate\nHonda,PCX 160,N-4", two)).toEqual([
      "2:name:modelNeedsName",
    ]);
    // A name that belongs to a different bike.
    expect(codes("make,model,name,plate\nHonda,Click 160,Our PCX,N-5")).toEqual(
      ["2:name:nameOtherModel"],
    );
  });

  it("reads the odometer in the shop's unit and money in its currency", () => {
    const result = plan(
      "make,model,odometer,purchase_price\nHonda,PCX 160,1000,1200000",
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
        "make,model,model_year,plate,odometer,location,purchase_date,purchase_price",
        ",PCX 160,,A-1,,,,",
        "Hodna,PCX 160,,A-2,,,,",
        "Honda,PCX 1600,,A-3,,,,",
        "Honda,PCX 160,,OLD-1,,,,",
        "Honda,PCX 160,,a-1,,,,",
        "Honda,PCX 160,26,A-6,12km,Nowhere,2026-13-01,12.345",
      ].join("\n"),
    );
    expect(result.models).toEqual([]);
    expect(result.units).toEqual([]);
    expect(result.errors.map((e) => `${e.line}:${e.column}:${e.code}`)).toEqual(
      [
        "2:make:required",
        // Not in the list, so they would be the shop's own: a motorbike
        // needs its engine size and transmission.
        "3:cc:ownNeedsSpecs",
        "4:cc:ownNeedsSpecs",
        "5:plate:plateExists",
        "6:plate:plateDuplicateInFile",
        "7:model_year:invalidYear",
        "7:odometer:invalidNumber",
        "7:location:locationUnknown",
        "7:purchase_price:invalidMoney",
        "7:purchase_date:invalidDate",
      ],
    );
  });

  it("refuses unknown and removed columns, missing columns and an empty file", () => {
    expect(
      codes("make,model,first_registered\nHonda,PCX 160,2026-01-01"),
    ).toEqual(["1:first_registered:unknownColumn"]);
    expect(codes("make,model,catalog\nHonda,PCX 160,x")).toEqual([
      "1:catalog:unknownColumn",
    ]);
    expect(codes("plate\nA-1")).toEqual([
      "1:make:missingColumns",
      "1:model:missingColumns",
    ]);
    expect(codes("make,model")).toEqual(["1::noRows"]);
  });

  it("a make and model outside the list becomes one of the shop's own, with no approval", () => {
    const result = plan(
      [
        "make,model,plate,vehicle_type,cc,transmission",
        "Kymco,Like 125,K-1,,125,automatic",
        "kymco,like125,K-2,,,",
        "Toyota,Yaris,K-3,car,,",
        "Honda,Wave 100,K-4,,,",
        "HONDA,wave100,K-5,,,",
        "Yamaha,242X,K-6,Boat,,",
      ].join("\n"),
    );
    expect(result.errors).toEqual([]);
    expect(result.models).toEqual([
      {
        id: "new-1",
        name: "Kymco Like 125",
        catalog_id: null,
        make: "Kymco",
        model: "Like 125",
        vehicle_type: "motorbike",
        cc: 125,
        transmission: "automatic",
      },
      {
        id: "new-2",
        name: "Toyota Yaris",
        catalog_id: null,
        make: "Toyota",
        model: "Yaris",
        vehicle_type: "car",
        cc: null,
        transmission: null,
      },
      {
        id: "new-3",
        name: "Yamaha 242X",
        catalog_id: null,
        make: "Yamaha",
        model: "242X",
        vehicle_type: "boat",
        cc: null,
        transmission: null,
      },
    ]);
    // Same make and model, whatever the case and spacing: one model, not two.
    expect(result.units.map((u) => u.model_id)).toEqual([
      "new-1",
      "new-1",
      "new-2",
      "model-own",
      "model-own",
      "new-3",
    ]);
    expect(codes("make,model,vehicle_type\nKymco,Like,plane")).toEqual([
      "2:vehicle_type:invalidVehicleType",
    ]);
    expect(codes("make,model,cc,transmission\nKymco,Like,125,cvt")).toEqual([
      "2:transmission:invalidTransmission",
    ]);
    expect(codes("make,model,cc\nKymco,Like,125")).toEqual([
      "2:transmission:ownNeedsSpecs",
    ]);
  });

  it("ships a template that imports cleanly", () => {
    const result = plan(importTemplate());
    expect(result.errors).toEqual([]);
    expect(result.units).toHaveLength(1);
    expect(result.units[0]).toMatchObject({
      model_id: "model-pcx",
      model_year: 2026,
    });
    expect(
      catalogName({
        make: "Honda",
        model: "Wave",
        year_from: null,
        year_to: null,
      }),
    ).toBe("Honda Wave");
  });
});

describe("the shop's own models and the presets", () => {
  const presets = [
    {
      id: "pcx26",
      make: "Honda",
      model: "PCX 160",
      year_from: 2026,
      year_to: 2026,
    },
    {
      id: "pcx21",
      make: "Honda",
      model: "PCX 160",
      year_from: 2021,
      year_to: 2025,
    },
    {
      id: "click",
      make: "Honda",
      model: "Click 160",
      year_from: 2023,
      year_to: 2025,
    },
    {
      id: "adv",
      make: "Honda",
      model: "ADV 160",
      year_from: 2026,
      year_to: 2026,
    },
    {
      id: "nmax",
      make: "Yamaha",
      model: "NMAX",
      year_from: 2026,
      year_to: 2026,
    },
    {
      id: "forza",
      make: "Honda",
      model: "Forza 350",
      year_from: null,
      year_to: null,
    },
  ];
  const ids = (make: string, model: string) =>
    suggestCatalog(make, model, presets).map((p) => p.id);

  it("own models: vehicle type always; engine size and transmission for motorbikes", () => {
    const base = {
      make: " Kymco ",
      model: "Like 125",
      vehicle_type: "motorbike",
      cc: "125",
      transmission: "automatic",
    };
    expect(ownModelSchema.parse(base)).toEqual({
      make: "Kymco",
      model: "Like 125",
      vehicle_type: "motorbike",
      cc: 125,
      transmission: "automatic",
    });
    const messages = (extra: object) =>
      ownModelSchema
        .safeParse({ ...base, ...extra })
        .error?.issues.map((i) => `${String(i.path[0])}:${i.message}`);
    expect(messages({ cc: "" })).toEqual(["cc:required"]);
    expect(messages({ transmission: "" })).toEqual(["transmission:required"]);
    expect(messages({ vehicle_type: "plane" })).toEqual([
      "vehicle_type:required",
    ]);
    expect(messages({ make: " " })).toEqual(["make:required"]);
    // A boat needs neither.
    expect(
      ownModelSchema.parse({
        ...base,
        vehicle_type: "boat",
        cc: "",
        transmission: "",
      }),
    ).toMatchObject({ vehicle_type: "boat", cc: null, transmission: null });
    expect(vehicleTypes).toEqual(["motorbike", "car", "atv", "boat", "other"]);
  });

  it("the same make and model, ignoring case and spacing", () => {
    expect(normName("  Honda  PCX 160 ")).toBe("hondapcx160");
    expect(sameMakeModel({ make: "HONDA", model: "pcx160" }, presets[0])).toBe(
      true,
    );
    expect(sameMakeModel({ make: "Honda", model: "PCX 150" }, presets[0])).toBe(
      false,
    );
    // Every generation of it is "already in the list".
    expect(
      exactPresets("honda", "p c x 160", presets).map((p) => p.id),
    ).toEqual(["pcx26", "pcx21"]);
    expect(exactPresets("Honda", "Wave", presets)).toEqual([]);
  });

  it("suggests close matches: Did you mean Honda PCX 160?", () => {
    // Punctuation and a missing number; newest generation first.
    expect(ids("Honda", "PCX-160")).toEqual(["pcx26", "pcx21"]);
    expect(ids("Honda", "PCX")).toEqual(["pcx26", "pcx21"]);
    // A typo in the make, and in the model.
    expect(ids("Hodna", "PCX 160")).toEqual(["pcx26", "pcx21"]);
    expect(ids("Honda", "Clikc 160")[0]).toBe("click");
    // Extra words.
    expect(ids("Honda", "ADV 160 ABS")[0]).toBe("adv");
    expect(ids("Yamaha", "N-Max")).toEqual(["nmax"]);
    // The make has to be about right, and something has to be alike.
    expect(ids("Yamaha", "PCX 160")).toEqual([]);
    expect(ids("Honda", "Gold Wing")).toEqual([]);
    expect(ids("Kymco", "Like 125")).toEqual([]);
    expect(editDistance("clikc160", "click160")).toBe(2);
  });
});

describe("fleet view", () => {
  const models: ViewModel[] = [
    {
      id: "pcx",
      name: "Honda PCX",
      make: "Honda",
      model: "PCX 160",
      cc: 160,
      transmission: "automatic",
    },
    {
      id: "click",
      name: "Honda Click",
      make: "Honda",
      model: "Click 160",
      cc: 160,
      transmission: "automatic",
    },
    {
      id: "nmax",
      name: "Yamaha NMAX",
      make: "Yamaha",
      model: "NMAX",
      cc: 155,
      transmission: "automatic",
    },
    {
      id: "cb",
      name: "Honda CB500X",
      make: "Honda",
      model: "CB500X",
      cc: 471,
      transmission: "manual",
    },
  ];
  const bands: ViewBand[] = [
    { model_id: "pcx", year_from: 2014, year_to: 2019 },
    { model_id: "pcx", year_from: 2024, year_to: 2026 },
    { model_id: "pcx", year_from: 2020, year_to: 2023 },
  ];
  const locations = [
    { id: "main", name: "Main shop" },
    { id: "air", name: "Airport" },
  ];
  let n = 0;
  const unit = (model_id: string, extra: Partial<ViewUnit> = {}): ViewUnit => ({
    id: `u${++n}`,
    model_id,
    location_id: "main",
    plate: `P-${String(n).padStart(3, "0")}`,
    plate_pending: false,
    frame_number: `F${n}`,
    engine_number: null,
    colour: null,
    model_year: null,
    current_odometer_km: n * 100,
    status: "active",
    ...extra,
  });
  const units: ViewUnit[] = [
    unit("pcx", { model_year: 2025 }),
    unit("pcx", { model_year: 2024, status: "maintenance" }),
    unit("pcx", { model_year: 2021 }),
    unit("pcx", { model_year: 2016, location_id: "air" }),
    unit("pcx", { model_year: 2010 }),
    unit("pcx"),
    unit("click", { model_year: 2024 }),
    unit("click", { status: "sold" }),
    unit("nmax", { model_year: 2026, location_id: "air" }),
    unit("cb", { model_year: 2022, plate: null, plate_pending: true }),
  ];
  const view = (options: Partial<FleetViewOptions> = {}) =>
    buildFleetView(
      { units, models, bands, locations },
      // These look at every bike; the default (current fleet) has its own test.
      { ...defaultView, scope: "all", ...options },
    );

  it("groups by model, then the shop's year bands, newest first", () => {
    const result = view();
    expect(result.shown).toBe(10);
    // Make and model order: Honda CB500X, Honda Click, Honda PCX, Yamaha NMAX.
    expect(result.sections.map((s) => s.model?.name)).toEqual([
      "Honda CB500X",
      "Honda Click",
      "Honda PCX",
      "Yamaha NMAX",
    ]);
    const pcx = result.sections[2];
    expect(pcx.count).toBe(6);
    expect(
      pcx.groups.map((g) => [g.band, g.yearFrom, g.yearTo, g.count]),
    ).toEqual([
      ["range", 2024, 2026, 2],
      ["range", 2020, 2023, 1],
      ["range", 2014, 2019, 1],
      ["other", undefined, undefined, 1],
      ["unknown", undefined, undefined, 1],
    ]);
    expect(pcx.groups[0]).toMatchObject({
      make: "Honda",
      model: "PCX 160",
      statusCounts: { active: 1, maintenance: 1 },
    });
  });

  it("shows one group for all years when a model has no bands", () => {
    const click = view().sections[1];
    expect(click.groups).toHaveLength(1);
    expect(click.groups[0]).toMatchObject({
      band: "all",
      count: 2,
      statusCounts: { active: 1, sold: 1 },
    });
  });

  it("keeps an empty band the shop defined", () => {
    const result = view({ status: "maintenance" });
    expect(result.shown).toBe(1);
    expect(result.sections[0].groups.map((g) => g.count)).toEqual([1, 0, 0]);
  });

  it("groups by make, location, status or not at all", () => {
    expect(
      view({ group: "make" }).sections[0].groups.map((g) => [g.title, g.count]),
    ).toEqual([
      ["Honda", 9],
      ["Yamaha", 1],
    ]);
    expect(
      view({ group: "location" }).sections[0].groups.map((g) => [
        g.title,
        g.count,
      ]),
    ).toEqual([
      ["Airport", 2],
      ["Main shop", 8],
    ]);
    expect(
      view({ group: "status" }).sections[0].groups.map((g) => [
        g.status,
        g.count,
      ]),
    ).toEqual([
      ["active", 8],
      ["maintenance", 1],
      ["sold", 1],
    ]);
    const flat = view({ group: "none" });
    expect(flat.sections).toHaveLength(1);
    expect(flat.sections[0].groups[0].count).toBe(10);
  });

  it("filters by make, model, cc, transmission, status, location, year and plate", () => {
    const shown = (options: Partial<FleetViewOptions>) => view(options).shown;
    expect(shown({ make: "Yamaha" })).toBe(1);
    expect(shown({ model: "click" })).toBe(2);
    expect(shown({ ccMin: 160 })).toBe(9);
    expect(shown({ ccMin: 160, ccMax: 200 })).toBe(8);
    expect(shown({ ccMax: 155 })).toBe(1);
    expect(shown({ transmission: "manual" })).toBe(1);
    expect(shown({ status: "sold" })).toBe(1);
    expect(shown({ location: "air" })).toBe(2);
    expect(shown({ year: 2024 })).toBe(2);
    expect(shown({ q: "p-003" })).toBe(1);
    expect(shown({ q: "f10" })).toBe(1);
    expect(shown({ make: "Honda", year: 2024, status: "active" })).toBe(1);
    expect(view({ make: "Suzuki" }).sections).toEqual([]);
  });

  it("sorts groups by cc or bike count, and bikes by plate, odometer or purchase date", () => {
    expect(view({ sort: "count" }).sections.map((s) => s.count)).toEqual([
      6, 2, 1, 1,
    ]);
    expect(view({ sort: "cc" }).sections.map((s) => s.model?.cc)).toEqual([
      155, 160, 160, 471,
    ]);
    expect(
      view({ group: "make", sort: "count" }).sections[0].groups.map(
        (g) => g.title,
      ),
    ).toEqual(["Honda", "Yamaha"]);
    const all = (options: Partial<FleetViewOptions>) =>
      view({ group: "none", ...options }).sections[0].groups[0].units;
    // By plate: natural order, bikes without a plate last.
    expect(
      all({})
        .map((u) => u.plate)
        .slice(-2),
    ).toEqual(["P-009", null]);
    expect(all({ sort: "odometer" })[0].current_odometer_km).toBe(1000);
    const dated = buildFleetView(
      {
        units: [
          { ...units[0], purchase_date: "2024-05-01" },
          { ...units[1], purchase_date: null },
          { ...units[2], purchase_date: "2026-01-10" },
        ],
        models,
        bands: [],
        locations,
      },
      { ...defaultView, group: "none", sort: "purchaseDate" },
    );
    expect(
      dated.sections[0].groups[0].units.map((u) => u.purchase_date),
    ).toEqual(["2026-01-10", "2024-05-01", null]);
  });

  it("reads the view from the address and writes it back without defaults", () => {
    expect(parseView({})).toEqual(defaultView);
    const parsed = parseView({
      group: "make",
      sort: "odometer",
      make: "Honda",
      ccMin: "125",
      ccMax: "abc",
      year: "2024",
      q: "  demo ",
      status: "active",
    });
    expect(parsed).toMatchObject({
      group: "make",
      sort: "odometer",
      make: "Honda",
      ccMin: 125,
      ccMax: null,
      year: 2024,
      q: "demo",
    });
    expect(viewQuery(parsed)).toBe(
      "group=make&sort=odometer&q=demo&make=Honda&ccMin=125&status=active&year=2024",
    );
    expect(viewQuery(defaultView)).toBe("");
    expect(parseView({ group: "colour", sort: "price" })).toEqual(defaultView);
    expect(activeFilterCount(parsed)).toBe(5);
    expect(activeFilterCount(defaultView)).toBe(0);
  });

  it("shows the current fleet by default: sold and retired bikes are kept but out of the way", () => {
    const data = {
      units: [
        ...units,
        unit("nmax", { status: "retired" }),
        unit("pcx", { status: "sold", model_year: 2025 }),
      ],
      models,
      bands,
      locations,
    };
    const current = buildFleetView(data, defaultView);
    // 12 bikes: 3 sold or retired, 9 in the working fleet.
    expect([
      current.shown,
      current.total,
      current.current,
      current.past,
    ]).toEqual([9, 9, 9, 3]);
    expect(
      current.sections
        .flatMap((s) => s.groups.flatMap((g) => g.units))
        .some((u) => u.status === "sold" || u.status === "retired"),
    ).toBe(false);
    const past = buildFleetView(data, { ...defaultView, scope: "past" });
    expect([past.shown, past.total]).toEqual([3, 3]);
    expect(buildFleetView(data, { ...defaultView, scope: "all" }).shown).toBe(
      12,
    );
    // Asking for Sold by name finds them without changing the scope.
    expect(buildFleetView(data, { ...defaultView, status: "sold" }).shown).toBe(
      2,
    );
    expect(parseView({ scope: "past" }).scope).toBe("past");
    expect(parseView({ scope: "junk" }).scope).toBe("current");
    expect(viewQuery({ ...defaultView, scope: "past" })).toBe("scope=past");
    // The scope is not a filter: it does not count as one.
    expect(activeFilterCount(parseView({ scope: "all" }))).toBe(0);
  });

  it("stays fast with 150 bikes in 5 models", () => {
    const five: ViewModel[] = Array.from({ length: 5 }, (_, i) => ({
      id: `m${i}`,
      name: `Model ${i}`,
      make: i < 3 ? "Honda" : "Yamaha",
      model: `M${i}`,
      cc: 110 + i * 15,
      transmission: "automatic",
    }));
    const many: ViewUnit[] = Array.from({ length: 150 }, (_, i) =>
      unit(`m${i % 5}`, { model_year: 2014 + (i % 13) }),
    );
    const manyBands: ViewBand[] = five.flatMap((m) => [
      { model_id: m.id, year_from: 2014, year_to: 2019 },
      { model_id: m.id, year_from: 2020, year_to: 2023 },
      { model_id: m.id, year_from: 2024, year_to: 2026 },
    ]);
    const data = { units: many, models: five, bands: manyBands, locations };
    const started = performance.now();
    let result = buildFleetView(data, defaultView);
    for (let i = 0; i < 99; i++) result = buildFleetView(data, defaultView);
    const each = (performance.now() - started) / 100;
    expect(result.shown).toBe(150);
    expect(result.sections).toHaveLength(5);
    expect(result.sections.every((s) => s.groups.length === 3)).toBe(true);
    // Generous: it takes a fraction of a millisecond.
    expect(each).toBeLessThan(10);
  });
});

describe("renewals", () => {
  const today = { year: 2026, month: 11, day: 11 };
  const renewal = (
    id: string,
    unit_id: string,
    kind: Renewal["kind"],
    expires_at: string,
  ): Renewal => ({
    id,
    unit_id,
    kind,
    provider: null,
    reference_no: null,
    starts_at: null,
    expires_at,
  });

  it("the latest expiry of each kind is the current record", () => {
    const current = currentRenewals([
      renewal("a", "u1", "road_tax", "2025-12-31"),
      renewal("b", "u1", "road_tax", "2026-12-31"),
      renewal("c", "u1", "compulsory_insurance", "2026-12-11"),
      renewal("d", "u2", "road_tax", "2026-11-01"),
    ]);
    expect(current.get("u1")?.road_tax?.id).toBe("b");
    expect(current.get("u1")?.compulsory_insurance?.id).toBe("c");
    expect(current.get("u2")?.road_tax?.id).toBe("d");
    expect(current.get("u2")?.compulsory_insurance).toBeUndefined();
  });

  it("is due from the earliest reminder day, then expired", () => {
    const days = [45, 30, 14, 7];
    expect(daysUntil("2026-12-11", today)).toBe(30);
    expect(renewalState("2026-12-11", today, days)).toBe("due");
    expect(renewalState("2026-12-26", today, days)).toBe("due"); // 45 days
    expect(renewalState("2026-12-27", today, days)).toBe("ok"); // 46 days
    expect(renewalState("2026-11-11", today, days)).toBe("due"); // today
    expect(renewalState("2026-11-10", today, days)).toBe("expired");
    // The shop's own setting decides.
    expect(renewalState("2026-12-11", today, [14, 7])).toBe("ok");
    expect(renewalState("2026-12-11", today, [])).toBe("ok");
    expect(renewalState("2026-11-10", today, [])).toBe("expired");
  });

  it("insurance expiring in 30 days shows on the dashboard; a renewed one doesn't", () => {
    const shown = renewalsToShow(
      [
        renewal("ins", "u1", "compulsory_insurance", "2026-12-11"),
        renewal("old-tax", "u1", "road_tax", "2026-11-01"),
        renewal("new-tax", "u1", "road_tax", "2027-11-01"),
        renewal("late", "u2", "road_tax", "2026-11-08"),
        renewal("far", "u2", "compulsory_insurance", "2027-06-01"),
      ],
      today,
      [45, 30, 14, 7],
    );
    expect(shown.map((r) => r.id)).toEqual(["late", "ins"]);

    const date = (iso: string) => {
      const [year, month, day] = iso.split("-").map(Number);
      return { year, month, day };
    };
    expect(
      placeItem({ kind: "renewal", date: date("2026-12-11") }, today),
    ).toEqual({
      tab: "upcoming",
      section: "renewalsDue",
    });
    expect(
      placeItem({ kind: "renewal", date: date("2026-11-08") }, today),
    ).toEqual({
      tab: "late",
      section: "overdueMaintenance",
    });
    const board = buildBoard(
      shown.map((r) => ({
        id: r.id,
        kind: "renewal" as const,
        date: date(r.expires_at),
        title: r.id,
        href: "/",
      })),
      today,
    );
    expect(board.upcoming.count).toBe(1);
    expect(board.late.count).toBe(1);
  });

  it("reads the reminder setting as typed", () => {
    const parse = (days: string, digest = "") =>
      reminderSettingsSchema.safeParse({
        renewal_reminder_days: days,
        renewal_digest_day: digest,
      });
    expect(parse("45, 30, 14, 7").data).toEqual({
      renewal_reminder_days: [45, 30, 14, 7],
      renewal_digest_day: null,
    });
    expect(parse("7 14;30,30", "1").data).toEqual({
      renewal_reminder_days: [30, 14, 7],
      renewal_digest_day: 1,
    });
    expect(parse("").data?.renewal_reminder_days).toEqual([]);
    expect(parse("0").success).toBe(false);
    expect(parse("400").success).toBe(false);
    expect(parse("soon").success).toBe(false);
    expect(parse("1,2,3,4,5,6,7,8,9,10,11").success).toBe(false);
    expect(parse("30", "31").success).toBe(false);
  });
});
