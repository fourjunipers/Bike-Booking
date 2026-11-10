import { describe, expect, it } from "vitest";
import { pickLocale } from "./config";

describe("pickLocale", () => {
  it("uses the cookie when it holds a supported language", () => {
    expect(pickLocale("th", "en-US,en;q=0.9")).toBe("th");
    expect(pickLocale("en", "th-TH")).toBe("en");
  });

  it("ignores an unsupported cookie and falls back to the browser", () => {
    expect(pickLocale("xx", "th-TH,th;q=0.9,en;q=0.8")).toBe("th");
  });

  it("takes the browser's highest-weighted supported language", () => {
    expect(pickLocale(undefined, "ja;q=1,th;q=0.5,en;q=0.7")).toBe("en");
    expect(pickLocale(undefined, "ja,th;q=0.9")).toBe("th");
  });

  it("defaults to English", () => {
    expect(pickLocale(undefined, null)).toBe("en");
    expect(pickLocale(undefined, "ja,ko")).toBe("en");
    expect(pickLocale(undefined, "th;q=0")).toBe("en");
  });
});
