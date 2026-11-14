"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { CsvError, parseCsv } from "@/lib/csv";
import { toKm } from "@/lib/distance";
import {
  bikeTypes,
  catalogSubmitSchema,
  dbErrorKey,
  fieldErrors,
  hoursToMinutes,
  isIsoDate,
  listingSchema,
  modelSchema,
  parseModelChoice,
  renewalSchema,
  runningAt,
  unitSchema,
  unitStatuses,
  vehicleTypes,
  wholeMinute,
} from "@/lib/fleet";
import { getLocations } from "@/lib/fleet-data";
import { planImport, type ImportError } from "@/lib/fleet-import";
import { parseMoney } from "@/lib/money";
import { canManageFleet, canWorkOnUnits } from "@/lib/roles";
import { requireMembership } from "@/lib/session";
import { fromLocalInput } from "@/lib/shop-time";
import { checkCategories } from "@/lib/vehicle-kinds";
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
  revalidatePath(`/${slug}/products`, "layout");
  revalidatePath(`/${slug}/maintenance`);
  revalidatePath(`/${slug}/dashboard`);
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
  // Adding a product on the way to adding a vehicle: back to that form.
  const thenInventory = field(formData, "then") === "inventory";

  const raw = Object.fromEntries(formData);
  const parsed = modelSchema.safeParse({
    name: raw.name,
    description: raw.description,
    bookable_online: raw.bookable_online,
    min_age: raw.min_age,
    licence_class: raw.licence_class,
  });
  const deposit = money(formData, "deposit", tenant.currency);
  // Typed in hours, stored in minutes.
  const bufferBefore = hoursToMinutes(field(formData, "buffer_before_hours"));
  const bufferAfter = hoursToMinutes(field(formData, "buffer_after_hours"));
  if (
    !parsed.success ||
    deposit === "invalid" ||
    bufferBefore === "invalid" ||
    bufferAfter === "invalid"
  ) {
    return {
      errors: {
        ...(parsed.success ? {} : fieldErrors(parsed.error)),
        ...(deposit === "invalid" ? { deposit: "invalidMoney" } : {}),
        ...(bufferBefore === "invalid"
          ? { buffer_before_hours: "invalidHours" }
          : {}),
        ...(bufferAfter === "invalid"
          ? { buffer_after_hours: "invalidHours" }
          : {}),
      },
    };
  }

  // A product is a kind and a name (owner, 13 Nov 2026). Its make, model,
  // engine size and transmission are asked for when it is sent to Moto
  // Mangos, or come from the list entry it is put on.
  const kind = field(formData, "vehicle_type");
  if (!(vehicleTypes as readonly string[]).includes(kind))
    return { errors: { vehicle_type: "required" } };
  // One or more categories (the chips are checkboxes named "category"). A
  // motorbike or a car needs at least one.
  const checked = checkCategories(kind, formData.getAll("category"));
  if ("error" in checked) return { errors: { category: checked.error } };

  const common = {
    ...parsed.data,
    buffer_before_minutes: bufferBefore,
    buffer_after_minutes: bufferAfter,
    categories: checked.categories,
    deposit,
    deposit_currency: deposit === null ? null : tenant.currency,
  };
  const failed = (error: Parameters<typeof dbErrorKey>[0]): FormState => {
    const key = dbErrorKey(error);
    if (key === "nameExists") return { errors: { name: key } };
    return { errors: { form: key } };
  };

  if (!id) {
    const { data, error } = await supabase
      .from("products")
      .insert({ ...common, vehicle_type: kind, tenant_id: tenant.id })
      .select("id")
      .single();
    if (error) return failed(error);
    refresh(slug);
    redirect(
      thenInventory
        ? `/${slug}/fleet/units/new?product=${data.id}`
        : `/${slug}/products/${data.id}?added=1`,
    );
  }

  const { data, error } = await supabase
    .from("products")
    .update({
      ...common,
      // On a list entry (or waiting on one) the kind is the entry's: the
      // form sends it back unchanged and the database keeps it either way.
      ...(field(formData, "locked") === "1" ? {} : { vehicle_type: kind }),
    })
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    .select("id");
  if (error || data.length !== 1) return failed(error);
  refresh(slug);
  return { ok: true };
}

/**
 * Retires a make & model, or restores it. The database refuses to retire one
 * that still has a vehicle in the fleet, and takes a retired one off Moto
 * Mangos; the audit trail records who did it.
 */
