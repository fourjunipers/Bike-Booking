"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { dbErrorKey, fieldErrors, wholeMinute } from "@/lib/fleet";
import { getLocations } from "@/lib/fleet-data";
import {
  generalSchema,
  maxGearQuantity,
  maxSaleQuantity,
  orderProducts,
  parseQuantity,
  readQuantities,
} from "@/lib/general-products";
import { canManageFleet, canMarkLost, canWorkOnUnits } from "@/lib/roles";
import { requireMembership } from "@/lib/session";
import { fromLocalInput } from "@/lib/shop-time";
import { createClient } from "@mango/db/platform-server";

/**
 * Actions for general products (rental gear, items for sale, services), the
 * manual order, and changing or disconnecting a Moto Mangos list entry
 * (docs/products-redesign.md §5.7). Each checks the caller's role for a
 * quick, clear answer; the database functions and guards are the real rule
 * and dbErrorKey turns their refusals into messages.
 */

const notAllowed: FormState = { errors: { form: "notAllowed" } };
const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "").trim();
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

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
}

type DbError = { code?: string; message?: string; details?: string | null };

/**
 * A refusal from a stock function, with the number it names: how low the
 * quantity can go, or how many units there are to act on.
 */
function stockError(error: DbError | null, blockedKey = "units_blocked") {
  const key = dbErrorKey(error);
  const named = [
    "units_blocked",
    "not_enough_free",
    "not_enough_damaged",
    "not_enough_lost",
  ].includes(key);
  const count = error?.details ? Number(error.details) : NaN;
  // A message that names a number is only shown with its number.
  if (named && !Number.isInteger(count))
    return { errors: { quantity: "saveFailed" } } satisfies FormState;
  return {
    errors: { quantity: key === "units_blocked" ? blockedKey : key },
    ...(named ? { values: { count } } : {}),
  } satisfies FormState;
}

// General products ---------------------------------------------------------------------

/** Adds a general product with its first quantities, in one transaction. */
export async function createGeneralProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const raw = Object.fromEntries(formData);
  const parsed = generalSchema.safeParse({
    type: raw.type,
    name: raw.name,
    description: raw.description,
    track_units: raw.track_units,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const locations = await getLocations(tenant.id);
  const read = readQuantities(
    parsed.data.type,
    raw,
    locations.map((location) => location.id),
  );
  if ("errors" in read) return { errors: read.errors };

  const { data, error } = await supabase.rpc("create_general_product", {
    p_tenant_id: tenant.id,
    p_type: parsed.data.type,
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? undefined,
    p_track_units: parsed.data.type === "gear" && parsed.data.track_units,
    p_quantities: read.quantities,
  });
  if (error) {
    const key = dbErrorKey(error);
    return { errors: key === "nameExists" ? { name: key } : { form: key } };
  }
  refresh(slug);
  redirect(`/${slug}/products/${data}?added=1`);
}

/** A general product's name and description, and whether gear is tracked unit by unit. */
export async function saveGeneralProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const raw = Object.fromEntries(formData);
  const parsed = generalSchema.safeParse({
    type: raw.type,
    name: raw.name,
    description: raw.description,
    track_units: raw.track_units,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { data, error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      ...(parsed.data.type === "gear"
        ? { tracking: parsed.data.track_units ? "unit" : "bulk" }
        : {}),
    })
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "id"))
    // The type never changes; this keeps a vehicle out of this form.
    .eq("type", parsed.data.type)
    .select("id");
  if (error || data.length !== 1) {
    const key = dbErrorKey(error);
    return { errors: key === "nameExists" ? { name: key } : { form: key } };
  }
  refresh(slug);
  return { ok: true };
}

/** What the stock forms send: which product, where, and how many. */
function stockFields(formData: FormData, max: number) {
  const product = field(formData, "id");
  const location = field(formData, "location");
  const typed = field(formData, "quantity");
  const quantity = typed === "" ? "invalid" : parseQuantity(typed, max);
  if (!uuid.test(product) || !uuid.test(location) || quantity === "invalid")
    return null;
  return { product, location, quantity };
}

/** "Change quantity": owners and managers. */
export async function setStockQuantity(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const sent = stockFields(
    formData,
    field(formData, "type") === "gear" ? maxGearQuantity : maxSaleQuantity,
  );
  if (!sent) return { errors: { quantity: "invalidQuantity" } };
  const { error } = await supabase.rpc("set_stock_quantity", {
    p_product_id: sent.product,
    p_location_id: sent.location,
    p_quantity: sent.quantity,
  });
  if (error) return stockError(error);
  refresh(slug);
  return { ok: true };
}

