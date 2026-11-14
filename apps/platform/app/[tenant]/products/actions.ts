"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { dbErrorKey, fieldErrors } from "@/lib/fleet";
import { getLocations } from "@/lib/fleet-data";
import {
  generalSchema,
  maxGearQuantity,
  maxSaleQuantity,
  orderProducts,
  parseDay,
  parseQuantity,
  readQuantities,
} from "@/lib/general-products";
import {
  canEditProblem,
  canGear,
  problemAction,
  problemKinds,
  type GearAction,
  type OutState,
  type ProblemKind,
} from "@/lib/gear-permissions";
import { canManageFleet } from "@/lib/roles";
import { requireMembership } from "@/lib/session";
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
function stockError(error: DbError | null) {
  const key = dbErrorKey(error);
  const named = ["units_blocked", "not_enough_free"].includes(key);
  const count = error?.details ? Number(error.details) : NaN;
  // A message that names a number is only shown with its number.
  if (named && !Number.isInteger(count))
    return { errors: { quantity: "saveFailed" } } satisfies FormState;
  return {
    errors: { quantity: key },
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
  const gear = field(formData, "type") === "gear";
  if (!(gear ? canGear(role, "set_quantity") : canManageFleet(role)))
    return notAllowed;
  const sent = stockFields(formData, gear ? maxGearQuantity : maxSaleQuantity);
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

/** Which field of the dialog a refusal belongs under. */
const problemField: Record<string, string> = {
  date_in_future: "happened_on",
  expected_before_happened: "expected_back",
  notes_too_long: "notes",
  unit_not_free: "unit",
  unit_not_found: "unit",
};

function problemError(error: DbError | null): FormState {
  const key = dbErrorKey(error);
  if (key === "not_enough_free" || key === "quantity_out_of_range")
    return stockError(error);
  return { errors: { [problemField[key] ?? "form"]: key } };
}

/** The day, the expected-back day and the notes, as the dialog sends them. */
function problemFields(formData: FormData, withExpected: boolean) {
  const errors: Record<string, string> = {};
  const happened = parseDay(field(formData, "happened_on"));
  if (!happened) errors.happened_on = "invalidDate";
  const expectedText = withExpected ? field(formData, "expected_back") : "";
  const expected = expectedText ? parseDay(expectedText) : null;
  if (expectedText && !expected) errors.expected_back = "invalidDate";
  else if (happened && expected && expected < happened)
    errors.expected_back = "expected_before_happened";
  const notes = field(formData, "notes");
  if (notes.length > 500) errors.notes = "notes_too_long";
  return Object.keys(errors).length > 0
    ? { errors }
    : { happened: happened!, expected, notes };
}

/**
 * "Report a problem": units in use go into repair, are marked lost, or are
 * written off as damaged for good. Counted gear says how many; tracked gear
 * says which unit. Each unit gets its own record.
 */
export async function reportProblem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, role, supabase } = await context(formData);
  const kind = field(formData, "kind") as ProblemKind;
  if (!problemKinds.includes(kind)) return { errors: { kind: "required" } };
  if (!canGear(role, problemAction[kind])) return notAllowed;
  const product = field(formData, "id");
  const location = field(formData, "location");
  if (!uuid.test(product) || !uuid.test(location)) return notAllowed;

  const errors: Record<string, string> = {};
  // Tracked gear names the unit; counted gear says how many.
  const unit = field(formData, "unit");
  const tracked = formData.has("unit");
  let quantity: number | undefined;
  if (tracked) {
    if (!uuid.test(unit)) errors.unit = "required";
  } else {
    const typed = field(formData, "quantity");
    const parsed =
      typed === "" ? "invalid" : parseQuantity(typed, maxGearQuantity);
    if (parsed === "invalid" || parsed < 1) errors.quantity = "invalidQuantity";
    else quantity = parsed;
  }
  const sent = problemFields(formData, kind === "repair");
  if ("errors" in sent) Object.assign(errors, sent.errors);
  if (Object.keys(errors).length > 0 || "errors" in sent) return { errors };

  const { error } = await supabase.rpc("report_gear_problem", {
    p_product_id: product,
    p_location_id: location,
    p_kind: kind,
    p_quantity: quantity,
    p_unit_ids: tracked ? [unit] : undefined,
    p_happened_on: sent.happened,
    p_expected_back: sent.expected ?? undefined,
    p_notes: sent.notes || undefined,
  });
  if (error) return problemError(error);
  refresh(slug);
  return { ok: true };
}

/** A line of the "Out of service" list, edited: its days and its notes. */
export async function updateProblem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, role, supabase } = await context(formData);
  const state = field(formData, "state") as OutState;
  const unit = field(formData, "unit");
  if (
    !["repair", "lost"].includes(state) ||
    !canEditProblem(role, state) ||
    !uuid.test(unit)
  )
    return notAllowed;
  const sent = problemFields(formData, state === "repair");
  if ("errors" in sent) return { errors: sent.errors };
  const { error } = await supabase.rpc("update_unit_problem", {
    p_unit_id: unit,
    p_happened_on: sent.happened,
    p_expected_back: sent.expected ?? undefined,
    p_notes: sent.notes || undefined,
  });
  if (error) return problemError(error);
  refresh(slug);
  return { ok: true };
}

/**
 * A line's buttons: "Back in use" (in repair), "Found, back in use" (lost),
 * and "Write off", which removes the unit for good.
 */
export async function resolveProblem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { slug, role, supabase } = await context(formData);
  const action = field(formData, "resolve") as GearAction;
  const unit = field(formData, "unit");
  if (
    !["back_in_use", "found", "write_off"].includes(action) ||
    !canGear(role, action) ||
    !uuid.test(unit)
  )
    return notAllowed;
  const { error } = await supabase.rpc("resolve_unit_problem", {
    p_unit_id: unit,
    p_action: action,
  });
  if (error) return { errors: { form: dbErrorKey(error) } };
  refresh(slug);
  return { ok: true };
}

// One unit of tracked gear ---------------------------------------------------------------

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
