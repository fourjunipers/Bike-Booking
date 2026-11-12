import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mergeStations } from "@/lib/stations/merge";
import type { OsmStation } from "@/lib/stations/osm";
import { serviceClient, type Db } from "./helpers";

// The monthly OpenStreetMap refresh writes stations correctly (UI batch,
// item 2): links a seeded station, adds a new one, switches a vanished one
// off without deleting it, and back on when it returns.

let service: Db;
let asok: { id: string; lat: number; lng: number };

const NEW_HALT: OsmStation = {
  osmId: "node/990000002",
  nameEn: "Zz Test Halt",
  nameTh: null,
  lines: ["RAIL"],
  lat: 13.9,
  lng: 100.6,
};

const row = async (filter: { id?: string; osm_id?: string }) => {
  let q = service
    .from("stations")
    .select(
      "id, name_en, lines, active, osm_id, osm_last_seen_at, osm_missing_since",
    );
  if (filter.id) q = q.eq("id", filter.id);
  if (filter.osm_id) q = q.eq("osm_id", filter.osm_id);
  return (await q.single()).data!;
};

beforeAll(async () => {
  service = serviceClient();
  const { data } = await service.rpc("station_list", {
    p_include_inactive: true,
  });
  const s = data!.find((x) => x.name_en === "Asok")!;
  asok = { id: s.id, lat: s.lat, lng: s.lng };
});

afterAll(async () => {
  await service.from("stations").delete().eq("osm_id", NEW_HALT.osmId);
  await service
    .from("stations")
    .update({ osm_id: null, osm_last_seen_at: null, osm_missing_since: null })
    .eq("id", asok.id);
});

describe("mergeStations", () => {
  const asokOsm = (): OsmStation => ({
    osmId: "node/990000001",
    nameEn: "Asok",
    nameTh: "อโศก",
    lines: ["BTS"],
    lat: asok.lat + 0.0001,
    lng: asok.lng,
  });

  it("links a seeded station and adds a new one", async () => {
    const result = await mergeStations(
      service,
      [asokOsm(), NEW_HALT],
      new Date("2026-12-01T03:00:00Z"),
    );
    expect(result).toMatchObject({ inserted: 1, deactivated: 0 });

    const linked = await row({ id: asok.id });
    expect(linked.osm_id).toBe("node/990000001");
    expect(linked.lines).toEqual(["BTS_SUKHUMVIT"]);
    expect(linked.osm_last_seen_at).toBe("2026-12-01T03:00:00+00:00");

    const added = await row({ osm_id: NEW_HALT.osmId });
    expect(added).toMatchObject({
      name_en: "Zz Test Halt",
      lines: ["RAIL"],
      active: true,
    });

    // Its position landed as a real point.
    const { data: list } = await service.rpc("station_list", {});
    const halt = list!.find((s) => s.id === added.id)!;
    expect(halt.lat).toBeCloseTo(13.9, 5);
    expect(halt.lng).toBeCloseTo(100.6, 5);
  });

  it("switches a vanished station off, keeps it, and back on when it returns", async () => {
    await mergeStations(service, [asokOsm()], new Date("2027-01-01T03:00:00Z"));
    const gone = await row({ osm_id: NEW_HALT.osmId });
    expect(gone.active).toBe(false);
    expect(gone.osm_missing_since).toBe("2027-01-01T03:00:00+00:00");
    // Customers no longer see it.
    const { data: list } = await service.rpc("station_list", {});
    expect(list!.some((s) => s.id === gone.id)).toBe(false);

    const result = await mergeStations(
      service,
      [asokOsm(), NEW_HALT],
      new Date("2027-02-01T03:00:00Z"),
    );
    expect(result.reactivated).toBe(1);
    const back = await row({ osm_id: NEW_HALT.osmId });
    expect(back).toMatchObject({ active: true, osm_missing_since: null });
  });

  it("leaves a station an admin switched off alone", async () => {
    await service.from("stations").update({ active: false }).eq("id", asok.id);
    await mergeStations(
      service,
      [asokOsm(), NEW_HALT],
      new Date("2027-03-01T03:00:00Z"),
    );
    expect((await row({ id: asok.id })).active).toBe(false);
    await service.from("stations").update({ active: true }).eq("id", asok.id);
  });
});
