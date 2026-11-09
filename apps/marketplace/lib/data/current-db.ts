import "server-only";
import { cacheLife } from "next/cache";
import {
  effectiveDeposit,
  effectiveInclusions,
  INCLUSION_FIELDS,
  type InclusionOverrides,
  type Inclusions,
} from "@/lib/inclusions";
import {
  BIKE_PLACEHOLDER,
  PHOTO_BUCKETS,
  photoUrl,
  SHOP_PLACEHOLDER,
  type PhotoBucket,
} from "@/lib/photos";
import { supabaseUrl } from "@mango/db/env";
import { createPublicClient } from "@mango/db/public";
import type {
  Availability,
  Booking,
  BoostLevel,
  CatalogModel,
  Extra,
  Listing,
  NewBooking,
  Offer,
  Quote,
  RankingWeights,
  Review,
  SearchQuery,
  Shop,
  ShopSignals,
  ShopSummary,
  Station,
} from "./types";

/**
 * TEMPORARY implementation of the data adapter: reads this project's own
 * Supabase database (the Phase 2 vendor tables and the Phase 3 SQL
 * functions). Mango Works will replace everything marked "platform" with its
 * API; the rules these functions follow are written up in
 * docs/INTEGRATION.md as what the API must match. Only lib/data/index.ts may
 * import this file.
 *
 * Public data that doesn't depend on the visitor is cached for a few minutes;
 * anything with dates or "now" runs per request.
 */

const url = (bucket: PhotoBucket, path: string | null, fallback: string) =>
  photoUrl(supabaseUrl(), bucket, path, fallback);

// Marketplace-owned data -------------------------------------------------------
// These stay in the marketplace's own database after the platform switch.

export async function listStations(): Promise<Station[]> {
  "use cache";
  cacheLife("hours");
  const { data } = await createPublicClient().rpc("station_list", {});
  return (data ?? []).map((s) => ({
    id: s.id,
    nameEn: s.name_en,
    nameTh: s.name_th,
    lines: s.lines,
    lat: s.lat,
    lng: s.lng,
  }));
}

export async function getRankingWeights(): Promise<RankingWeights> {
  "use cache";
  cacheLife("minutes");
  const { data } = await createPublicClient()
    .from("ranking_settings")
    .select("boost, rating, response, cancellation, distance")
    .single();
  return {
    boost: Number(data?.boost ?? 0.3),
    rating: Number(data?.rating ?? 0.2),
    response: Number(data?.response ?? 0.15),
    cancellation: Number(data?.cancellation ?? 0.15),
    distance: Number(data?.distance ?? 0.2),
  };
}

// Platform data: shops and catalog ----------------------------------------------

export async function listFeaturedShops(): Promise<ShopSummary[]> {
  "use cache";
  cacheLife("minutes");
  const { data } = await createPublicClient()
    .from("shops")
    .select("id, slug, name, photos, nearest_station")
    .eq("boost_level", "featured")
    .order("name")
    .limit(6);
  return (data ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    nearestStation: s.nearest_station,
    thumbUrl: url(PHOTO_BUCKETS.shop, s.photos[0] ?? null, SHOP_PLACEHOLDER),
  }));
}

async function loadShop(
  column: "slug" | "id",
  value: string,
): Promise<Shop | null> {
  const db = createPublicClient();
  const { data: s } = await db
    .from("shops")
    .select(
      "id, slug, name, about, photos, maps_url, nearest_station, google_place_id",
    )
    .eq(column, value)
    .maybeSingle();
  if (!s) return null;
  const [{ data: coords }, { data: hours }, { data: closures }] =
    await Promise.all([
      db.rpc("shop_coordinates", { p_shop_id: s.id }),
      db
        .from("shop_hours")
        .select("weekday, open, close")
        .eq("shop_id", s.id)
        .order("weekday"),
      db
        .from("shop_closures")
        .select("start_date, end_date, note, repeats_yearly")
        .eq("shop_id", s.id)
        .order("start_date"),
    ]);
  const photoUrls = s.photos.map((p) =>
    url(PHOTO_BUCKETS.shop, p, SHOP_PLACEHOLDER),
  );
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    about: s.about,
    nearestStation: s.nearest_station,
    thumbUrl: photoUrls[0] ?? SHOP_PLACEHOLDER,
    photoUrls,
    location: coords?.[0] ? { lat: coords[0].lat, lng: coords[0].lng } : null,
    mapsUrl: s.maps_url,
    googlePlaceId: s.google_place_id,
    hours: (hours ?? []).map((h) => ({
      weekday: h.weekday,
      open: h.open.slice(0, 5),
      close: h.close.slice(0, 5),
    })),
    closures: (closures ?? []).map((c) => ({
      startDate: c.start_date,
      endDate: c.end_date,
      note: c.note,
      repeatsYearly: c.repeats_yearly,
    })),
  };
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  "use cache";
  cacheLife("minutes");
  return loadShop("slug", slug);
}

