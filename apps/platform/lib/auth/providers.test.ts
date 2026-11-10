import { describe, expect, it } from "vitest";
import { enabledProviders } from "./providers";

describe("enabledProviders", () => {
  it("lists configured providers, LINE first", () => {
    expect(enabledProviders("google, LINE")).toEqual(["custom:line", "google"]);
    expect(enabledProviders("google")).toEqual(["google"]);
  });

  it("ignores unknown names and blanks", () => {
    expect(enabledProviders("apple,,facebook")).toEqual([]);
    expect(enabledProviders("")).toEqual([]);
    expect(enabledProviders(undefined)).toEqual([]);
  });
});
