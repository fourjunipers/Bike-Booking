import { describe, expect, it } from "vitest";
import { isDarkTheme, parseTabBar, parseTheme } from "./preferences";

describe("parseTabBar", () => {
  it("reads top and bottom, defaulting to bottom", () => {
    expect(parseTabBar("top")).toBe("top");
    expect(parseTabBar("bottom")).toBe("bottom");
    expect(parseTabBar(undefined)).toBe("bottom");
    expect(parseTabBar("left")).toBe("bottom");
  });
});

describe("parseTheme", () => {
  it("reads light and dark, defaulting to the device setting", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("blue")).toBe("system");
  });
});

describe("isDarkTheme", () => {
  it("Light and Dark win over the device; Match device follows it", () => {
    // Bug, 14 Nov 2026: on a phone set to dark, Light did nothing.
    expect(isDarkTheme("light", true)).toBe(false);
    expect(isDarkTheme("light", false)).toBe(false);
    expect(isDarkTheme("dark", false)).toBe(true);
    expect(isDarkTheme("dark", true)).toBe(true);
    expect(isDarkTheme("system", true)).toBe(true);
    expect(isDarkTheme("system", false)).toBe(false);
  });
});
