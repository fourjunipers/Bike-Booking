import { describe, expect, it } from "vitest";
import { cronAuthorised } from "./cron-auth";

describe("cronAuthorised", () => {
  it("accepts only the exact bearer secret", () => {
    expect(cronAuthorised("Bearer s3cret", "s3cret")).toBe(true);
    expect(cronAuthorised("Bearer s3cre", "s3cret")).toBe(false);
    expect(cronAuthorised("s3cret", "s3cret")).toBe(false);
    expect(cronAuthorised(null, "s3cret")).toBe(false);
  });

  it("refuses everything when no secret is set", () => {
    expect(cronAuthorised("Bearer ", undefined)).toBe(false);
    expect(cronAuthorised("Bearer ", "")).toBe(false);
  });
});
