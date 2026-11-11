/**
 * Phase 1a rules the database enforces (docs/platform/SPEC.md › Review
 * decisions): role limits, the one availability lock on unit_blocks, selling
 * a unit, the currency lock, default locations, the catalog link, the
 * all-or-nothing import, and the audit trail.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCatalogEntry,
  createTenant,
  createUser,
  deleteTenant,
  deleteUser,
  hours,
  period,
  removeCatalogEntry,
  serviceClient,
  type Db,
  type TestTenant,
  type TestUser,
} from "./helpers";

let shop: TestTenant;
let other: TestTenant;
let admin: TestUser;
let catalogId: string;
let modelId: string;
const extraCatalog: string[] = [];
const service = serviceClient();

let plateCounter = 0;
/** A fresh active unit of the test model. */
async function addUnit(tenant = shop, model = modelId): Promise<string> {
  const { data, error } = await service
    .from("units")
    .insert({
      tenant_id: tenant.id,
      model_id: model,
      location_id: tenant.locationId,
      plate: `T-${++plateCounter}`,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const block = (unitId: string, from: Date, to?: Date, kind = "downtime") => ({
  tenant_id: shop.id,
  unit_id: unitId,
  kind,
  period: period(from, to),
});

beforeAll(async () => {
  catalogId = await createCatalogEntry("fleet");
  [shop, other, admin] = await Promise.all([
    createTenant("fleet-a", {
      country: "TH",
      currency: "THB",
      locale: "th-TH",
      timezone: "Asia/Bangkok",
    }),
    createTenant("fleet-b"),
    createUser("fleet-admin"),
  ]);
  await service.from("platform_admins").insert({ user_id: admin.id });
  const { data, error } = await service
    .from("models")
    .insert({ tenant_id: shop.id, catalog_id: catalogId, name: "Test model" })
    .select("id")
    .single();
  if (error) throw error;
  modelId = data.id;
}, 120_000);

afterAll(async () => {
  await Promise.all([deleteTenant(shop), deleteTenant(other)]);
  await deleteUser(admin);
  for (const id of [catalogId, ...extraCatalog]) await removeCatalogEntry(id);
});

describe("role limits", () => {
  let unitId: string;
  beforeAll(async () => {
    unitId = await addUnit();
    await service.from("unit_financials").insert({
      tenant_id: shop.id,
      unit_id: unitId,
      currency: "THB",
      purchase_price: 4_500_000,
    });
  });

  it("only owners and managers read purchase and sale prices", async () => {
    for (const role of ["owner", "manager"] as const) {
      const { data } = await shop.members[role].db
        .from("unit_financials")
        .select("purchase_price")
        .eq("unit_id", unitId);
      expect(data, role).toEqual([{ purchase_price: 4_500_000 }]);
    }
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const { data } = await shop.members[role].db
        .from("unit_financials")
        .select("*");
      expect(data, role).toEqual([]);
    }
  });

  it("only owners and managers read the audit log, which holds those prices too", async () => {
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const { data } = await shop.members[role].db
        .from("audit_events")
        .select("id");
      expect(data, role).toEqual([]);
    }
    const { data } = await shop.members.manager.db
      .from("audit_events")
      .select("id")
      .eq("entity", "unit_financials");
    expect(data?.length).toBeGreaterThan(0);
  });

  it("staff, mechanics and drivers can't add models, units or locations", async () => {
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const db = shop.members[role].db;
      const model = await db
        .from("models")
        .insert({ tenant_id: shop.id, catalog_id: catalogId, name: role });
      expect(model.error?.code, `${role} model`).toBe("42501");
      const unit = await db.from("units").insert({
        tenant_id: shop.id,
        model_id: modelId,
        location_id: shop.locationId,
        plate: `ROLE-${role}`,
      });
      expect(unit.error?.code, `${role} unit`).toBe("42501");
      const location = await db
        .from("locations")
        .insert({ tenant_id: shop.id, name: role, timezone: "Asia/Bangkok" });
      expect(location.error?.code, `${role} location`).toBe("42501");
      const remove = await db.from("units").delete().eq("id", unitId).select();
      expect(remove.data ?? [], `${role} delete`).toEqual([]);
    }
  });

  it("staff and mechanics update the odometer (up or down) and active/maintenance, nothing else", async () => {
    for (const role of ["staff", "mechanic"] as const) {
      const db = shop.members[role].db;
      const id = await addUnit();
      const up = await db
        .from("units")
        .update({ current_odometer_km: 1200.5, status: "maintenance" })
        .eq("id", id)
        .select("current_odometer_km, status");
      expect(up.data, role).toEqual([
        { current_odometer_km: 1200.5, status: "maintenance" },
      ]);
      const down = await db
        .from("units")
        .update({ current_odometer_km: 900 })
        .eq("id", id);
      // A lower reading is allowed (owner, 11 Nov 2026); the app asks first.
      expect(down.error, role).toBeNull();
      const plate = await db
        .from("units")
        .update({ plate: "HACKED" })
        .eq("id", id);
      expect(plate.error?.message, role).toBe("only_owner_or_manager");
      const sold = await db
        .from("units")
        .update({ status: "sold" })
        .eq("id", id);
      expect(sold.error?.message, role).toBe("only_owner_or_manager");
    }
  });

  it("a manager can correct the odometer down too; a driver changes nothing", async () => {
    const id = await addUnit();
    await service
      .from("units")
      .update({ current_odometer_km: 500 })
      .eq("id", id);
    const driver = await shop.members.driver.db
      .from("units")
      .update({ current_odometer_km: 600 })
      .eq("id", id)
      .select("id");
    expect(driver.data ?? []).toEqual([]);
    const manager = await shop.members.manager.db
      .from("units")
      .update({ current_odometer_km: 400 })
      .eq("id", id)
      .select("current_odometer_km");
    expect(manager.data).toEqual([{ current_odometer_km: 400 }]);
  });

  it("mechanics and staff add and end downtime; drivers can't; nobody adds an allocation by hand", async () => {
    const id = await addUnit();
    for (const [i, role] of (["mechanic", "staff"] as const).entries()) {
      const db = shop.members[role].db;
      // Open-ended: "until someone ends it".
      const added = await db
        .from("unit_blocks")
        .insert(block(id, hours(1 + i * 10)))
        .select("id, created_by")
        .single();
      expect(added.data?.created_by, role).toBe(shop.members[role].id);
      const ended = await db
        .from("unit_blocks")
        .update({ period: period(hours(1 + i * 10), hours(2 + i * 10)) })
        .eq("id", added.data!.id)
        .select("id");
      expect(ended.data, role).toHaveLength(1);
    }
    const driver = await shop.members.driver.db
      .from("unit_blocks")
      .insert(block(id, hours(10), hours(11)));
    expect(driver.error?.code).toBe("42501");
    for (const role of ["owner", "mechanic"] as const) {
      const allocation = await shop.members[role].db
        .from("unit_blocks")
        .insert(block(id, hours(20), hours(21), "allocation"));
      expect(allocation.error?.code, role).toBe("42501");
    }
  });

  it("only an owner changes a location's time zone", async () => {
    const manager = await shop.members.manager.db
      .from("locations")
      .update({ timezone: "Asia/Tokyo" })
      .eq("id", shop.locationId);
    expect(manager.error?.code).toBe("42501");
    // A manager still edits everything else.
    const address = await shop.members.manager.db
      .from("locations")
      .update({ address: "79/37 Soi Phumichit" })
      .eq("id", shop.locationId)
      .select("id");
    expect(address.data).toHaveLength(1);
    const owner = await shop.members.owner.db
      .from("locations")
      .update({ timezone: "Asia/Tokyo" })
      .eq("id", shop.locationId)
      .select("timezone");
    expect(owner.data).toEqual([{ timezone: "Asia/Tokyo" }]);
    const unknown = await shop.members.owner.db
      .from("locations")
      .update({ timezone: "Asia/Atlantis" })
      .eq("id", shop.locationId);
    expect(unknown.error?.message).toContain("Unknown time zone");
  });
});

