import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  offerFor,
  type HeldBooking,
  type ModelStock,
} from "@/lib/availability";
import { priceForDays } from "@/lib/pricing";
import { rentalDays } from "@/lib/rental-days";
import { bangkokDateTime } from "@/lib/time";
import { anonClient, seed, serviceClient, type Db } from "./helpers";

// Phase 3: the SQL availability, price and search functions follow the same
// rules as lib/availability.ts, lib/pricing.ts and lib/rental-days.ts.

const click = "c0000000-0000-4000-8000-000000000010"; // Honda Click 125i
const codes = ["TSTAA2", "TSTAB3", "TSTAC4"];

let anon: Db;
let service: Db;

const at = (date: string, time = "10:00") => bangkokDateTime(date, time);

beforeAll(async () => {
  anon = anonClient();
  service = serviceClient();
  // Two bikes: 1 Instant, 1 Request, 2-hour buffer after return.
  await service
    .from("bike_models")
    .update({ qty: 2, instant_qty: 1, request_qty: 1, buffer_after_h: 2 })
    .eq("id", click);
});

afterAll(async () => {
  await service.from("bookings").delete().in("code", codes);
  await service
    .from("bike_models")
    .update({ qty: 1, instant_qty: 0, request_qty: 1, buffer_after_h: null })
    .eq("id", click);
  await service.from("bike_model_downtime").delete().eq("bike_model_id", click);
});

async function book(code: string, b: HeldBooking) {
  const { error } = await service.from("bookings").insert({
    code,
    customer_id: seed.customerId,
    shop_id: seed.bsrShop,
    bike_model_id: click,
    start_at: b.start.toISOString(),
    end_at: b.end.toISOString(),
    mode: b.kind,
    rental_total: 1000,
    rental_after_promo: 1000,
    fee: 100,
    due_at_shop: 900,
    status: "confirmed_unpaid",
  });
  expect(error).toBeNull();
}

describe("model_offer matches lib/availability", () => {
  const bookings: HeldBooking[] = [
    { start: at("2026-12-01"), end: at("2026-12-10"), kind: "instant" },
    { start: at("2026-12-05"), end: at("2026-12-08"), kind: "now" },
  ];

  beforeAll(async () => {
    await book(codes[0], bookings[0]);
    await book(codes[1], bookings[1]);
    await service
      .from("bike_model_downtime")
      .insert({ bike_model_id: click, units: 1, back_on: "2026-12-20" });
  });

  const stock: ModelStock = {
    qty: 2,
    instantQty: 1,
    requestQty: 1,
    bufferBeforeH: 0,
    bufferAfterH: 2,
    repairs: [{ units: 1, backOn: "2026-12-20" }],
    bookings,
  };

  it.each([
    ["2026-12-02", "2026-12-04"],
    ["2026-12-06", "2026-12-07"],
    ["2026-12-10", "2026-12-11"],
    ["2026-12-21", "2026-12-23"],
    ["2026-11-20", "2026-11-25"],
  ])("from %s to %s", async (from, to) => {
    const ts = offerFor(stock, at(from), at(to));
    const { data } = await anon.rpc("model_offer", {
      p_bike_model_id: click,
      p_start: at(from).toISOString(),
      p_end: at(to).toISOString(),
    });
    expect(data?.[0]).toEqual({ free: ts.free, mode: ts.mode });
  });
});

describe("rental_price and rental_days match lib", () => {
  it.each([1, 7, 10, 30, 31, 45, 60, 75])("%i days", async (days) => {
    const [{ data: rows }, { data: model }, { data: sql }] = await Promise.all([
      anon.from("price_days").select("day, total").eq("bike_model_id", click),
      anon
        .from("bike_models")
        .select("price_after_30")
        .eq("id", click)
        .single(),
      anon.rpc("rental_price", { p_bike_model_id: click, p_days: days }),
    ]);
    const table = [...rows!].sort((a, b) => a.day - b.day).map((r) => r.total);
    expect(sql).toBe(priceForDays(table, days, model!.price_after_30!));
  });

  it.each([
    ["10:00", "2026-11-10", "10:00"],
    ["10:00", "2026-11-10", "10:30"],
    ["10:00", "2026-11-09", "14:00"],
  ])("from 9 Nov %s to %s %s", async (t1, d2, t2) => {
    const start = at("2026-11-09", t1);
    const end = at(d2, t2);
    const { data } = await anon.rpc("rental_days", {
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    });
    expect(data).toBe(rentalDays(start, end));
  });
});

describe("search_offers", () => {
  it("lists BSR's public bikes and nothing from draft shops", async () => {
    const { data } = await anon.rpc("search_offers", {});
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.some((r) => r.shop_id === seed.bsrShop)).toBe(true);
    expect(data!.some((r) => r.shop_id === seed.draftShop)).toBe(false);
  });

  it("hides a bike that's fully booked for the dates", async () => {
    const { data } = await anon.rpc("search_offers", {
      p_start: at("2026-11-10").toISOString(),
      p_end: at("2026-11-12").toISOString(),
    });
    expect(data!.some((r) => r.bike_model_id === seed.bsrPcx)).toBe(false);
  });

  it("respects the minimum notice and minimum days", async () => {
    await service
      .from("bike_models")
      .update({ min_days_booking: 7 })
      .eq("id", click);
    const { data } = await anon.rpc("search_offers", {
      p_start: at("2027-01-05").toISOString(),
      p_end: at("2027-01-08").toISOString(),
    });
    expect(data!.some((r) => r.bike_model_id === click)).toBe(false);
    await service
      .from("bike_models")
      .update({ min_days_booking: null })
      .eq("id", click);
  });

  it("returns no booking details to the public", async () => {
    const { data } = await anon.from("bookings").select("id");
    expect(data).toEqual([]);
  });
});

describe("stations", () => {
  it("lists BTS/MRT stations with interchanges merged", async () => {
    const { data } = await anon.rpc("station_list", {});
    expect(data!.length).toBeGreaterThan(150);
    const siam = data!.find((s) => s.name_en === "Siam");
    expect(siam?.lines).toEqual(["BTS_SILOM", "BTS_SUKHUMVIT"]);
    expect(siam?.lat).toBeCloseTo(13.7456, 2);
  });
});
