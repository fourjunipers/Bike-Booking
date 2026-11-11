"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { reminderSettingsSchema } from "@/lib/renewals";
import { canSeeArea } from "@/lib/roles";
import { requireMembership } from "@/lib/session";
import { tenantSettingsSchema } from "@/lib/tenant-settings";
import { createClient } from "@mango/db/platform-server";

export type SettingsErrorKey =
  | "required"
  | "tooLong"
  | "invalidCountry"
  | "invalidCurrency"
  | "invalidDistanceUnit"
  | "currencyLocked"
  | "invalidLocale"
  | "saveFailed";

export type SettingsState = {
  ok?: boolean;
  errors?: Partial<Record<string, SettingsErrorKey>>;
};

/** Saves the shop's settings. RLS allows owners and managers only. */
export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const slug = String(formData.get("slug") ?? "");
  const { membership } = await requireMembership(slug);
  if (!canSeeArea(membership.role, "settings"))
    return { errors: { form: "saveFailed" } };

  const parsed = tenantSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: SettingsState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      errors[field] ??= issue.message as SettingsErrorKey;
    }
    return { errors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .update(parsed.data)
    .eq("id", membership.tenant.id)
    .select("id");
  if (error?.message === "currency_locked")
    return { errors: { currency: "currencyLocked" } };
  if (error || data.length !== 1) return { errors: { form: "saveFailed" } };

  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}

/**
 * Saves the tax and insurance reminder setting: the days before an expiry, and
 * the day of the month for the digest (blank = off). RLS allows owners and
 * managers only.
 */
export async function saveReminders(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const { membership } = await requireMembership(slug);
  if (!canSeeArea(membership.role, "settings"))
    return { errors: { form: "notAllowed" } };

  const parsed = reminderSettingsSchema.safeParse({
    renewal_reminder_days: String(formData.get("renewal_reminder_days") ?? ""),
    renewal_digest_day: String(formData.get("renewal_digest_day") ?? ""),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      errors[String(issue.path[0])] ??= issue.message;
    return { errors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .update(parsed.data)
    .eq("id", membership.tenant.id)
    .select("id");
  if (error || data.length !== 1) return { errors: { form: "saveFailed" } };
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}
