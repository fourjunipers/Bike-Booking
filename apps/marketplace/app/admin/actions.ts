"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { failed, invalid, savedState, type ActionState } from "@/lib/forms";
import { PHOTO_BUCKETS } from "@/lib/photos";
import { createAdminClient } from "@mango/db/admin";
import { now } from "@mango/core/time";
import {
  catalogEntrySchema,
  fieldErrors,
  formObject,
} from "@/lib/validation/vendor";

// Admin uses the service role, on the server only, after requireAdmin()
// (CLAUDE.md security rules). Every action checks again.

const id = (formData: FormData, key = "id") => String(formData.get(key) ?? "");

export async function approveShop(formData: FormData) {
  await requireAdmin();
  const shopId = id(formData);
  const db = createAdminClient();
  // Vendors may submit early (2026-11-06); only a complete shop goes live.
  const { data: missing } = await db.rpc("shop_readiness", {
    p_shop_id: shopId,
  });
  if (!missing || missing.length > 0) return;
  await db
    .from("shops")
    .update({
      status: "live",
      approved_at: now().toISOString(),
      review_notes: null,
      flagged_for_review: false,
    })
    .eq("id", shopId)
    .eq("status", "pending");
  await db
    .from("bike_models")
    .update({ flagged_for_review: false })
    .eq("shop_id", shopId);
  refresh();
}

export async function returnShop(formData: FormData) {
  await requireAdmin();
  const notes = String(formData.get("notes") ?? "")
    .trim()
    .slice(0, 2000);
  if (!notes) return;
  await createAdminClient()
    .from("shops")
    .update({ status: "draft", review_notes: notes })
    .eq("id", id(formData))
    .eq("status", "pending");
  refresh();
}

export async function setShopSuspended(formData: FormData) {
  await requireAdmin();
  const suspend = formData.get("suspend") === "true";
  await createAdminClient()
    .from("shops")
    .update({ status: suspend ? "suspended" : "live" })
    .eq("id", id(formData))
    .eq("status", suspend ? "live" : "suspended");
  refresh();
}

export async function setBoost(formData: FormData) {
  await requireAdmin();
  const boost = String(formData.get("boost_level") ?? "");
  if (boost !== "featured" && boost !== "preferred" && boost !== "normal")
    return;
  await createAdminClient()
    .from("shops")
    .update({ boost_level: boost })
    .eq("id", id(formData));
  refresh();
}

/** Marks a live shop's flagged edits as reviewed (shop and all its models). */
export async function clearFlags(formData: FormData) {
  await requireAdmin();
  const shopId = id(formData);
  const db = createAdminClient();
  await db.from("shops").update({ flagged_for_review: false }).eq("id", shopId);
  await db
    .from("bike_models")
    .update({ flagged_for_review: false })
    .eq("shop_id", shopId);
  refresh();
}

/**
 * Creates (entryId null) or updates a catalog entry; new entries are approved.
 * The stock photo can be added once the entry exists.
 */
export async function saveCatalogEntry(
  entryId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = catalogEntrySchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const v = parsed.data;
  const row = {
    make: v.make,
    model: v.model,
    year_from: v.year_from ?? null,
    year_to: v.year_to ?? null,
    cc: v.cc,
    type: v.type,
    transmission: v.transmission,
    abs: v.abs,
    underseat_storage: v.underseat_storage,
    usb_charger: v.usb_charger,
    key_type: v.key_type ?? null,
    description: v.description ?? null,
    ...(v.slug ? { slug: v.slug } : {}),
  };
  const db = createAdminClient();
  const { data, error } = entryId
    ? await db
        .from("bike_catalog")
        .update(row)
        .eq("id", entryId)
        .select("id")
        .single()
    : await db
        .from("bike_catalog")
        .insert({
          ...row,
          status: "approved",
          reviewed_at: now().toISOString(),
        })
        .select("id")
        .single();
  if (error)
    return error.code === "23505" ? invalid({ slug: "invalid" }) : failed;

  // Stock photo: uploaded by the browser to catalog-photos/<id>/…; at most one.
  if (entryId) {
    const raw = String(formData.get("stock_photo") ?? "[]");
    let paths: unknown;
    try {
      paths = JSON.parse(raw);
    } catch {
      return invalid({ stock_photo: "invalid" });
    }
    if (!Array.isArray(paths) || paths.length > 1)
      return invalid({ stock_photo: "invalid" });
    const next = typeof paths[0] === "string" ? paths[0] : null;
    if (next && !next.startsWith(`${entryId}/`))
      return invalid({ stock_photo: "invalid" });
    const { data: old } = await db
      .from("bike_catalog")
      .select("stock_photo")
      .eq("id", entryId)
      .single();
    if ((old?.stock_photo ?? null) !== next) {
      await db
        .from("bike_catalog")
        .update({ stock_photo: next })
        .eq("id", entryId);
      if (old?.stock_photo)
        await db.storage.from(PHOTO_BUCKETS.catalog).remove([old.stock_photo]);
    }
  }
  if (!entryId) redirect(`/admin/catalog/${data.id}`);
  refresh();
  return savedState;
}

