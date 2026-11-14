import type { Role } from "./roles";

/**
 * Who may do what to rental gear's stock. The one place in the app: every
 * screen and every server action asks canGear(). It mirrors
 * platform_private.gear_roles() in the database, which is the real rule
 * (tests/db/gear-stock-rework.test.ts holds the two together).
 *
 * Today the answer depends on the role alone. When owners set their own
 * permissions, this table becomes the default and canGear() reads the shop's
 * choices first; nothing that calls it has to change.
 */
export const gearActions = [
  "set_quantity",
  "mark_repair",
  "back_in_use",
  "mark_lost",
  "found",
  "write_off",
] as const;
export type GearAction = (typeof gearActions)[number];

const allowed: Record<GearAction, readonly Role[]> = {
  /** Change the quantity. */
  set_quantity: ["owner", "manager"],
  /** Mark in repair, and edit that line. */
  mark_repair: ["owner", "manager", "staff", "mechanic"],
  /** Put a unit in repair back in use. */
  back_in_use: ["owner", "manager", "staff", "mechanic"],
  /** Mark lost, and edit that line. */
  mark_lost: ["owner", "manager", "staff"],
  /** Mark a lost unit found, back in use. */
  found: ["owner", "manager"],
  /** Write off for good, as damaged or as lost. */
  write_off: ["owner", "manager"],
};

export function gearRoles(action: GearAction): readonly Role[] {
  return allowed[action];
}

export function canGear(role: Role, action: GearAction): boolean {
  return allowed[action].includes(role);
}

/** What "Report a problem" offers, in the order it shows them. */
export const problemKinds = ["repair", "lost", "damaged"] as const;
export type ProblemKind = (typeof problemKinds)[number];

/** The action behind each choice of "What happened". */
export const problemAction: Record<ProblemKind, GearAction> = {
  repair: "mark_repair",
  lost: "mark_lost",
  damaged: "write_off",
};

/** The choices of "What happened" a role is offered. */
export function problemKindsFor(role: Role): ProblemKind[] {
  return problemKinds.filter((kind) => canGear(role, problemAction[kind]));
}

/** A unit out of service: in repair or lost. */
export type OutState = "repair" | "lost";

/** Whoever may mark a unit that way may edit its line. */
export function canEditProblem(role: Role, state: OutState): boolean {
  return canGear(role, state === "repair" ? "mark_repair" : "mark_lost");
}
