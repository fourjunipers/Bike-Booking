"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { CsvError, parseCsv } from "@/lib/csv";
import { toKm } from "@/lib/distance";
import {
  catalogRequestSchema,
  dbErrorKey,
  fieldErrors,
  modelSchema,
  unitSchema,
  workStatuses,
} from "@/lib/fleet";
import { getCatalog, getLocations } from "@/lib/fleet-data";
import { isIsoDate, planImport, type ImportError } from "@/lib/fleet-import";
import { parseMoney } from "@/lib/money";
import { canManageFleet, canWorkOnUnits } from "@/lib/roles";
import { requireMembership } from "@/lib/session";
import { fromLocalInput } from "@/lib/shop-time";
import { createClient } from "@mango/db/platform-server";

/**
 * Fleet actions. Each checks the caller's role for a quick, clear answer, but
 * the database is the real guard: RLS, the units_guard trigger and the
 * unit_blocks exclusion constraint refuse whatever isn't allowed, and
 * dbErrorKey turns that refusal into a message.
 */

const notAllowed: FormState = { errors: { form: "notAllowed" } };
const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "").trim();

async function context(formData: FormData) {
  const slug = field(formData, "slug");
  const { membership } = await requireMembership(slug);
  return {
    slug,
    tenant: membership.tenant,
    role: membership.role,
    supabase: await createClient(),
  };
}

function refresh(slug: string) {
  revalidatePath(`/${slug}/fleet`, "layout");
  revalidatePath(`/${slug}/maintenance`);
}

/** Blank is fine; otherwise an amount in the shop's currency. */
function money(
  formData: FormData,
  name: string,
  currency: string,
): number | null | "invalid" {
  const text = field(formData, name);
  if (!text) return null;
  return parseMoney(text, currency) ?? "invalid";
}

// Models ---------------------------------------------------------------------------

export async function saveModel(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const id = field(formData, "id");

  const raw = Object.fromEntries(formData);
  const parsed = modelSchema.safeParse({
    name: raw.name,
    catalog_id: raw.catalog_id,
    description: raw.description,
    bookable_online: raw.bookable_online,
    buffer_before_minutes: raw.buffer_before_minutes,
    buffer_after_minutes: raw.buffer_after_minutes,
    min_age: raw.min_age,
    licence_class: raw.licence_class,
    instant_units: raw.instant_units,
    request_units: raw.request_units,
    ready_now: raw.ready_now,
  });
  const deposit = money(formData, "deposit", tenant.currency);
  if (!parsed.success || deposit === "invalid") {
    return {
      errors: {
        ...(parsed.success ? {} : fieldErrors(parsed.error)),
        ...(deposit === "invalid" ? { deposit: "invalidMoney" } : {}),
      },
    };
  }
  const row = {
    ...parsed.data,
    deposit,
    deposit_currency: deposit === null ? null : tenant.currency,
  };

  if (!id) {
    const { data, error } = await supabase
      .from("models")
      .insert({ ...row, tenant_id: tenant.id })
      .select("id")
      .single();
    if (error) return { errors: { form: dbErrorKey(error) } };
    refresh(slug);
    redirect(`/${slug}/fleet/models/${data.id}`);
  }

  const { data, error } = await supabase
    .from("models")
    .update({
      ...row,
      ...(row.ready_now > 0 ? { ready_updated_at: new Date().toISOString() } : {}),
    })
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    .select("id");
  if (error || data.length !== 1) return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}

export async function deleteModel(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const { data, error } = await supabase
    .from("models")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "id"))
    .select("id");
  if (error || data.length !== 1) return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  redirect(`/${slug}/fleet`);
}

// Units ----------------------------------------------------------------------------

