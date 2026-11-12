/**
 * Train stations from OpenStreetMap (marketplace UI batch, item 2): the
 * Overpass query for each market's area, reading its answer, and planning
 * the merge into public.stations. Pure; lib/stations/refresh.ts runs it.
 *
 * Merge rules:
 * - A station with an osm_id is updated from OpenStreetMap (names, position)
 *   and its lines are kept. Seen again after going missing: switched back on.
 * - A station without one (the 182 seeded on 7 Nov 2026) is matched once by
 *   name within MATCH_METRES, nearest first, and gets the osm_id.
 * - Anything else from OpenStreetMap is added, except a same-name station
 *   within MATCH_METRES of one we have: that is the other line's platform at
 *   an interchange (Lat Phrao, Hua Mak), and one entry covers both.
 * - A station with an osm_id that OpenStreetMap no longer has is switched off
 *   (never deleted). Unlinked stations are left alone.
 * - If OpenStreetMap returns far fewer stations than we have linked (an
 *   Overpass hiccup), nothing is switched off.
 */

/** Areas to load stations for, one per market. [south, west, north, east]. */
export const STATION_AREAS = [
  { market: "bangkok", bbox: [13.45, 100.25, 14.2, 100.95] },
] as const satisfies readonly {
  market: string;
  bbox: readonly [number, number, number, number];
}[];

export const MATCH_METRES = 400;
/** Below this share of linked stations, the answer is treated as broken. */
export const MIN_SEEN_SHARE = 0.5;

export type OsmStation = {
  osmId: string;
  nameEn: string;
  nameTh: string | null;
  lines: string[];
  lat: number;
  lng: number;
};

export type ExistingStation = {
  id: string;
  nameEn: string;
  nameTh: string | null;
  lines: string[];
  lat: number;
  lng: number;
  active: boolean;
  osmId: string | null;
  osmMissingSince: string | null;
};

export type StationPlan = {
  insert: OsmStation[];
  update: {
    id: string;
    osm: OsmStation;
    /** Came back after being switched off by a refresh. */
    reactivate: boolean;
  }[];
  /** Linked stations OpenStreetMap no longer has. */
  deactivate: string[];
  /** Unlinked seeded stations with no OpenStreetMap match (for the log). */
  unmatched: string[];
  /** Too few stations came back: deactivate is left empty on purpose. */
  suspicious: boolean;
};

export function overpassQuery(bbox: readonly number[]): string {
  const b = bbox.join(",");
  return `[out:json][timeout:50];
(
  nwr["railway"="station"](${b});
  nwr["railway"="halt"](${b});
);
out center tags;`;
}

type Element = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const THAI = /[฀-๿]/;

/** Line codes for a new station, from its OpenStreetMap tags. */
export function linesFromTags(tags: Record<string, string>): string[] {
  const text = [tags.network, tags.operator, tags["network:en"], tags.name]
    .filter(Boolean)
    .join(" ");
  const lines = new Set<string>();
  if (/\bBTS\b/i.test(text)) lines.add("BTS");
  if (/\bMRT\b/i.test(text)) lines.add("MRT");
  if (/airport rail link|\bARL\b/i.test(text)) lines.add("ARL");
  if (/\bSRT\b|state railway/i.test(text)) lines.add("SRT");
  if (lines.size === 0) lines.add("RAIL");
  return [...lines];
}

/** Stations in an Overpass answer, one per name within 200 m. */
export function parseOverpass(json: unknown): OsmStation[] {
  const elements = ((json as { elements?: Element[] })?.elements ?? []).filter(
    (e) => e.tags && (e.lat !== undefined || e.center),
  );
  const out: OsmStation[] = [];
  for (const e of elements) {
    const t = e.tags!;
    const local = t.name?.trim();
    const en =
      t["name:en"]?.trim() || (local && !THAI.test(local) ? local : "");
    const th = t["name:th"]?.trim() || (local && THAI.test(local) ? local : "");
    const nameEn = (en || th).slice(0, 80);
    if (!nameEn) continue;
    const station: OsmStation = {
      osmId: `${e.type}/${e.id}`,
      nameEn,
      nameTh: th ? th.slice(0, 80) : null,
      lines: linesFromTags(t),
      lat: e.lat ?? e.center!.lat,
      lng: e.lon ?? e.center!.lon,
    };
    // A station often has a node and an area way: keep one.
    const twin = out.find(
      (s) => sameName(s.nameEn, station.nameEn) && metres(s, station) < 200,
    );
    if (twin) {
      twin.lines = [...new Set([...twin.lines, ...station.lines])];
      if (twin.lines.length > 1)
        twin.lines = twin.lines.filter((l) => l !== "RAIL");
      continue;
    }
    out.push(station);
  }
  return out;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(station|bts|mrt|arl|srt)\b/g, "")
    .replace(/[^a-z0-9฀-๿]/g, "");

export const sameName = (a: string, b: string) => norm(a) === norm(b);

/** Great-circle distance in metres. */
export function metres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function planStationMerge(
  existing: ExistingStation[],
  osm: OsmStation[],
): StationPlan {
  const byOsmId = new Map(
    existing.filter((s) => s.osmId).map((s) => [s.osmId!, s]),
  );
  const unlinked = existing.filter((s) => !s.osmId);
  const claimed = new Set<string>();
  const plan: StationPlan = {
    insert: [],
    update: [],
    deactivate: [],
    unmatched: [],
    suspicious: false,
  };

  const fresh: OsmStation[] = [];
  for (const o of osm) {
    const linked = byOsmId.get(o.osmId);
    if (linked) {
      claimed.add(linked.id);
      plan.update.push({
        id: linked.id,
        osm: o,
        reactivate: !linked.active && linked.osmMissingSince !== null,
      });
    } else fresh.push(o);
  }

  // Seeded stations: nearest same-name OpenStreetMap station within reach.
  const pairs = fresh
    .flatMap((o) =>
      unlinked
        .filter(
          (s) =>
            sameName(s.nameEn, o.nameEn) ||
            (s.nameTh !== null &&
              o.nameTh !== null &&
              sameName(s.nameTh, o.nameTh)),
        )
        .map((s) => ({ s, o, d: metres(s, o) })),
    )
    .filter((p) => p.d <= MATCH_METRES)
    .sort((a, b) => a.d - b.d);
  const used = new Set<string>();
  for (const { s, o } of pairs) {
    if (claimed.has(s.id) || used.has(o.osmId)) continue;
    claimed.add(s.id);
    used.add(o.osmId);
    // First link: keep the seeded names (already curated) and lines.
    plan.update.push({
      id: s.id,
      osm: { ...o, nameEn: s.nameEn, nameTh: s.nameTh ?? o.nameTh },
      reactivate: false,
    });
  }
  plan.insert = fresh.filter(
    (o) =>
      !used.has(o.osmId) &&
      !existing.some(
        (s) => sameName(s.nameEn, o.nameEn) && metres(s, o) <= MATCH_METRES,
      ),
  );
  plan.unmatched = unlinked
    .filter((s) => !claimed.has(s.id))
    .map((s) => s.nameEn);

  const linkedActive = existing.filter((s) => s.osmId && s.active);
  const missing = linkedActive.filter((s) => !claimed.has(s.id));
  const seenShare =
    linkedActive.length === 0
      ? 1
      : (linkedActive.length - missing.length) / linkedActive.length;
  plan.suspicious = linkedActive.length >= 10 && seenShare < MIN_SEEN_SHARE;
  plan.deactivate = plan.suspicious ? [] : missing.map((s) => s.id);
  return plan;
}