describe("unit blocks: one lock for every kind", () => {
  it("refuses an overlap on the same unit, whatever the kinds", async () => {
    const id = await addUnit();
    const first = await service
      .from("unit_blocks")
      .insert(block(id, hours(10), hours(20), "allocation"));
    expect(first.error).toBeNull();
    for (const kind of ["downtime", "hold", "transfer", "allocation"]) {
      const overlap = await service
        .from("unit_blocks")
        .insert(block(id, hours(15), hours(25), kind));
      expect(overlap.error?.code, kind).toBe("23P01");
    }
  });

  it("keeps the end out of the range so the next block can start right then", async () => {
    const id = await addUnit();
    const at = (n: number) => new Date(Date.UTC(2030, 0, 1, n));
    const first = await service
      .from("unit_blocks")
      .insert(block(id, at(10), at(20)));
    const next = await service
      .from("unit_blocks")
      .insert(block(id, at(20), at(22)));
    expect([first.error, next.error]).toEqual([null, null]);
    const inside = await service
      .from("unit_blocks")
      .insert(block(id, at(19), at(21)));
    expect(inside.error?.code).toBe("23P01");
  });

  it("lets two units be blocked at the same time", async () => {
    const [x, y] = [await addUnit(), await addUnit()];
    const results = await Promise.all([
      service.from("unit_blocks").insert(block(x, hours(1), hours(2))),
      service.from("unit_blocks").insert(block(y, hours(1), hours(2))),
    ]);
    expect(results.map((r) => r.error)).toEqual([null, null]);
  });

  it("gives one winner when two people block the same unit at once", async () => {
    const id = await addUnit();
    const results = await Promise.all(
      (["mechanic", "staff", "manager", "owner"] as const).map((role) =>
        shop.members[role].db
          .from("unit_blocks")
          .insert(block(id, hours(40), hours(50))),
      ),
    );
    const codes = results.map((r) => r.error?.code ?? "ok").sort();
    expect(codes).toEqual(["23P01", "23P01", "23P01", "ok"]);
  });

  it("refuses an empty, reversed or unbounded-start period", async () => {
    const id = await addUnit();
    for (const bad of [
      "empty",
      `[${hours(5).toISOString()},${hours(4).toISOString()})`,
      `[,${hours(4).toISOString()})`,
      `[${hours(4).toISOString()},${hours(5).toISOString()}]`,
    ]) {
      const { error } = await service
        .from("unit_blocks")
        .insert({ ...block(id, hours(1)), period: bad });
      expect(error, bad).not.toBeNull();
    }
  });
});

