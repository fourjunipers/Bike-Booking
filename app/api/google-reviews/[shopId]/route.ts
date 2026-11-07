import { isCustomerLocale } from "@/i18n/config";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Google rating and reviews for a live shop that linked its Google Business
 * Profile (SPEC "Google rating and reviews"). Fetched live from Places API
 * (New) on every call: Google's terms allow storing only the place ID, so
 * nothing here is cached. Asking for `reviews` bills the Enterprise +
 * Atmosphere SKU, so the page calls this only when the block scrolls into
 * view. Needs GOOGLE_PLACES_SERVER_KEY (server-only, restricted to Places API).
 */

const FIELDS = "rating,userRatingCount,reviews,googleMapsUri";

type PlaceReview = {
  rating?: number;
  relativePublishTimeDescription?: string;
  text?: { text?: string; languageCode?: string };
  originalText?: { text?: string; languageCode?: string };
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  googleMapsUri?: string;
};

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/google-reviews/[shopId]">,
) {
  const key = process.env.GOOGLE_PLACES_SERVER_KEY;
  if (!key) return new Response(null, { status: 404 });
  const { shopId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(shopId))
    return new Response(null, { status: 404 });

  const { data: shop } = await createPublicClient()
    .from("shops")
    .select("google_place_id")
    .eq("id", shopId)
    .maybeSingle();
  if (!shop?.google_place_id) return new Response(null, { status: 404 });

  const lang = new URL(request.url).searchParams.get("lang");
  const languageCode = isCustomerLocale(lang) ? lang : "en";
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(shop.google_place_id)}?languageCode=${languageCode}`,
    {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
      cache: "no-store",
    },
  );
  if (!res.ok) return new Response(null, { status: 502 });
  const place = (await res.json()) as {
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    reviews?: PlaceReview[];
  };

  return Response.json(
    {
      rating: place.rating ?? null,
      count: place.userRatingCount ?? 0,
      mapsUri: place.googleMapsUri ?? null,
      reviews: (place.reviews ?? []).slice(0, 5).map((r) => ({
        rating: r.rating ?? null,
        when: r.relativePublishTimeDescription ?? "",
        text: r.text?.text ?? "",
        translated:
          !!r.originalText?.languageCode &&
          r.originalText.languageCode !== r.text?.languageCode,
        author: r.authorAttribution?.displayName ?? "",
        authorUri: r.authorAttribution?.uri ?? null,
        photo: r.authorAttribution?.photoUri ?? null,
        uri: r.googleMapsUri ?? null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