export async function getShopById(id: string): Promise<Shop | null> {
  "use cache";
  cacheLife("minutes");
  return loadShop("id", id);
}

export async function getCatalogModel(
  slug: string,
): Promise<CatalogModel | null> {
  "use cache";
  cacheLife("minutes");
  const { data: c } = await createPublicClient()
    .from("bike_catalog")
    .select(
      "id, slug, make, model, year_from, year_to, cc, type, transmission, abs, underseat_storage, usb_charger, key_type, description, stock_photo",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!c) return null;
  const photo = url(PHOTO_BUCKETS.catalog, c.stock_photo, BIKE_PLACEHOLDER);
  return {
    id: c.id,
    slug: c.slug,
    make: c.make,
    model: c.model,
    yearFrom: c.year_from,
    yearTo: c.year_to,
    cc: c.cc,
    type: c.type,
    transmission: c.transmission,
    abs: c.abs,
    underseatStorage: c.underseat_storage,
    usbCharger: c.usb_charger,
    keyType: c.key_type,
    description: c.description,
    photoUrl: photo,
    thumbUrl: photo,
  };
}

// Platform data: search, availability, prices ---------------------------------------

type SearchRow = {
  bike_model_id: string;
  shop_id: string;
  shop_slug: string;
  shop_name: string;
  shop_lat: number | null;
  shop_lng: number | null;
  catalog_id: string;
  catalog_slug: string;
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
  cc: number;
  type: CatalogModel["type"];
  transmission: CatalogModel["transmission"];
  stock_photo: string | null;
  photo: string | null;
  boost: BoostLevel;
  distance_km: number | null;
  days: number;
  total: number;
  per_day: number;
  deposit: number | null;
  mode: Offer["mode"];
  free_units: number | null;
  ready_today: boolean;
  ready_updated_at: string | null;
  walkin_max_days: number | null;
};

/** Shop offers matching a search, with availability and price for the dates. */
export async function searchOffers(q: SearchQuery): Promise<Offer[]> {
  const { data, error } = await createPublicClient().rpc("search_offers", {
    p_start: !q.now && q.start ? q.start.toISOString() : undefined,
    p_end: q.end ? q.end.toISOString() : undefined,
    p_now: q.now,
    p_lat: q.near?.lat,
    p_lng: q.near?.lng,
    p_radius_km: q.radiusKm,
    p_type: q.type,
    p_transmission: q.transmission,
    p_cc_min: q.ccMin,
    p_cc_max: q.ccMax,
    p_price_max_day: q.maxPricePerDay,
    p_passport_not_held: q.passportNotHeld,
    p_catalog_id: q.catalogId,
    p_shop_id: q.shopId,
  });
  if (error) throw new Error(`Search failed: ${error.message}`);
  return ((data ?? []) as unknown as SearchRow[]).map((r) => {
    const stock = url(PHOTO_BUCKETS.catalog, r.stock_photo, BIKE_PLACEHOLDER);
    return {
      listingId: r.bike_model_id,
      shop: {
        id: r.shop_id,
        slug: r.shop_slug,
        name: r.shop_name,
        location:
          r.shop_lat !== null && r.shop_lng !== null
            ? { lat: r.shop_lat, lng: r.shop_lng }
            : null,
      },
      model: {
        id: r.catalog_id,
        slug: r.catalog_slug,
        make: r.make,
        model: r.model,
        yearFrom: r.year_from,
        yearTo: r.year_to,
        cc: r.cc,
        type: r.type,
        transmission: r.transmission,
        thumbUrl: stock,
      },
      thumbUrl: url(PHOTO_BUCKETS.model, r.photo, BIKE_PLACEHOLDER),
      distanceKm: r.distance_km,
      days: r.days,
      total: r.total,
      perDay: r.per_day,
      deposit: r.deposit,
      mode: r.mode,
      freeUnits: r.free_units,
      readyNow: r.ready_today,
      readyUpdatedAt: r.ready_updated_at,
      walkinMaxDays: r.walkin_max_days,
      boost: r.boost,
    };
  });
}

