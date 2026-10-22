import { describe, expect, it } from "vitest";
import {
  addDays,
  addHours,
  bangkokDateString,
  bangkokDateTime,
  bangkokWeekday,
  startOfBangkokDay,
  toBangkok,
} from "./time";

describe("toBangkok", () => {
  it("shifts UTC to UTC+7", () => {
    expect(toBangkok(new Date("2026-11-03T03:00:00Z"))).toEqual({
      year: 2026,
      month: 11,
      day: 3,
      hour: 10,
      minute: 0,
      weekday: 2, // Tuesday
    });
  });
});

describe("bangkokDateString", () => {
  it("rolls over to the next day after 17:00 UTC", () => {
    expect(bangkokDateString(new Date("2026-10-22T16:59:00Z"))).toBe(
      "2026-10-22",
    );
    expect(bangkokDateString(new Date("2026-10-22T17:00:00Z"))).toBe(
      "2026-10-23",
    );
  });

  it("handles year end", () => {
    expect(bangkokDateString(new Date("2026-12-31T18:00:00Z"))).toBe(
      "2027-01-01",
    );
  });
});

describe("bangkokWeekday", () => {
  it("uses the Bangkok day, not the UTC day", () => {
    // Saturday 20:00 UTC is Sunday 03:00 in Bangkok.
    expect(bangkokWeekday(new Date("2026-10-24T20:00:00Z"))).toBe(0);
  });
});

describe("bangkokDateTime", () => {
  it("converts a Bangkok wall-clock time to UTC", () => {
    expect(bangkokDateTime("2026-11-03", "10:00").toISOString()).toBe(
      "2026-11-03T03:00:00.000Z",
    );
  });

  it("rejects invalid dates and times", () => {
    expect(() => bangkokDateTime("2026-02-30", "10:00")).toThrow(RangeError);
    expect(() => bangkokDateTime("2026-11-03", "24:00")).toThrow(RangeError);
    expect(() => bangkokDateTime("3 Nov", "10:00")).toThrow(RangeError);
  });
});

describe("startOfBangkokDay", () => {
  it("returns Bangkok midnight as a UTC instant", () => {
    expect(
      startOfBangkokDay(new Date("2026-11-03T15:30:00Z")).toISOString(),
    ).toBe("2026-11-02T17:00:00.000Z");
  });
});

describe("addDays / addHours", () => {
  it("computes the pay-later date 3 days before pickup", () => {
    const pickup = bangkokDateTime("2026-11-03", "10:00");
    expect(bangkokDateString(addDays(pickup, -3))).toBe("2026-10-31");
  });

  it("widens a booking by a buffer", () => {
    const pickup = bangkokDateTime("2026-11-03", "10:00");
    expect(toBangkok(addHours(pickup, -2)).hour).toBe(8);
  });
});
