import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/vendor")).toBe("/vendor");
    expect(safeNextPath("/account?tab=cards")).toBe("/account?tab=cards");
  });

  it("falls back for missing or off-site destinations", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("vendor", "/account")).toBe("/account");
  });
});
