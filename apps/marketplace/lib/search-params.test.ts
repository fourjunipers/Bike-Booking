import { describe, expect, it } from "vitest";
import {
  addDays,
  parseSearchParams,
  searchQuery,
  TIME_OPTIONS,
  timeOptions,
} from "./search-params";

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
    expect(p.types).toEqual(["touring"]);
    expect(p).toMatchObject({
      lat: 13.7146,
      lng: 100.5915,
      place: "Phra Khanong",
      from: "2026-12-01T10:00",
      to: "2026-12-08T10:00",
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
    expect(p.types).toEqual([]);
    expect(p.sort).toBe("recommended");
  });

  it("reads several bike types, once each, in a fixed order", () => {
    const p = parseSearchParams({
      type: ["sport", "city_scooter", "spaceship", "sport"],
    });
    expect(p.types).toEqual(["city_scooter", "sport"]);
  });

  it("means any type when none is given", () => {
    expect(parseSearchParams({}).types).toEqual([]);
  });

  it("reads Ride today", () => {
    expect(parseSearchParams({ now: "1" }).now).toBe(true);
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

  it("repeats type for each chosen type, so the link round-trips", () => {
    const q = searchQuery({ types: ["sport", "city_scooter"] });
    expect(q).toBe("?type=city_scooter&type=sport");
    const sp = new URLSearchParams(q.slice(1));
    expect(parseSearchParams({ type: sp.getAll("type") }).types).toEqual([
      "city_scooter",
      "sport",
    ]);
  });

  it("applies overrides", () => {
    expect(searchQuery({ sort: "price" }, { sort: "rating" })).toBe(
      "?sort=rating",
    );
    expect(searchQuery({})).toBe("");
  });
});

describe("time choices", () => {
  it("runs 00:00 to 23:30 in 30-minute steps, 24-hour", () => {
    expect(TIME_OPTIONS).toHaveLength(48);
    expect(TIME_OPTIONS[0]).toBe("00:00");
    expect(TIME_OPTIONS[1]).toBe("00:30");
    expect(TIME_OPTIONS).toContain("13:00");
    expect(TIME_OPTIONS.at(-1)).toBe("23:30");
    expect(TIME_OPTIONS.join(" ")).not.toMatch(/AM|PM/i);
  });

  it("keeps an odd time from a shared link, in order", () => {
    const options = timeOptions("10:15");
    expect(options).toHaveLength(49);
    expect(options.indexOf("10:15")).toBe(options.indexOf("10:00") + 1);
    expect(timeOptions("10:00")).toHaveLength(48);
    expect(timeOptions("bad")).toHaveLength(48);
  });
});

describe("addDays", () => {
  it("adds calendar days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