export async function saveUnit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const id = field(formData, "id");

  const raw = Object.fromEntries(formData);
  const parsed = unitSchema.safeParse({
    model_id: raw.model_id,
    location_id: raw.location_id,
    plate: raw.plate,
    plate_pending: raw.plate_pending,
    frame_number: raw.frame_number,
    engine_number: raw.engine_number,
    colour: raw.colour,
    first_registered: raw.first_registered,
    status: raw.status ?? "active",
    active_from: raw.active_from,
    active_to: raw.active_to,
    notes: raw.notes,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  if (!id) {
    const odometer = distance(formData, tenant.distanceUnit);
    if (odometer === "invalid")
      return { errors: { odometer: "invalidDistance" } };
    const { data, error } = await supabase
      .from("units")
      .insert({
        ...parsed.data,
        tenant_id: tenant.id,
        current_odometer_km: odometer ?? 0,
      })
      .select("id")
      .single();
    if (error) return unitError(error);
    refresh(slug);
    redirect(`/${slug}/fleet/units/${data.id}`);
  }

  const { data, error } = await supabase
    .from("units")
    .update(parsed.data)
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    .select("id");
  if (error || data.length !== 1) return unitError(error);
  refresh(slug);
  return { ok: true };
}

/** Errors that belong under a field rather than at the foot of the form. */
function unitError(error: Parameters<typeof dbErrorKey>[0]): FormState {
  const key = dbErrorKey(error);
  if (key === "plateExists") return { errors: { plate: key } };
  if (key === "unit_has_future_blocks") return { errors: { status: key } };
  return { errors: { form: key } };
}

/** The odometer field, typed in the shop's unit, as km. */
function distance(
  formData: FormData,
  unit: "km" | "mi",
): number | null | "invalid" {
  const text = field(formData, "odometer").replace(/[\s,]/g, "");
  if (!text) return null;
  if (!/^\d+(\.\d)?$/.test(text) || Number(text) > 9_999_999) return "invalid";
  return toKm(Number(text), unit);
}

/** Odometer and active/maintenance: what staff and mechanics may change. */
export async function updateUnitWork(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canWorkOnUnits(role)) return notAllowed;

  const odometer = distance(formData, tenant.distanceUnit);
  if (odometer === "invalid" || odometer === null)
    return { errors: { odometer: "invalidDistance" } };
  const status = field(formData, "status");
  const change: { current_odometer_km: number; status?: string } = {
    current_odometer_km: odometer,
  };
  if ((workStatuses as readonly string[]).includes(status))
    change.status = status;

  const { data, error } = await supabase
    .from("units")
    .update(change)
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "id"))
    .select("id");
  if (error || data.length !== 1) {
    const key = dbErrorKey(error);
    return key === "odometer_lower_needs_manager"
      ? { errors: { odometer: key } }
      : { errors: { form: key } };
  }
  refresh(slug);
  return { ok: true };
}

export async function deleteUnit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const { data, error } = await supabase
    .from("units")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "id"))
    .select("id");
  if (error || data.length !== 1) return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  redirect(`/${slug}/fleet`);
}

// Purchase and sale ------------------------------------------------------------------

function optionalDate(formData: FormData, name: string) {
  const text = field(formData, name);
  if (!text) return null;
  return isIsoDate(text) ? text : ("invalid" as const);
}

export async function saveFinancials(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;

  const purchasePrice = money(formData, "purchase_price", tenant.currency);
  const salePrice = money(formData, "sale_price", tenant.currency);
  const purchaseDate = optionalDate(formData, "purchase_date");
  const soldAt = optionalDate(formData, "sold_at");
  const errors: Record<string, string> = {};
  if (purchasePrice === "invalid") errors.purchase_price = "invalidMoney";
  if (salePrice === "invalid") errors.sale_price = "invalidMoney";
  if (purchaseDate === "invalid") errors.purchase_date = "invalidDate";
  if (soldAt === "invalid") errors.sold_at = "invalidDate";
  const purchasedFrom = field(formData, "purchased_from");
  const soldTo = field(formData, "sold_to");
  if (purchasedFrom.length > 200) errors.purchased_from = "tooLong";
  if (soldTo.length > 200) errors.sold_to = "tooLong";
  if (Object.keys(errors).length > 0) return { errors };

  const unitId = field(formData, "id");
  const selling = field(formData, "intent") === "sell";
  if (selling) {
    // The refusable step first: the database won't sell a unit that still
    // has a block ending in the future.
    const { data, error } = await supabase
      .from("units")
      .update({ status: "sold" })
      .eq("tenant_id", tenant.id)
      .eq("id", unitId)
      .select("id");
    if (error || data.length !== 1)
      return { errors: { form: dbErrorKey(error) } };
  }

  const { error } = await supabase.from("unit_financials").upsert({
    tenant_id: tenant.id,
    unit_id: unitId,
    currency: tenant.currency,
    purchase_date: purchaseDate as string | null,
    purchase_price: purchasePrice as number | null,
    purchased_from: purchasedFrom || null,
    sold_at: soldAt as string | null,
    sale_price: salePrice as number | null,
    sold_to: soldTo || null,
  });
  if (error) return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}

// Downtime ---------------------------------------------------------------------------