describe("selling or retiring a unit", () => {
  it("is refused while the unit has a future block, then allowed", async () => {
    for (const status of ["sold", "retired"] as const) {
      const id = await addUnit();
      const { data: future } = await service
        .from("unit_blocks")
        .insert(block(id, hours(48), hours(72), "allocation"))
        .select("id")
        .single();
      const refused = await shop.members.owner.db
        .from("units")
        .update({ status })
        .eq("id", id);
      expect(refused.error?.message, status).toBe("unit_has_future_blocks");
      // The service role is refused too: it's a rule, not a permission.
      const service2 = await service
        .from("units")
        .update({ status })
        .eq("id", id);
      expect(service2.error?.message).toBe("unit_has_future_blocks");

      await service.from("unit_blocks").delete().eq("id", future!.id);
      const allowed = await shop.members.owner.db
        .from("units")
        .update({ status })
        .eq("id", id)
        .select("status");
      expect(allowed.data, status).toEqual([{ status }]);

      // Gone from the fleet: no new blocks.
      const late = await shop.members.owner.db
        .from("unit_blocks")
        .insert(block(id, hours(100), hours(101)));
      expect(late.error?.message).toBe("unit_not_in_fleet");
    }
  });

  it("is refused by an open-ended downtime, and allowed by blocks in the past", async () => {
    const id = await addUnit();
    await service.from("unit_blocks").insert(block(id, hours(-48), hours(-24)));
    const { data: open } = await service
      .from("unit_blocks")
      .insert(block(id, hours(-1)))
      .select("id")
      .single();
    const refused = await service
      .from("units")
      .update({ status: "sold" })
      .eq("id", id);
    expect(refused.error?.message).toBe("unit_has_future_blocks");
    await service
      .from("unit_blocks")
      .update({ period: period(hours(-1), new Date(Date.now() - 1000)) })
      .eq("id", open!.id);
    const allowed = await service
      .from("units")
      .update({ status: "sold" })
      .eq("id", id);
    expect(allowed.error).toBeNull();
  });

  it("a unit with blocks or a model with units can't be deleted", async () => {
    const id = await addUnit();
    await service.from("unit_blocks").insert(block(id, hours(1), hours(2)));
    const unit = await shop.members.owner.db
      .from("units")
      .delete()
      .eq("id", id);
    expect(unit.error?.code).toBe("23503");
    const model = await shop.members.owner.db
      .from("models")
      .delete()
      .eq("id", modelId);
    expect(model.error?.code).toBe("23503");
  });
});

describe("units and models", () => {
  it("a plate is unique within a shop (any letter case) and free in another shop", async () => {
    const unit = (tenant: TestTenant, model: string, plate: string | null) =>
      service.from("units").insert({
        tenant_id: tenant.id,
        model_id: model,
        location_id: tenant.locationId,
        plate,
      });
    expect((await unit(shop, modelId, "1กข-1234")).error).toBeNull();
    expect((await unit(shop, modelId, " 1กข-1234 ")).error?.code).toBe("23505");
    expect((await unit(shop, modelId, "ab-77")).error).toBeNull();
    expect((await unit(shop, modelId, "AB-77")).error?.code).toBe("23505");
    const { data: otherModel } = await service
      .from("models")
      .insert({ tenant_id: other.id, catalog_id: catalogId, name: "Other" })
      .select("id")
      .single();
    expect((await unit(other, otherModel!.id, "AB-77")).error).toBeNull();
  });

  it("a unit without a plate needs the plate-pending flag", async () => {
    const row = {
      tenant_id: shop.id,
      model_id: modelId,
      location_id: shop.locationId,
    };
    const bare = await service.from("units").insert(row);
    expect(bare.error?.code).toBe("23514");
    const pending = await service
      .from("units")
      .insert([
        { ...row, plate_pending: true },
        { ...row, plate_pending: true },
      ])
      .select("qr_token");
    expect(pending.error).toBeNull();
    // Each unit gets its own sticker token.
    expect(new Set(pending.data!.map((u) => u.qr_token)).size).toBe(2);
  });

  it("several models may share a catalog entry, each with its own name", async () => {
    const add = (name: string) =>
      shop.members.manager.db
        .from("models")
        .insert({ tenant_id: shop.id, catalog_id: catalogId, name });
    expect((await add("With top box")).error).toBeNull();
    expect((await add("Without top box")).error).toBeNull();
    expect((await add(" with TOP box ")).error?.code).toBe("23505");
  });

  it("booking-mode counts can't exceed the model's active units", async () => {
    const { data: model } = await service
      .from("models")
      .insert({ tenant_id: shop.id, catalog_id: catalogId, name: "Counted" })
      .select("id")
      .single();
    await addUnit(shop, model!.id);
    await addUnit(shop, model!.id);
    const set = (values: object) =>
      shop.members.owner.db.from("models").update(values).eq("id", model!.id);
    expect(
      (await set({ instant_units: 1, request_units: 1 })).error,
    ).toBeNull();
    expect(
      (await set({ instant_units: 2, request_units: 1 })).error?.message,
    ).toBe("more_units_than_active");
    expect((await set({ ready_now: 3 })).error?.message).toBe(
      "more_units_than_active",
    );
  });
});

