/**
 * Result of a dashboard form's Server Action. Error values are keys under
 * "Errors" in messages/*.json (see lib/validation/vendor.ts).
 */
export type ActionState =
  | { status: "idle" }
  | { status: "saved"; notice?: string }
  | { status: "invalid"; errors: Partial<Record<string, string>> }
  | { status: "error"; notice?: string };

export const idleState: ActionState = { status: "idle" };

export const savedState: ActionState = { status: "saved" };

export function invalid(errors: Partial<Record<string, string>>): ActionState {
  return { status: "invalid", errors };
}

export const failed: ActionState = { status: "error" };

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}
