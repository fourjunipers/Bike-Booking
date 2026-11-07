import { describe, expect, it } from "vitest";
import { parseSearchParams, searchQuery } from "./search-params";

describe("parseSearchParams", () => {
  it("reads a full search", () => {
    const p = parseSearchParams({
      lat: "13.7146",
      lng: "100.5915",
      place: "Phra Khanong",
      from: "2026-12-01T10:00",
      to: "2026-12-08T10:00",
      type: "touring",
      sort: "price",
      passport: "copy",
    });
    expect(p).toMatchObject({
      lat: 13.7146,
      lng: 100.5915,
      place: "Phra Khanong",
      from: "2026-12-01T10:00",
      to: "2026-12-08T10:00",
      type: "touring",
      sort: "price",
      passportNotHeld: true,
      now: false,
      view: "list",
    });
  });

  it("drops invalid or half-given values", () => {
    const p = parseSearchParams({
      lat: "200",
      lng: "100",
      place: "x",
      from: "2026-12-08T10:00",
      to: "2026-12-01T10:00",
      type: "spaceship",
      sort: "cheapest",
    });
    expect(p.lat).toBeUndefined();
    expect(p.place).toBeUndefined();
    expect(p.from).toBeUndefined();
    expect(p.to).toBeUndefined();
    expect(p.type).toBeUndefined();
    expect(p.sort).toBe("recommended");
  });

  it("needs both dates", () => {
    const p = parseSearchParams({ from: "2026-12-01T10:00" });
    expect(p.from).toBeUndefined();
  });
});

describe("searchQuery", () => {
  it("round-trips and leaves out defaults", () => {
    const q = searchQuery({
      lat: 13.7146,
      lng: 100.5915,
      place: "Phra Khanong",
      from: "2026-12-01T10:00",
      to: "2026-12-08T10:00",
      sort: "recommended",
      view: "list",
      now: false,
      passportNotHeld: false,
      anyDistance: false,
    });
    const back = parseSearchParams(
      Object.fromEntries(new URLSearchParams(q.slice(1))),
    );
    expect(back.place).toBe("Phra Khanong");
    expect(back.from).toBe("2026-12-01T10:00");
    expect(q).not.toContain("sort");
    expect(q).not.toContain("view");
  });

  it("applies overrides", () => {
    expect(searchQuery({ sort: "price" }, { sort: "rating" })).toBe(
      "?sort=rating",
    );
    expect(searchQuery({})).toBe("");
  });
});
