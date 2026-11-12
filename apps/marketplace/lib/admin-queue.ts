import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mango/db/database.types";

/**
 * Catalog requests waiting for the marketplace admin, oldest first: the ones
 * a marketplace shop made. A request from a shop on the platform has no
 * marketplace shop (requested_by_shop_id is null) and is reviewed in the
 * platform's own admin, which also unlinks or relinks that shop's models;
 * deciding it here would skip that.
 */
export function catalogRequestQueue(db: SupabaseClient<Database>) {
  return db
    .from("bike_catalog")
    .select(
      "id, make, model, year_from, year_to, cc, created_at, shop:shops (name)",
    )
    .eq("status", "requested")
    .not("requested_by_shop_id", "is", null)
    .order("created_at");
}
