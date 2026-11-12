import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import th from "../messages/th.json";
import { bikeTypes, vehicleTypes } from "./fleet";
import { planImport, type ImportContext } from "./fleet-import";
import { parseCsv } from "./csv";
import { buildFleetView, defaultView, parseView } from "./fleet-view";
import {
  categoriesFor,
  categoryFromText,
  categoryRequired,
  checkCategory,
  humanizeKey,
  kindTypes,
  reviewNews,
  vehicleKinds,
} from "./vehicle-kinds";

describe("kinds of vehicle and their categories (owner, 12 Nov 2026)", () => {
  it("the kinds are exactly the database's vehicle types", () => {
    expect([...kindTypes].sort()).toEqual([...vehicleTypes].sort());
  });

  it("holds the owner's first lists", () => {
    expect(categoriesFor("motorbike")).toEqual([
      "city_scooter",
      "touring",
      "adventure",
      "sport",
      "classic",
      "off_road",
    ]);
    expect(categoriesFor("car")).toEqual([
      "sedan",
      "suv",
      "pickup",
      "van",
      "hatchback",
      "convertible",
    ]);
    // Dirt bikes are motorbikes ("off_road"); the Off-road kind is ATV and UTV.
    expect(categoriesFor("atv")).toEqual(["atv", "utv"]);
    expect(categoriesFor("boat")).toEqual(["jet_ski", "speedboat", "pontoon"]);
    expect(categoriesFor("other")).toEqual([]);
  });

  it("motorbike categories are the types Moto Mangos files a bike under", () => {
    expect([...categoriesFor("motorbike")].sort()).toEqual(
      [...bikeTypes].sort(),
    );
  });

  it("a category is required for motorbikes and cars only", () => {
    expect(kindTypes.filter(categoryRequired)).toEqual(["motorbike", "car"]);
    expect(checkCategory("motorbike", "")).toEqual({ error: "required" });
    expect(checkCategory("car", "  ")).toEqual({ error: "required" });
    expect(checkCategory("atv", "")).toEqual({ category: null });
    expect(checkCategory("other", "")).toEqual({ category: null });
  });

  it("a category must belong to its kind", () => {
    expect(checkCategory("car", "suv")).toEqual({ category: "suv" });
    expect(checkCategory("motorbike", "suv")).toEqual({
      error: "invalidCategory",
    });
    expect(checkCategory("other", "suv")).toEqual({ error: "invalidCategory" });
  });

  it("every key is one the database accepts", () => {
    for (const kind of vehicleKinds)
      for (const key of kind.categories)
        expect(key).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
  });

  it("every kind and category has an English and a Thai label", () => {
    for (const messages of [en, th]) {
      for (const kind of vehicleKinds) {
        expect(messages.Fleet.kind).toHaveProperty(kind.type);
        for (const key of kind.categories)
          expect(messages.Fleet.category).toHaveProperty(key);
      }
    }
  });

  it("a category with no label yet still reads well", () => {
    expect(humanizeKey("jet_ski")).toBe("Jet ski");
    expect(humanizeKey("suv")).toBe("Suv");
  });

  it("reads a category the way people type it in a CSV file", () => {
    expect(categoryFromText("motorbike", "Scooter")).toBe("city_scooter");
    expect(categoryFromText("motorbike", "off-road")).toBe("off_road");
    expect(categoryFromText("car", " SUV ")).toBe("suv");
    expect(categoryFromText("boat", "Jet ski")).toBe("jet_ski");
    expect(categoryFromText("car", "scooter")).toBeNull();
    expect(categoryFromText("other", "anything")).toBeNull();
  });
});

describe("what the shop is told about a Moto Mangos review", () => {
  const now = new Date("2026-11-12T03:00:00Z");
  const model = (rejected: string | null, approved: string | null) => ({
    catalog_rejected_at: rejected,
    catalog_approved_at: approved,
  });

  it("a rejection shows until it is dealt with, however old", () => {
    expect(reviewNews(model("2026-01-01T00:00:00Z", null), now)).toBe(
      "notAdded",
    );
  });

  it("an approval shows for two weeks", () => {
    expect(reviewNews(model(null, "2026-11-01T00:00:00Z"), now)).toBe("added");
    expect(reviewNews(model(null, "2026-10-28T00:00:00Z"), now)).toBeNull();
  });

  it("nothing to say about a model that was never reviewed", () => {
    expect(reviewNews(model(null, null), now)).toBeNull();
  });
});

