import "server-only";
import {
  createPlaces,
  createRateLimit,
  PLACES_ERROR_STATUS,
  PlacesError,
} from "./places";

/** One Places client and cache per server instance. */
export const places = createPlaces({
  apiKey: process.env.GOOGLE_PLACES_SERVER_KEY,
});

/** Place search shows only when the server key is set. */
export const placeSearchEnabled = () => !!process.env.GOOGLE_PLACES_SERVER_KEY;

const limited = createRateLimit(60);

/** The caller's address as Netlify (or the local server) reports it. */
export function callerKey(request: Request) {
  return (
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

export function overLimit(request: Request) {
  return !limited(callerKey(request));
}

/** JSON error the search form reads: `{ error: "limit" | … }`. */
export function placesErrorResponse(e: unknown) {
  const kind = e instanceof PlacesError ? e.kind : "unavailable";
  return Response.json(
    { error: kind },
    {
      status: PLACES_ERROR_STATUS[kind],
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/** Too many requests from one caller: the form falls back as for a quota. */
export const rateLimited = () => placesErrorResponse(new PlacesError("limit"));
