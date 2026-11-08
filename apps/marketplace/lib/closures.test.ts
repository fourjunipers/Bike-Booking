import { describe, expect, it } from "vitest";
import { isClosedOn, isShopClosedOn, type Closure } from "./closures";

const songkran: Closure = {
  start_date: "2027-04-13",
  end_date: "2027-04-15",
  repeats_yearly: true,
};
const newYear: Closure = {
  start_date: "2026-12-31",
  end_date: "2027-01-02",
  repeats_yearly: true,
};

describe("isClosedOn", () => {
  it("covers a one-off closure's dates only", () => {
    const once = { ...songkran, repeats_yearly: false };
    expect(isClosedOn(once, "2027-04-12")).toBe(false);
    expect(isClosedOn(once, "2027-04-13")).toBe(true);
    expect(isClosedOn(once, "2027-04-15")).toBe(true);
    expect(isClosedOn(once, "2027-04-16")).toBe(false);
    expect(isClosedOn(once, "2028-04-14")).toBe(false);
  });

  it("repeats a yearly closure on the same dates", () => {
    expect(isClosedOn(songkran, "2028-04-13")).toBe(true);
    expect(isClosedOn(songkran, "2031-04-15")).toBe(true);
    expect(isClosedOn(songkran, "2028-04-16")).toBe(false);
  });

  it("doesn't apply before its first year", () => {
    expect(isClosedOn(songkran, "2026-04-14")).toBe(false);
  });

  it("handles closures that run over New Year", () => {
    expect(isClosedOn(newYear, "2027-12-31")).toBe(true);
    expect(isClosedOn(newYear, "2028-01-02")).toBe(true);
    expect(isClosedOn(newYear, "2028-01-03")).toBe(false);
    expect(isClosedOn(newYear, "2027-12-30")).toBe(false);
  });
});

describe("isShopClosedOn", () => {
  it("is true when any closure covers the date", () => {
    expect(isShopClosedOn([songkran, newYear], "2029-01-01")).toBe(true);
    expect(isShopClosedOn([songkran, newYear], "2029-06-01")).toBe(false);
    expect(isShopClosedOn([], "2029-01-01")).toBe(false);
  });
});