export async function addDowntime(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canWorkOnUnits(role)) return notAllowed;
  const unitId = field(formData, "id");

  // Times are typed in the time zone of the unit's location.
  const { data: unit } = await supabase
    .from("units")
    .select("id, location:locations!inner(timezone)")
    .eq("tenant_id", tenant.id)
    .eq("id", unitId)
    .maybeSingle();
  if (!unit) return notAllowed;
  const zone = unit.location.timezone;

  const from = fromLocalInput(field(formData, "from"), zone);
  const untilText = field(formData, "until");
  const until = untilText ? fromLocalInput(untilText, zone) : null;
  const note = field(formData, "note");
  const errors: Record<string, string> = {};
  if (!from) errors.from = "invalidDate";
  if (untilText && !until) errors.until = "invalidDate";
  if (from && until && until <= from) errors.until = "endBeforeStart";
  if (note.length > 500) errors.note = "tooLong";
  if (!from || Object.keys(errors).length > 0) return { errors };

  const { error } = await supabase.from("unit_blocks").insert({
    tenant_id: tenant.id,
    unit_id: unitId,
    kind: "downtime",
    period: `[${from.toISOString()},${until ? until.toISOString() : ""})`,
    note: note || null,
  });
  if (error) return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}

/** Ends a running block now, or removes one that hasn't started. */
export async function endDowntime(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canWorkOnUnits(role)) return notAllowed;
  const blockId = field(formData, "block");

  const { data: block } = await supabase
    .from("unit_blocks")
    .select("id, period")
    .eq("tenant_id", tenant.id)
    .eq("id", blockId)
    .eq("kind", "downtime")
    .maybeSingle();
  if (!block) return notAllowed;
  const start = new Date(
    String(block.period)
      .replace(/^[[(]/, "")
      .split(",")[0]
      .replace(/"/g, ""),
  );
  const now = new Date();

  const query =
    start >= now
      ? supabase.from("unit_blocks").delete()
      : supabase
          .from("unit_blocks")
          .update({ period: `[${start.toISOString()},${now.toISOString()})` });
  const { data, error } = await query
    .eq("tenant_id", tenant.id)
    .eq("id", blockId)
    .select("id");
  if (error || data.length !== 1) return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}

// CSV import -------------------------------------------------------------------------

export type ImportState = {
  done?: { models: number; units: number };
  /** A problem with the file as a whole. */
  fileError?: string;
  problems?: ImportError[];
};

const maxBytes = 1_000_000;

export async function importFleet(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return { fileError: "saveFailed" };

  const file = formData.get("file");
  let text = String(formData.get("text") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > maxBytes) return { fileError: "tooLarge" };
    text = await file.text();
  }
  if (!text.trim()) return { fileError: "noFile" };
  if (text.length > maxBytes) return { fileError: "tooLarge" };

  let table;
  try {
    table = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvError)
      return {
        problems: [
          { line: error.line, column: error.detail ?? "", code: error.code as never },
        ],
      };
    throw error;
  }

  const [locations, catalog, models, units] = await Promise.all([
    getLocations(tenant.id),
    getCatalog(),
    supabase.from("models").select("id, name").eq("tenant_id", tenant.id),
    supabase.from("units").select("plate").eq("tenant_id", tenant.id),
  ]);
  const plan = planImport(table, {
    currency: tenant.currency,
    distanceUnit: tenant.distanceUnit,
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      isDefault: l.is_default,
    })),
    models: models.data ?? [],
    catalog,
    plates: (units.data ?? []).flatMap((u) => (u.plate ? [u.plate] : [])),
    newId: randomUUID,
  });
  if (plan.errors.length > 0) return { problems: plan.errors };

  // One transaction in the database: the file is saved whole or not at all.
  const { data, error } = await supabase.rpc("import_fleet", {
    p_tenant_id: tenant.id,
    p_models: plan.models,
    p_units: plan.units,
  });
  if (error) return { fileError: "saveFailed" };
  refresh(slug);
  return { done: data as { models: number; units: number } };
}

// Catalog request ----------------------------------------------------------------------

export async function requestCatalogEntry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;

  const raw = Object.fromEntries(formData);
  const parsed = catalogRequestSchema.safeParse({
    make: raw.make,
    model: raw.model,
    year_from: raw.year_from,
    year_to: raw.year_to,
    type: raw.type,
    transmission: raw.transmission,
    cc: raw.cc,
    note: raw.note,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const entry = parsed.data;

  const { data: id, error } = await supabase.rpc("request_catalog_entry", {
    p_tenant_id: tenant.id,
    p_make: entry.make,
    p_model: entry.model,
    // The generated types mark these as required; the function accepts null.
    p_year_from: entry.year_from as number,
    p_year_to: entry.year_to as number,
    p_type: entry.type,
    p_transmission: entry.transmission,
    p_cc: entry.cc,
    p_note: entry.note ?? undefined,
  });
  if (error) return { errors: { form: dbErrorKey(error) } };
  revalidatePath(`/${slug}/fleet`, "layout");
  redirect(`/${slug}/fleet/models/new?catalog=${id}`);
}
