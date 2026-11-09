import { describe, expect, it } from "vitest";
import { isCustomerLocale, localePath, splitLocalePath } from "./config";

describe("localePath", () => {
  it("leaves English unprefixed", () => {
    expect(localePath("en", "/")).toBe("/");
    expect(localePath("en", "/account")).toBe("/account");
  });

  it("prefixes other languages", () => {
    expect(localePath("ja", "/")).toBe("/ja");
    expect(localePath("ja", "/account/join")).toBe("/ja/account/join");
  });
});

describe("splitLocalePath", () => {
  it("reads the language prefix", () => {
    expect(splitLocalePath("/ko/login")).toEqual({
      locale: "ko",
      path: "/login",
    });
    expect(splitLocalePath("/zh")).toEqual({ locale: "zh", path: "/" });
  });

  it("treats unprefixed paths as English", () => {
    expect(splitLocalePath("/")).toEqual({ locale: "en", path: "/" });
    expect(splitLocalePath("/account")).toEqual({
      locale: "en",
      path: "/account",
    });
  });

  it("doesn't mistake other first segments for a language", () => {
    expect(splitLocalePath("/vendor/fleet").locale).toBe("en");
  });

  it("round-trips with localePath", () => {
    for (const path of ["/", "/login", "/account/join"]) {
      expect(splitLocalePath(localePath("ru", path))).toEqual({
        locale: "ru",
        path,
      });
    }
  });
});

describe("isCustomerLocale", () => {
  it("accepts the ten site languages only", () => {
    expect(isCustomerLocale("it")).toBe(true);
    expect(isCustomerLocale("pt")).toBe(false);
    expect(isCustomerLocale(undefined)).toBe(false);
  });
});