export async function setModelRetired(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const { data, error } = await supabase
    .from("products")
    .update({
      retired_at:
        field(formData, "retired") === "1" ? new Date().toISOString() : null,
    })
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "id"))
    .select("id");
  if (error || data.length !== 1)
    return { errors: { form: dbErrorKey(error) } };
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
    .from("products")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "id"))
    .select("id");
  // A vehicle points at its product, so the database refuses while any
  // remain, retired and sold ones included. The same holds for a gear
  // product's units, and an item for sale with stock on hand is kept too.
  if (error?.code === "23503" || error?.message?.includes("product_has_stock"))
    return {
      errors: {
        form:
          field(formData, "general") === "1"
            ? "productHasStock"
            : "productHasVehicles",
      },
    };
  if (error || data.length !== 1)
    return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  redirect(`/${slug}/products`);
}

// Units ----------------------------------------------------------------------------

/**
 * The shop's model a vehicle goes on. Adding to the inventory never creates a
 * make & model (owner, 12 Nov 2026): that is "+ Make & model"'s one job.
 */
async function resolveModel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  choice: unknown,
): Promise<string | null> {
  const picked = parseModelChoice(choice);
  if (!picked) return null;
  const { data } = await supabase
    .from("products")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", picked.id)
    .maybeSingle();
  return data?.id ?? null;
}

export async function saveUnit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const id = field(formData, "id");

  const raw = Object.fromEntries(formData);
  const parsed = unitSchema.safeParse({
    location_id: raw.location_id,
    plate: raw.plate,
    plate_pending: raw.plate_pending,
    frame_number: raw.frame_number,
    engine_number: raw.engine_number,
    colour: raw.colour,
    model_year: raw.model_year,
    notes: raw.notes,
  });
  const choice = parseModelChoice(raw.model_choice);
  if (!parsed.success || !choice) {
    return {
      errors: {
        ...(parsed.success ? {} : fieldErrors(parsed.error)),
        ...(choice ? {} : { model_choice: "required" }),
      },
    };
  }
  // The odometer is part of the details form (a new bike may leave it blank).
  const odometer = distance(formData, tenant.distanceUnit);
  if (odometer === "invalid" || (id && odometer === null))
    return { errors: { odometer: "invalidDistance" } };

  const modelId = await resolveModel(supabase, tenant.id, raw.model_choice);
  if (!modelId) return { errors: { model_choice: "required" } };

  if (!id) {
    const { data, error } = await supabase
      .from("units")
      .insert({
        ...parsed.data,
        tenant_id: tenant.id,
        product_id: modelId,
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
    .update({
      ...parsed.data,
      product_id: modelId,
      current_odometer_km: odometer ?? 0,
    })
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    // Only if nobody has changed the bike since this form was opened: an old
    // form would otherwise put back an old odometer reading.
    .eq("updated_at", field(formData, "updated_at"))
    .select("id");
  if (error) return unitError(error);
  if (data.length !== 1) {
    const { data: still } = await supabase
      .from("units")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("id", id)
      .maybeSingle();
    return { errors: { form: still ? "staleUnit" : "saveFailed" } };
  }
  refresh(slug);
  return { ok: true };
}

/** Errors that belong under a field rather than at the foot of the form. */
function unitError(error: Parameters<typeof dbErrorKey>[0]): FormState {
  const key = dbErrorKey(error);
  if (key === "plateExists") return { errors: { plate: key } };
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

/**
 * The odometer: owners, managers, staff and mechanics. A lower reading is
 * allowed (the form asks to confirm first); the audit trail records who
 * changed it, from what, to what.
 */
export async function updateOdometer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canWorkOnUnits(role)) return notAllowed;

  const odometer = distance(formData, tenant.distanceUnit);
  if (odometer === "invalid" || odometer === null)
    return { errors: { odometer: "invalidDistance" } };

  const { data, error } = await supabase
    .from("units")
    .update({ current_odometer_km: odometer })
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "id"))
    .select("id");
  if (error || data.length !== 1)
    return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}

/**
 * The bike's one status. Staff and mechanics switch between active and
 * maintenance; owners and managers also retire or sell. Selling or retiring
 * is refused while the bike has a block that ends in the future. After
 * "sold", the user lands on the purchase and sale section to fill it in.
 */
