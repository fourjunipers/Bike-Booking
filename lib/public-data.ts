import "server-only";
import { cacheLife } from "next/cache";
import {
  effectiveDeposit,
  effectiveInclusions,
  INCLUSION_FIELDS,
  type EffectiveInclusions,
  type InclusionOverrides,
  type Inclusions,
} from "./inclusions";
import { localToInstant, NEAR_KM, type SearchParams } from "./search-params";
import type { OfferRow } from "./search";
import { createPublicClient } from "./supabase/public";

/**
 * Public data for the customer site. Things that don't depend on the
 * visitor (catalog entries, shop details, stations) are cached for a few
 * minutes, so vendor edits show up shortly after saving. Search depends on
 * dates and "now", so it runs on every request.
 */

export type Station = {
  id: string;
  name_en: string;
  name_th: string | null;
  lines: string[];
  lat: number;
  lng: number;
};

export async function getStations(): Promise<Station[]> {
  "use cache";
  cacheLife("hours");
  const { data } = await createPublicClient().rpc("station_list", {});
  return (data ?? []).map((s) => ({
    id: s.id,
    name_en: s.name_en,
    name_th: s.name_th,
    lines: s.lines,
    lat: s.lat,
    lng: s.lng,
  }));
}

export async function getCatalogEntry(slug: string) {
  "use cache";
  cacheLife("minutes");
  const { data } = await createPublicClient()
    .from("bike_catalog")
    .select(
      "id, slug, make, model, year_from, year_to, cc, type, transmission, abs, underseat_storage, usb_charger, key_type, description, stock_photo",
    )
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export type PublicShop = NonNullable<Awaited<ReturnType<typeof getShop>>>;

export async function getShop(slug: string) {
  "use cache";
  cacheLife("minutes");
  const db = createPublicClient();
  const { data: shop } = await db
    .from("shops")
    .select(
      "id, slug, name, about, photos, maps_url, nearest_station, google_place_id, boost_level, cutoff_minutes",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!shop) return null;
  const [{ data: coords }, { data: hours }, { data: closures }] =
    await Promise.all([
      db.rpc("shop_coordinates", { p_shop_id: shop.id }),
      db
        .from("shop_hours")
        .select("weekday, open, close")
        .eq("shop_id", shop.id)
        .order("weekday"),
      db
        .from("shop_closures")
        .select("start_date, end_date, note, repeats_yearly")
        .eq("shop_id", shop.id)
        .order("start_date"),
    ]);
  return {
    ...shop,
    lat: coords?.[0]?.lat ?? null,
    lng: coords?.[0]?.lng ?? null,
    hours: (hours ?? []).map((h) => ({
      weekday: h.weekday,
      open: h.open.slice(0, 5),
      close: h.close.slice(0, 5),
    })),
    closures: closures ?? [],
  };
}

export async function getFeaturedShops() {
  "use cache";
  cacheLife("minutes");
  const { data } = await createPublicClient()
    .from("shops")
    .select("slug, name, photos, nearest_station")
    .eq("boost_level", "featured")
    .order("name")
    .limit(6);
  return data ?? [];
}

export async function getShopReviews(shopId: string) {
  "use cache";
  cacheLife("minutes");
  const { data } = await createPublicClient()
    .from("reviews")
    .select("rating, text, created_at")
    .eq("shop_id", shopId)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export type Listing = NonNullable<Awaited<ReturnType<typeof getListing>>>;

/** One shop's offer of one catalog model: photos, prices, inclusions, extras. */
export async function getListing(shopId: string, catalogId: string) {
  "use cache";
  cacheLife("minutes");
  const db = createPublicClient();
  const { data: model } = await db
    .from("bike_models")
    .select("id, qty, photos, deposit_amount, price_after_30")
    .eq("shop_id", shopId)
    .eq("catalog_id", catalogId)
    .maybeSingle();
  if (!model) return null;
  const [{ data: prices }, { data: overrides }, { data: shopPolicy }, extras] =
    await Promise.all([
      db
        .from("price_days")
        .select("day, total")
        .eq("bike_model_id", model.id)
        .order("day"),
      db
        .from("bike_model_policies")
        .select(INCLUSION_FIELDS.join(", "))
        .eq("bike_model_id", model.id)
        .maybeSingle<InclusionOverrides>(),
      db
        .from("shop_policies")
        .select(`deposit_amount, ${INCLUSION_FIELDS.join(", ")}`)
        .eq("shop_id", shopId)
        .maybeSingle<Inclusions & { deposit_amount: number | null }>(),
      getExtras(shopId, model.id),
    ]);
  const inclusions: EffectiveInclusions | null = shopPolicy
    ? effectiveInclusions(shopPolicy, overrides)
    : null;
  return {
    modelId: model.id,
    photos: model.photos,
    deposit: effectiveDeposit(
      shopPolicy?.deposit_amount ?? null,
      model.deposit_amount,
    ),
    priceAfter30: model.price_after_30,
    prices: (prices ?? []).map((p) => p.total),
    inclusions,
    extras,
  };
}

async function getExtras(shopId: string, modelId: string) {
  const { data } = await createPublicClient()
    .from("shop_extras")
    .select(
      "id, name, description, terms, price_kind, price_rental, price_1d, price_7d, price_30d, all_models, shop_extra_models (bike_model_id)",
    )
    .eq("shop_id", shopId)
    .order("sort");
  return (data ?? []).filter(
    (e) =>
      e.all_models ||
      e.shop_extra_models.some((m) => m.bike_model_id === modelId),
  );
}

/** search_offers() for a customer search, optionally for one model or shop. */
export async function searchOffers(
  p: SearchParams,
  only: { catalogId?: string; shopId?: string } = {},
): Promise<OfferRow[]> {
  const start = localToInstant(p.from);
  const end = localToInstant(p.to);
  const { data, error } = await createPublicClient().rpc("search_offers", {
    p_start: !p.now && start ? start.toISOString() : undefined,
    p_end: end ? end.toISOString() : undefined,
    p_now: p.now,
    p_lat: p.lat,
    p_lng: p.lng,
    p_radius_km:
      p.anyDistance || only.catalogId || only.shopId ? undefined : NEAR_KM,
    p_type: p.type,
    p_transmission: p.transmission,
    p_cc_min: p.ccMin,
    p_cc_max: p.ccMax,
    p_price_max_day: p.priceMax,
    p_passport_not_held: p.passportNotHeld,
    p_min_rating: p.minRating,
    p_catalog_id: only.catalogId,
    p_shop_id: only.shopId,
  });
  if (error) throw new Error(`Search failed: ${error.message}`);
  return (data ?? []) as OfferRow[];
}
