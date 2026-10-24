import { describe, expect, it } from "vitest";
import { enabledProviders, providerOrder } from "./providers";

describe("enabledProviders", () => {
  it("maps names and ignores unknown ones", () => {
    expect(enabledProviders(" Google, line ,facebook")).toEqual([
      "google",
      "custom:line",
    ]);
  });

  it("is empty when unset", () => {
    expect(enabledProviders(undefined)).toEqual([]);
  });
});

describe("providerOrder", () => {
  const all = enabledProviders("apple,line,google");

  it("puts LINE first for vendors and hides Apple", () => {
    expect(providerOrder(all, true)).toEqual(["custom:line", "google"]);
  });

  it("puts Google first for customers", () => {
    expect(providerOrder(all, false)).toEqual([
      "google",
      "custom:line",
      "apple",
    ]);
  });
});