/** "Mark damaged": that many units out of use, until a time or until put back. */
export async function markDamaged(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canWorkOnUnits(role)) return notAllowed;
  const sent = stockFields(formData, maxGearQuantity);
  if (!sent || sent.quantity < 1)
    return { errors: { quantity: "invalidQuantity" } };
  // "Until" is typed in the location's time zone.
  const untilText = field(formData, "until");
  let until: Date | null = null;
  if (untilText) {
    const locations = await getLocations(tenant.id);
    const zone = locations.find((l) => l.id === sent.location)?.timezone;
    until = zone ? fromLocalInput(untilText, zone) : null;
    if (!until) return { errors: { until: "invalidDate" } };
    if (until <= wholeMinute(new Date()))
      return { errors: { until: "until_in_past" } };
  }
  const { error } = await supabase.rpc("mark_units_damaged", {
    p_product_id: sent.product,
    p_location_id: sent.location,
    p_quantity: sent.quantity,
    p_until: until?.toISOString(),
  });
  if (error) return stockError(error);
  refresh(slug);
  return { ok: true };
}

/** "Back in use": ends the downtime on that many damaged units. */
export async function markRepaired(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, role, supabase } = await context(formData);
  if (!canWorkOnUnits(role)) return notAllowed;
  const sent = stockFields(formData, maxGearQuantity);
  if (!sent || sent.quantity < 1)
    return { errors: { quantity: "invalidQuantity" } };
  const { error } = await supabase.rpc("mark_units_repaired", {
    p_product_id: sent.product,
    p_location_id: sent.location,
    p_quantity: sent.quantity,
  });
  if (error) return stockError(error);
  refresh(slug);
  return { ok: true };
}

/** "Mark lost": owners, managers and staff. A mechanic is refused. */
export async function markLost(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, role, supabase } = await context(formData);
  if (!canMarkLost(role)) return notAllowed;
  const sent = stockFields(formData, maxGearQuantity);
  if (!sent || sent.quantity < 1)
    return { errors: { quantity: "invalidQuantity" } };
  const { error } = await supabase.rpc("mark_units_lost", {
    p_product_id: sent.product,
    p_location_id: sent.location,
    p_quantity: sent.quantity,
  });
  if (error) return stockError(error, "notEnoughToLose");
  refresh(slug);
  return { ok: true };
}

/** Lost units found again ("restore") or gone for good ("remove"): owners and managers. */
export async function resolveLost(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const sent = stockFields(formData, maxGearQuantity);
  const action = field(formData, "resolve");
  if (!sent || sent.quantity < 1 || !["restore", "remove"].includes(action))
    return { errors: { quantity: "invalidQuantity" } };
  const { error } = await supabase.rpc("resolve_lost_units", {
    p_product_id: sent.product,
    p_location_id: sent.location,
    p_quantity: sent.quantity,
    p_action: action,
  });
  if (error) return stockError(error);
  refresh(slug);
  return { ok: true };
}

// One unit of tracked gear ---------------------------------------------------------------
// The same rules as above, on the unit the person picked. These write the
// rows directly: RLS, units_guard and unit_blocks_guard decide.

