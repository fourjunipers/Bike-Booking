import type { Database } from "@mango/db/database.types";

/** Staff roles (SPEC › Data model, memberships). */
export type Role = Database["platform"]["Enums"]["platform_role"];

export const roles = [
  "owner",
  "manager",
  "staff",
  "mechanic",
  "driver",
] as const satisfies readonly Role[];

/** The staff app's four tabs (SPEC › Staff app), in tab-bar order. */
export const staffTabs = [
  "dashboard",
  "orders",
  "new-order",
  "maintenance",
] as const;
export type StaffTab = (typeof staffTabs)[number];

/** Desktop-admin areas beside the tabs. */
export type AdminArea = "fleet" | "locations" | "team" | "settings";

/** Shop areas in menu order. */
export const adminAreas = [
  "fleet",
  "locations",
  "team",
  "settings",
] as const satisfies readonly AdminArea[];

const tabsByRole: Record<Role, readonly StaffTab[]> = {
  owner: staffTabs,
  manager: staffTabs,
  staff: staffTabs,
  // Mechanics work on bikes: maintenance, plus what's due today.
  mechanic: ["dashboard", "maintenance"],
  // Drivers: today's deliveries and collections, and the orders behind them.
  driver: ["dashboard", "orders"],
};

/** The tabs a role sees, in tab-bar order. */
export function tabsFor(role: Role): readonly StaffTab[] {
  return tabsByRole[role];
}

/** Where a role lands when it opens the app. A mechanic opens straight to Maintenance. */
export function homeTab(role: Role): StaffTab {
  return role === "mechanic" ? "maintenance" : "dashboard";
}

export function canSeeTab(role: Role, tab: string): tab is StaffTab {
  return (tabsByRole[role] as readonly string[]).includes(tab);
}

/**
 * Fleet: every role reads it (drivers read-only). Locations, team and shop
 * settings: owners and managers (SPEC › Who uses it).
 */
export function canSeeArea(role: Role, area: AdminArea): boolean {
  if (area === "fleet") return true;
  return role === "owner" || role === "manager";
}

/** Owners and managers set up the fleet: models, units, import, money. */
export function canManageFleet(role: Role): boolean {
  return role === "owner" || role === "manager";
}

/**
 * Owners, managers, staff and mechanics add or end downtime, update the
 * odometer and switch a unit between active and maintenance. Drivers only read.
 * The database enforces both (units_guard, unit_blocks policies).
 */
export function canWorkOnUnits(role: Role): boolean {
  return role !== "driver";
}

/**
 * Whether `actor` may change a member who has role `from` to role `to`
 * (`to` = null removes them). Mirrors platform_private.assert_can_change in
 * the database, which is the real check; this only decides what the UI offers.
 * The "at least one owner" rule needs the whole team, so only the database
 * enforces it.
 */
export function canChangeMember(
  actor: Role,
  from: Role,
  to: Role | null,
): boolean {
  if (actor === "owner") return true;
  if (actor !== "manager") return false;
  const senior = (r: Role | null) => r === "owner" || r === "manager";
  return !senior(from) && !senior(to);
}

/** Roles `actor` may hand out. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "owner") return [...roles];
  if (actor === "manager") return ["staff", "mechanic", "driver"];
  return [];
}
