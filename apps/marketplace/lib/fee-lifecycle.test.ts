import { describe, expect, it } from "vitest";
import {
  feeAtBooking,
  feeWhenAccepted,
  feeWhenEnded,
  paymentDeadline,
  type EndingEvent,
  type FeeStatus,
} from "./fee-lifecycle";

// The rules work on instants, so tests use UTC; no market time zone needed.
const at = (date: string, time = "03:00") => new Date(`${date}T${time}:00Z`);
const now = at("2026-12-01");

describe("feeAtBooking", () => {
  it("charges at booking when pickup is within 3 days, for every kind", () => {
    for (const kind of ["instant", "request", "now"] as const)
      expect(feeAtBooking(kind, now, at("2026-12-04"))).toEqual({
        status: "due",
        chargeAt: now,
      });
  });

  it("schedules Instant bookings 3 days before pickup", () => {
    expect(feeAtBooking("instant", now, at("2026-12-10"))).toEqual({
      status: "scheduled",
      chargeAt: at("2026-12-07"),
    });
  });

  it("waits for the shop on Request bookings further out", () => {
    expect(feeAtBooking("request", now, at("2026-12-10"))).toEqual({
      status: "awaiting_shop",
      chargeAt: null,
    });
  });
});

describe("feeWhenAccepted", () => {
  it("schedules or charges once the shop accepts", () => {
    expect(feeWhenAccepted("awaiting_shop", now, at("2026-12-10"))).toEqual({
      status: "scheduled",
      chargeAt: at("2026-12-07"),
    });
    expect(feeWhenAccepted("awaiting_shop", now, at("2026-12-03"))).toEqual({
      status: "due",
      chargeAt: now,
    });
  });

  it("leaves a fee already charged at booking alone", () => {
    expect(feeWhenAccepted("paid", now, at("2026-12-03")).status).toBe("paid");
  });
});

describe("paymentDeadline", () => {
  it("is 48 hours before pickup", () => {
    expect(paymentDeadline(at("2026-12-10"))).toEqual(at("2026-12-08"));
  });
});

describe("feeWhenEnded", () => {
  const far = at("2026-12-10"); // more than 3 days away
  const near = at("2026-12-03"); // within 3 days

  it.each<[EndingEvent, FeeStatus, Date, FeeStatus, string]>([
    // The shop's side: always refunded (owner decision 2026-11-08).
    ["declined", "paid", near, "refunded", "refund"],
    ["expired", "paid", near, "refunded", "refund"],
    ["cancelled_vendor", "paid", near, "refunded", "refund"],
    ["declined", "awaiting_shop", far, "not_charged", "cancel_charge"],
    ["cancelled_vendor", "scheduled", far, "not_charged", "cancel_charge"],
    // The customer's side.
    ["cancelled_customer", "paid", far, "refunded", "refund"],
    ["cancelled_customer", "scheduled", far, "not_charged", "cancel_charge"],
    ["cancelled_customer", "paid", near, "kept", "none"],
    ["no_show", "paid", near, "kept", "none"],
    // Never paid.
    ["cancelled_unpaid", "due", near, "not_charged", "cancel_charge"],
  ])("%s with fee %s → %s", (event, current, start, status, action) => {
    expect(feeWhenEnded(event, current, now, start)).toEqual({
      status,
      action,
    });
  });

  it("never settles a fee twice", () => {
    expect(feeWhenEnded("declined", "refunded", now, near)).toEqual({
      status: "refunded",
      action: "none",
    });
    expect(feeWhenEnded("cancelled_vendor", "kept", now, near)).toEqual({
      status: "kept",
      action: "none",
    });
  });
});