describe("money", () => {
  it("locks the shop's currency once any amount is stored", async () => {
    const fresh = await createTenant("fleet-money");
    try {
      const change = (currency: string) =>
        fresh.members.owner.db
          .from("tenants")
          .update({ currency })
          .eq("id", fresh.id)
          .select("currency");
      const locked = () =>
        fresh.members.staff.db.rpc("currency_locked", {
          p_tenant_id: fresh.id,
        });
      expect((await change("USD")).data).toEqual([{ currency: "USD" }]);
      expect((await locked()).data).toBe(false);

      const { data: model } = await service
        .from("models")
        .insert({ tenant_id: fresh.id, catalog_id: catalogId, name: "M" })
        .select("id")
        .single();
      const unitId = await addUnit(fresh, model!.id);
      await service.from("unit_financials").insert({
        tenant_id: fresh.id,
        unit_id: unitId,
        currency: "USD",
        purchase_price: 250_000,
      });

      expect((await locked()).data).toBe(true);
      expect((await change("EUR")).error?.message).toBe("currency_locked");
      const asService = await service
        .from("tenants")
        .update({ currency: "EUR" })
        .eq("id", fresh.id);
      expect(asService.error?.message).toBe("currency_locked");

      // Removing the money unlocks it again.
      await service.from("unit_financials").delete().eq("unit_id", unitId);
      expect((await change("EUR")).data).toEqual([{ currency: "EUR" }]);
    } finally {
      await deleteTenant(fresh);
    }
  });

  it("a deposit locks it too, and amounts are whole minor units", async () => {
    const withDeposit = await service
      .from("models")
      .insert({
        tenant_id: shop.id,
        catalog_id: catalogId,
        name: "Deposit",
        deposit: 200_000,
        deposit_currency: "THB",
      })
      .select("deposit")
      .single();
    expect(withDeposit.data).toEqual({ deposit: 200_000 });
    const change = await service
      .from("tenants")
      .update({ currency: "USD" })
      .eq("id", shop.id);
    expect(change.error?.message).toBe("currency_locked");
    const noCurrency = await service.from("models").insert({
      tenant_id: shop.id,
      catalog_id: catalogId,
      name: "No currency",
      deposit: 100,
    });
    expect(noCurrency.error?.code).toBe("23514");
    const fraction = await service.from("models").insert({
      tenant_id: shop.id,
      catalog_id: catalogId,
      name: "Fraction",
      deposit: 100.5 as number,
      deposit_currency: "THB",
    });
    expect(fraction.error).not.toBeNull();
    // Far past 32 bits: bigint.
    const big = await service
      .from("models")
      .insert({
        tenant_id: shop.id,
        catalog_id: catalogId,
        name: "Big",
        deposit: 9_000_000_000_000,
        deposit_currency: "THB",
      })
      .select("deposit")
      .single();
    expect(big.data).toEqual({ deposit: 9_000_000_000_000 });
  });
});

describe("locations", () => {
  it("every tenant is created with one default location in its time zone", async () => {
    const { data } = await service
      .from("locations")
      .select("is_default, timezone, name")
      .eq("tenant_id", other.id);
    expect(data).toEqual([
      { is_default: true, timezone: "Asia/Ho_Chi_Minh", name: "Test fleet-b" },
    ]);
  });

  it("a tenant can't be created without one", async () => {
    const { error } = await service.from("tenants").insert({
      name: "No location",
      slug: `no-location-${Date.now()}`,
      country: "TH",
      currency: "THB",
      locale: "th",
    });
    expect(error?.code).toBe("23514");
  });

  it("keeps exactly one default: no second, no deleting or unsetting it", async () => {
    const db = shop.members.owner.db;
    const second = await db.from("locations").insert({
      tenant_id: shop.id,
      name: "Airport",
      timezone: "Asia/Bangkok",
      is_default: true,
    });
    expect(second.error?.code).toBe("23505");
    const remove = await db
      .from("locations")
      .delete()
      .eq("id", shop.locationId);
    expect(remove.error?.message).toContain("default location");
    const unset = await db
      .from("locations")
      .update({ is_default: false })
      .eq("id", shop.locationId);
    expect(unset.error?.message).toContain("default location");

    // A second, non-default location is fine and can go again.
    const branch = await db
      .from("locations")
      .insert({
        tenant_id: shop.id,
        name: "Airport",
        timezone: "Europe/London",
      })
      .select("id")
      .single();
    expect(branch.error).toBeNull();
    const gone = await db
      .from("locations")
      .delete()
      .eq("id", branch.data!.id)
      .select("id");
    expect(gone.data).toHaveLength(1);
  });

  it("phones are international format only", async () => {
    const set = (phone: string) =>
      shop.members.owner.db
        .from("locations")
        .update({ phone })
        .eq("id", shop.locationId);
    expect((await set("+66850550247")).error).toBeNull();
    expect((await set("085 055 0247")).error?.code).toBe("23514");
  });
});

