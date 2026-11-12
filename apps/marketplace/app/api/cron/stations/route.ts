import { cronAuthorised } from "@/lib/cron-auth";
import { refreshStations } from "@/lib/stations/refresh";

/**
 * Monthly train-station refresh from OpenStreetMap, called by the Netlify
 * scheduled function netlify/functions/refresh-stations.mts with
 * "Authorization: Bearer $CRON_SECRET". Returns what changed.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  if (
    !cronAuthorised(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  )
    return new Response(null, { status: 401 });
  try {
    const result = await refreshStations();
    console.log("Station refresh", JSON.stringify(result));
    return Response.json(result);
  } catch (e) {
    console.error("Station refresh failed", e);
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
