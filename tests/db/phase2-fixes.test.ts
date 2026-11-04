import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isShopClosedOn, type Closure } from "@/lib/closures";
import {
  anonClient,
  seed,
  serviceClient,
  signedInClient,
  type Db,
} from "./helpers";

// Owner feedback on Phase 2 (2026-11-04): yearly closures, price per day
// after 30 days, helmet types, catalog without generation.

let anon: Db;
let service: Db;
let bsrOwner: Db;
const closureIds: string[] = [];

beforeAll(async () => {
  anon = anonClient();
  service = serviceClient();
  bsrOwner = await signedInClient(seed.users.bsrOwner);
});

afterAll(async () => {
  if (closureIds.length > 0)
    await service.from("shop_closures").delete().in("id", closureIds);
});

describe("yearly closures", () => {
  const closures: (Closure & { note: string })[] = [
    {
      start_date: "2027-04-13",
      end_date: "2027-04-15",
      repeats_yearly: true,
      note: "test Songkran",
    },
    {
      start_date: "2026-12-31",
      end_date: "2027-01-02",
      repeats_yearly: true,
      note: "test New Year",
    },
    {
      start_date: "2027-08-01",
      end_date: "2027-08-02",
      repeats_yearly: false,
      note: "test one-off",
    },
  ];

  beforeAll(async () => {
    const { data, error } = await bsrOwner
      .from("shop_closures")
      .insert(closures.map((c) => ({ ...c, shop_id: seed.bsrShop })))
      .select("id");
    expect(error).toBeNull();
    closureIds.push(...(data ?? []).map((r) => r.id));
  });

  it.each([
    "2026-04-14",
    "2027-04-13",
    "2029-04-15",
    "2029-04-16",
    "2027-12-31",
    "2028-01-02",
    "2028-01-03",
    "2027-08-02",
    "2028-08-02",
  ])("is_shop_closed_on matches lib/closures for %s", async (date) => {
    const { data, error } = await anon.rpc("is_shop_closed_on", {
      p_shop_id: seed.bsrShop,
      p_date: date,
    });
    expect(error).toBeNull();
    expect(data).toBe(isShopClosedOn(closures, date));
  });

  it("rejects a yearly closure longer than a year", async () => {
    const { error } = await bsrOwner.from("shop_closures").insert({
      shop_id: seed.bsrShop,
      start_date: "2027-01-01",
      end_date: "2028-01-01",
      repeats_yearly: true,
    });
    expect(error?.code).toBe("23514");
  });
});

describe("price per day after 30 days", () => {
  it("is set on every seeded BSR model", async () => {
    const { data } = await anon
      .from("bike_models")
      .select("id, price_after_30")
      .eq("shop_id", seed.bsrShop);
    expect(data?.length).toBeGreaterThan(0);
    for (const m of data ?? []) expect(m.price_after_30).toBeGreaterThan(0);
  });

  it("is required before a shop can be submitted", async () => {
    const { data: before } = await bsrOwner.rpc("shop_readiness", {
      p_shop_id: seed.bsrShop,
    });
    expect(before).not.toContain("model_prices");

    const { data: pcx } = await service
      .from("bike_models")
      .select("price_after_30")
      .eq("id", seed.bsrPcx)
      .single();
    await service
      .from("bike_models")
      .update({ price_after_30: null })
      .eq("id", seed.bsrPcx);
    try {
      const { data: after } = await bsrOwner.rpc("shop_readiness", {
        p_shop_id: seed.bsrShop,
      });
      expect(after).toContain("model_prices");
    } finally {
      await service
        .from("bike_models")
        .update({ price_after_30: pcx!.price_after_30 })
        .eq("id", seed.bsrPcx);
    }
  });
});

describe("schema changes", () => {
  it("stores helmet types as a set", async () => {
    const { error } = await bsrOwner
      .from("shop_policies")
      .update({ helmet_types: ["full_face", "half"] })
      .eq("shop_id", seed.bsrShop);
    expect(error).toBeNull();
    const { data } = await anon
      .from("shop_policies")
      .select("helmet_types, deposit_refund_days")
      .eq("shop_id", seed.bsrShop)
      .single();
    expect(data?.helmet_types).toEqual(["full_face", "half"]);
    await service
      .from("shop_policies")
      .update({ helmet_types: [] })
      .eq("shop_id", seed.bsrShop);
  });

  it("allows the deposit refund days to be left blank", async () => {
    const { data: was } = await service
      .from("shop_policies")
      .select("deposit_refund_days")
      .eq("shop_id", seed.bsrShop)
      .single();
    const { error } = await bsrOwner
      .from("shop_policies")
      .update({ deposit_refund_days: null })
      .eq("shop_id", seed.bsrShop);
    expect(error).toBeNull();
    await service
      .from("shop_policies")
      .update({ deposit_refund_days: was!.deposit_refund_days })
      .eq("shop_id", seed.bsrShop);
  });

  it("names catalog slugs from make, model and years", async () => {
    const { data, error } = await service
      .from("bike_catalog")
      .insert({
        make: "Test",
        model: "Slug 125",
        year_from: 2025,
        year_to: 2026,
        cc: 125,
        type: "city_scooter",
        transmission: "automatic",
        status: "approved",
      })
      .select("id, slug")
      .single();
    expect(error).toBeNull();
    expect(data?.slug).toBe("test-slug-125-2025-2026");
    await service.from("bike_catalog").delete().eq("id", data!.id);
  });
});
