"use server";

import { revalidatePath } from "next/cache";
import { canSeeArea } from "@/lib/roles";
import { requireMembership } from "@/lib/session";
import { tenantSettingsSchema } from "@/lib/tenant-settings";
import { createClient } from "@mango/db/server";

export type SettingsErrorKey =
  | "required"
  | "tooLong"
  | "invalidCountry"
  | "invalidCurrency"
  | "invalidTimezone"
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
  if (error || data.length !== 1) return { errors: { form: "saveFailed" } };

  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}