/** Approve or reject a vendor's catalog request. */
export async function reviewCatalogRequest(formData: FormData) {
  await requireAdmin();
  const decision = formData.get("decision");
  if (decision !== "approved" && decision !== "rejected") return;
  const notes =
    String(formData.get("notes") ?? "")
      .trim()
      .slice(0, 1000) || null;
  await createAdminClient()
    .from("bike_catalog")
    .update({
      status: decision,
      review_notes: notes,
      reviewed_at: now().toISOString(),
    })
    .eq("id", id(formData))
    .eq("status", "requested");
  refresh();
}

/**
 * Deletes a shop that isn't live (e.g. one the admin won't approve), with its
 * bikes, settings and photos. Live shops are suspended instead, so their
 * bookings and history stay.
 */
export async function deleteShop(formData: FormData) {
  await requireAdmin();
  const shopId = id(formData);
  const db = createAdminClient();
  const { data: shop } = await db
    .from("shops")
    .select("status")
    .eq("id", shopId)
    .maybeSingle();
  if (!shop || shop.status === "live") return;

  // Photos live in folders named after the shop (and its models).
  await removeFolder(db, PHOTO_BUCKETS.shop, shopId);
  const { data: models } = await db
    .from("bike_models")
    .select("id")
    .eq("shop_id", shopId);
  for (const m of models ?? [])
    await removeFolder(db, PHOTO_BUCKETS.model, `${shopId}/${m.id}`);

  const { error } = await db.from("shops").delete().eq("id", shopId);
  if (error) throw new Error(`Couldn't delete shop: ${error.message}`);
  refresh();
  redirect("/admin/shops");
}

async function removeFolder(
  db: ReturnType<typeof createAdminClient>,
  bucket: string,
  folder: string,
) {
  const { data: files } = await db.storage
    .from(bucket)
    .list(folder, { limit: 1000 });
  const paths = (files ?? [])
    .filter((f) => f.id !== null)
    .map((f) => `${folder}/${f.name}`);
  if (paths.length > 0) await db.storage.from(bucket).remove(paths);
}

const weight = (formData: FormData, key: string) => {
  const n = Number(String(formData.get(key) ?? "").trim());
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
};

/** Ranking weights (SPEC "Admin screens and ranking"). */
export async function saveRankingWeights(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const keys = [
    "boost",
    "rating",
    "response",
    "cancellation",
    "distance",
  ] as const;
  const values = Object.fromEntries(keys.map((k) => [k, weight(formData, k)]));
  const errors = Object.fromEntries(
    keys.filter((k) => values[k] === null).map((k) => [k, "range"]),
  );
  if (Object.keys(errors).length > 0) return invalid(errors);
  if (keys.every((k) => values[k] === 0)) return invalid({ boost: "range" });
  const { error } = await createAdminClient()
    .from("ranking_settings")
    .update({
      ...(values as Record<(typeof keys)[number], number>),
      updated_at: now().toISOString(),
    })
    .eq("id", true);
  if (error) return failed;
  refresh();
  return savedState;
}

const STATION_LINES = [
  "BTS_SUKHUMVIT",
  "BTS_SILOM",
  "BTS_GOLD",
  "MRT_BLUE",
  "MRT_PURPLE",
  "MRT_YELLOW",
  "MRT_PINK",
  "ARL",
  "SRT_DARK_RED",
  "SRT_LIGHT_RED",
];

/** Adds (stationId null) or edits a BTS/MRT station. */
export async function saveStation(
  stationId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const nameEn = String(formData.get("name_en") ?? "").trim();
  const nameTh = String(formData.get("name_th") ?? "").trim();
  const lines = formData
    .getAll("lines")
    .map(String)
    .filter((l) => STATION_LINES.includes(l));
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const errors: Record<string, string> = {};
  if (nameEn.length < 1 || nameEn.length > 80) errors.name_en = "required";
  if (nameTh.length > 80) errors.name_th = "tooLong";
  if (lines.length === 0) errors.lines = "required";
  // Roughly Thailand, to catch swapped or mistyped coordinates.
  if (!(lat > 5 && lat < 21)) errors.lat = "range";
  if (!(lng > 97 && lng < 106)) errors.lng = "range";
  if (Object.keys(errors).length > 0) return invalid(errors);
  const row = {
    name_en: nameEn,
    name_th: nameTh || null,
    lines,
    location: `SRID=4326;POINT(${lng} ${lat})`,
  };
  const db = createAdminClient();
  const { error } = stationId
    ? await db.from("stations").update(row).eq("id", stationId)
    : await db.from("stations").insert(row);
  if (error) return failed;
  refresh();
  return savedState;
}

export async function setStationActive(formData: FormData) {
  await requireAdmin();
  await createAdminClient()
    .from("stations")
    .update({ active: formData.get("active") === "true" })
    .eq("id", id(formData));
  refresh();
}
