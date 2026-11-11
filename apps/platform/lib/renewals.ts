import { z } from "zod";
import type { RenewalKind } from "./fleet";
import type { CalendarDate } from "./shop-time";

/**
 * Tax and insurance renewals (SPEC › Fleet › Tax and insurance log, Renewal
 * reminders). Every renewal is a record; for each bike and kind the record
 * with the latest expiry is the current one. Dates are calendar dates.
 */

export type Renewal = {
  id: string;
  unit_id: string;
  kind: RenewalKind;
  provider: string | null;
  reference_no: string | null;
  starts_at: string | null;
  expires_at: string;
};

/** The current record of each kind for each bike: unit id → kind → record. */
export function currentRenewals<T extends Renewal>(
  renewals: readonly T[],
): Map<string, Partial<Record<RenewalKind, T>>> {
  const current = new Map<string, Partial<Record<RenewalKind, T>>>();
  for (const renewal of renewals) {
    const byKind = current.get(renewal.unit_id) ?? {};
    const held = byKind[renewal.kind];
    if (!held || renewal.expires_at > held.expires_at)
      byKind[renewal.kind] = renewal;
    current.set(renewal.unit_id, byKind);
  }
  return current;
}

export const defaultReminderDays = [45, 30, 14, 7];

const isoDate = (date: CalendarDate) =>
  `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;

export function parseIsoDate(text: string): CalendarDate {
  const [year, month, day] = text.split("-").map(Number);
  return { year, month, day };
}

/** Whole days from `today` to `expires` (negative once it has passed). */
export function daysUntil(expires: string, today: CalendarDate): number {
  const d = parseIsoDate(expires);
  return Math.round(
    (Date.UTC(d.year, d.month - 1, d.day) -
      Date.UTC(today.year, today.month - 1, today.day)) /
      86_400_000,
  );
}

export type RenewalState = "ok" | "due" | "expired";

/**
 * Where a renewal stands under the shop's reminder setting: "due" from the
 * earliest reminder day (45 days before, by default) until it expires, then
 * "expired". With no reminder days set, nothing is due before it expires.
 */
export function renewalState(
  expires: string,
  today: CalendarDate,
  reminderDays: readonly number[],
): RenewalState {
  const days = daysUntil(expires, today);
  if (days < 0) return "expired";
  const window = reminderDays.length > 0 ? Math.max(...reminderDays) : -1;
  return days <= window ? "due" : "ok";
}

/** Renewals to show on the dashboard today: due or expired, current records only. */
export function renewalsToShow<T extends Renewal>(
  renewals: readonly T[],
  today: CalendarDate,
  reminderDays: readonly number[],
): T[] {
  const shown: T[] = [];
  for (const byKind of currentRenewals(renewals).values()) {
    for (const renewal of Object.values(byKind)) {
      if (renewal && renewalState(renewal.expires_at, today, reminderDays) !== "ok")
        shown.push(renewal);
    }
  }
  return shown.sort(
    (a, b) => a.expires_at.localeCompare(b.expires_at) || a.id.localeCompare(b.id),
  );
}

export { isoDate };

/**
 * The reminder setting as typed: "45, 30, 14, 7". Up to 10 whole numbers of
 * days from 1 to 365, saved largest first without repeats. Blank = no
 * reminders.
 */
export const reminderSettingsSchema = z.object({
  renewal_reminder_days: z.string().transform((text, ctx) => {
    const parts = text
      .split(/[\s,;]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    const days = parts.map(Number);
    if (
      parts.some((part) => !/^\d{1,3}$/.test(part)) ||
      days.some((d) => d < 1 || d > 365)
    ) {
      ctx.addIssue({ code: "custom", message: "invalidReminderDays" });
      return z.NEVER;
    }
    const unique = [...new Set(days)].sort((a, b) => b - a);
    if (unique.length > 10) {
      ctx.addIssue({ code: "custom", message: "invalidReminderDays" });
      return z.NEVER;
    }
    return unique;
  }),
  /** Day of the month for the digest, 1 to 28; blank = off. */
  renewal_digest_day: z.preprocess(
    (v) => (v === undefined || v === "" ? null : v),
    z.coerce
      .number("invalidDigestDay")
      .int("invalidDigestDay")
      .min(1, "invalidDigestDay")
      .max(28, "invalidDigestDay")
      .nullable(),
  ),
});
