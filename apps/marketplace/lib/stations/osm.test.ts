import { describe, expect, it } from "vitest";
import {
  linesFromTags,
  metres,
  overpassQuery,
  parseOverpass,
  planStationMerge,
  type ExistingStation,
  type OsmStation,
} from "./osm";

const asok = { lat: 13.73702, lng: 100.56045 };

function existing(over: Partial<ExistingStation>): ExistingStation {
  return {
    id: "s1",
    nameEn: "Asok",
    nameTh: "อโศก",
    lines: ["BTS_SUKHUMVIT"],
    ...asok,
    active: true,
    osmId: null,
    osmMissingSince: null,
    ...over,
  };
}

function osm(over: Partial<OsmStation>): OsmStation {
  return {
    osmId: "node/1",
    nameEn: "Asok",
    nameTh: "อโศก",
    lines: ["BTS"],
    ...asok,
    ...over,
  };
}

describe("overpassQuery", () => {
  it("asks for stations and halts in the area, with centres for areas", () => {
    const q = overpassQuery([13.45, 100.25, 14.2, 100.95]);
    expect(q).toContain('nwr["railway"="station"](13.45,100.25,14.2,100.95)');
    expect(q).toContain("out center tags");
  });
});

describe("parseOverpass", () => {
  it("reads English and Thai names, positions, and folds a node and its area together", () => {
    const stations = parseOverpass({
      elements: [
        {
          type: "node",
          id: 1,
          lat: 13.737,
          lon: 100.5604,
          tags: { name: "อโศก", "name:en": "Asok", network: "BTS Skytrain" },
        },
        {
          type: "way",
          id: 2,
          center: { lat: 13.7371, lon: 100.5606 },
          tags: { name: "Asok", network: "BTS" },
        },
        {
          type: "node",
          id: 3,
          lat: 13.7468,
          lon: 100.5345,
          tags: { name: "Hua Lamphong", operator: "State Railway of Thailand" },
        },
        { type: "node", id: 4, lat: 1, lon: 1, tags: { railway: "station" } },
      ],
    });
    expect(stations).toEqual([
      {
        osmId: "node/1",
        nameEn: "Asok",
        nameTh: "อโศก",
        lines: ["BTS"],
        lat: 13.737,
        lng: 100.5604,
      },
      {
        osmId: "node/3",
        nameEn: "Hua Lamphong",
        nameTh: null,
        lines: ["SRT"],
        lat: 13.7468,
        lng: 100.5345,
      },
    ]);
  });

  it("copes with an empty or broken answer", () => {
    expect(parseOverpass({})).toEqual([]);
    expect(parseOverpass(null)).toEqual([]);
  });
});

describe("linesFromTags", () => {
  it("maps networks to line codes, or RAIL when unknown", () => {
    expect(linesFromTags({ network: "MRT" })).toEqual(["MRT"]);
    expect(linesFromTags({ network: "Airport Rail Link" })).toEqual(["ARL"]);
    expect(linesFromTags({ name: "Lampang" })).toEqual(["RAIL"]);
  });
});

describe("planStationMerge", () => {
  it("links a seeded station by name and position, keeping its names and lines", () => {
    const plan = planStationMerge(
      [existing({})],
      [osm({ nameEn: "Asoke Station", lat: 13.7372 })],
    );
    expect(plan.insert).toEqual([]);
    expect(plan.update).toHaveLength(1);
    expect(plan.update[0].id).toBe("s1");
    expect(plan.update[0].osm.osmId).toBe("node/1");
    // "Asoke" isn't "Asok": matched by the Thai name instead.
    expect(plan.update[0].osm.nameEn).toBe("Asok");
  });

  it("doesn't link a same-name station that is too far away", () => {
    const plan = planStationMerge(
      [existing({})],
      [osm({ lat: asok.lat + 0.01 })],
    );
    expect(
      metres(asok, { lat: asok.lat + 0.01, lng: asok.lng }),
    ).toBeGreaterThan(400);
    expect(plan.update).toEqual([]);
    expect(plan.insert).toHaveLength(1);
    expect(plan.unmatched).toEqual(["Asok"]);
  });

  it("links each seeded station once, to the nearest twin", () => {
    const plan = planStationMerge(
      [existing({})],
      [
        osm({ osmId: "node/9", lat: asok.lat + 0.002 }),
        osm({ osmId: "node/1" }),
      ],
    );
    expect(plan.update.map((u) => u.osm.osmId)).toEqual(["node/1"]);
    // The farther twin, 220 m off, is the same interchange: not added.
    expect(plan.insert).toEqual([]);
  });

  it("doesn't add the other line's platform at an interchange", () => {
    const plan = planStationMerge(
      [existing({ osmId: "node/1", lines: ["MRT_BLUE"] })],
      [
        osm({ osmId: "node/1" }),
        // Same name, 250 m away: the interchange's other platform.
        osm({ osmId: "node/7", lines: ["RAIL"], lat: asok.lat + 0.00225 }),
        // Same name, 1.5 km away: a separate station.
        osm({ osmId: "node/8", lines: ["SRT"], lat: asok.lat + 0.0135 }),
      ],
    );
    expect(plan.insert.map((o) => o.osmId)).toEqual(["node/8"]);
  });

  it("updates linked stations from OpenStreetMap and adds new ones", () => {
    const plan = planStationMerge(
      [existing({ osmId: "node/1" })],
      [
        osm({ nameEn: "Asok (renamed)", lat: 13.7375 }),
        osm({ osmId: "node/2", nameEn: "New Station", lat: 13.8 }),
      ],
    );
    expect(plan.update).toEqual([
      {
        id: "s1",
        osm: osm({ nameEn: "Asok (renamed)", lat: 13.7375 }),
        reactivate: false,
      },
    ]);
    expect(plan.insert.map((o) => o.nameEn)).toEqual(["New Station"]);
  });

  it("switches off linked stations that disappeared, never unlinked ones", () => {
    const linked = Array.from({ length: 12 }, (_, i) =>
      existing({ id: `l${i}`, nameEn: `S${i}`, osmId: `node/${i}` }),
    );
    const plan = planStationMerge(
      [...linked, existing({ id: "seeded", nameEn: "Old" })],
      linked.slice(1).map((s) => osm({ osmId: s.osmId!, nameEn: s.nameEn })),
    );
    expect(plan.deactivate).toEqual(["l0"]);
    expect(plan.suspicious).toBe(false);
    expect(plan.unmatched).toEqual(["Old"]);
  });

  it("switches nothing off when OpenStreetMap returns too few stations", () => {
    const linked = Array.from({ length: 12 }, (_, i) =>
      existing({ id: `l${i}`, nameEn: `S${i}`, osmId: `node/${i}` }),
    );
    const plan = planStationMerge(linked, [
      osm({ osmId: "node/0", nameEn: "S0" }),
    ]);
    expect(plan.suspicious).toBe(true);
    expect(plan.deactivate).toEqual([]);
  });

  it("switches a station back on only if a refresh switched it off", () => {
    const plan = planStationMerge(
      [
        existing({
          id: "gone",
          osmId: "node/1",
          active: false,
          osmMissingSince: "2026-10-01T03:00:00Z",
        }),
        existing({
          id: "admin-off",
          nameEn: "Siam",
          osmId: "node/2",
          active: false,
        }),
      ],
      [osm({}), osm({ osmId: "node/2", nameEn: "Siam" })],
    );
    expect(
      Object.fromEntries(plan.update.map((u) => [u.id, u.reactivate])),
    ).toEqual({ gone: true, "admin-off": false });
  });
});
