"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@mango/db/platform-server";

export type ReviewState = { failed?: boolean };

const year = (value: FormDataEntryValue | null) =>
  /^\d{4}$/.test(String(value ?? "")) ? Number(value) : undefined;

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
  const { data, error } = await supabase.rpc("review_catalog_request", {
    p_catalog_id: String(formData.get("id") ?? ""),
    p_approve: formData.get("decision") === "approve",
    p_notes: String(formData.get("notes") ?? "") || undefined,
    // The model years the entry covers: the reviewer's to set when approving.
    p_year_from: year(formData.get("year_from")),
    p_year_to: year(formData.get("year_to")),
    // "Merge": every model waiting on this moves to the chosen preset.
    p_merge_into:
      formData.get("decision") === "merge"
        ? String(formData.get("merge_into") ?? "")
        : undefined,
  });
  if (error) return { failed: true };
  revalidatePath("/admin/catalog");
  // Reject: models the shop had meanwhile added again as its own stay linked
  // to the rejected entry. Say so, on the refreshed page.
  const kept = (data as { kept_linked?: unknown[] } | null)?.kept_linked ?? [];
  redirect(
    kept.length ? `/admin/catalog?kept=${kept.length}` : "/admin/catalog",
  );
}
