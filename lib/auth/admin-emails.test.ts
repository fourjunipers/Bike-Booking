import { describe, expect, it } from "vitest";
import { isAdminEmail, parseAdminEmails } from "./admin-emails";

describe("parseAdminEmails", () => {
  it("splits, trims and lower-cases", () => {
    expect(parseAdminEmails(" Mark@Example.com, ops@example.com ,")).toEqual(
      new Set(["mark@example.com", "ops@example.com"]),
    );
  });

  it("returns an empty set when unset or blank", () => {
    expect(parseAdminEmails(undefined).size).toBe(0);
    expect(parseAdminEmails("  , ").size).toBe(0);
  });
});

describe("isAdminEmail", () => {
  const admins = parseAdminEmails("mark@example.com");

  it("matches case-insensitively", () => {
    expect(isAdminEmail("MARK@example.com", admins)).toBe(true);
  });

  it("rejects other and missing emails", () => {
    expect(isAdminEmail("someone@example.com", admins)).toBe(false);
    expect(isAdminEmail(null, admins)).toBe(false);
    expect(isAdminEmail(undefined, admins)).toBe(false);
  });
});
