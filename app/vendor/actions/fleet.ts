"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { vendorShopForAction } from "@/lib/auth/session";
import {
  failed,
  hasErrors,
  invalid,
  mergeStates,
  savedState,
  type ActionState,
} from "@/lib/forms";
import {
  minimalOverrides,
  INCLUSION_FIELDS,
  type Inclusions,
} from "@/lib/inclusions";
import { isOwnPhotoPath, PHOTO_BUCKETS } from "@/lib/photos";
import { bikeAnchorErrors, fillDays } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { bangkokDateString, now } from "@/lib/time";
import {
  catalogRequestSchema,
  fieldErrors,
  formObject,
  modelSchema,
  parseInclusionOverrides,
  parsePriceForm,
  repairSchema,
} from "@/lib/validation/vendor";

/** The model, if it belongs to the caller's shop (RLS also enforces this). */
async function ownModel(modelId: string) {
  const shop = await vendorShopForAction();
  if (!shop) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("bike_models")
    .select("id, shop_id, qty, ready_today_count, ready_today_on, photos")
    .eq("id", modelId)
    .eq("shop_id", shop.id)
    .maybeSingle();
  return data ? { shop, model: data, supabase } : null;
}

/** Units of the model in repair today (Bangkok date). */
async function unitsInRepair(
  supabase: Awaited<ReturnType<typeof createClient>>,
  modelId: string,
): Promise<number> {
  const { data } = await supabase.rpc("units_in_repair", {
    p_bike_model_id: modelId,
    p_date: bangkokDateString(now()),
  });
  return data ?? 0;
}

export async function addModel(formData: FormData) {
  const shop = await vendorShopForAction();
  const catalogId = String(formData.get("catalog_id") ?? "");
  if (!shop || !catalogId) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bike_models")
    .insert({
      shop_id: shop.id,
      catalog_id: catalogId,
      qty: 1,
      request_qty: 1,
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    // Already in the fleet: one listing per bike, so open that one.
    const { data: existing } = await supabase
      .from("bike_models")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("catalog_id", catalogId)
      .maybeSingle();
    if (existing) redirect(`/vendor/fleet/${existing.id}?existing=1`);
  }
  if (error || !data) redirect("/vendor/fleet/new?error=1");
  redirect(`/vendor/fleet/${data.id}`);
}

export async function requestCatalogModel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shop = await vendorShopForAction();
  if (!shop) return failed;
  const parsed = catalogRequestSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data: entry, error } = await supabase
    .from("bike_catalog")
    .insert({ ...parsed.data, requested_by_shop_id: shop.id })
    .select("id")
    .single();
  if (error || !entry) return failed;
  const { data: model, error: modelError } = await supabase
    .from("bike_models")
    .insert({
      shop_id: shop.id,
      catalog_id: entry.id,
      qty: 1,
      request_qty: 1,
    })
    .select("id")
    .single();
  if (modelError || !model) return failed;
  redirect(`/vendor/fleet/${model.id}`);
}

export type FleetPatch = {
  ready_today_on?: boolean;
  ready_today_count?: number;
  visible?: boolean;
};

export type FleetResult =
  { ok: true } | { ok: false; error: "invalid" | "ceiling" | "failed" };

const isCount = (n: unknown) =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 999;

/** One inline change from the fleet table. Saves immediately. */
export async function updateFleetRow(
  modelId: string,
  patch: FleetPatch,
): Promise<FleetResult> {
  const own = await ownModel(modelId);
  if (!own) return { ok: false, error: "failed" };
  const { model, supabase } = own;

  if (
    patch.ready_today_count !== undefined &&
    !isCount(patch.ready_today_count)
  )
    return { ok: false, error: "invalid" };

  const next = { ...model, ...patch };
  // Ready today can't exceed the bikes not in repair.
  // TODO(phase-4): also subtract bikes currently on rent.
  const repair = await unitsInRepair(supabase, modelId);
  const available = Math.max(next.qty - repair, 0);
  let readyCount = next.ready_today_count;
  let readyOn = next.ready_today_on;
  if (patch.ready_today_on === true && readyCount === 0)
    readyCount = Math.min(1, available);
  if (
    patch.ready_today_count !== undefined &&
    patch.ready_today_count > available
  ) {
    return { ok: false, error: "ceiling" };
  }
  readyCount = Math.min(readyCount, available);
  if (readyCount === 0) readyOn = false;

  const touchesReady =
    patch.ready_today_on !== undefined || patch.ready_today_count !== undefined;
  const { error } = await supabase
    .from("bike_models")
    .update({
      ...patch,
      ready_today_count: readyCount,
      ready_today_on: readyOn,
      ...(touchesReady ? { ready_today_updated_at: now().toISOString() } : {}),
    })
    .eq("id", modelId);
  if (error) return { ok: false, error: "failed" };
  refresh();
  return { ok: true };
}

export async function saveModel(
  modelId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const own = await ownModel(modelId);
  if (!own) return failed;
  const { shop, model, supabase } = own;
  const parsed = modelSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const v = parsed.data;
  if (!v.photos.every((p) => isOwnPhotoPath(p, shop.id, modelId))) {
    return invalid({ photos: "invalid" });
  }
  const repair = await unitsInRepair(supabase, modelId);
  const { error } = await supabase
    .from("bike_models")
    .update({
      qty: v.qty,
      instant_qty: v.instant_qty,
      request_qty: v.request_qty,
      deposit_amount: v.deposit_amount ?? null,
      buffer_before_h: v.buffer_before_h ?? null,
      buffer_after_h: v.buffer_after_h ?? null,
      min_days_walkin: v.min_days_walkin ?? null,
      min_days_booking: v.min_days_booking ?? null,
      notice_h: v.notice_h ?? null,
      visible: v.visible,
      photos: v.photos,
      ready_today_count: Math.max(
        Math.min(model.ready_today_count, v.qty - repair),
        0,
      ),
    })
    .eq("id", modelId);
  if (error) return failed;
  const removed = model.photos.filter(
    (p) => !v.photos.includes(p) && !p.startsWith("/"),
  );
  if (removed.length > 0)
    await supabase.storage.from(PHOTO_BUCKETS.model).remove(removed);
  refresh();
  return savedState;
}

