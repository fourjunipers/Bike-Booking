import { describe, expect, it } from "vitest";
import {
  filterChips,
  mangoFor,
  parseListSort,
  parseReorder,
  rowIcon,
  sortRows,
  type Sortable,
} from "./product-list";

const vehicle = (
  name: string,
  kind: string | null,
  categories: string[] = [],
): Sortable => ({ id: name, name, type: "vehicle", kind, categories });
const general = (name: string, type: string): Sortable => ({
  id: name,
  name,
  type,
  kind: null,
  categories: [],
});

describe("parseListSort and parseReorder", () => {
  it("reads the sort, defaulting to My order", () => {
    expect(parseListSort({ sort: "az" })).toBe("az");
    expect(parseListSort({ sort: "type" })).toBe("type");
    expect(parseListSort({ sort: "mine" })).toBe("mine");
    expect(parseListSort({})).toBe("mine");
    expect(parseListSort({ sort: "price" })).toBe("mine");
    expect(parseListSort({ sort: ["az", "type"] })).toBe("mine");
  });

  it("reorder mode only for ?reorder=1", () => {
    expect(parseReorder({ reorder: "1" })).toBe(true);
    expect(parseReorder({ reorder: "yes" })).toBe(false);
    expect(parseReorder({})).toBe(false);
  });
});

describe("sortRows", () => {
  const rows = [
    vehicle("Yamaha NMAX", "motorbike", ["city_scooter"]),
    vehicle("Crestliner 16'", "boat"),
    general("Helmet", "gear"),
    vehicle("Honda CB500X", "motorbike", ["touring", "adventure"]),
    vehicle("Honda PCX", "motorbike"),
    vehicle("Toyota Yaris", "car", ["sedan"]),
    general("Sun cream", "sale_item"),
    vehicle("Honda Africa Twin", "motorbike", ["adventure"]),
    general("Delivery", "service"),
    vehicle("Honda Click 10", "motorbike", ["city_scooter"]),
    vehicle("Honda Click 2", "motorbike", ["city_scooter"]),
  ];
  const names = (list: Sortable[]) => list.map((row) => row.name);

  it("My order keeps the order it was given", () => {
    expect(sortRows(rows, "mine")).toBe(rows);
  });

  it("A–Z by name, numbers in order, case ignored", () => {
    expect(names(sortRows(rows, "az"))).toEqual([
      "Crestliner 16'",
      "Delivery",
      "Helmet",
      "Honda Africa Twin",
      "Honda CB500X",
      "Honda Click 2",
      "Honda Click 10",
      "Honda PCX",
      "Sun cream",
      "Toyota Yaris",
      "Yamaha NMAX",
    ]);
  });

  it("By type is kind, then category, then name; general products last", () => {
    expect(names(sortRows(rows, "type"))).toEqual([
      // Motorbike: Scooter, then Touring (CB500X's first), Adventure, none.
      "Honda Click 2",
      "Honda Click 10",
      "Yamaha NMAX",
      "Honda CB500X",
      "Honda Africa Twin",
      "Honda PCX",
      "Toyota Yaris",
      "Crestliner 16'",
      "Helmet",
      "Sun cream",
      "Delivery",
    ]);
  });

  it("does not change the list it was given", () => {
    const before = names(rows);
    sortRows(rows, "type");
    sortRows(rows, "az");
    expect(names(rows)).toEqual(before);
  });
});

describe("filterChips", () => {
  it("a motorbike-only shop gets its categories, without a Motorbike chip", () => {
    expect(
      filterChips([
        vehicle("A", "motorbike", ["adventure", "touring"]),
        vehicle("B", "motorbike", ["city_scooter"]),
        vehicle("C", "motorbike"),
      ]),
    ).toEqual([
      { by: "category", key: "city_scooter", kind: "motorbike" },
      { by: "category", key: "touring", kind: "motorbike" },
      { by: "category", key: "adventure", kind: "motorbike" },
    ]);
  });

  it("several kinds: each kind, then its categories; only what the shop has", () => {
    expect(
      filterChips([
        vehicle("Crestliner", "boat"),
        vehicle("NMAX", "motorbike", ["city_scooter"]),
        general("Helmet", "gear"),
      ]),
    ).toEqual([
      { by: "kind", key: "motorbike" },
      { by: "category", key: "city_scooter", kind: "motorbike" },
      { by: "kind", key: "boat" },
      { by: "kind", key: "gear" },
    ]);
  });

  it("nothing to choose from: no chips", () => {
    expect(filterChips([])).toEqual([]);
    expect(filterChips([vehicle("A", "motorbike")])).toEqual([]);
  });
});

describe("rowIcon", () => {
  it("shows the saved kind, so a scooter saved as a boat shows a boat", () => {
    // Honda Spacy on staging (14 Nov 2026) was created with the kind Boat on
    // 11 Nov, while a motorbike still needed an engine size: the icon is
    // right, the saved kind is not.
    expect(rowIcon({ type: "vehicle", kind: "motorbike" })).toBe("motorbike");
    expect(rowIcon({ type: "vehicle", kind: "boat" })).toBe("boat");
  });

  it("a vehicle with no kind or an unknown one shows Other, never a boat or a bike", () => {
    expect(rowIcon({ type: "vehicle", kind: null })).toBe("other");
    expect(rowIcon({ type: "vehicle", kind: "spaceship" })).toBe("other");
  });

  it("a general product shows its type", () => {
    expect(rowIcon({ type: "gear", kind: null })).toBe("gear");
    expect(rowIcon({ type: "service", kind: null })).toBe("service");
  });
});

describe("mangoFor", () => {
  it("colour when listed, colour and amber in review, grey when not; nothing for other products", () => {
    expect(mangoFor("listed")).toEqual({
      image: "colour",
      dot: null,
      label: "listed",
    });
    expect(mangoFor("inReview")).toEqual({
      image: "colour",
      dot: "amber",
      label: "inReview",
    });
    expect(mangoFor("notListed")).toEqual({
      image: "grey",
      dot: null,
      label: "notListed",
    });
    expect(mangoFor("needsChanges")).toEqual({
      image: "grey",
      dot: "red",
      label: "needsChanges",
    });
    expect(mangoFor(null)).toBeNull();
  });
});
