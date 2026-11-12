import { isCustomerLocale } from "@/i18n/config";
import {
  overLimit,
  places,
  placesErrorResponse,
  rateLimited,
} from "@/lib/places-server";

/**
 * Place suggestions for the search form:
 * GET /api/places/autocomplete?q=chiang&session=<uuid>&lang=en
 * The form waits for 3 characters and a 300 ms pause before calling.
 */
export async function GET(request: Request) {
  if (overLimit(request)) return rateLimited();
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang");
  try {
    const suggestions = await places.autocomplete(
      url.searchParams.get("q") ?? "",
      url.searchParams.get("session") ?? "",
      isCustomerLocale(lang) ? lang : "en",
    );
    return Response.json(
      { suggestions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return placesErrorResponse(e);
  }
}