export async function setUnitStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canWorkOnUnits(role)) return notAllowed;
  const id = field(formData, "id");
  const status = field(formData, "status");
  if (!(unitStatuses as readonly string[]).includes(status))
    return { errors: { status: "required" } };

  const { data, error } = await supabase
    .from("units")
    .update({ status })
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    .select("id");
  // The status form shows a refusal under its choices; a lone button
  // (Restore, Retire instead) has no such field and shows it beside itself.
  if (error || data.length !== 1)
    return {
      errors: {
        [field(formData, "button") === "1" ? "form" : "status"]:
          dbErrorKey(error),
      },
    };
  refresh(slug);
  if (status === "sold" && field(formData, "was") !== "sold")
    redirect(`/${slug}/fleet/units/${id}?sold=1#purchase-sale`);
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
  // A vehicle with downtime or bookings on record can't be deleted (they
  // point at it): say so, and offer to retire it instead.
  if (error?.code === "23503")
    return { errors: { form: "unitInUse" }, offer: "retire" };
  if (error || data.length !== 1)
    return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  redirect(`/${slug}/fleet`);
}

// Purchase and sale ------------------------------------------------------------------

function optionalDate(formData: FormData, name: string) {
  const text = field(formData, name);
  if (!text) return null;
  return isIsoDate(text) ? text : ("invalid" as const);
}

/** The one place purchase and sale details are saved. It never changes the status. */
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

  const { error } = await supabase.from("unit_financials").upsert({
    tenant_id: tenant.id,
    unit_id: field(formData, "id"),
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

// Tax and insurance ------------------------------------------------------------------

/** Adds a renewal record. The cost is saved only for owners and managers. */
export async function addRenewal(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canWorkOnUnits(role)) return notAllowed;

  const raw = Object.fromEntries(formData);
  const parsed = renewalSchema.safeParse({
    kind: raw.kind,
    provider: raw.provider,
    reference_no: raw.reference_no,
    starts_at: raw.starts_at,
    expires_at: raw.expires_at,
  });
  const cost = canManageFleet(role)
    ? money(formData, "cost", tenant.currency)
    : null;
  if (!parsed.success || cost === "invalid") {
    return {
      errors: {
        ...(parsed.success ? {} : fieldErrors(parsed.error)),
        ...(cost === "invalid" ? { cost: "invalidMoney" } : {}),
      },
    };
  }

  const { data, error } = await supabase
    .from("unit_renewals")
    .insert({
      ...parsed.data,
      tenant_id: tenant.id,
      unit_id: field(formData, "id"),
    })
    .select("id")
    .single();
  if (error) return { errors: { form: dbErrorKey(error) } };
  if (cost !== null) {
    const { error: costError } = await supabase
      .from("unit_renewal_costs")
      .insert({
        tenant_id: tenant.id,
        renewal_id: data.id,
        currency: tenant.currency,
        cost,
      });
    if (costError) return { errors: { cost: dbErrorKey(costError) } };
  }
  refresh(slug);
  return { ok: true };
}

export async function deleteRenewal(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const { data, error } = await supabase
    .from("unit_renewals")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "renewal"))
    .select("id");
  if (error || data.length !== 1)
    return { errors: { form: dbErrorKey(error) } };
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

  // "From" left blank means now. The time comes from the server at this
  // moment, not from when the page was opened, so it can't land inside a
  // block that was ended since.
  const fromText = field(formData, "from");
  const from = fromText
    ? fromLocalInput(fromText, zone)
    : wholeMinute(new Date());
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
  // Someone else ended or removed it first: back to the bike, which says so.
  const alreadyGone = (): never => {
    refresh(slug);
    redirect(
      `/${slug}/fleet/units/${encodeURIComponent(field(formData, "unit"))}?downtime=gone`,
    );
  };

  const { data: block } = await supabase
    .from("unit_blocks")
    .select("id, period")
    .eq("tenant_id", tenant.id)
    .eq("id", blockId)
    .eq("kind", "downtime")
    .maybeSingle();
  if (!block) return alreadyGone();
  const start = new Date(
    String(block.period).replace(/^[[(]/, "").split(",")[0].replace(/"/g, ""),
  );
  const now = new Date();
  // Ends on the whole minute, like every time typed on this screen, so a new
  // downtime can start in the same minute this one ended.
  const end = wholeMinute(now);

  const query =
    // Not started yet, or started within this minute: nothing left to keep.
    start >= end
      ? supabase.from("unit_blocks").delete()
      : supabase
          .from("unit_blocks")
          .update({ period: `[${start.toISOString()},${end.toISOString()})` })
          // Only a block that is running right now. From a stale page, one
          // that someone already ended would otherwise be stretched to now.
          .overlaps("period", runningAt(now));
  const { data, error } = await query
    .eq("tenant_id", tenant.id)
    .eq("id", blockId)
    .select("id");
  if (error) return { errors: { form: dbErrorKey(error) } };
  if (data.length !== 1) return alreadyGone();
  refresh(slug);
  return { ok: true };
}

// CSV import -------------------------------------------------------------------------

export type ImportState = {
  done?: { products: number; units: number };
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
          {
            line: error.line,
            column: error.detail ?? "",
            code: error.code as never,
          },
        ],
      };
    throw error;
  }

  const [locations, products, units] = await Promise.all([
    getLocations(tenant.id),
    supabase
      .from("products")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .eq("type", "vehicle"),
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
    products: products.data ?? [],
    plates: (units.data ?? []).flatMap((u) => (u.plate ? [u.plate] : [])),
    newId: randomUUID,
  });
  if (plan.errors.length > 0) return { problems: plan.errors };

  // One transaction in the database: the file is saved whole or not at all.
  const { data, error } = await supabase.rpc("import_fleet", {
    p_tenant_id: tenant.id,
    p_models: plan.products,
    p_units: plan.units,
  });
  if (error) return { fileError: "saveFailed" };
  refresh(slug);
  return { done: data as { products: number; units: number } };
}

