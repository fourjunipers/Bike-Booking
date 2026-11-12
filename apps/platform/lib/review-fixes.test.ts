import { describe, expect, it } from "vitest";
import {
  dbErrorKey,
  fieldErrors,
  ownModelSchema,
  runningAt,
  wholeMinute,
} from "./fleet";

/** The independent Phase 1a review (11 Nov 2026): the parts that are plain code. */
describe("review fix 9: engine size, one range and a readable message", () => {
  const base = {
    make: "Tomos",
    model: "Sprint",
    vehicle_type: "motorbike",
    transmission: "automatic",
  };

  it("accepts 1 to 20000 cc, so a 49 cc moped saves", () => {
    for (const cc of ["1", "49", "20000"])
      expect(ownModelSchema.safeParse({ ...base, cc }).success, cc).toBe(true);
  });

  it("gives the engine-size message under the field outside that range", () => {
    for (const cc of ["0", "20001", "49.5", "big"]) {
      const parsed = ownModelSchema.safeParse({ ...base, cc });
      expect(parsed.success, cc).toBe(false);
      if (!parsed.success)
        expect(fieldErrors(parsed.error), cc).toEqual({ cc: "ccRange" });
    }
  });

  it("turns the database's own refusal into the same message, never a raw error", () => {
    for (const constraint of ["models_cc_check", "bike_catalog_cc_check"])
      expect(
        dbErrorKey({
          code: "23514",
          message: `new row for relation violates check constraint "${constraint}"`,
        }),
      ).toBe("ccRange");
  });
});

describe("review fix 7: ending downtime", () => {
  it("asks only for a block that is running at that instant", () => {
    const now = new Date("2026-11-11T08:30:00.000Z");
    expect(runningAt(now)).toBe(
      "[2026-11-11T08:30:00.000Z,2026-11-11T08:30:00.000Z]",
    );
  });
});

describe("downtime works in whole minutes (owner's click-through, 12 Nov 2026)", () => {
  it('"now" is the start of the current minute, so ending and starting in one minute don\'t collide', () => {
    const ended = wholeMinute(new Date("2026-11-12T03:30:45.123Z"));
    expect(ended.toISOString()).toBe("2026-11-12T03:30:00.000Z");
    // A new downtime typed as 10:30, or started "now" seconds later.
    const startedNow = wholeMinute(new Date("2026-11-12T03:30:58.000Z"));
    expect(startedNow.getTime()).toBeGreaterThanOrEqual(ended.getTime());
    expect(wholeMinute(ended)).toEqual(ended);
  });
});
