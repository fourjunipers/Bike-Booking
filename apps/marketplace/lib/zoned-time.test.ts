import { describe, expect, it } from "vitest";
import { addCalendarDays } from "./zoned-time";

const utc = (iso: string) => new Date(iso);

describe("addCalendarDays", () => {
  it("keeps the clock time in a zone without daylight saving", () => {
    // 10:00 Bangkok (UTC+7) → 10:00 Bangkok three days earlier.
    expect(
      addCalendarDays(utc("2026-12-10T03:00:00Z"), -3, "Asia/Bangkok"),
    ).toEqual(utc("2026-12-07T03:00:00Z"));
  });

  it("keeps the clock time across a spring-forward change", () => {
    // London: BST starts 28 Mar 2027. 10:00 BST on 30 Mar → 10:00 GMT on
    // 27 Mar, which is 71 hours earlier, not 72.
    expect(
      addCalendarDays(utc("2027-03-30T09:00:00Z"), -3, "Europe/London"),
    ).toEqual(utc("2027-03-27T10:00:00Z"));
  });

  it("keeps the clock time across a fall-back change", () => {
    // London: BST ends 31 Oct 2027. 10:00 GMT on 2 Nov → 10:00 BST on 30 Oct.
    expect(
      addCalendarDays(utc("2027-11-02T10:00:00Z"), -3, "Europe/London"),
    ).toEqual(utc("2027-10-30T09:00:00Z"));
  });

  it("moves a skipped clock time forward by the gap", () => {
    // New York: 02:00–03:00 on 14 Mar 2027 doesn't exist. 02:30 EDT on
    // 17 Mar minus 3 days → 03:30 EDT on 14 Mar.
    expect(
      addCalendarDays(utc("2027-03-17T06:30:00Z"), -3, "America/New_York"),
    ).toEqual(utc("2027-03-14T07:30:00Z"));
  });

  it("takes the earlier of a repeated clock time", () => {
    // New York: 01:00–02:00 on 7 Nov 2027 happens twice. 01:30 EST on
    // 10 Nov minus 3 days → 01:30 EDT (the first one).
    expect(
      addCalendarDays(utc("2027-11-10T06:30:00Z"), -3, "America/New_York"),
    ).toEqual(utc("2027-11-07T05:30:00Z"));
  });

  it("rejects unknown time zones and fractional days", () => {
    expect(() =>
      addCalendarDays(utc("2027-01-01T00:00:00Z"), 1, "Mars/Base"),
    ).toThrow(RangeError);
    expect(() =>
      addCalendarDays(utc("2027-01-01T00:00:00Z"), 1.5, "UTC"),
    ).toThrow(RangeError);
  });
});
