import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createUser,
  deleteUser,
  seed,
  serviceClient,
  signedInClient,
  type Db,
} from "./helpers";

// Postgres "insufficient privilege": a column grant or RLS check refused it.
const DENIED = "42501";

let anon: Db;
let customer: Db;
let otherCustomer: Db;
let otherCustomerId: string;
let bsrOwner: Db;
let bsrStaff: Db;
let draftOwner: Db;

beforeAll(async () => {
  anon = anonClient();
  const other = await createUser("rls-other");
  otherCustomerId = other.id;
  [customer, otherCustomer, bsrOwner, bsrStaff, draftOwner] = await Promise.all(
    [
      signedInClient(seed.users.customer),
      signedInClient(other.email),
      signedInClient(seed.users.bsrOwner),
      signedInClient(seed.users.bsrStaff),
      signedInClient(seed.users.draftOwner),
    ],
  );
});

afterAll(async () => {
  await deleteUser(otherCustomerId);
});

describe("the public (signed out)", () => {
  it("sees live shops but not draft ones", async () => {
    const { data } = await anon.from("shops").select("id");
    const ids = data!.map((s) => s.id);
    expect(ids).toContain(seed.bsrShop);
    expect(ids).not.toContain(seed.draftShop);
  });

  it("sees models and prices of live shops only", async () => {
    const { data: models } = await anon
      .from("bike_models")
      .select("id, shop_id");
    expect(models!.length).toBeGreaterThan(0);
    expect(models!.every((m) => m.shop_id === seed.bsrShop)).toBe(true);

    const { data: prices } = await anon
      .from("price_days")
      .select("day")
      .eq("bike_model_id", seed.bsrPcx);
    expect(prices).toHaveLength(30);
  });

  it("sees hours and policies of live shops", async () => {
    const { data: hours } = await anon.from("shop_hours").select("shop_id");
    expect(hours!.length).toBe(7);
    const { data: policies } = await anon
      .from("shop_policies")
      .select("shop_id");
    expect(policies!.map((p) => p.shop_id)).toEqual([seed.bsrShop]);
  });

  it("can't read contacts, team, profiles, bookings or events", async () => {
    for (const table of [
      "shop_contacts",
      "shop_members",
      "profiles",
      "bookings",
      "booking_events",
    ] as const) {
      const { data } = await anon.from(table).select("*");
      expect(data, table).toEqual([]);
    }
  });
});

describe("customers", () => {
  it("read their own booking and its events", async () => {
    const { data } = await customer.from("bookings").select("code");
    expect(data).toEqual([{ code: "K7Q4ZP" }]);
    const { data: events } = await customer
      .from("booking_events")
      .select("event");
    expect(events).toEqual([{ event: "created" }]);
  });

  it("can't read another customer's booking, events or profile", async () => {
    expect((await otherCustomer.from("bookings").select("id")).data).toEqual(
      [],
    );
    expect(
      (await otherCustomer.from("booking_events").select("id")).data,
    ).toEqual([]);
    const { data: profiles } = await otherCustomer
      .from("profiles")
      .select("id");
    expect(profiles!.map((p) => p.id)).toEqual([otherCustomerId]);
  });

  it("see a shop's contacts only once they have a confirmed booking there", async () => {
    const { data: mine } = await customer
      .from("shop_contacts")
      .select("shop_id");
    expect(mine!.map((c) => c.shop_id)).toEqual([seed.bsrShop]);
    expect(
      (await otherCustomer.from("shop_contacts").select("shop_id")).data,
    ).toEqual([]);
  });

  it("edit their own profile but never their role", async () => {
    const { error: nameError } = await customer
      .from("profiles")
      .update({ name: "Test Customer" })
      .eq("id", seed.customerId);
    expect(nameError).toBeNull();

    const { error: roleError } = await customer
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", seed.customerId);
    expect(roleError?.code).toBe(DENIED);
  });

  it("can't edit someone else's profile", async () => {
    const { data } = await otherCustomer
      .from("profiles")
      .update({ name: "Hacked" })
      .eq("id", seed.customerId)
      .select();
    expect(data).toEqual([]);
  });

  it("can't create or change bookings directly", async () => {
    const { error: insertError } = await customer.from("bookings").insert({
      code: "ABCDEF",
      customer_id: seed.customerId,
      shop_id: seed.bsrShop,
      bike_model_id: seed.bsrPcx,
      start_at: "2026-12-01T03:00:00Z",
      end_at: "2026-12-02T03:00:00Z",
      mode: "instant",
      rental_total: 300,
      rental_after_promo: 300,
      fee: 50,
      due_at_shop: 250,
      status: "paid",
    });
    expect(insertError?.code).toBe(DENIED);

    const { error: updateError } = await customer
      .from("bookings")
      .update({ status: "returned" })
      .eq("id", seed.booking);
    expect(updateError?.code).toBe(DENIED);
  });

  it("can't review a booking that hasn't been returned", async () => {
    // shop_id and bike_model_id are filled from the booking by a trigger, so a
    // client sends only these columns (the generated types can't express that).
    // TODO(phase-7): a typed insertReview helper.
    const { error } = await customer
      .from("reviews")
      .insert({ booking_id: seed.booking, rating: 5 } as never);
    expect(error?.code).toBe(DENIED);
    expect(error?.message).toMatch(/row-level security/);
  });
});

