import { describe, expect, it } from "vitest";
import { ADMIN_HOME, hiddenRedirect } from "./hidden-areas";

describe("hiddenRedirect", () => {
  it("sends the vendor dashboard and shop-side admin screens home", () => {
    for (const path of [
      "/vendor",
      "/vendor/fleet/abc",
      "/admin/shops",
      "/admin/shops/123",
      "/admin/catalog",
    ]) {
      expect(hiddenRedirect(path), path).toBe("/");
    }
  });

  it("opens the admin area on Ranking", () => {
    expect(hiddenRedirect("/admin")).toBe(ADMIN_HOME);
    expect(hiddenRedirect("/admin/")).toBe(ADMIN_HOME);
  });

  it("keeps marketplace admin screens and the customer site", () => {
    expect(hiddenRedirect("/admin/ranking")).toBeNull();
    expect(hiddenRedirect("/admin/stations")).toBeNull();
    expect(hiddenRedirect("/vendorship")).toBeNull();
    expect(hiddenRedirect("/account", true)).toBeNull();
  });

  it("hides shop staff invites on the customer site", () => {
    expect(hiddenRedirect("/account/join", true)).toBe("/");
  });
});