describe("CSV import: the category column", () => {
  const context: ImportContext = {
    currency: "THB",
    distanceUnit: "km",
    locations: [{ id: "loc-1", name: "Main", isDefault: true }],
    models: [],
    catalog: [
      {
        id: "cat-pcx",
        make: "Honda",
        model: "PCX 160",
        year_from: null,
        year_to: null,
      },
    ],
    plates: [],
    newId: (() => {
      let n = 0;
      return () => `new-${++n}`;
    })(),
  };
  const plan = (csv: string) =>
    planImport(parseCsv(csv), {
      ...context,
      newId: (() => {
        let n = 0;
        return () => `new-${++n}`;
      })(),
    });

  it("a new car needs a category from the car list", () => {
    const missing = plan("make,model,plate,vehicle_type\nToyota,Yaris,C-1,car");
    expect(missing.errors.map((e) => `${e.column}:${e.code}`)).toEqual([
      "category:ownNeedsCategory",
    ]);
    const wrong = plan(
      "make,model,plate,vehicle_type,category\nToyota,Yaris,C-1,car,scooter",
    );
    expect(wrong.errors.map((e) => `${e.column}:${e.code}`)).toEqual([
      "category:invalidCategory",
    ]);
    const good = plan(
      "make,model,plate,vehicle_type,category\nToyota,Fortuner,C-1,car,SUV",
    );
    expect(good.errors).toEqual([]);
    expect(good.models[0]).toMatchObject({
      vehicle_type: "car",
      category: "suv",
    });
  });

  it('"Off-road" in the kind column is an ATV or UTV; its category is optional', () => {
    const result = plan(
      [
        "make,model,plate,vehicle_type,category",
        "Polaris,RZR,O-1,Off-road,UTV",
        "CFMoto,CForce,O-2,atv,",
      ].join("\n"),
    );
    expect(result.errors).toEqual([]);
    expect(result.models.map((m) => [m.vehicle_type, m.category])).toEqual([
      ["atv", "utv"],
      ["atv", null],
    ]);
  });

  it("a motorbike from the list takes the list's category unless the file names one", () => {
    const plain = plan("make,model,plate\nHonda,PCX 160,P-1");
    expect(plain.errors).toEqual([]);
    expect(plain.models).toEqual([
      { id: "new-1", name: "Honda PCX 160", catalog_id: "cat-pcx" },
    ]);
    const named = plan("make,model,plate,category\nHonda,PCX 160,P-1,touring");
    expect(named.models[0]).toMatchObject({
      catalog_id: "cat-pcx",
      category: "touring",
    });
    const wrong = plan("make,model,plate,category\nHonda,PCX 160,P-1,sedan");
    expect(wrong.errors.map((e) => e.code)).toEqual(["invalidCategory"]);
  });
});

describe("fleet list: the kind filter", () => {
  const data = {
    units: [
      { id: "u1", model_id: "m-bike", status: "active" },
      { id: "u2", model_id: "m-car", status: "active" },
    ].map((u) => ({
      ...u,
      location_id: "loc-1",
      plate: u.id,
      frame_number: null,
      engine_number: null,
      colour: null,
      model_year: null,
      current_odometer_km: 0,
      created_at: "2026-01-01T00:00:00Z",
    })),
    bands: [],
    locations: [{ id: "loc-1", name: "Main" }],
    models: [
      {
        id: "m-bike",
        name: "PCX",
        make: "Honda",
        model: "PCX",
        cc: 160,
        transmission: "automatic",
        kind: "motorbike",
      },
      {
        id: "m-car",
        name: "Yaris",
        make: "Toyota",
        model: "Yaris",
        cc: null,
        transmission: "automatic",
        kind: "car",
      },
      {
        id: "m-empty-car",
        name: "Fortuner",
        make: "Toyota",
        model: "Fortuner",
        cc: null,
        transmission: null,
        kind: "car",
      },
    ],
  };

  it("reads the kind from the address and ignores an unknown one", () => {
    expect(parseView({ kind: "car" }).kind).toBe("car");
    expect(parseView({ kind: "spaceship" }).kind).toBe("");
    expect(defaultView.kind).toBe("");
  });

  it("shows only that kind, including its makes & models with no vehicles yet", () => {
    const cars = buildFleetView(data as never, { ...defaultView, kind: "car" });
    expect(cars.shown).toBe(1);
    expect(cars.sections.map((s) => s.model?.name).sort()).toEqual([
      "Fortuner",
      "Yaris",
    ]);
    const bikes = buildFleetView(data as never, {
      ...defaultView,
      kind: "motorbike",
    });
    expect(bikes.sections.map((s) => s.model?.name)).toEqual(["PCX"]);
  });
});
