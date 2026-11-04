"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { vendorShopForAction } from "@/lib/auth/session";
import {
  failed,
  hasErrors,
  invalid,
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
import { now } from "@/lib/time";
import {
  catalogRequestSchema,
  fieldErrors,
  formObject,
  modelSchema,
  parseInclusionOverrides,
  parsePriceForm,
} from "@/lib/validation/vendor";

/** The model, if it belongs to the caller's shop (RLS also enforces this). */
async function ownModel(modelId: string) {
  const shop = await vendorShopForAction();
  if (!shop) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("bike_models")
    .select(
      "id, shop_id, qty, downtime_count, ready_today_count, ready_today_on, photos",
    )
    .eq("id", modelId)
    .eq("shop_id", shop.id)
    .maybeSingle();
  return data ? { shop, model: data, supabase } : null;
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
      booking_mode: "request",
    })
    .select("id")
    .single();
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
      booking_mode: "request",
    })
    .select("id")
    .single();
  if (modelError || !model) return failed;
  redirect(`/vendor/fleet/${model.id}`);
}

export type FleetPatch = {
  qty?: number;
  ready_today_on?: boolean;
  ready_today_count?: number;
  downtime_count?: number;
  downtime_until?: string | null;
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

  for (const key of ["qty", "ready_today_count", "downtime_count"] as const) {
    if (patch[key] !== undefined && !isCount(patch[key]))
      return { ok: false, error: "invalid" };
  }
  if (
    patch.downtime_until &&
    !/^\d{4}-\d{2}-\d{2}$/.test(patch.downtime_until)
  ) {
    return { ok: false, error: "invalid" };
  }

  const next = { ...model, ...patch };
  // Down time can't exceed the bikes owned; ready today can't exceed what's
  // left. TODO(phase-4): also subtract bikes currently on rent.
  const downtime = Math.min(next.downtime_count, next.qty);
  const available = Math.max(next.qty - downtime, 0);
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
      downtime_count: downtime,
      downtime_until:
        downtime === 0 ? null : (patch.downtime_until ?? undefined),
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
  if (
    v.year_from !== undefined &&
    v.year_to !== undefined &&
    v.year_to < v.year_from
  ) {
    return invalid({ year_to: "endAfterStart" });
  }
  const downtime = Math.min(model.downtime_count, v.qty);
  const { error } = await supabase
    .from("bike_models")
    .update({
      qty: v.qty,
      deposit_amount: v.deposit_amount ?? null,
      booking_mode: v.booking_mode,
      buffer_before_h: v.buffer_before_h ?? null,
      buffer_after_h: v.buffer_after_h ?? null,
      year_from: v.year_from ?? null,
      year_to: v.year_to ?? null,
      visible: v.visible,
      photos: v.photos,
      downtime_count: downtime,
      ready_today_count: Math.min(model.ready_today_count, v.qty - downtime),
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
  const { anchors, manual, errors } = parsePriceForm(formObject(formData));
  if (hasErrors(errors) || bikeAnchorErrors(anchors).length > 0)
    return invalid(errors);
  const table = fillDays(anchors, manual);
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
    helmet_sizes: formData.getAll("helmet_sizes").map(String),
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
