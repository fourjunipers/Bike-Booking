/**
 * Place search through Google Places API (New), called only from our own
 * server routes so the key never reaches the browser.
 *
 * Billing (checked against Google's price list, 12 Nov 2026):
 * - Each Autocomplete request carries the customer's session token. A session
 *   ends with one Place Details call on the same token; Google then bills the
 *   first 12 Autocomplete requests (Autocomplete Requests SKU) and the Place
 *   Details call, and nothing for requests 13 and up.
 * - Place Details asks for `location` only: Place Details Essentials. Adding
 *   `displayName` would bill Place Details Pro, so the label shown to the
 *   customer comes from the suggestion text instead.
 * - Google allows caching latitude/longitude for up to 30 days; we keep a
 *   chosen place for PLACE_CACHE_MS so a popular place (an airport) is looked
 *   up once, not once per customer.
 */

export const MIN_QUERY_LENGTH = 3;
export const MAX_QUERY_LENGTH = 100;
export const PLACE_CACHE_MS = 6 * 60 * 60 * 1000;
const PLACE_CACHE_MAX = 1000;

const BASE = "https://places.googleapis.com/v1";

export type Suggestion = { placeId: string; main: string; secondary: string };
export type PlacePoint = { lat: number; lng: number };

/** Why a lookup failed; routes turn it into a status the form understands. */
export class PlacesError extends Error {
  constructor(readonly kind: "disabled" | "limit" | "unavailable" | "invalid") {
    super(`Places: ${kind}`);
  }
}

/** HTTP status for each failure; the form falls back on 429 and 503. */
export const PLACES_ERROR_STATUS: Record<PlacesError["kind"], number> = {
  disabled: 503,
  limit: 429,
  unavailable: 503,
  invalid: 400,
};

// A UUID from crypto.randomUUID(); Google's limit is 36 URL-safe characters.
const SESSION = /^[0-9a-f-]{36}$/i;
// Place IDs are URL-safe base64-like strings.
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;

type Fetch = typeof fetch;

export function createPlaces({
  apiKey,
  fetchImpl = fetch,
  now = Date.now,
}: {
  apiKey: string | undefined;
  fetchImpl?: Fetch;
  now?: () => number;
}) {
  const cache = new Map<string, { point: PlacePoint; until: number }>();

  async function call(url: string, init: RequestInit) {
    if (!apiKey) throw new PlacesError("disabled");
    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, cache: "no-store" });
    } catch {
      throw new PlacesError("unavailable");
    }
    // 429 RESOURCE_EXHAUSTED: our daily quota (or Google's rate limit).
    if (res.status === 429) throw new PlacesError("limit");
    if (!res.ok) throw new PlacesError("unavailable");
    return res.json();
  }

  return {
    async autocomplete(
      input: string,
      sessionToken: string,
      languageCode: string,
    ): Promise<Suggestion[]> {
      const text = input.trim();
      if (
        text.length < MIN_QUERY_LENGTH ||
        text.length > MAX_QUERY_LENGTH ||
        !SESSION.test(sessionToken)
      )
        throw new PlacesError("invalid");
      // Any country: no includedRegionCodes. Google biases by the caller's
      // IP, which is our server, so the results don't lean to one country.
      const body = await call(`${BASE}/places:autocomplete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey!,
          "X-Goog-FieldMask":
            "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat",
        },
        body: JSON.stringify({ input: text, sessionToken, languageCode }),
      });
      type Raw = {
        suggestions?: {
          placePrediction?: {
            placeId?: string;
            structuredFormat?: {
              mainText?: { text?: string };
              secondaryText?: { text?: string };
            };
          };
        }[];
      };
      return ((body as Raw).suggestions ?? []).flatMap(({ placePrediction }) =>
        placePrediction?.placeId && placePrediction.structuredFormat?.mainText
          ? [
              {
                placeId: placePrediction.placeId,
                main: placePrediction.structuredFormat.mainText.text ?? "",
                secondary:
                  placePrediction.structuredFormat.secondaryText?.text ?? "",
              },
            ]
          : [],
      );
    },

    /** Where a chosen suggestion is. Ends the customer's billing session. */
    async location(
      placeId: string,
      sessionToken: string | null,
    ): Promise<PlacePoint> {
      if (!PLACE_ID.test(placeId)) throw new PlacesError("invalid");
      if (sessionToken !== null && !SESSION.test(sessionToken))
        throw new PlacesError("invalid");
      const hit = cache.get(placeId);
      if (hit && hit.until > now()) return hit.point;

      const q = sessionToken
        ? `?sessionToken=${encodeURIComponent(sessionToken)}`
        : "";
      const body = (await call(
        `${BASE}/places/${encodeURIComponent(placeId)}${q}`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey!,
            "X-Goog-FieldMask": "location",
          },
        },
      )) as { location?: { latitude?: number; longitude?: number } };
      const lat = body.location?.latitude;
      const lng = body.location?.longitude;
      if (typeof lat !== "number" || typeof lng !== "number")
        throw new PlacesError("unavailable");

      const point = { lat, lng };
      if (cache.size >= PLACE_CACHE_MAX)
        cache.delete(cache.keys().next().value!);
      cache.set(placeId, { point, until: now() + PLACE_CACHE_MS });
      return point;
    },
  };
}

/**
 * Requests per caller per minute through our routes. Per server instance, so
 * only a brake on one noisy visitor: the hard cap is the daily quota set in
 * Google Cloud.
 */
export function createRateLimit(limit: number, windowMs = 60_000) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (key: string, at = Date.now()) => {
    const h = hits.get(key);
    if (!h || h.reset <= at) {
      if (hits.size > 5000) hits.clear();
      hits.set(key, { count: 1, reset: at + windowMs });
      return true;
    }
    h.count += 1;
    return h.count <= limit;
  };
}
