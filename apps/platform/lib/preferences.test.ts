import { describe, expect, it } from "vitest";
import { parseTabBar, parseTheme } from "./preferences";

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
