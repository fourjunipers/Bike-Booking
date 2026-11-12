import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  bangkokDay,
  seed,
  serviceClient,
  signedInClient,
  type Db,
} from "./helpers";

// Owner decisions 2026-11-05: quantity split, repair entries, one listing per
// catalog model, minimum days and notice.

let anon: Db;
let service: Db;
let bsrOwner: Db;
let bsrStaff: Db;

beforeAll(async () => {
  anon = anonClient();
  service = serviceClient();
  [bsrOwner, bsrStaff] = await Promise.all([
    signedInClient(seed.users.bsrOwner),
    signedInClient(seed.users.bsrStaff),
  ]);
});

afterEach(async () => {
  await service
    .from("bike_model_downtime")
    .delete()
    .eq("bike_model_id", seed.bsrPcx);
});

describe("quantity split", () => {
  it("seeds BSR's models as Request", async () => {
    const { data } = await anon
      .from("bike_models")
      .select("qty, instant_qty, request_qty")
      .eq("id", seed.bsrPcx)
      .single();
    expect(data).toEqual({ qty: 1, instant_qty: 0, request_qty: 1 });
  });

  it("rejects Instant + Request above the quantity", async () => {
    const { error } = await bsrStaff
      .from("bike_models")
      .update({ instant_qty: 1, request_qty: 1 })
      .eq("id", seed.bsrPcx);
    expect(error?.code).toBe("23514");
  });

  it("lets a shop list each catalog model once", async () => {
    const { data: pcx } = await service
      .from("bike_models")
      .select("catalog_id")
      .eq("id", seed.bsrPcx)
      .single();
    const { error } = await bsrOwner.from("bike_models").insert({
      shop_id: seed.bsrShop,
      catalog_id: pcx!.catalog_id,
      qty: 1,
    });
    expect(error?.code).toBe("23505");
  });
});

describe("repair entries", () => {
  it("are members-only", async () => {
    const { error } = await bsrStaff
      .from("bike_model_downtime")
      .insert({ bike_model_id: seed.bsrPcx, units: 1, back_on: "2026-11-12" });
    expect(error).toBeNull();
    const { data: publicRows } = await anon
      .from("bike_model_downtime")
      .select("id")
      .eq("bike_model_id", seed.bsrPcx);
    expect(publicRows).toEqual([]);
  });

  it("count until their back-on date", async () => {
    await service
      .from("bike_model_downtime")
      .insert({ bike_model_id: seed.bsrPcx, units: 1, back_on: "2026-11-12" });
    const on = async (date: string) =>
      (
        await bsrOwner.rpc("units_in_repair", {
          p_bike_model_id: seed.bsrPcx,
          p_date: date,
        })
      ).data;
    expect(await on("2026-11-11")).toBe(1);
    expect(await on("2026-11-12")).toBe(0);
  });

  it("report bookings that no longer fit", async () => {
    // The seeded booking holds BSR's only PCX from 2 days ago to 12 days on.
    const conflicts = async () =>
      (
        await bsrOwner.rpc("repair_conflicts", {
          p_bike_model_id: seed.bsrPcx,
          p_from: bangkokDay(0),
        })
      ).data?.map((c) => c.code);
    expect(await conflicts()).toEqual([]);

    await service
      .from("bike_model_downtime")
      .insert({
        bike_model_id: seed.bsrPcx,
        units: 1,
        back_on: bangkokDay(15),
      });
    expect(await conflicts()).toEqual(["K7Q4ZP"]);

    // Back tomorrow, while the booking still runs: still clashes from today.
    await service
      .from("bike_model_downtime")
      .delete()
      .eq("bike_model_id", seed.bsrPcx);
    await service
      .from("bike_model_downtime")
      .insert({ bike_model_id: seed.bsrPcx, units: 1, back_on: bangkokDay(1) });
    expect(await conflicts()).toEqual(["K7Q4ZP"]);
  });
});

describe("minimum days and notice", () => {
  it("have shop defaults that owners can change", async () => {
    const { data: before } = await service
      .from("shops")
      .select("min_days_walkin, min_days_booking, notice_h")
      .eq("id", seed.bsrShop)
      .single();
    expect(before).toEqual({
      min_days_walkin: 1,
      min_days_booking: 1,
      notice_h: 0,
    });
    const { error } = await bsrOwner
      .from("shops")
      .update({ min_days_booking: 3, notice_h: 24 })
      .eq("id", seed.bsrShop);
    expect(error).toBeNull();
    await service
      .from("shops")
      .update({ min_days_booking: 1, notice_h: 0 })
      .eq("id", seed.bsrShop);
  });

  it("cap the request reply window at 4 hours", async () => {
    const { error } = await bsrOwner
      .from("shops")
      .update({ request_window_min: 241 })
      .eq("id", seed.bsrShop);
    expect(error?.code).toBe("23514");
  });

  it("can be overridden per model", async () => {
    const { error } = await bsrStaff
      .from("bike_models")
      .update({ min_days_booking: 7 })
      .eq("id", seed.bsrPcx);
    expect(error).toBeNull();
    await service
      .from("bike_models")
      .update({ min_days_booking: null })
      .eq("id", seed.bsrPcx);
  });
});