describe("catalog link", () => {
  const request = (db: Db, tenant: TestTenant, model: string) =>
    db.rpc("request_catalog_entry", {
      p_tenant_id: tenant.id,
      p_make: "Requested",
      p_model: model,
      p_year_from: 2024,
      p_year_to: null as unknown as number,
      p_type: "city_scooter",
      p_transmission: "automatic",
      p_cc: 110,
      p_note: "Please add",
    });

  it("a shop uses its own pending request; another shop can't; staff can't ask", async () => {
    const staff = await request(shop.members.staff.db, shop, "Staff ask");
    expect(staff.error?.code).toBe("42501");

    const { data: id, error } = await request(
      shop.members.manager.db,
      shop,
      `Mine ${Date.now()}`,
    );
    expect(error).toBeNull();
    extraCatalog.push(id!);

    const mine = await shop.members.manager.db
      .from("models")
      .insert({ tenant_id: shop.id, catalog_id: id!, name: "On my request" });
    expect(mine.error).toBeNull();
    const theirs = await other.members.owner.db
      .from("models")
      .insert({
        tenant_id: other.id,
        catalog_id: id!,
        name: "On their request",
      });
    expect(theirs.error?.message).toBe("catalog_entry_not_usable");

    // The requesting shop sees it; the other shop and the public don't.
    const seen = (db: Db) =>
      db.schema("public").from("bike_catalog").select("status").eq("id", id!);
    expect((await seen(shop.members.staff.db)).data).toEqual([
      { status: "requested" },
    ]);
    expect((await seen(other.members.owner.db)).data).toEqual([]);
  });

  it("only a platform admin approves or rejects, and approval opens it to every shop", async () => {
    const { data: id } = await request(
      shop.members.owner.db,
      shop,
      `Review ${Date.now()}`,
    );
    extraCatalog.push(id!);
    const review = (db: Db, approve: boolean) =>
      db.rpc("review_catalog_request", {
        p_catalog_id: id!,
        p_approve: approve,
        p_notes: "ok",
      });
    // A shop owner isn't a platform admin, whatever their marketplace role.
    expect((await review(shop.members.owner.db, true)).error?.code).toBe(
      "42501",
    );
    expect((await review(admin.db, true)).error).toBeNull();
    // Already reviewed: nothing left to review.
    expect((await review(admin.db, false)).error?.code).toBe("P0002");

    const theirs = await other.members.owner.db
      .from("models")
      .insert({ tenant_id: other.id, catalog_id: id!, name: "Now approved" });
    expect(theirs.error).toBeNull();
  });

  it("a rejected or unknown entry can't be used", async () => {
    const { data: id } = await request(
      shop.members.owner.db,
      shop,
      `Reject ${Date.now()}`,
    );
    extraCatalog.push(id!);
    await admin.db.rpc("review_catalog_request", {
      p_catalog_id: id!,
      p_approve: false,
    });
    const rejected = await shop.members.owner.db
      .from("models")
      .insert({ tenant_id: shop.id, catalog_id: id!, name: "Rejected" });
    expect(rejected.error?.message).toBe("catalog_entry_not_usable");
  });

  it("the catalog has a path for cars", async () => {
    const { data: types } = await shop.members.staff.db
      .schema("public")
      .from("vehicle_types")
      .select("key")
      .order("key");
    expect(types).toEqual([{ key: "car" }, { key: "motorbike" }]);
    const { data: entry } = await service
      .schema("public")
      .from("bike_catalog")
      .select("vehicle_type, specs")
      .eq("id", catalogId)
      .single();
    expect(entry).toEqual({ vehicle_type: "motorbike", specs: {} });
  });
});

describe("import", () => {
  const unit = (plate: string, extra: object = {}) => ({
    model_id: modelId,
    location_id: shop.locationId,
    plate,
    ...extra,
  });
  const count = async (table: "units" | "models" | "unit_financials") => {
    const { count } = await service
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", shop.id);
    return count;
  };

  it("saves models, units and purchase details together", async () => {
    const newModel = crypto.randomUUID();
    const { data, error } = await shop.members.manager.db.rpc("import_fleet", {
      p_tenant_id: shop.id,
      p_models: [{ id: newModel, catalog_id: catalogId, name: "Imported" }],
      p_units: [
        unit("IMP-1", {
          purchase_price: 9_500_000,
          purchase_date: "2026-01-10",
        }),
        { ...unit("IMP-2"), model_id: newModel, current_odometer_km: 1200.5 },
        { model_id: newModel, location_id: shop.locationId, plate: null },
      ],
    });
    expect(error).toBeNull();
    expect(data).toEqual({ models: 1, units: 3 });

    const { data: units } = await shop.members.owner.db
      .from("units")
      .select(
        "plate, plate_pending, current_odometer_km, unit_financials(purchase_price, currency)",
      )
      .in("plate", ["IMP-1", "IMP-2"])
      .order("plate");
    expect(units).toEqual([
      {
        plate: "IMP-1",
        plate_pending: false,
        current_odometer_km: 0,
        unit_financials: [{ purchase_price: 9_500_000, currency: "THB" }],
      },
      {
        plate: "IMP-2",
        plate_pending: false,
        current_odometer_km: 1200.5,
        unit_financials: [],
      },
    ]);
  });

  it("is all or nothing: one bad row and nothing is saved", async () => {
    const before = await Promise.all([
      count("units"),
      count("models"),
      count("unit_financials"),
    ]);
    const { error } = await shop.members.owner.db.rpc("import_fleet", {
      p_tenant_id: shop.id,
      p_models: [
        { id: crypto.randomUUID(), catalog_id: catalogId, name: "Half done" },
      ],
      p_units: [
        unit("ATOMIC-1", { purchase_price: 1 }),
        unit("ATOMIC-2"),
        // The same plate again breaks the unique rule.
        unit("atomic-1"),
      ],
    });
    expect(error?.code).toBe("23505");
    expect(
      await Promise.all([
        count("units"),
        count("models"),
        count("unit_financials"),
      ]),
    ).toEqual(before);
  });

  it("is for owners and managers only", async () => {
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const { error } = await shop.members[role].db.rpc("import_fleet", {
        p_tenant_id: shop.id,
        p_models: [],
        p_units: [unit(`NOPE-${role}`)],
      });
      expect(error?.code, role).toBe("42501");
    }
  });
});

