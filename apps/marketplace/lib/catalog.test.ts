import { describe, expect, it } from "vitest";
import { catalogLabel, searchCatalog, yearRange } from "./catalog";

const entry = (
  make: string,
  model: string,
  cc: number,
  year_from: number | null = null,
  year_to: number | null = null,
) => ({ make, model, cc, year_from, year_to });

const catalog = [
  entry("Honda", "PCX 160", 160, 2026, 2026),
  entry("Honda", "Scoopy", 110, 2025, 2026),
  entry("Honda", "Scoopy", 110, 2021, 2023),
  entry("Honda", "CB500X", 471, 2019, 2021),
  entry("Yamaha", "NMAX", 155, 2026, 2026),
  entry("Honda", "Click 160", 160, 2023, 2025),
];

describe("yearRange / catalogLabel", () => {
  it("formats years", () => {
    expect(yearRange(2019, 2022)).toBe("2019–2022");
    expect(yearRange(2026, 2026)).toBe("2026");
    expect(yearRange(2025, null)).toBe("2025–");
    expect(yearRange(null, null)).toBe("");
  });

  it("labels entries", () => {
    expect(catalogLabel(catalog[1])).toBe("Honda Scoopy 2025–2026");
    expect(catalogLabel(entry("Honda", "Forza 350", 330))).toBe(
      "Honda Forza 350",
    );
  });
});

describe("searchCatalog", () => {
  const names = (q: string) => searchCatalog(catalog, q).map(catalogLabel);

  it("matches every word, in any order", () => {
    expect(names("pcx honda")).toEqual(["Honda PCX 160 2026"]);
    expect(names("scoopy 2025")).toEqual(["Honda Scoopy 2025–2026"]);
  });

  it("matches words typed without spaces", () => {
    expect(names("cb500")).toEqual(["Honda CB500X 2019–2021"]);
    expect(names("click160")).toEqual(["Honda Click 160 2023–2025"]);
  });

  it("matches engine size", () => {
    expect(names("155cc")).toEqual(["Yamaha NMAX 2026"]);
  });

  it("returns everything for an empty query", () => {
    expect(searchCatalog(catalog, "  ")).toHaveLength(catalog.length);
  });
});