export async function savePrices(
  modelId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const own = await ownModel(modelId);
  if (!own) return failed;
  const { anchors, manual, dailyAfter30, errors } = parsePriceForm(
    formObject(formData),
  );
  if (hasErrors(errors) || bikeAnchorErrors(anchors).length > 0)
    return invalid(errors);
  const table = fillDays(anchors, manual);
  const { error: afterError } = await own.supabase
    .from("bike_models")
    .update({ price_after_30: dailyAfter30 })
    .eq("id", modelId);
  if (afterError) return failed;
  const { error } = await own.supabase.from("price_days").upsert(
    table.map((d) => ({
      bike_model_id: modelId,
      day: d.day,
      total: d.total,
      is_anchor: d.isAnchor,
      is_manual: d.isManual,
    })),
  );
  if (error) return failed;
  refresh();
  return savedState;
}

export async function saveModelInclusions(
  modelId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const own = await ownModel(modelId);
  if (!own) return failed;
  const { overrides, errors } = parseInclusionOverrides(formObject(formData), {
    helmet_types: formData.getAll("helmet_types").map(String),
    deposit_methods: formData.getAll("deposit_methods").map(String),
  });
  if (hasErrors(errors)) return invalid(errors);

  const { data: shopDefaults } = await own.supabase
    .from("shop_policies")
    .select(INCLUSION_FIELDS.join(", "))
    .eq("shop_id", own.shop.id)
    .single<Inclusions>();
  if (!shopDefaults) return failed;
  const kept = minimalOverrides(shopDefaults, overrides);
  // Every field written: anything not overridden goes back to null.
  const row = Object.fromEntries(
    INCLUSION_FIELDS.map((f) => [f, kept[f] ?? null]),
  );
  const { error } = await own.supabase
    .from("bike_model_policies")
    .upsert({ bike_model_id: modelId, ...row });
  if (error) return failed;
  refresh();
  return savedState;
}

export async function deleteModel(modelId: string): Promise<ActionState> {
  const own = await ownModel(modelId);
  if (!own) return failed;
  const { error } = await own.supabase
    .from("bike_models")
    .delete()
    .eq("id", modelId);
  // Bookings keep their model (on delete restrict): hide it instead.
  if (error) return { status: "error", notice: "hasBookings" };
  const photos = own.model.photos.filter((p) => !p.startsWith("/"));
  if (photos.length > 0)
    await own.supabase.storage.from(PHOTO_BUCKETS.model).remove(photos);
  redirect("/vendor/fleet");
}

export type RepairResult =
  | { ok: true; conflicts: string[] }
  | { ok: false; error: "invalid" | "repairTooBig" | "failed" };

/**
 * Adds a repair entry (units out of service, optional back-in-service date).
 * Returns the codes of bookings that no longer fit, as a warning.
 */
export async function addRepair(
  modelId: string,
  input: { units: number; back_on?: string; note?: string },
): Promise<RepairResult> {
  const own = await ownModel(modelId);
  if (!own) return { ok: false, error: "failed" };
  const { model, supabase } = own;
  const parsed = repairSchema.safeParse({
    units: String(input.units),
    back_on: input.back_on ?? "",
    note: input.note ?? "",
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const today = bangkokDateString(now());
  const v = parsed.data;
  if (v.back_on !== undefined && v.back_on <= today)
    return { ok: false, error: "invalid" };
  const repair = await unitsInRepair(supabase, modelId);
  if (repair + v.units > model.qty) return { ok: false, error: "repairTooBig" };

  const { error } = await supabase.from("bike_model_downtime").insert({
    bike_model_id: modelId,
    units: v.units,
    back_on: v.back_on ?? null,
    note: v.note ?? null,
  });
  if (error) return { ok: false, error: "failed" };
  // Fewer bikes left: ready today can't exceed them.
  const left = Math.max(model.qty - repair - v.units, 0);
  if (model.ready_today_count > left) {
    await supabase
      .from("bike_models")
      .update({
        ready_today_count: left,
        ready_today_on: left > 0 && model.ready_today_on,
      })
      .eq("id", modelId);
  }
  const { data: conflicts } = await supabase.rpc("repair_conflicts", {
    p_bike_model_id: modelId,
    p_from: today,
  });
  refresh();
  return { ok: true, conflicts: (conflicts ?? []).map((c) => c.code) };
}

/** Removes a repair entry: the units are back in service now. */
export async function removeRepair(
  modelId: string,
  repairId: string,
): Promise<RepairResult> {
  const own = await ownModel(modelId);
  if (!own) return { ok: false, error: "failed" };
  const { error } = await own.supabase
    .from("bike_model_downtime")
    .delete()
    .eq("id", repairId)
    .eq("bike_model_id", modelId);
  if (error) return { ok: false, error: "failed" };
  refresh();
  return { ok: true, conflicts: [] };
}

/**
 * The bike editor's one Save button: details, prices and "What's included".
 * Each part saves on its own; the result lists every part's field errors.
 */
export async function saveModelPage(
  modelId: string,
  prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return mergeStates([
    await saveModel(modelId, prev, formData),
    await savePrices(modelId, prev, formData),
    await saveModelInclusions(modelId, prev, formData),
  ]);
}
