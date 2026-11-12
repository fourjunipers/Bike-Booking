import "server-only";
import { createAdminClient } from "@mango/db/admin";
import { mergeStations, type RefreshResult } from "./merge";
import {
  overpassQuery,
  parseOverpass,
  STATION_AREAS,
  type OsmStation,
} from "./osm";

/**
 * Public Overpass servers, tried in order. The main one took 30-42 s for our
 * query on 12 Nov 2026, so each gets most of the route's 60 s limit and the
 * next is tried only if the first fails fast.
 */
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
/** Stop starting Overpass requests after this long (route limit: 60 s). */
const BUDGET_MS = 52_000;

async function fetchArea(
  bbox: readonly number[],
  deadline: number,
): Promise<OsmStation[]> {
  const errors: string[] = [];
  for (const url of OVERPASS) {
    const left = deadline - Date.now();
    if (left < 10_000) break;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Overpass asks automated clients to name themselves.
          "User-Agent": "MotoMangos-station-refresh/1.0",
        },
        body: new URLSearchParams({ data: overpassQuery(bbox) }),
        cache: "no-store",
        signal: AbortSignal.timeout(left),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseOverpass(await res.json());
    } catch (e) {
      errors.push(`${new URL(url).host}: ${(e as Error).message}`);
    }
  }
  throw new Error(`Overpass failed (${errors.join("; ") || "no time left"})`);
}

/** Load stations from OpenStreetMap and merge them (see lib/stations/osm.ts). */
export async function refreshStations(
  now = new Date(),
): Promise<RefreshResult> {
  const deadline = Date.now() + BUDGET_MS;
  const osm = (
    await Promise.all(STATION_AREAS.map((a) => fetchArea(a.bbox, deadline)))
  ).flat();
  return mergeStations(createAdminClient(), osm, now);
}