// Listing on Moto Mangos -------------------------------------------------------------------

/** Links one of the shop's own models to a preset ("Did you mean Honda PCX 160?"). */
export async function linkModelToPreset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const { data, error } = await supabase
    .from("products")
    .update({ catalog_id: field(formData, "catalog_id") })
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "id"))
    .select("id");
  if (error || data.length !== 1)
    return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}

/**
 * Sends one of the shop's own models to the platform admin, to be added to
 * the presets or merged into one. The model waits, linked to its submission.
 */
export async function submitModelToCatalog(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const raw = Object.fromEntries(formData);
  // Moto Mangos files a motorbike under one type: the product's first
  // category (in the order of the list in lib/vehicle-kinds.ts).
  const { data: model } = await supabase
    .from("products")
    .select("categories")
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "id"))
    .maybeSingle();
  const type =
    bikeTypes.find((bikeType) => model?.categories.includes(bikeType)) ?? null;
  if (!type) return { errors: { form: "categoryFirst" } };
  // Make, model, engine size, transmission and the year of the shop's bike
  // are given with the request: all five are required.
  const parsed = catalogSubmitSchema.safeParse({
    make: raw.make,
    model: raw.model,
    cc: raw.cc,
    transmission: raw.transmission,
    year: raw.year,
    note: raw.note,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // One transaction in the database: the details are saved on the product
  // and the request is made, or neither.
  const { error } = await supabase.rpc("submit_product_to_catalog", {
    p_product_id: field(formData, "id"),
    p_type: type,
    p_year: parsed.data.year,
    p_note: parsed.data.note ?? undefined,
    p_make: parsed.data.make,
    p_model: parsed.data.model,
    p_cc: parsed.data.cc,
    p_transmission: parsed.data.transmission,
  });
  if (error) return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}

/**
 * The Moto Mangos listing switch and settings: listed or not, and how many
 * units confirm instantly, need the shop's OK, or stand ready for walk-ins.
 * The database lets a product be listed only on an approved list entry, and
 * keeps the counts within its active vehicles.
 */
export async function saveListing(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const raw = Object.fromEntries(formData);
  const parsed = listingSchema.safeParse({
    listed: raw.listed,
    instant_units: raw.instant_units,
    request_units: raw.request_units,
    ready_now: raw.ready_now,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { listed, ...counts } = parsed.data;
  const { data, error } = await supabase
    .from("products")
    .update({
      marketplace_listed: listed,
      ...counts,
      ...(counts.ready_now > 0
        ? { ready_updated_at: new Date().toISOString() }
        : {}),
    })
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "id"))
    .select("id");
  if (error || data.length !== 1)
    return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}
