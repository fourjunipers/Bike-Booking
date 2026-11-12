import {
  overLimit,
  places,
  placesErrorResponse,
  rateLimited,
} from "@/lib/places-server";

/**
 * Where a chosen place is: GET /api/places/<placeId>?session=<uuid>.
 * Ends the customer's Autocomplete session (see lib/places.ts); cached on
 * the server for a few hours.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/places/[placeId]">,
) {
  if (overLimit(request)) return rateLimited();
  const { placeId } = await params;
  const session = new URL(request.url).searchParams.get("session");
  try {
    const point = await places.location(placeId, session);
    return Response.json(point, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return placesErrorResponse(e);
  }
}
