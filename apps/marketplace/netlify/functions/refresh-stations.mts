// Monthly train-station refresh from OpenStreetMap (marketplace UI batch,
// item 2). The real work runs in the protected API route, because scheduled
// functions time out after 30 s; this only calls it.
// Needs URL (set by Netlify) and CRON_SECRET in the site's environment.

export default async function refreshStations() {
  const site = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) throw new Error("URL or CRON_SECRET not set");

  // This function may run 30 s, the route 60 s, and OpenStreetMap often
  // needs 30-40 s. So wait up to 25 s: if the route is still working, it
  // carries on and logs its own result (Netlify → Logs → Functions).
  let response: Response;
  try {
    response = await fetch(`${site}/api/cron/stations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    if ((e as Error).name === "TimeoutError") {
      console.log("Station refresh still running; see the route's log");
      return;
    }
    throw e;
  }
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Station refresh failed: HTTP ${response.status} ${body}`);
  }
  console.log(`Station refresh ok: ${body}`);
}

// 03:00 UTC on the 1st of each month (10:00 Bangkok).
export const config = { schedule: "0 3 1 * *" };
