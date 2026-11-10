import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  canChangeMember,
  canSeeArea,
  canSeeTab,
  homeTab,
  roles,
  staffTabs,
  tabsFor,
} from "./roles";

describe("tabs per role", () => {
  it("gives owners, managers and staff all four tabs in order", () => {
    for (const role of ["owner", "manager", "staff"] as const) {
      expect(tabsFor(role)).toEqual(staffTabs);
    }
  });

  it("gives mechanics Dashboard and Maintenance, opening on Maintenance", () => {
    expect(tabsFor("mechanic")).toEqual(["dashboard", "maintenance"]);
    expect(homeTab("mechanic")).toBe("maintenance");
  });

  it("gives drivers Dashboard and Orders, opening on Dashboard", () => {
    expect(tabsFor("driver")).toEqual(["dashboard", "orders"]);
    expect(homeTab("driver")).toBe("dashboard");
  });

  it("opens every role on a tab it can see", () => {
    for (const role of roles) {
      expect(canSeeTab(role, homeTab(role))).toBe(true);
    }
  });

  it("refuses tabs a role doesn't have and unknown tabs", () => {
    expect(canSeeTab("mechanic", "new-order")).toBe(false);
    expect(canSeeTab("driver", "maintenance")).toBe(false);
    expect(canSeeTab("owner", "reports")).toBe(false);
  });
});

describe("admin areas", () => {
  it("are for owners and managers only", () => {
    expect(canSeeArea("owner", "team")).toBe(true);
    expect(canSeeArea("manager", "settings")).toBe(true);
    for (const role of ["staff", "mechanic", "driver"] as const) {
      expect(canSeeArea(role, "team")).toBe(false);
      expect(canSeeArea(role, "settings")).toBe(false);
    }
  });
});

describe("team changes", () => {
  it("lets owners change anyone to anything", () => {
    expect(canChangeMember("owner", "owner", "staff")).toBe(true);
    expect(canChangeMember("owner", "staff", "owner")).toBe(true);
    expect(canChangeMember("owner", "manager", null)).toBe(true);
  });

  it("lets managers change only staff, mechanics and drivers", () => {
    expect(canChangeMember("manager", "staff", "mechanic")).toBe(true);
    expect(canChangeMember("manager", "driver", null)).toBe(true);
    expect(canChangeMember("manager", "staff", "manager")).toBe(false);
    expect(canChangeMember("manager", "staff", "owner")).toBe(false);
    expect(canChangeMember("manager", "owner", "staff")).toBe(false);
    expect(canChangeMember("manager", "manager", null)).toBe(false);
  });

  it("lets nobody else change the team", () => {
    for (const actor of ["staff", "mechanic", "driver"] as const) {
      expect(canChangeMember(actor, "driver", "staff")).toBe(false);
      expect(assignableRoles(actor)).toEqual([]);
    }
  });

  it("offers each actor only the roles it may hand out", () => {
    expect(assignableRoles("owner")).toEqual(roles);
    expect(assignableRoles("manager")).toEqual(["staff", "mechanic", "driver"]);
  });
});
