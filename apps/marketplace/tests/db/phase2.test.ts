import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fillDays, type Anchors } from "@mango/core/pricing";
import {
  anonClient,
  createUser,
  deleteUser,
  seed,
  serviceClient,
  signedInClient,
  type Db,
} from "./helpers";

// Phase 2: catalog, "What's included", extras, shop setup RPCs, review flags.

const vespaRequest = "e0000000-0000-4000-8000-000000000090";
const damageCoverExtra = "f0000000-0000-4000-8000-000000000003";

let anon: Db;
let service: Db;
let bsrOwner: Db;
let bsrStaff: Db;
let draftOwner: Db;
let newcomer: Db;
let newcomerId: string;

beforeAll(async () => {
  anon = anonClient();
  service = serviceClient();
  const user = await createUser("phase2");
  newcomerId = user.id;
  [bsrOwner, bsrStaff, draftOwner, newcomer] = await Promise.all([
    signedInClient(seed.users.bsrOwner),
    signedInClient(seed.users.bsrStaff),
    signedInClient(seed.users.draftOwner),
    signedInClient(user.email),
  ]);
});

afterAll(async () => {
  // Shops the newcomer created go first (they hold an owner membership).
  const { data } = await service
    .from("shop_members")
    .select("shop_id, role")
    .eq("user_id", newcomerId);
  for (const m of data ?? []) {
    if (m.shop_id !== seed.bsrShop) {
      await service.from("shops").delete().eq("id", m.shop_id);
    }
  }
  await service
    .from("shop_members")
    .delete()
    .eq("user_id", newcomerId)
    .eq("shop_id", seed.bsrShop);
  await deleteUser(newcomerId);
});

describe("seed", () => {
  it("BSR has 24 public models with day prices that match lib/pricing", async () => {
    const { data: models } = await anon
      .from("bike_models")
      .select("id, price_days (day, total, is_anchor)")
      .eq("shop_id", seed.bsrShop);
    expect(models).toHaveLength(24);
    for (const model of models!) {
      const days = [...model.price_days].sort((a, b) => a.day - b.day);
      const anchors: Anchors = {};
      for (const d of days) if (d.is_anchor) anchors[d.day as 1] = d.total;
      expect(days.map((d) => d.total)).toEqual(
        fillDays(anchors).map((d) => d.total),
      );
    }
  });
});

describe("country and currency", () => {
  it("shops default to Thailand / THB and vendors can't change it", async () => {
    const { data } = await anon
      .from("shops")
      .select("country, currency")
      .eq("id", seed.bsrShop)
      .single();
    expect(data).toEqual({ country: "TH", currency: "THB" });
    const { error } = await bsrOwner
      .from("shops")
      .update({ currency: "VND" } as never)
      .eq("id", seed.bsrShop);
    expect(error).not.toBeNull();
  });
});

describe("bike catalog", () => {
  it("the public sees approved entries only", async () => {
    const { data } = await anon.from("bike_catalog").select("id, status");
    expect(data!.every((c) => c.status === "approved")).toBe(true);
    expect(data!.map((c) => c.id)).not.toContain(vespaRequest);
  });

  it("a shop sees its own requests; other shops don't", async () => {
    const { data: own } = await draftOwner
      .from("bike_catalog")
      .select("id")
      .eq("id", vespaRequest);
    expect(own).toHaveLength(1);
    const { data: other } = await bsrOwner
      .from("bike_catalog")
      .select("id")
      .eq("id", vespaRequest);
    expect(other).toEqual([]);
  });

  it("vendors can request but not approve entries", async () => {
    const { error } = await draftOwner.from("bike_catalog").insert({
      make: "Test",
      model: `Approve-${Date.now()}`,
      cc: 125,
      type: "city_scooter",
      transmission: "automatic",
      requested_by_shop_id: seed.draftShop,
      status: "approved",
    } as never);
    expect(error).not.toBeNull();

    const { error: foreign } = await draftOwner.from("bike_catalog").insert({
      make: "Test",
      model: `Foreign-${Date.now()}`,
      cc: 125,
      type: "city_scooter",
      transmission: "automatic",
      requested_by_shop_id: seed.bsrShop,
    });
    expect(foreign).not.toBeNull();
  });

  it("a shop can't list another shop's pending request", async () => {
    const { error } = await bsrStaff.from("bike_models").insert({
      shop_id: seed.bsrShop,
      catalog_id: vespaRequest,
      qty: 1,
    });
    expect(error).not.toBeNull();
  });
});

