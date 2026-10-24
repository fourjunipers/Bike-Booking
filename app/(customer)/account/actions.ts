"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { notifyChannels, profileFormSchema } from "@/lib/validation/profile";

export type ProfileFormState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "invalid";
      errors: Partial<Record<"name" | "whatsapp" | "notify", string>>;
    }
  | { status: "error" };

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  // Re-check the session here: actions are callable directly, not only from the page.
  const user = await getCurrentUser();
  if (!user) return { status: "error" };

  const parsed = profileFormSchema.safeParse({
    name: formData.get("name") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    notify: formData.get("notify"),
  });
  if (!parsed.success) {
    const errors: Extract<ProfileFormState, { status: "invalid" }>["errors"] =
      {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof typeof errors;
      errors[field] ??= issue.message;
    }
    return { status: "invalid", errors };
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
  if (error) return { status: "error" };

  revalidatePath("/account");
  return { status: "saved" };
}
