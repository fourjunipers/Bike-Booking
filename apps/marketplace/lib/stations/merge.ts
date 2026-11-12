import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mango/db/database.types";
import { planStationMerge, type ExistingStation, type OsmStation } from "./osm";

export type RefreshResult = {
  fetched: number;
  inserted: number;
  updated: number;
  reactivated: number;
  deactivated: number;
  unmatched: string[];
  suspicious: boolean;
};

const point = (s: { lat: number; lng: number }) =>
  `SRID=4326;POINT(${s.lng} ${s.lat})`;

/**
 * Merge stations from OpenStreetMap into public.stations with a service-role
 * client (rules in lib/stations/osm.ts). Separate from the fetching so
 * tests/db/stations-refresh.test.ts can run it against the local database.
 */
export async function mergeStations(
  db: SupabaseClient<Database>,
  osm: OsmStation[],
  now: Date,
): Promise<RefreshResult> {
  if (osm.length === 0) throw new Error("Overpass returned no stations");
  const [{ data: list, error: e1 }, { data: meta, error: e2 }] =
    await Promise.all([
      db.rpc("station_list", { p_include_inactive: true }),
      db.from("stations").select("id, osm_id, osm_missing_since"),
    ]);
  if (e1 || e2) throw new Error(`Reading stations: ${(e1 ?? e2)!.message}`);
  const byId = new Map((meta ?? []).map((m) => [m.id, m]));
  const existing: ExistingStation[] = (list ?? []).map((s) => ({
    id: s.id,
    nameEn: s.name_en,
    nameTh: s.name_th,
    lines: s.lines,
    lat: s.lat,
    lng: s.lng,
    active: s.active,
    osmId: byId.get(s.id)?.osm_id ?? null,
    osmMissingSince: byId.get(s.id)?.osm_missing_since ?? null,
  }));
  const current = new Map(existing.map((s) => [s.id, s]));

  const plan = planStationMerge(existing, osm);
  const seen = now.toISOString();

  if (plan.update.length > 0) {
    const { error } = await db.from("stations").upsert(
      plan.update.map(({ id, osm: o, reactivate }) => ({
        id,
        name_en: o.nameEn,
        name_th: o.nameTh,
        lines: current.get(id)!.lines,
        location: point(o),
        osm_id: o.osmId,
        osm_last_seen_at: seen,
        osm_missing_since: null,
        // Every row carries every column: a bulk upsert fills gaps with null.
        active: reactivate || current.get(id)!.active,
      })),
    );
    if (error) throw new Error(`Updating stations: ${error.message}`);
  }
  if (plan.insert.length > 0) {
    const { error } = await db.from("stations").insert(
      plan.insert.map((o) => ({
        name_en: o.nameEn,
        name_th: o.nameTh,
        lines: o.lines,
        location: point(o),
        osm_id: o.osmId,
        osm_last_seen_at: seen,
      })),
    );
    if (error) throw new Error(`Adding stations: ${error.message}`);
  }
  if (plan.deactivate.length > 0) {
    const { error } = await db
      .from("stations")
      .update({ active: false, osm_missing_since: seen })
      .in("id", plan.deactivate)
      .is("osm_missing_since", null);
    if (error) throw new Error(`Switching stations off: ${error.message}`);
  }

  return {
    fetched: osm.length,
    inserted: plan.insert.length,
    updated: plan.update.length,
    reactivated: plan.update.filter((u) => u.reactivate).length,
    deactivated: plan.deactivate.length,
    unmatched: plan.unmatched,
    suspicious: plan.suspicious,
  };
}