describe("audit trail", () => {
  it("records who changed what, with only the changed columns", async () => {
    const id = await addUnit();
    await shop.members.mechanic.db
      .from("units")
      .update({ current_odometer_km: 321, status: "maintenance" })
      .eq("id", id);
    const { data } = await shop.members.owner.db
      .from("audit_events")
      .select("action, actor, before, after")
      .eq("entity", "units")
      .eq("entity_id", id)
      .order("id");
    expect(data).toHaveLength(2);
    expect(data![0]).toMatchObject({
      action: "insert",
      actor: null,
      before: null,
    });
    expect(data![1]).toEqual({
      action: "update",
      actor: shop.members.mechanic.id,
      before: { current_odometer_km: 0, status: "active" },
      after: { current_odometer_km: 321, status: "maintenance" },
    });
  });

  it("skips saves that change nothing, and records deletes and imports", async () => {
    const id = await addUnit();
    await service.from("units").update({ status: "active" }).eq("id", id);
    await shop.members.owner.db.from("units").delete().eq("id", id);
    const { data } = await service
      .from("audit_events")
      .select("action")
      .eq("entity_id", id)
      .order("id");
    expect(data?.map((e) => e.action)).toEqual(["insert", "delete"]);
    const imports = await service
      .from("audit_events")
      .select("after")
      .eq("tenant_id", shop.id)
      .eq("action", "import");
    expect(imports.data?.[0]?.after).toEqual({ models: 1, units: 3 });
  });

  it("can't be written, changed or removed by anyone signed in", async () => {
    const db = shop.members.owner.db;
    const forged = await db.from("audit_events").insert({
      tenant_id: shop.id,
      entity: "units",
      entity_id: "x",
      action: "forged",
    });
    expect(forged.error?.code).toBe("42501");
    const edit = await db
      .from("audit_events")
      .update({ action: "x" })
      .eq("tenant_id", shop.id);
    expect(edit.error?.code).toBe("42501");
    const remove = await db
      .from("audit_events")
      .delete()
      .eq("tenant_id", shop.id);
    expect(remove.error?.code).toBe("42501");
  });
});

