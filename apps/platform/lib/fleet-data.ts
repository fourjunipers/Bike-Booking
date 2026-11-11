import "server-only";
import { cache } from "react";
import { createClient } from "@mango/db/platform-server";
import type { RenewalKind } from "./fleet";
import { catalogName } from "./fleet-import";

export { catalogName };

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
  transmission: "automatic" | "semi_auto" | "manual";
  status: string;
};

const catalogColumns =
  "id, slug, make, model, year_from, year_to, cc, type, transmission, status";

/**
 * The presets: approved catalog entries, the same list Moto Mangos uses.
 * Approving an entry makes it a preset for every shop at once.
 */
export const getCatalog = cache(async (): Promise<CatalogEntry[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("public")
    .from("bike_catalog")
    .select(catalogColumns)
    .eq("status", "approved")
    .order("make")
    .order("model")
    .order("year_from");
  if (error) throw error;
  return data;
});

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
  "id, model_id, location_id, plate, plate_pending, frame_number, engine_number, colour, model_year, current_odometer_km, status, qr_token, notes, created_at, updated_at";

/** Every model with its catalog entry and its units, by model name then plate. */
export const getFleet = cache(async (tenantId: string) => {
  const supabase = await createClient();
  const [models, units, catalog] = await Promise.all([
    supabase
      .from("models")
      .select(
        "id, name, catalog_id, make, model, vehicle_type, cc, transmission, bookable_online, marketplace_listed",
      )
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
  void catalog;
  return models.data.map((model) => ({
    ...model,
    // What the model is, whether it came from a preset or is the shop's own.
    catalog: {
      id: model.catalog_id,
      make: model.make,
      model: model.model,
      cc: model.cc,
      transmission: model.transmission,
    },
    units: units.data.filter((u) => u.model_id === model.id),
  }));
});

export type FleetModel = Awaited<ReturnType<typeof getFleet>>[number];
export type FleetUnit = FleetModel["units"][number];

/** The shop's model-year bands, for every model. */
export const getYearBands = cache(async (tenantId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("model_year_bands")
    .select("id, model_id, year_from, year_to")
    .eq("tenant_id", tenantId)
    .order("year_from", { ascending: false });
  if (error) throw error;
  return data;
});

/** Purchase dates by unit, for sorting. Empty for roles that may not see money (RLS). */
export async function getPurchaseDates(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_financials")
    .select("unit_id, purchase_date")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return new Map(data.map((row) => [row.unit_id, row.purchase_date]));
}

export async function getModel(tenantId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select(
      "id, name, catalog_id, make, model, vehicle_type, cc, transmission, marketplace_listed, description, bookable_online, buffer_before_minutes, buffer_after_minutes, deposit, min_age, licence_class, instant_units, request_units, ready_now",
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

const renewalColumns =
  "id, unit_id, kind, provider, reference_no, starts_at, expires_at";

export type RenewalRow = {
  id: string;
  unit_id: string;
  kind: RenewalKind;
  provider: string | null;
  reference_no: string | null;
  starts_at: string | null;
  expires_at: string;
};

/** One bike's tax and insurance records, latest expiry first. */
export async function getUnitRenewals(tenantId: string, unitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_renewals")
    .select(renewalColumns)
    .eq("tenant_id", tenantId)
    .eq("unit_id", unitId)
    .order("expires_at", { ascending: false });
  if (error) throw error;
  return data as RenewalRow[];
}

/** What each renewal cost, by renewal id. Empty for roles that may not see money (RLS). */
export async function getRenewalCosts(tenantId: string, renewalIds: string[]) {
  if (renewalIds.length === 0) return new Map<string, number>();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_renewal_costs")
    .select("renewal_id, cost")
    .eq("tenant_id", tenantId)
    .in("renewal_id", renewalIds);
  if (error) throw error;
  return new Map(data.map((row) => [row.renewal_id, row.cost]));
}

/**
 * Every renewal in the shop. The caller keeps the current one per bike and
 * kind and applies the shop's reminder days (lib/renewals).
 */
export async function getFleetRenewals(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_renewals")
    .select(renewalColumns)
    .eq("tenant_id", tenantId)
    .order("expires_at", { ascending: false });
  if (error) throw error;
  return data as RenewalRow[];
}

/** The shop's reminder setting. */
export async function getReminderSettings(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("renewal_reminder_days, renewal_digest_day")
    .eq("id", tenantId)
    .single();
  if (error) throw error;
  return data;
}

/** One catalog entry by id: an approved preset, or the shop's own submission (RLS). */
export async function getCatalogEntry(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("public")
    .from("bike_catalog")
    .select(catalogColumns)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
