"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@mango/db/platform-server";

export type ReviewState = { failed?: boolean };

// Approve: the entry becomes a preset for every shop, and listable on Moto
// Mangos. Merge: it was a preset already under another spelling. Reject: the
// shop keeps its own model, unlisted.

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
    // "Merge": every model waiting on this moves to the chosen preset.
    p_merge_into:
      formData.get("decision") === "merge"
        ? String(formData.get("merge_into") ?? "")
        : undefined,
  });
  if (error) return { failed: true };
  revalidatePath("/admin/catalog");
  return {};
}