describe("follow-ups (11 Nov 2026): removed fields, year bands, renewals, reminders", () => {
  it("has no borrowed status, first-registered date or borrowed window any more", async () => {
    const id = await addUnit();
    const borrowed = await service
      .from("units")
      .update({ status: "borrowed" })
      .eq("id", id);
    expect(borrowed.error?.code).toBe("23514");
    for (const column of ["first_registered", "active_from", "active_to"]) {
      const { error } = await service
        .from("units")
        .update({ [column]: "2026-01-01" } as never)
        .eq("id", id);
      expect(error, column).not.toBeNull();
    }
    const year = await service
      .from("units")
      .update({ model_year: 2024 })
      .eq("id", id)
      .select("model_year");
    expect(year.data).toEqual([{ model_year: 2024 }]);
    const bad = await service.from("units").update({ model_year: 1900 }).eq("id", id);
    expect(bad.error?.code).toBe("23514");
  });

  it("a lowered odometer is saved for staff and mechanics, and the audit log says who did it", async () => {
    const id = await addUnit();
    await service.from("units").update({ current_odometer_km: 5000 }).eq("id", id);
    const lowered = await shop.members.staff.db
      .from("units")
      .update({ current_odometer_km: 4200 })
      .eq("id", id)
      .select("current_odometer_km");
    expect(lowered.data).toEqual([{ current_odometer_km: 4200 }]);
    const { data } = await shop.members.owner.db
      .from("audit_events")
      .select("action, actor, before, after")
      .eq("entity", "units")
      .eq("entity_id", id)
      .order("id", { ascending: false })
      .limit(1);
    expect(data).toEqual([
      {
        action: "update",
        actor: shop.members.staff.id,
        before: { current_odometer_km: 5000 },
        after: { current_odometer_km: 4200 },
      },
    ]);
  });

  it("year bands: owners and managers edit; a year belongs to one band of a model", async () => {
    const band = (year_from: number, year_to: number) => ({
      tenant_id: shop.id,
      model_id: modelId,
      year_from,
      year_to,
    });
    const manager = shop.members.manager.db;
    expect((await manager.from("model_year_bands").insert(band(2020, 2023))).error).toBeNull();
    expect((await manager.from("model_year_bands").insert(band(2024, 2026))).error).toBeNull();
    const overlap = await manager.from("model_year_bands").insert(band(2023, 2025));
    expect(overlap.error?.code).toBe("23P01");
    const reversed = await manager.from("model_year_bands").insert(band(2019, 2014));
    expect(reversed.error?.code).toBe("23514");
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const { error } = await shop.members[role].db
        .from("model_year_bands")
        .insert(band(2010, 2012));
      expect(error?.code, role).toBe("42501");
      const { data } = await shop.members[role].db
        .from("model_year_bands")
        .select("year_from")
        .eq("model_id", modelId);
      expect(data, role).toHaveLength(2);
    }
  });

  it("renewals: everyone reads the dates, staff and mechanics record them, only owners and managers see the cost", async () => {
    const unitId = await addUnit();
    const renewal = (kind: string, expires_at: string) => ({
      tenant_id: shop.id,
      unit_id: unitId,
      kind,
      provider: "Test insurer",
      reference_no: "P-1",
      starts_at: "2026-01-01",
      expires_at,
    });
    const added = await shop.members.mechanic.db
      .from("unit_renewals")
      .insert(renewal("compulsory_insurance", "2026-12-31"))
      .select("id, recorded_by")
      .single();
    expect(added.error).toBeNull();
    expect(added.data?.recorded_by).toBe(shop.members.mechanic.id);
    const driver = await shop.members.driver.db
      .from("unit_renewals")
      .insert(renewal("road_tax", "2026-12-31"));
    expect(driver.error?.code).toBe("42501");
    const badKind = await shop.members.owner.db
      .from("unit_renewals")
      .insert(renewal("mot", "2026-12-31"));
    expect(badKind.error?.code).toBe("23514");
    const backwards = await shop.members.owner.db
      .from("unit_renewals")
      .insert(renewal("road_tax", "2025-06-01"));
    expect(backwards.error?.code).toBe("23514");

    const cost = {
      tenant_id: shop.id,
      renewal_id: added.data!.id,
      currency: "THB",
      cost: 64_500,
    };
    const byMechanic = await shop.members.mechanic.db
      .from("unit_renewal_costs")
      .insert(cost);
    expect(byMechanic.error?.code).toBe("42501");
    expect(
      (await shop.members.manager.db.from("unit_renewal_costs").insert(cost)).error,
    ).toBeNull();
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const dates = await shop.members[role].db
        .from("unit_renewals")
        .select("expires_at")
        .eq("unit_id", unitId);
      expect(dates.data, role).toEqual([{ expires_at: "2026-12-31" }]);
      const costs = await shop.members[role].db
        .from("unit_renewal_costs")
        .select("*");
      expect(costs.data, role).toEqual([]);
    }
    const seen = await shop.members.owner.db
      .from("unit_renewal_costs")
      .select("cost")
      .eq("renewal_id", added.data!.id);
    expect(seen.data).toEqual([{ cost: 64_500 }]);
    // Only owners and managers delete a record.
    const removed = await shop.members.mechanic.db
      .from("unit_renewals")
      .delete()
      .eq("id", added.data!.id)
      .select("id");
    expect(removed.data ?? []).toEqual([]);
  });

  it("reminder settings: owners and managers set them; the values are checked", async () => {
    const set = (db: Db, values: object) =>
      db.from("tenants").update(values).eq("id", shop.id).select("renewal_reminder_days, renewal_digest_day");
    const start = await service
      .from("tenants")
      .select("renewal_reminder_days, renewal_digest_day")
      .eq("id", shop.id)
      .single();
    expect(start.data).toEqual({
      renewal_reminder_days: [45, 30, 14, 7],
      renewal_digest_day: null,
    });
    const saved = await set(shop.members.manager.db, {
      renewal_reminder_days: [60, 10],
      renewal_digest_day: 1,
    });
    expect(saved.data).toEqual([
      { renewal_reminder_days: [60, 10], renewal_digest_day: 1 },
    ]);
    expect((await set(shop.members.staff.db, { renewal_digest_day: 5 })).data ?? []).toEqual([]);
    expect((await set(service, { renewal_reminder_days: [0] })).error?.code).toBe("23514");
    expect((await set(service, { renewal_reminder_days: [400] })).error?.code).toBe("23514");
    expect((await set(service, { renewal_digest_day: 31 })).error?.code).toBe("23514");
    await set(service, { renewal_reminder_days: [45, 30, 14, 7], renewal_digest_day: null });
  });
});

