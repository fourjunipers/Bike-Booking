import { describe, expect, it } from "vitest";
import {
  longestWalkIn,
  offerFor,
  type HeldBooking,
  type ModelStock,
} from "./availability";
import { bangkokDateTime } from "./time";

const at = (date: string, time = "10:00") => bangkokDateTime(date, time);
const booking = (
  from: string,
  to: string,
  kind: HeldBooking["kind"] = "request",
): HeldBooking => ({ start: at(from), end: at(to), kind });

const stock = (over: Partial<ModelStock> = {}): ModelStock => ({
  qty: 2,
  instantQty: 0,
  requestQty: 2,
  bufferBeforeH: 0,
  bufferAfterH: 0,
  repairs: [],
  bookings: [],
  ...over,
});

describe("offerFor", () => {
  it("counts free units in the pool", () => {
    const s = stock({ bookings: [booking("2026-11-01", "2026-11-10")] });
    expect(offerFor(s, at("2026-11-05"), at("2026-11-08")).free).toBe(1);
    expect(offerFor(s, at("2026-11-11"), at("2026-11-12")).free).toBe(2);
  });

  it("needs a unit only at the busiest moment (owner's example)", () => {
    // 3 bikes; Nov 1–10, 5–15, 11–20, 16–25 booked. Nov 8–18 still fits.
    const s = stock({
      qty: 3,
      requestQty: 3,
      bookings: [
        booking("2026-11-01", "2026-11-10"),
        booking("2026-11-05", "2026-11-15"),
        booking("2026-11-11", "2026-11-20"),
        booking("2026-11-16", "2026-11-25"),
      ],
    });
    expect(offerFor(s, at("2026-11-08"), at("2026-11-18")).free).toBe(1);
  });

  it("widens bookings by the buffers", () => {
    const s = stock({
      qty: 1,
      requestQty: 1,
      bufferAfterH: 1,
      bookings: [booking("2026-11-09", "2026-11-10")],
    });
    // Back at 10:00, ready again at 11:00 with a 1-hour buffer.
    expect(
      offerFor(s, at("2026-11-10", "10:30"), at("2026-11-11", "10:30")).free,
    ).toBe(0);
    expect(
      offerFor(s, at("2026-11-10", "11:00"), at("2026-11-11", "11:00")).free,
    ).toBe(1);
  });

  it("takes units out of service until their back-on date", () => {
    const s = stock({ repairs: [{ units: 1, backOn: "2026-11-12" }] });
    expect(offerFor(s, at("2026-11-10"), at("2026-11-11")).free).toBe(1);
    expect(offerFor(s, at("2026-11-12"), at("2026-11-13")).free).toBe(2);
    // A rental that overlaps the last repair day sees it too.
    expect(offerFor(s, at("2026-11-11"), at("2026-11-13")).free).toBe(1);
    const noDate = stock({ repairs: [{ units: 2, backOn: null }] });
    expect(offerFor(noDate, at("2027-01-01"), at("2027-01-02")).free).toBe(0);
  });

  it("is Instant while Instant units remain, then Request", () => {
    const s = stock({
      qty: 3,
      instantQty: 1,
      requestQty: 1,
      bookings: [booking("2026-11-01", "2026-11-10", "instant")],
    });
    expect(offerFor(s, at("2026-11-11"), at("2026-11-12")).mode).toBe(
      "instant",
    );
    expect(offerFor(s, at("2026-11-05"), at("2026-11-06")).mode).toBe(
      "request",
    );
  });

  it("never offers walk-ins-only units for advance bookings", () => {
    const s = stock({ qty: 2, instantQty: 0, requestQty: 0 });
    const o = offerFor(s, at("2026-11-11"), at("2026-11-12"));
    expect(o).toEqual({ free: 2, mode: null });
  });

  it("counts walk-in rentals in the pool only", () => {
    const s = stock({
      qty: 2,
      instantQty: 1,
      requestQty: 0,
      bookings: [booking("2026-11-01", "2026-11-10", "now")],
    });
    expect(offerFor(s, at("2026-11-05"), at("2026-11-06"))).toEqual({
      free: 1,
      mode: "instant",
    });
  });
});

describe("longestWalkIn", () => {
  it("ends before the next booking needs the unit", () => {
    const s = stock({
      qty: 1,
      requestQty: 1,
      bufferBeforeH: 0,
      bookings: [booking("2026-11-20", "2026-11-25")],
    });
    // From 10:00 on the 5th, 15 full days reach 10:00 on the 20th.
    expect(longestWalkIn(s, at("2026-11-05"))).toBe(15);
  });

  it("is 0 when nothing is free now and capped otherwise", () => {
    const busy = stock({
      qty: 1,
      bookings: [booking("2026-11-01", "2026-11-10")],
    });
    expect(longestWalkIn(busy, at("2026-11-05"))).toBe(0);
    expect(longestWalkIn(stock(), at("2026-11-05"), 30)).toBe(30);
  });
});
