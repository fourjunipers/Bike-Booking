import { describe, expect, it } from "vitest";
import { rentalDays } from "./rental-days";
import { bangkokDateTime } from "./time";

const at = (date: string, time: string) => bangkokDateTime(date, time);

describe("rentalDays", () => {
  it("counts every started 24 hours as a day (owner's examples)", () => {
    const mon = at("2026-11-09", "10:00");
    expect(rentalDays(mon, at("2026-11-10", "10:00"))).toBe(1);
    expect(rentalDays(mon, at("2026-11-11", "10:00"))).toBe(2);
    expect(rentalDays(mon, at("2026-11-10", "10:30"))).toBe(2);
  });

  it("is at least one day", () => {
    expect(
      rentalDays(at("2026-11-09", "10:00"), at("2026-11-09", "14:00")),
    ).toBe(1);
  });

  it("rejects a return before the pickup", () => {
    const t = at("2026-11-09", "10:00");
    expect(() => rentalDays(t, t)).toThrow(RangeError);
  });
});
