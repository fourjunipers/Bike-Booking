import { describe, expect, it } from "vitest";
import {
  chargeDate,
  feeAtBooking,
  feeWhenAccepted,
  feeWhenEnded,
  paymentDeadline,
  type EndingEvent,
  type FeeStatus,
} from "./fee-lifecycle";

// A shop in Bangkok (UTC+7, no daylight saving): 03:00Z is 10:00 local.
const TZ = "Asia/Bangkok";
const at = (date: string, time = "03:00") => new Date(`${date}T${time}:00Z`);
const now = at("2026-12-01");

// A shop in London: BST starts 28 Mar 2027, ends 31 Oct 2027.
const LONDON = "Europe/London";

describe("feeAtBooking", () => {
  it("charges at booking when pickup is within 3 days, for every kind", () => {
    for (const kind of ["instant", "request", "now"] as const)
      expect(feeAtBooking(kind, now, at("2026-12-04"), TZ)).toEqual({
        status: "due",
        chargeAt: now,
      });
  });

  it("schedules Instant bookings 3 days before pickup", () => {
    expect(feeAtBooking("instant", now, at("2026-12-10"), TZ)).toEqual({
      status: "scheduled",
      chargeAt: at("2026-12-07"),
    });
  });

  it("waits for the shop on Request bookings further out", () => {
    expect(feeAtBooking("request", now, at("2026-12-10"), TZ)).toEqual({
      status: "awaiting_shop",
      chargeAt: null,
    });
  });
});

describe("feeWhenAccepted", () => {
  it("schedules or charges once the shop accepts", () => {
    expect(feeWhenAccepted("awaiting_shop", now, at("2026-12-10"), TZ)).toEqual(
      {
        status: "scheduled",
        chargeAt: at("2026-12-07"),
      },
    );
    expect(feeWhenAccepted("awaiting_shop", now, at("2026-12-03"), TZ)).toEqual(
      {
        status: "due",
        chargeAt: now,
      },
    );
  });

  it("leaves a fee already charged at booking alone", () => {
    expect(feeWhenAccepted("paid", now, at("2026-12-03"), TZ).status).toBe(
      "paid",
    );
  });
});

describe("paymentDeadline", () => {
  it("is 2 calendar days before pickup, same clock time", () => {
    expect(paymentDeadline(at("2026-12-10"), TZ)).toEqual(at("2026-12-08"));
  });
});

describe("deadlines across a daylight-saving change", () => {
  // Pickup 10:00 BST on 30 Mar 2027 = 09:00Z.
  const pickup = at("2027-03-30", "09:00");

  it("charges at the same clock time 3 days earlier, not 72 hours", () => {
    // 10:00 GMT on 27 Mar = 10:00Z: 71 hours before pickup.
    expect(chargeDate(pickup, LONDON)).toEqual(at("2027-03-27", "10:00"));
  });

  it("cancels an unpaid fee at the same clock time 2 days earlier", () => {
    // 28 Mar is the change day; 10:00 BST = 09:00Z.
    expect(paymentDeadline(pickup, LONDON)).toEqual(at("2027-03-28", "09:00"));
  });

  it("decides 'within 3 days' by the shop's calendar", () => {
    // 09:30Z on 27 Mar is 09:30 local: 71.5 hours before pickup but still
    // before the 10:00 charge time, so the Instant booking is scheduled.
    const justBefore = at("2027-03-27", "09:30");
    expect(feeAtBooking("instant", justBefore, pickup, LONDON)).toEqual({
      status: "scheduled",
      chargeAt: at("2027-03-27", "10:00"),
    });
    // And a customer cancelling then gets the fee back.
    expect(
      feeWhenEnded(
        "cancelled_customer",
        "scheduled",
        justBefore,
        pickup,
        LONDON,
      ),
    ).toEqual({ status: "not_charged", action: "cancel_charge" });
    // From 10:00 local it is due, and a cancellation keeps the fee.
    const chargeTime = at("2027-03-27", "10:00");
    expect(feeAtBooking("instant", chargeTime, pickup, LONDON).status).toBe(
      "due",
    );
    expect(
      feeWhenEnded("cancelled_customer", "paid", chargeTime, pickup, LONDON),
    ).toEqual({ status: "kept", action: "none" });
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
    expect(feeWhenEnded(event, current, now, start, TZ)).toEqual({
      status,
      action,
    });
  });

  it("never settles a fee twice", () => {
    expect(feeWhenEnded("declined", "refunded", now, near, TZ)).toEqual({
      status: "refunded",
      action: "none",
    });
    expect(feeWhenEnded("cancelled_vendor", "kept", now, near, TZ)).toEqual({
      status: "kept",
      action: "none",
    });
  });
});
