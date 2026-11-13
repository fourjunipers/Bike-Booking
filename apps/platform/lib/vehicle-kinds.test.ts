import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import th from "../messages/th.json";
import { bikeTypes, vehicleTypes } from "./fleet";
import {
  categoriesFor,
  categoriesFromText,
  categoryFromText,
  categoryRequired,
  checkCategories,
  humanizeKey,
  kindTypes,
  listingStatus,
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
    expect(categoriesFor("atv")).toEqual(["atv", "utv", "dirt_bike"]);
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
    expect(checkCategories("motorbike", [])).toEqual({ error: "required" });
    expect(checkCategories("car", ["  "])).toEqual({ error: "required" });
    expect(checkCategories("atv", [])).toEqual({ categories: [] });
    expect(checkCategories("other", [""])).toEqual({ categories: [] });
  });

  it("a category must belong to its kind", () => {
    expect(checkCategories("car", ["suv"])).toEqual({ categories: ["suv"] });
    expect(checkCategories("motorbike", ["suv"])).toEqual({
      error: "invalidCategory",
    });
    expect(checkCategories("other", ["suv"])).toEqual({
      error: "invalidCategory",
    });
  });

  it("a model can have several categories (owner, 12 Nov 2026)", () => {
    // Kept in the list's own order, without repeats, however they were ticked.
    expect(
      checkCategories("motorbike", ["adventure", "touring", "adventure"]),
    ).toEqual({ categories: ["touring", "adventure"] });
    // One that isn't the kind's spoils the lot.
    expect(checkCategories("motorbike", ["touring", "suv"])).toEqual({
      error: "invalidCategory",
    });
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

  it("reads several categories from one CSV cell, separated by a semicolon", () => {
    expect(categoriesFromText("motorbike", "Adventure; Touring")).toEqual([
      "touring",
      "adventure",
    ]);
    expect(categoriesFromText("motorbike", "scooter;")).toEqual([
      "city_scooter",
    ]);
    expect(categoriesFromText("car", "SUV;suv ; pickup")).toEqual([
      "suv",
      "pickup",
    ]);
    expect(categoriesFromText("car", "")).toEqual([]);
    // A comma is not a separator, and one wrong name fails the cell.
    expect(categoriesFromText("car", "suv, pickup")).toBeNull();
    expect(categoriesFromText("car", "suv; scooter")).toBeNull();
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

describe("the Moto Mangos chip on a model's row", () => {
  const bike = {
    vehicle_type: "motorbike",
    marketplace_listed: false,
    catalog_rejected_at: null as string | null,
  };

  it("green only when it is on an approved entry and switched on", () => {
    expect(
      listingStatus({ ...bike, marketplace_listed: true }, "approved"),
    ).toBe("listed");
    expect(listingStatus(bike, "approved")).toBe("notListed");
    expect(listingStatus(bike, null)).toBe("notListed");
  });

  it("amber while its request waits, red after it was turned down", () => {
    expect(listingStatus(bike, "requested")).toBe("inReview");
    const rejected = { ...bike, catalog_rejected_at: "2026-11-12T00:00:00Z" };
    expect(listingStatus(rejected, null)).toBe("needsChanges");
    // Turned down but still tied to the request (the shop has a twin).
    expect(listingStatus(rejected, "rejected")).toBe("needsChanges");
  });

  it("nothing for a car or a boat: Moto Mangos lists motorbikes only", () => {
    expect(listingStatus({ ...bike, vehicle_type: "car" }, null)).toBeNull();
  });
});