describe("renewal notifications are queued, once each, for a sender that doesn't exist yet", () => {
  let queue: TestTenant;
  let unitId: string;
  // "Now" for every call: noon UTC on 11 Nov 2026, which is 11 Nov in Bangkok too.
  const now = "2026-11-11T12:00:00Z";
  const run = async (at = now) => {
    const { data, error } = await service.rpc("queue_renewal_notifications", {
      p_now: at,
    });
    if (error) throw error;
    return data;
  };
  const outbox = async () => {
    const { data } = await service
      .from("notification_outbox")
      .select("kind, dedupe_key, status, payload")
      .eq("tenant_id", queue.id)
      .order("id");
    return data ?? [];
  };
  /** Runs the queue (it works through every shop) and counts what this shop gained. */
  const added = async (at = now) => {
    const before = (await outbox()).length;
    await run(at);
    return (await outbox()).length - before;
  };
  const addRenewal = async (unit: string, kind: string, expires_at: string) => {
    const { data, error } = await service
      .from("unit_renewals")
      .insert({ tenant_id: queue.id, unit_id: unit, kind, expires_at })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };

  beforeAll(async () => {
    queue = await createTenant("fleet-queue", {
      country: "TH",
      currency: "THB",
      locale: "th-TH",
      timezone: "Asia/Bangkok",
    });
    const { data: model } = await service
      .from("models")
      .insert({ tenant_id: queue.id, catalog_id: catalogId, name: "Queue" })
      .select("id")
      .single();
    unitId = await addUnit(queue, model!.id);
  }, 60_000);
  afterAll(async () => {
    await deleteTenant(queue);
  });

  it("queues the nearest reminder day reached, and nothing twice", async () => {
    // 30 days away: the 45 and 30 day reminders have both been reached; only 30 is queued.
    const insurance = await addRenewal(unitId, "compulsory_insurance", "2026-12-11");
    // 100 days away: nothing yet.
    await addRenewal(unitId, "road_tax", "2027-02-19");
    await run();
    const first = await outbox();
    expect(first.map((m) => [m.kind, m.dedupe_key, m.status])).toEqual([
      ["renewal_reminder", `renewal:${insurance}:30`, "queued"],
    ]);
    expect(first[0].payload).toMatchObject({
      renewal_kind: "compulsory_insurance",
      expires_at: "2026-12-11",
      days_before: 30,
      unit_id: unitId,
    });
    // Again the same hour, and the next day: nothing new.
    expect(await added()).toBe(0);
    expect(await added("2026-11-12T12:00:00Z")).toBe(0);
    // 14 days before: the next reminder.
    expect(await added("2026-11-27T12:00:00Z")).toBe(1);
    expect((await outbox()).map((m) => m.dedupe_key)).toEqual([
      `renewal:${insurance}:30`,
      `renewal:${insurance}:14`,
    ]);
  });

  it("uses the calendar date at the bike's location, not UTC", async () => {
    // 18:00 UTC on 26 Nov is already 27 Nov in Bangkok: the 14-day reminder
    // for 11 Dec is due there, though it is still 15 days away in UTC.
    const { data: model } = await service
      .from("models")
      .select("id")
      .eq("tenant_id", queue.id)
      .single();
    const unit = await addUnit(queue, model!.id);
    const id = await addRenewal(unit, "road_tax", "2026-12-11");
    await run("2026-11-11T12:00:00Z");
    expect(await added("2026-11-26T16:00:00Z")).toBe(0); // 23:00 in Bangkok, still the 26th
    expect(await added("2026-11-26T18:00:00Z")).toBe(1); // 01:00 on the 27th
    expect((await outbox()).map((m) => m.dedupe_key)).toContain(`renewal:${id}:14`);
  });

  it("queues 'expired' once, only for the current record, and never for a sold bike", async () => {
    const { data: model } = await service
      .from("models")
      .select("id")
      .eq("tenant_id", queue.id)
      .single();
    const lapsed = await addUnit(queue, model!.id);
    const renewed = await addUnit(queue, model!.id);
    const sold = await addUnit(queue, model!.id);
    const lapsedId = await addRenewal(lapsed, "road_tax", "2026-11-08");
    // Renewed: the old record has passed, but a newer one is current.
    await addRenewal(renewed, "road_tax", "2026-11-01");
    await addRenewal(renewed, "road_tax", "2027-11-01");
    await addRenewal(sold, "road_tax", "2026-11-01");
    await service.from("units").update({ status: "sold" }).eq("id", sold);

    await run();
    await run();
    const expired = (await outbox()).filter((m) => m.kind === "renewal_expired");
    expect(expired.map((m) => m.dedupe_key)).toEqual([`renewal:${lapsedId}:expired`]);
  });

  it("queues the monthly digest from the chosen day, once, listing that month", async () => {
    expect((await outbox()).filter((m) => m.kind === "renewal_digest")).toEqual([]);
    await service.from("tenants").update({ renewal_digest_day: 15 }).eq("id", queue.id);
    // The 11th: too early. The 15th: queued. The 20th: not again.
    expect(await added("2026-11-11T12:00:00Z")).toBe(0);
    expect(await added("2026-11-15T12:00:00Z")).toBeGreaterThan(0);
    await run("2026-11-20T12:00:00Z");
    const digests = (await outbox()).filter((m) => m.kind === "renewal_digest");
    expect(digests.map((m) => m.dedupe_key)).toEqual(["digest:2026-11"]);
    const items = (digests[0].payload as { items: { expires_at: string }[] }).items;
    // Only what expires in November 2026 (the lapsed road tax of 8 Nov).
    expect(items.map((i) => i.expires_at)).toEqual(["2026-11-08"]);
    // December gets its own.
    await run("2026-12-15T12:00:00Z");
    expect(
      (await outbox())
        .filter((m) => m.kind === "renewal_digest")
        .map((m) => m.dedupe_key),
    ).toEqual(["digest:2026-11", "digest:2026-12"]);
  });

  it("is readable by owners and managers only, written by nobody signed in, and not callable", async () => {
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const { data } = await queue.members[role].db
        .from("notification_outbox")
        .select("id");
      expect(data, role).toEqual([]);
    }
    const owner = queue.members.owner.db;
    expect((await owner.from("notification_outbox").select("id")).data?.length).toBeGreaterThan(0);
    const forged = await owner.from("notification_outbox").insert({
      tenant_id: queue.id,
      kind: "renewal_digest",
      dedupe_key: "forged",
      payload: {},
    });
    expect(forged.error?.code).toBe("42501");
    const call = await owner.rpc("queue_renewal_notifications", { p_now: now });
    expect(call.error?.code).toBe("42501");
  });
});
