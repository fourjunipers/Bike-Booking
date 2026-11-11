"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@mango/db/platform-server";

export type ReviewState = { failed?: boolean };

/**
 * Approves or rejects a catalog request. The database function is the guard:
 * it refuses anyone who isn't in platform.platform_admins.
 */
export async function reviewRequest(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_catalog_request", {
    p_catalog_id: String(formData.get("id") ?? ""),
    p_approve: formData.get("decision") === "approve",
    p_notes: String(formData.get("notes") ?? "") || undefined,
  });
  if (error) return { failed: true };
  revalidatePath("/admin/catalog");
  return {};
}
