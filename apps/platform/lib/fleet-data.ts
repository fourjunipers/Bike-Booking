import "server-only";
import { cache } from "react";
import { createClient } from "@mango/db/platform-server";

/**
 * Reads for the fleet and location screens. Everything runs as the signed-in
 * user, so RLS decides what comes back: another shop's rows simply aren't
 * there. The shared catalog lives in `public`, which PostgREST can't join to
 * from `platform`, so catalog entries are fetched beside the models.
 */

export type CatalogEntry = {
  id: string;
  slug: string;
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
  cc: number;
  type: string;
  transmission: string;
  status: string;
};

const catalogColumns =
  "id, slug, make, model, year_from, year_to, cc, type, transmission, status";

/** Entries the shop may use: approved ones and its own pending requests (RLS). */
export const getCatalog = cache(async (): Promise<CatalogEntry[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("public")
    .from("bike_catalog")
    .select(catalogColumns)
    .in("status", ["approved", "requested"])
    .order("make")
    .order("model")
    .order("year_from");
  if (error) throw error;
  return data;
});

/** "Honda PCX 160 (2026)" / "Honda CB500X (2019–2021)". */
export function catalogName(entry: CatalogEntry): string {
  const years =
    entry.year_from && entry.year_to && entry.year_to !== entry.year_from
      ? ` (${entry.year_from}–${entry.year_to})`
      : entry.year_from
        ? ` (${entry.year_from})`
        : "";
  return `${entry.make} ${entry.model}${years}`;
}

export const getLocations = cache(async (tenantId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select(
      "id, name, is_default, timezone, address, maps_url, phone, whatsapp, line_id, email",
    )
    .eq("tenant_id", tenantId)
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return data;
});

const unitColumns =
  "id, model_id, location_id, plate, plate_pending, frame_number, engine_number, colour, first_registered, current_odometer_km, status, active_from, active_to, qr_token, notes";

/** Every model with its units, by model name then plate. */
export const getFleet = cache(async (tenantId: string) => {
  const supabase = await createClient();
  const [models, units, catalog] = await Promise.all([
    supabase
      .from("models")
      .select("id, name, catalog_id, bookable_online")
      .eq("tenant_id", tenantId)
      .order("name"),
    supabase
      .from("units")
      .select(unitColumns)
      .eq("tenant_id", tenantId)
      .order("plate", { nullsFirst: false }),
    getCatalog(),
  ]);
  if (models.error) throw models.error;
  if (units.error) throw units.error;
  const entries = new Map(catalog.map((c) => [c.id, c]));
  return models.data.map((model) => ({
    ...model,
    catalog: entries.get(model.catalog_id),
    units: units.data.filter((u) => u.model_id === model.id),
  }));
});

export type FleetModel = Awaited<ReturnType<typeof getFleet>>[number];
export type FleetUnit = FleetModel["units"][number];

export async function getModel(tenantId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select(
      "id, name, catalog_id, description, bookable_online, buffer_before_minutes, buffer_after_minutes, deposit, min_age, licence_class, instant_units, request_units, ready_now",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUnit(tenantId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select(unitColumns)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** A unit's blocks, newest first. `period` is "[from,to)" with an empty `to` when open-ended. */
export async function getUnitBlocks(tenantId: string, unitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_blocks")
    .select("id, kind, period, note")
    .eq("tenant_id", tenantId)
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data.map((block) => ({ ...block, ...parsePeriod(block.period) }));
}

/** Postgres writes a time range as ["2026-11-10 02:30:00+00","2026-11-11 02:30:00+00"). */
export function parsePeriod(period: unknown): { from: Date; to: Date | null } {
  const [from, to] = String(period)
    .replace(/^[[(]|[\])]$/g, "")
    .split(",")
    .map((part) => part.replace(/^"|"$/g, "").trim());
  return { from: new Date(from), to: to ? new Date(to) : null };
}

/** Purchase and sale details. Null for roles that may not see them (RLS). */
export async function getUnitFinancials(tenantId: string, unitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_financials")
    .select(
      "currency, purchase_date, purchase_price, purchased_from, sold_at, sale_price, sold_to",
    )
    .eq("tenant_id", tenantId)
    .eq("unit_id", unitId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
