import { describe, expect, it } from "vitest";
import { addCalendarDays, dateInZone, formatCalendarDate } from "./shop-time";

describe("dateInZone", () => {
  it("reads the date in the shop's zone, not the server's", () => {
    // 20:00 UTC on 9 Nov is already 10 Nov in Bangkok and Tokyo, still 9 Nov in New York.
    const instant = new Date("2026-11-09T20:00:00Z");
    expect(dateInZone(instant, "Asia/Bangkok")).toEqual({
      year: 2026,
      month: 11,
      day: 10,
    });
    expect(dateInZone(instant, "Asia/Tokyo")).toEqual({
      year: 2026,
      month: 11,
      day: 10,
    });
    expect(dateInZone(instant, "America/New_York")).toEqual({
      year: 2026,
      month: 11,
      day: 9,
    });
  });
});

describe("addCalendarDays", () => {
  it("steps across month and year ends", () => {
    expect(addCalendarDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(addCalendarDays({ year: 2028, month: 2, day: 28 }, 1)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
  });

  it("gives the next calendar day across a daylight-saving change", () => {
    // Europe/Berlin springs forward on 29 Mar 2026: that day has 23 hours.
    const today = dateInZone(new Date("2026-03-28T23:30:00Z"), "Europe/Berlin");
    expect(today).toEqual({ year: 2026, month: 3, day: 29 });
    expect(addCalendarDays(today, 1)).toEqual({
      year: 2026,
      month: 3,
      day: 30,
    });
  });
});

describe("formatCalendarDate", () => {
  it("formats in the viewer's language without shifting the day", () => {
    const date = { year: 2026, month: 11, day: 10 };
    expect(formatCalendarDate(date, "en-GB")).toBe("Tuesday 10 November");
    expect(formatCalendarDate(date, "th")).toContain("10");
  });
});