describe("What's included and extras", () => {
  it("the public reads model overrides and active extras of live shops", async () => {
    const { data: overrides } = await anon
      .from("bike_model_policies")
      .select("bike_model_id");
    expect(overrides).toHaveLength(8);
    const { data: extras } = await anon.from("shop_extras").select("id");
    expect(extras!.length).toBeGreaterThan(0);
  });

  it("staff can't change extras; owners can", async () => {
    const { data: staff } = await bsrStaff
      .from("shop_extras")
      .update({ price_1d: 1 })
      .eq("id", damageCoverExtra)
      .select();
    expect(staff).toEqual([]);

    const { data: owner } = await bsrOwner
      .from("shop_extras")
      .update({ price_1d: 200 })
      .eq("id", damageCoverExtra)
      .select("price_1d");
    expect(owner).toEqual([{ price_1d: 200 }]);
  });

  it("an extra can't be tied to another shop's model", async () => {
    const { error } = await bsrOwner
      .from("shop_extra_models")
      .insert({ extra_id: damageCoverExtra, bike_model_id: seed.draftModel });
    expect(error).not.toBeNull();
  });
});

describe("review flags", () => {
  it("a price edit on a live shop flags the model; admin clears it", async () => {
    await service
      .from("bike_models")
      .update({ flagged_for_review: false })
      .eq("id", seed.bsrPcx);
    const { data: day5 } = await bsrStaff
      .from("price_days")
      .select("total")
      .eq("bike_model_id", seed.bsrPcx)
      .eq("day", 5)
      .single();
    await bsrStaff
      .from("price_days")
      .update({ total: day5!.total })
      .eq("bike_model_id", seed.bsrPcx)
      .eq("day", 5);

    const { data: flagged } = await service
      .from("bike_models")
      .select("flagged_for_review")
      .eq("id", seed.bsrPcx)
      .single();
    expect(flagged!.flagged_for_review).toBe(true);
    await service
      .from("bike_models")
      .update({ flagged_for_review: false })
      .eq("id", seed.bsrPcx);
  });

  it("a policy edit flags the shop", async () => {
    await service
      .from("shops")
      .update({ flagged_for_review: false })
      .eq("id", seed.bsrShop);
    await bsrOwner
      .from("shop_policies")
      .update({ helmets: 2 })
      .eq("shop_id", seed.bsrShop);
    const { data } = await service
      .from("shops")
      .select("flagged_for_review")
      .eq("id", seed.bsrShop)
      .single();
    expect(data!.flagged_for_review).toBe(true);
    await service
      .from("shops")
      .update({ flagged_for_review: false })
      .eq("id", seed.bsrShop);
  });
});

describe("shop setup", () => {
  it("anyone signed in can create a draft shop and becomes its owner", async () => {
    const { data: shopId, error } = await newcomer.rpc("create_shop", {
      p_name: "Test Phase Two Rentals",
    });
    expect(error).toBeNull();
    const { data: shop } = await newcomer
      .from("shops")
      .select("status, slug")
      .eq("id", shopId!)
      .single();
    expect(shop!.status).toBe("draft");
    expect(shop!.slug).toMatch(/^test-phase-two-rentals/);

    // The terms are required; the setup steps aren't (2026-11-06).
    const { data: noTerms } = await newcomer.rpc("submit_shop", {
      p_shop_id: shopId!,
      p_accept_terms: false,
    });
    expect(noTerms).toEqual(["terms"]);

    const { data: missing } = await newcomer.rpc("submit_shop", {
      p_shop_id: shopId!,
      p_accept_terms: true,
    });
    expect(missing).toEqual(
      expect.arrayContaining(["about", "shop_photo", "hours", "model"]),
    );
    const { data: submitted } = await newcomer
      .from("shops")
      .select("status")
      .eq("id", shopId!)
      .single();
    expect(submitted!.status).toBe("pending");
    // Still invisible to the public.
    const { data: hidden } = await anon
      .from("shops")
      .select("id")
      .eq("id", shopId!);
    expect(hidden).toEqual([]);
  });

  it("staff can't invite; an owner's invite works once", async () => {
    const { error: staffError } = await bsrStaff.rpc("create_shop_invite", {
      p_shop_id: seed.bsrShop,
    });
    expect(staffError).not.toBeNull();

    const { data: token } = await bsrOwner.rpc("create_shop_invite", {
      p_shop_id: seed.bsrShop,
    });
    const { data: joined, error } = await newcomer.rpc("accept_shop_invite", {
      p_token: token!,
    });
    expect(error).toBeNull();
    expect(joined).toBe(seed.bsrShop);

    const { error: again } = await newcomer.rpc("accept_shop_invite", {
      p_token: token!,
    });
    expect(again).not.toBeNull();
  });

  it("staff don't see invites", async () => {
    const { data } = await bsrStaff.from("shop_invites").select("id");
    expect(data).toEqual([]);
  });

  it("the last owner can't be removed", async () => {
    const { error } = await draftOwner
      .from("shop_members")
      .delete()
      .eq("shop_id", seed.draftShop)
      .eq("role", "owner");
    expect(error).not.toBeNull();
  });
});