/** An optional label ("GoPro 3"). Owners and managers. */
export async function setUnitLabel(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const label = field(formData, "label");
  if (label.length > 60) return { errors: { label: "tooLong" } };
  const { data, error } = await supabase
    .from("units")
    .update({ label: label || null })
    .eq("tenant_id", tenant.id)
    .eq("id", field(formData, "unit"))
    .eq("product_type", "gear")
    .select("id");
  if (error || data.length !== 1)
    return { errors: { label: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}

/**
 * What a row's buttons do to one unit of gear: damaged (downtime from now),
 * repaired (that downtime ends), lost, restore (a lost unit back in stock) or
 * remove (deleted; retired instead if bookings on record need it).
 */
export async function changeGearUnit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, tenant, role, supabase } = await context(formData);
  const unitId = field(formData, "unit");
  const change = field(formData, "change");
  const allowed =
    change === "damaged" || change === "repaired"
      ? canWorkOnUnits(role)
      : change === "lost"
        ? canMarkLost(role)
        : canManageFleet(role);
  if (!allowed || !uuid.test(unitId)) return notAllowed;
  const failed = (error: DbError | null): FormState => ({
    errors: { form: dbErrorKey(error) },
  });
  const now = wholeMinute(new Date());

  if (change === "damaged") {
    const { data: unit } = await supabase
      .from("units")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("id", unitId)
      .eq("product_type", "gear")
      .maybeSingle();
    if (!unit) return notAllowed;
    const { error } = await supabase.from("unit_blocks").insert({
      tenant_id: tenant.id,
      unit_id: unitId,
      kind: "downtime",
      period: `[${now.toISOString()},)`,
    });
    if (error) return failed(error);
  } else if (change === "repaired") {
    const at = new Date().toISOString();
    const { data: blocks, error } = await supabase
      .from("unit_blocks")
      .select("id, period")
      .eq("tenant_id", tenant.id)
      .eq("unit_id", unitId)
      .eq("kind", "downtime")
      .overlaps("period", `[${at},${at}]`);
    if (error) return failed(error);
    for (const block of blocks) {
      const start = new Date(
        String(block.period)
          .replace(/^[[(]/, "")
          .split(",")[0]
          .replace(/"/g, ""),
      );
      const query =
        start >= now
          ? supabase.from("unit_blocks").delete()
          : supabase.from("unit_blocks").update({
              period: `[${start.toISOString()},${now.toISOString()})`,
            });
      const ended = await query.eq("tenant_id", tenant.id).eq("id", block.id);
      if (ended.error) return failed(ended.error);
    }
  } else if (change === "lost" || change === "restore") {
    const { data, error } = await supabase
      .from("units")
      .update({ status: change === "lost" ? "lost" : "active" })
      .eq("tenant_id", tenant.id)
      .eq("id", unitId)
      .eq("product_type", "gear")
      .select("id");
    if (error || data.length !== 1) return failed(error);
  } else if (change === "remove") {
    const removed = await supabase
      .from("units")
      .delete()
      .eq("tenant_id", tenant.id)
      .eq("id", unitId)
      .eq("product_type", "gear")
      .select("id");
    // Bookings on record point at it: it leaves stock but its row stays.
    if (removed.error?.code === "23503") {
      const retired = await supabase
        .from("units")
        .update({ status: "retired" })
        .eq("tenant_id", tenant.id)
        .eq("id", unitId)
        .eq("product_type", "gear")
        .select("id");
      if (retired.error || retired.data.length !== 1)
        return failed(retired.error);
    } else if (removed.error || removed.data.length !== 1)
      return failed(removed.error);
  } else {
    return notAllowed;
  }
  refresh(slug);
  return { ok: true };
}

// Manual order -------------------------------------------------------------------------

/**
 * "Move up" and "Move down" on a line of Fleet or the Products list: puts a
 * product just before or after the line beside it. Owners and managers. A
 * shop still on A to Z has no saved order yet, so the order both lists show
 * (A to Z) is sent with the first move. Plain form actions: they work
 * without JavaScript, and the page shows the new order when it comes back.
 */
export async function moveProduct(formData: FormData): Promise<void> {
  const { slug, tenant, role, supabase } = await context(formData);
  const id = field(formData, "id");
  const target = field(formData, "target");
  const place = field(formData, "place");
  if (
    !canManageFleet(role) ||
    !uuid.test(id) ||
    !uuid.test(target) ||
    !["before", "after"].includes(place)
  )
    return;
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sort_position")
    .eq("tenant_id", tenant.id);
  await supabase.rpc("move_product", {
    p_product_id: id,
    p_target_id: target,
    p_place: place,
    p_current_order: orderProducts(products ?? []).map((p) => p.id),
  });
  refresh(slug);
}

/** "Reset to A–Z": clears the shop's own order. Owners and managers. */
export async function resetProductOrder(formData: FormData): Promise<void> {
  const { slug, tenant, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return;
  await supabase.rpc("reset_product_order", { p_tenant_id: tenant.id });
  refresh(slug);
}

// Moto Mangos: change model, disconnect ---------------------------------------------------

/**
 * "Change model": moves a product that is on a Moto Mangos list entry to
 * another one. The listing switch and its quantities stay; bookings already
 * made are not touched.
 */
export async function changeListingEntry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const entry = field(formData, "catalog_id");
  if (!uuid.test(entry)) return { errors: { catalog_id: "required" } };
  const { error } = await supabase.rpc("change_listing_entry", {
    p_product_id: field(formData, "id"),
    p_catalog_id: entry,
  });
  if (error) return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}

/**
 * "Disconnect": switches the listing off and clears the list entry. Bookings
 * already made are not touched.
 */
export async function disconnectListing(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, role, supabase } = await context(formData);
  if (!canManageFleet(role)) return notAllowed;
  const { error } = await supabase.rpc("disconnect_listing", {
    p_product_id: field(formData, "id"),
  });
  if (error) return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}