describe("vendors", () => {
  it("read their own shop's bookings and those customers' profiles", async () => {
    const { data } = await bsrStaff.from("bookings").select("code");
    expect(data).toEqual([{ code: "K7Q4ZP" }]);
    const { data: profiles } = await bsrStaff
      .from("profiles")
      .select("id")
      .eq("id", seed.customerId);
    expect(profiles).toHaveLength(1);
  });

  it("can't read another shop's bookings, contacts, team or customers", async () => {
    expect((await draftOwner.from("bookings").select("id")).data).toEqual([]);
    const { data: contacts } = await draftOwner
      .from("shop_contacts")
      .select("shop_id");
    expect(contacts!.map((c) => c.shop_id)).toEqual([seed.draftShop]);
    const { data: members } = await draftOwner
      .from("shop_members")
      .select("shop_id");
    expect(new Set(members!.map((m) => m.shop_id))).toEqual(
      new Set([seed.draftShop]),
    );
    const { data: profiles } = await draftOwner
      .from("profiles")
      .select("id")
      .eq("id", seed.customerId);
    expect(profiles).toEqual([]);
  });

  it("see their own draft shop and its models; other vendors can't", async () => {
    const { data: own } = await draftOwner
      .from("bike_models")
      .select("id")
      .eq("id", seed.draftModel);
    expect(own).toHaveLength(1);

    const { data: shop } = await bsrStaff
      .from("shops")
      .select("id")
      .eq("id", seed.draftShop);
    expect(shop).toEqual([]);
    const { data: model } = await bsrStaff
      .from("bike_models")
      .select("id")
      .eq("id", seed.draftModel);
    expect(model).toEqual([]);
  });

  it("staff manage the fleet; other shops can't touch it", async () => {
    const { data: updated } = await bsrStaff
      .from("bike_models")
      .update({ qty: 5 })
      .eq("id", seed.bsrPcx)
      .select("qty");
    expect(updated).toEqual([{ qty: 5 }]);
    await bsrStaff.from("bike_models").update({ qty: 4 }).eq("id", seed.bsrPcx);

    const { data: foreign } = await draftOwner
      .from("bike_models")
      .update({ qty: 0 })
      .eq("id", seed.bsrPcx)
      .select();
    expect(foreign).toEqual([]);
  });

  it("can't clear the review flag or change shop status and boost", async () => {
    const { error: flagError } = await bsrOwner
      .from("bike_models")
      .update({ flagged_for_review: false })
      .eq("id", seed.bsrPcx);
    expect(flagError?.code).toBe(DENIED);

    const { error: statusError } = await bsrOwner
      .from("shops")
      .update({ status: "live", boost_level: "featured" })
      .eq("id", seed.bsrShop);
    expect(statusError?.code).toBe(DENIED);
  });

  it("owners edit their shop profile; staff can't", async () => {
    const { data: owner } = await bsrOwner
      .from("shops")
      .update({ nearest_station: "Phra Khanong (BTS)" })
      .eq("id", seed.bsrShop)
      .select("id");
    expect(owner).toHaveLength(1);

    const { data: staff } = await bsrStaff
      .from("shops")
      .update({ nearest_station: "Somewhere else" })
      .eq("id", seed.bsrShop)
      .select("id");
    expect(staff).toEqual([]);
  });

  it("only owners manage the team", async () => {
    const extra = await createUser("rls-team");
    try {
      const { error: staffError } = await bsrStaff
        .from("shop_members")
        .insert({ shop_id: seed.bsrShop, user_id: extra.id, role: "staff" });
      expect(staffError?.code).toBe(DENIED);

      const { error: ownerError } = await bsrOwner
        .from("shop_members")
        .insert({ shop_id: seed.bsrShop, user_id: extra.id, role: "staff" });
      expect(ownerError).toBeNull();

      const { data: removed } = await bsrOwner
        .from("shop_members")
        .delete()
        .eq("user_id", extra.id)
        .select();
      expect(removed).toHaveLength(1);
    } finally {
      await deleteUser(extra.id);
    }
  });
});

describe("booking_events", () => {
  it("is append-only, even for the service role", async () => {
    const service = serviceClient();
    const { error: updateError } = await service
      .from("booking_events")
      .update({ event: "edited" })
      .eq("booking_id", seed.booking);
    expect(updateError?.message).toMatch(/append-only/);

    const { error: deleteError } = await service
      .from("booking_events")
      .delete()
      .eq("booking_id", seed.booking);
    expect(deleteError?.message).toMatch(/append-only/);
  });

  it("can't be written by clients", async () => {
    const { error } = await customer.from("booking_events").insert({
      booking_id: seed.booking,
      actor_type: "customer",
      event: "forged",
    });
    expect(error?.code).toBe(DENIED);
  });
});

describe("new sign-ups", () => {
  it("get a customer profile automatically", async () => {
    const { data } = await serviceClient()
      .from("profiles")
      .select("role, email")
      .eq("id", otherCustomerId)
      .single();
    expect(data?.role).toBe("customer");
    expect(data?.email).toMatch(/^rls-other-/);
  });
});
