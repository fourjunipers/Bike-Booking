"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { notifyChannels, profileFormSchema } from "@/lib/validation/profile";

type Field = "name" | "whatsapp" | "notify";

/**
 * `values` echoes what was submitted: React resets a form after its action
 * runs, and the inputs fall back to these instead of the original profile.
 */
export type ProfileFormState =
  | { status: "idle" }
  | { status: "saved"; values: Record<Field, string> }
  | {
      status: "invalid";
      values: Record<Field, string>;
      errors: Partial<Record<Field, string>>;
    }
  | { status: "error"; values?: Record<Field, string> };

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    notify: String(formData.get("notify") ?? ""),
  };

  // Re-check the session here: actions are callable directly, not only from the page.
  const user = await getCurrentUser();
  if (!user) return { status: "error", values };

  const parsed = profileFormSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Partial<Record<Field, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as Field;
      errors[field] ??= issue.message;
    }
    return { status: "invalid", values, errors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      name: parsed.data.name,
      whatsapp: parsed.data.whatsapp,
      notify_channels: notifyChannels(parsed.data.notify),
    })
    .eq("id", user.id);
  if (error) return { status: "error", values };

  // No revalidation needed: /account renders per request.
  return {
    status: "saved",
    values: {
      name: parsed.data.name,
      whatsapp: parsed.data.whatsapp ?? "",
      notify: parsed.data.notify,
    },
  };
}