export async function getListing(
  shopId: string,
  catalogId: string,
): Promise<Listing | null> {
  "use cache";
  cacheLife("minutes");
  const db = createPublicClient();
  const { data: model } = await db
    .from("bike_models")
    .select("id, photos, deposit_amount")
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
      listExtras(shopId, model.id),
    ]);
  return {
    listingId: model.id,
    photoUrls: model.photos.map((p) =>
      url(PHOTO_BUCKETS.model, p, BIKE_PLACEHOLDER),
    ),
    deposit: effectiveDeposit(
      shopPolicy?.deposit_amount ?? null,
      model.deposit_amount,
    ),
    dayPrices: (prices ?? []).map((p) => p.total),
    inclusions: shopPolicy ? effectiveInclusions(shopPolicy, overrides) : null,
    extras,
  };
}

async function listExtras(shopId: string, modelId: string): Promise<Extra[]> {
  const { data } = await createPublicClient()
    .from("shop_extras")
    .select(
      "id, name, description, terms, price_kind, price_rental, price_1d, price_7d, price_30d, all_models, shop_extra_models (bike_model_id)",
    )
    .eq("shop_id", shopId)
    .order("sort");
  return (data ?? [])
    .filter(
      (e) =>
        e.all_models ||
        e.shop_extra_models.some((m) => m.bike_model_id === modelId),
    )
    .map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      terms: e.terms,
      price:
        e.price_kind === "rental"
          ? { kind: "rental" as const, amount: e.price_rental! }
          : {
              kind: "time" as const,
              perDay: e.price_1d!,
              per7Days: e.price_7d,
              per30Days: e.price_30d,
            },
    }));
}

export async function getAvailability(
  listingId: string,
  start: Date,
  end: Date,
): Promise<Availability> {
  const db = createPublicClient();
  const [{ data: offer }, { data: walkin }] = await Promise.all([
    db.rpc("model_offer", {
      p_bike_model_id: listingId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    }),
    db.rpc("longest_walkin", {
      p_bike_model_id: listingId,
      p_start: start.toISOString(),
    }),
  ]);
  const o = offer?.[0];
  return {
    freeUnits: o?.free ?? 0,
    mode: (o?.mode as Availability["mode"]) ?? null,
    walkinMaxDays: walkin ?? null,
  };
}

export async function getQuote(
  listingId: string,
  start: Date,
  end: Date,
): Promise<Quote | null> {
  const db = createPublicClient();
  const { data: days } = await db.rpc("rental_days", {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });
  if (!days) return null;
  const { data: total } = await db.rpc("rental_price", {
    p_bike_model_id: listingId,
    p_days: days,
  });
  if (total === null || total === undefined) return null;
  // TODO(phase-7): promotions (Mango Works returns the discount).
  return {
    days,
    total,
    discount: 0,
    rentalAfterPromotion: total,
    perDay: Math.ceil(total / days),
  };
}

// Platform data: ranking signals and reviews ------------------------------------------

export async function getShopSignals(
  shopIds: string[],
): Promise<ShopSignals[]> {
  const db = createPublicClient();
  return Promise.all(
    [...new Set(shopIds)].map(async (shopId) => {
      const { data } = await db.rpc("shop_stats", { p_shop_id: shopId });
      const s = data?.[0];
      return {
        shopId,
        rating:
          s?.rating === null || s?.rating === undefined
            ? null
            : Number(s.rating),
        reviewCount: s?.review_count ?? 0,
        responseRate:
          s?.response_rate === null || s?.response_rate === undefined
            ? null
            : Number(s.response_rate),
        cancellationRate:
          s?.cancellation_rate === null || s?.cancellation_rate === undefined
            ? null
            : Number(s.cancellation_rate),
      };
    }),
  );
}

export async function listShopReviews(shopId: string): Promise<Review[]> {
  "use cache";
  cacheLife("minutes");
  const { data } = await createPublicClient()
    .from("reviews")
    .select("rating, text, created_at")
    .eq("shop_id", shopId)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => ({
    rating: r.rating,
    text: r.text,
    createdAt: r.created_at,
  }));
}

// Platform data: bookings (booking-flow phases) ---------------------------------------

export async function createBooking(input: NewBooking): Promise<Booking> {
  void input;
  // TODO(phase-4): create the order on the platform (channel "marketplace").
  throw new Error("Bookings aren't available yet");
}

export async function getBooking(id: string): Promise<Booking | null> {
  void id;
  // TODO(phase-4): read the order from the platform.
  return null;
}
