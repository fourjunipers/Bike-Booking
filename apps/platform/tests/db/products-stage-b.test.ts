/**
 * Products, stage B (migration 20261113000300): general products. Unit rules
 * per type, the lost status, quantities, damaged and lost, the stock ledger
 * for items for sale, the manual order, and changing or disconnecting a
 * product's Moto Mangos list entry. Every rule is tried by role and across
 * two shops.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Role } from "@/lib/roles";
import {
  anonClient,
  createCatalogEntry,
  createTenant,
  deleteTenant,
  hours,
  period,
  removeCatalogEntry,
  serviceClient,
  type Db,
  type TestTenant,
} from "./helpers";

let shop: TestTenant;
let other: TestTenant;
let presetA: string;
let presetB: string;
const service = serviceClient();
const tag = Math.random().toString(36).slice(2, 8);
let counter = 0;
const name = (what: string) => `${what} ${tag} ${++counter}`;

const db = (role: Role, tenant: TestTenant = shop): Db =>
  tenant.members[role].db;

/** A general product, made the way the create page makes it. */
async function general(
  type: "gear" | "sale_item" | "service",
  quantity = 0,
  options: { track?: boolean; tenant?: TestTenant } = {},
): Promise<string> {
  const tenant = options.tenant ?? shop;
  const { data, error } = await db("owner", tenant).rpc(
    "create_general_product",
    {
      p_tenant_id: tenant.id,
      p_type: type,
      p_name: name(type),
      p_track_units: options.track ?? false,
      p_quantities: [{ location_id: tenant.locationId, quantity }],
    },
  );
  if (error) throw error;
  return data;
}

async function vehicle(tenant: TestTenant = shop, extra: object = {}) {
  const { data, error } = await db("owner", tenant)
    .from("products")
    .insert({
      tenant_id: tenant.id,
      name: name("Bike"),
      vehicle_type: "motorbike",
      categories: ["city_scooter"],
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** What the Stock tab shows for one product. */
async function stock(productId: string, tenant: TestTenant = shop) {
  const { data, error } = await db("owner", tenant).rpc("product_stock", {
    p_tenant_id: tenant.id,
  });
  if (error) throw error;
  const row = data.find((r) => r.product_id === productId);
  return {
    in_stock: row?.in_stock ?? 0,
    damaged: row?.damaged ?? 0,
    lost: row?.lost ?? 0,
    available: row?.available ?? 0,
  };
}

const unitsOf = async (productId: string) => {
  const { data, error } = await service
    .from("units")
    .select("id, status, label, product_type, plate")
    .eq("product_id", productId)
    .order("created_at");
  if (error) throw error;
  return data;
};

const setQuantity = (role: Role, productId: string, quantity: number) =>
  db(role).rpc("set_stock_quantity", {
    p_product_id: productId,
    p_location_id: shop.locationId,
    p_quantity: quantity,
  });
const damaged = (role: Role, productId: string, quantity: number) =>
  db(role).rpc("mark_units_damaged", {
    p_product_id: productId,
    p_location_id: shop.locationId,
    p_quantity: quantity,
  });
const repaired = (role: Role, productId: string, quantity: number) =>
  db(role).rpc("mark_units_repaired", {
    p_product_id: productId,
    p_location_id: shop.locationId,
    p_quantity: quantity,
  });
const lost = (role: Role, productId: string, quantity: number) =>
  db(role).rpc("mark_units_lost", {
    p_product_id: productId,
    p_location_id: shop.locationId,
    p_quantity: quantity,
  });
const resolveLost = (
  role: Role,
  productId: string,
  quantity: number,
  action: "restore" | "remove",
) =>
  db(role).rpc("resolve_lost_units", {
    p_product_id: productId,
    p_location_id: shop.locationId,
    p_quantity: quantity,
    p_action: action,
  });

beforeAll(async () => {
  [shop, other, presetA, presetB] = await Promise.all([
    createTenant("stage-b"),
    createTenant("stage-b-other"),
    createCatalogEntry("stage-b-a"),
    createCatalogEntry("stage-b-b"),
  ]);
}, 120_000);

afterAll(async () => {
  await Promise.all([deleteTenant(shop), deleteTenant(other)]);
  await Promise.all([removeCatalogEntry(presetA), removeCatalogEntry(presetB)]);
});

describe("unit rules per type", () => {
  it("a gear unit is a nameless row: no plate, plate pending, frame, engine, year or odometer", async () => {
    const helmet = await general("gear", 2);
    const units = await unitsOf(helmet);
    expect(units).toHaveLength(2);
    for (const unit of units)
      expect(unit).toMatchObject({
        product_type: "gear",
        plate: null,
        label: null,
        status: "active",
      });
    const base = {
      tenant_id: shop.id,
      product_id: helmet,
      product_type: "gear",
      location_id: shop.locationId,
    };
    for (const extra of [
      { plate: "GEAR-1" },
      { plate_pending: true },
      { frame_number: "F1" },
      { engine_number: "E1" },
      { model_year: 2024 },
      { current_odometer_km: 5 },
    ]) {
      const { error } = await db("owner")
        .from("units")
        .insert({ ...base, ...extra });
      expect(error?.message, JSON.stringify(extra)).toContain(
        "units_gear_fields_check",
      );
    }
  });

  it("a vehicle unit keeps its rule and takes no label", async () => {
    const bike = await vehicle();
    const unit = {
      tenant_id: shop.id,
      product_id: bike,
      location_id: shop.locationId,
    };
    const noPlate = await db("owner").from("units").insert(unit);
    expect(noPlate.error?.message).toContain("units_check");
    const labelled = await db("owner")
      .from("units")
      .insert({ ...unit, plate: name("PL"), label: "Mine" });
    expect(labelled.error?.message).toContain("units_check");
    const fine = await db("owner")
      .from("units")
      .insert({ ...unit, plate: name("PL") });
    expect(fine.error).toBeNull();
  });

  it("a service and an item for sale have no units, and no quantity for a service", async () => {
    const cover = await general("service");
    const sticker = await general("sale_item", 5);
    for (const [id, type] of [
      [cover, "service"],
      [sticker, "sale_item"],
    ]) {
      const { error } = await service.from("units").insert({
        tenant_id: shop.id,
        product_id: id,
        product_type: type,
        location_id: shop.locationId,
      });
      expect(error, type).not.toBeNull();
    }
    expect(await unitsOf(sticker)).toEqual([]);
    const { error } = await setQuantity("owner", cover, 3);
    expect(error?.message).toContain("no_stock_for_type");
  });

  it("only tracked gear has labels, and no two alike in one product", async () => {
    const counted = await general("gear", 1);
    const [unit] = await unitsOf(counted);
    const onCounted = await db("owner")
      .from("units")
      .update({ label: "Helmet 1" })
      .eq("id", unit.id)
      .select("id");
    expect(onCounted.error?.message).toContain("label_needs_tracking");

    const camera = await general("gear", 3, { track: true });
    const [one, two, three] = await unitsOf(camera);
    // Optional: a tracked unit may stay unlabelled.
    expect(three.label).toBeNull();
    const first = await db("owner")
      .from("units")
      .update({ label: "GoPro 1" })
      .eq("id", one.id)
      .select("id");
    expect(first.error).toBeNull();
    const twin = await db("owner")
      .from("units")
      .update({ label: "gopro1" })
      .eq("id", two.id)
      .select("id");
    expect(twin.error?.message).toContain("units_label_idx");
    // Staff don't rename units.
    const byStaff = await db("staff")
      .from("units")
      .update({ label: "Staff's" })
      .eq("id", two.id)
      .select("id");
    expect(byStaff.error?.message).toContain("only_owner_or_manager");
  });

  it("a general product stores no buffers and no deposit", async () => {
    const helmet = await general("gear");
    for (const change of [
      { buffer_before_minutes: 30 },
      { buffer_after_minutes: 30 },
      { deposit: 1000, deposit_currency: shop.currency },
    ]) {
      const { error } = await db("owner")
        .from("products")
        .update(change)
        .eq("id", helmet)
        .select("id");
      expect(error?.message, JSON.stringify(change)).toContain(
        "products_general_fields_check",
      );
    }
    // A vehicle still takes them.
    const bike = await vehicle(shop, { buffer_before_minutes: 30 });
    expect(bike).toBeTruthy();
  });

  it("switching counted and tracked keeps the units and their blocks; going back clears labels", async () => {
    const camera = await general("gear", 2);
    expect((await damaged("staff", camera, 1)).error).toBeNull();
    const before = await unitsOf(camera);
    const toTracked = await db("owner")
      .from("products")
      .update({ tracking: "unit" })
      .eq("id", camera)
      .select("id");
    expect(toTracked.error).toBeNull();
    await db("owner")
      .from("units")
      .update({ label: "Cam A" })
      .eq("id", before[0].id);
    expect((await unitsOf(camera)).map((u) => u.id).sort()).toEqual(
      before.map((u) => u.id).sort(),
    );
    expect((await stock(camera)).damaged).toBe(1);

    const back = await db("owner")
      .from("products")
      .update({ tracking: "bulk" })
      .eq("id", camera)
      .select("id");
    expect(back.error).toBeNull();
    expect((await unitsOf(camera)).every((u) => u.label === null)).toBe(true);
    expect(await stock(camera)).toMatchObject({ in_stock: 2, damaged: 1 });
    // Staff can't switch it; nothing but counted and tracked is accepted.
    const byStaff = await db("staff")
      .from("products")
      .update({ tracking: "unit" })
      .eq("id", camera)
      .select("id");
    expect(byStaff.data ?? []).toEqual([]);
    const odd = await db("owner")
      .from("products")
      .update({ tracking: "none" })
      .eq("id", camera)
      .select("id");
    expect(odd.error?.message).toContain("products_type_tracking_check");
  });
});

describe("quantity", () => {
  it("is raised and lowered by owners and managers, with one audit line each time", async () => {
    const helmet = await general("gear", 20);
    expect(await stock(helmet)).toEqual({
      in_stock: 20,
      damaged: 0,
      lost: 0,
      available: 20,
    });
    expect((await setQuantity("manager", helmet, 25)).data).toEqual({
      from: 20,
      to: 25,
    });
    expect((await setQuantity("owner", helmet, 18)).error).toBeNull();
    expect((await stock(helmet)).in_stock).toBe(18);
    expect(await unitsOf(helmet)).toHaveLength(18);

    const { data: events } = await service
      .from("audit_events")
      .select("action, before, after")
      .eq("entity", "products")
      .eq("entity_id", helmet)
      .eq("action", "stock_adjust")
      .order("id");
    expect(events!.map((e) => [e.before, e.after])).toEqual([
      [
        { quantity: 0, location_id: shop.locationId },
        { quantity: 20, location_id: shop.locationId },
      ],
      [
        { quantity: 20, location_id: shop.locationId },
        { quantity: 25, location_id: shop.locationId },
      ],
      [
        { quantity: 25, location_id: shop.locationId },
        { quantity: 18, location_id: shop.locationId },
      ],
    ]);
  });

  it("is refused to staff, mechanics, drivers and another shop's owner", async () => {
    const helmet = await general("gear", 4);
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const { error } = await setQuantity(role, helmet, 9);
      expect(error?.code, role).toBe("42501");
    }
    const outsider = await db("owner", other).rpc("set_stock_quantity", {
      p_product_id: helmet,
      p_location_id: shop.locationId,
      p_quantity: 9,
    });
    expect(outsider.error?.code).toBe("42501");
    const signedOut = await anonClient().rpc("set_stock_quantity", {
      p_product_id: helmet,
      p_location_id: shop.locationId,
      p_quantity: 9,
    });
    expect(signedOut.error).not.toBeNull();
    // Staff can't add a unit row by hand either.
    const byHand = await db("staff").from("units").insert({
      tenant_id: shop.id,
      product_id: helmet,
      product_type: "gear",
      location_id: shop.locationId,
    });
    expect(byHand.error).not.toBeNull();
    expect((await stock(helmet)).in_stock).toBe(4);
  });

  it("has limits: none below zero, 1,000 of one gear product in one place, a location of the shop", async () => {
    const helmet = await general("gear", 1);
    expect((await setQuantity("owner", helmet, -1)).error?.message).toContain(
      "quantity_out_of_range",
    );
    expect((await setQuantity("owner", helmet, 1001)).error?.message).toContain(
      "quantity_out_of_range",
    );
    const elsewhere = await db("owner").rpc("set_stock_quantity", {
      p_product_id: helmet,
      p_location_id: other.locationId,
      p_quantity: 2,
    });
    expect(elsewhere.error?.message).toContain("location_not_found");
  });

  it("can't be lowered below the units that are blocked, and says how low it can go", async () => {
    const helmet = await general("gear", 5);
    expect((await damaged("staff", helmet, 3)).error).toBeNull();
    const tooLow = await setQuantity("owner", helmet, 2);
    expect(tooLow.error?.message).toContain("units_blocked");
    expect(tooLow.error?.details).toBe("3");
    expect((await stock(helmet)).in_stock).toBe(5);
    // Down to the blocked ones is fine: the free units go.
    expect((await setQuantity("owner", helmet, 3)).error).toBeNull();
    expect(await stock(helmet)).toMatchObject({ in_stock: 3, damaged: 3 });
  });

  it("retires a unit that has bookings on record instead of deleting it", async () => {
    const helmet = await general("gear", 1);
    const [unit] = await unitsOf(helmet);
    const past = await service.from("unit_blocks").insert({
      tenant_id: shop.id,
      unit_id: unit.id,
      kind: "allocation",
      period: period(hours(-48), hours(-24)),
    });
    expect(past.error).toBeNull();
    expect((await setQuantity("owner", helmet, 0)).error).toBeNull();
    expect(await unitsOf(helmet)).toMatchObject([
      { id: unit.id, status: "retired" },
    ]);
    expect((await stock(helmet)).in_stock).toBe(0);
  });
});

describe("damaged and lost", () => {
  it("staff and mechanics mark gear damaged and back in use; a driver can't", async () => {
    const helmet = await general("gear", 6);
    expect((await damaged("staff", helmet, 2)).error).toBeNull();
    expect((await damaged("mechanic", helmet, 1)).error).toBeNull();
    expect((await damaged("driver", helmet, 1)).error?.code).toBe("42501");
    expect(await stock(helmet)).toEqual({
      in_stock: 6,
      damaged: 3,
      lost: 0,
      available: 3,
    });
    const tooMany = await damaged("staff", helmet, 4);
    expect(tooMany.error?.message).toContain("not_enough_free");
    expect(tooMany.error?.details).toBe("3");
    expect((await repaired("mechanic", helmet, 2)).error).toBeNull();
    expect(await stock(helmet)).toMatchObject({ damaged: 1, available: 5 });
    expect((await repaired("staff", helmet, 2)).error?.message).toContain(
      "not_enough_damaged",
    );
  });

  it("owners, managers and staff mark gear lost; a mechanic and a driver are refused", async () => {
    const helmet = await general("gear", 20);
    expect((await lost("staff", helmet, 1)).error).toBeNull();
    expect((await lost("manager", helmet, 1)).error).toBeNull();
    for (const role of ["mechanic", "driver"] as const) {
      const { error } = await lost(role, helmet, 1);
      expect(error?.code, role).toBe("42501");
    }
    // "18 in stock, 2 lost".
    expect(await stock(helmet)).toEqual({
      in_stock: 18,
      damaged: 0,
      lost: 2,
      available: 18,
    });
    // Directly on the row, the guard says the same.
    const [unit] = (await unitsOf(helmet)).filter((u) => u.status === "active");
    const byMechanic = await db("mechanic")
      .from("units")
      .update({ status: "lost" })
      .eq("id", unit.id)
      .select("id");
    expect(byMechanic.error?.code).toBe("42501");
    const byStaff = await db("staff")
      .from("units")
      .update({ status: "lost" })
      .eq("id", unit.id)
      .select("id");
    expect(byStaff.data).toHaveLength(1);
  });

  it("only an owner or manager restores or removes a lost unit", async () => {
    const helmet = await general("gear", 5);
    expect((await lost("staff", helmet, 3)).error).toBeNull();
    const lostUnit = (await unitsOf(helmet)).find((u) => u.status === "lost")!;
    for (const role of ["staff", "mechanic", "driver"] as const) {
      for (const action of ["restore", "remove"] as const) {
        const { error } = await resolveLost(role, helmet, 1, action);
        expect(error?.code, `${role} ${action}`).toBe("42501");
      }
      const back = await db(role)
        .from("units")
        .update({ status: "active" })
        .eq("id", lostUnit.id)
        .select("id");
      expect(back.data ?? [], `${role} restoring by hand`).toEqual([]);
      const gone = await db(role)
        .from("units")
        .delete()
        .eq("id", lostUnit.id)
        .select("id");
      expect(gone.data ?? [], `${role} deleting by hand`).toEqual([]);
    }
    expect(await stock(helmet)).toMatchObject({ in_stock: 2, lost: 3 });

    expect(
      (await resolveLost("manager", helmet, 1, "restore")).error,
    ).toBeNull();
    expect(await stock(helmet)).toMatchObject({ in_stock: 3, lost: 2 });
    expect((await resolveLost("owner", helmet, 2, "remove")).error).toBeNull();
    expect(await stock(helmet)).toMatchObject({ in_stock: 3, lost: 0 });
    expect(await unitsOf(helmet)).toHaveLength(3);
    expect(
      (await resolveLost("owner", helmet, 1, "remove")).error?.message,
    ).toContain("not_enough_lost");
  });

  it("a lost unit ends its downtime, takes no new block, and a booked unit can't be lost", async () => {
    const helmet = await general("gear", 1);
    const [unit] = await unitsOf(helmet);
    expect((await damaged("staff", helmet, 1)).error).toBeNull();
    // The only unit is damaged: it is the one that is lost, and its downtime ends.
    expect((await lost("staff", helmet, 1)).error).toBeNull();
    expect(await stock(helmet)).toEqual({
      in_stock: 0,
      damaged: 0,
      lost: 1,
      available: 0,
    });
    const block = await db("staff")
      .from("unit_blocks")
      .insert({
        tenant_id: shop.id,
        unit_id: unit.id,
        kind: "downtime",
        period: period(hours(1), hours(2)),
      });
    expect(block.error?.message).toContain("unit_not_in_fleet");

    const booked = await general("gear", 1);
    const [bookedUnit] = await unitsOf(booked);
    await service.from("unit_blocks").insert({
      tenant_id: shop.id,
      unit_id: bookedUnit.id,
      kind: "allocation",
      period: period(hours(1), hours(5)),
    });
    const refused = await lost("owner", booked, 1);
    expect(refused.error?.message).toContain("units_blocked");
    const byHand = await db("owner")
      .from("units")
      .update({ status: "lost" })
      .eq("id", bookedUnit.id)
      .select("id");
    expect(byHand.error?.message).toContain("unit_has_future_blocks");
  });

  it("a vehicle's status rules for staff and mechanics are as they were", async () => {
    const bike = await vehicle();
    const { data: unit } = await db("owner")
      .from("units")
      .insert({
        tenant_id: shop.id,
        product_id: bike,
        location_id: shop.locationId,
        plate: name("PL"),
      })
      .select("id")
      .single();
    for (const role of ["staff", "mechanic"] as const) {
      const toWorkshop = await db(role)
        .from("units")
        .update({ status: "maintenance" })
        .eq("id", unit!.id)
        .select("id");
      expect(toWorkshop.data, role).toHaveLength(1);
      const sold = await db(role)
        .from("units")
        .update({ status: "sold" })
        .eq("id", unit!.id)
        .select("id");
      expect(sold.error?.message, role).toContain("only_owner_or_manager");
      await db(role)
        .from("units")
        .update({ status: "active" })
        .eq("id", unit!.id);
    }
  });
});

describe("items for sale: the stock ledger", () => {
  it("counts what is on hand as the sum of its rows", async () => {
    const sticker = await general("sale_item", 50);
    expect((await setQuantity("owner", sticker, 45)).error).toBeNull();
    expect((await setQuantity("manager", sticker, 60)).error).toBeNull();
    const { data: rows } = await service
      .from("stock_movements")
      .select("kind, quantity, created_by")
      .eq("product_id", sticker)
      .order("created_at");
    expect(rows!.map((r) => [r.kind, r.quantity])).toEqual([
      ["received", 50],
      ["adjusted", -5],
      ["adjusted", 15],
    ]);
    expect(rows!.map((r) => r.created_by)).toEqual([
      shop.members.owner.id,
      shop.members.owner.id,
      shop.members.manager.id,
    ]);
    expect(await stock(sticker)).toEqual({
      in_stock: 60,
      damaged: 0,
      lost: 0,
      available: 60,
    });
  });

  it("is append-only, never below zero, and records who really did it", async () => {
    const sticker = await general("sale_item", 10);
    const row = {
      tenant_id: shop.id,
      product_id: sticker,
      location_id: shop.locationId,
    };
    const changed = await db("owner")
      .from("stock_movements")
      .update({ quantity: 999 } as never)
      .eq("product_id", sticker)
      .select("id");
    expect(changed.error).not.toBeNull();
    const removed = await db("owner")
      .from("stock_movements")
      .delete()
      .eq("product_id", sticker)
      .select("id");
    expect(removed.error).not.toBeNull();

    const below = await db("owner")
      .from("stock_movements")
      .insert({ ...row, kind: "adjusted", quantity: -11 });
    expect(below.error?.message).toContain("stock_below_zero");
    // Selling comes with orders: not from the API.
    const sold = await db("owner")
      .from("stock_movements")
      .insert({ ...row, kind: "sold", quantity: -1 });
    expect(sold.error).not.toBeNull();
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const { error } = await db(role)
        .from("stock_movements")
        .insert({ ...row, kind: "received", quantity: 5 });
      expect(error, role).not.toBeNull();
    }
    const forged = await db("manager")
      .from("stock_movements")
      .insert({
        ...row,
        kind: "received",
        quantity: 5,
        created_by: shop.members.owner.id,
      })
      .select("created_by")
      .single();
    expect(forged.data?.created_by).toBe(shop.members.manager.id);
    expect((await stock(sticker)).in_stock).toBe(15);
  });

  it("holds its product while there is stock; at zero the product and its ledger go", async () => {
    const sticker = await general("sale_item", 3);
    const held = await db("owner")
      .from("products")
      .delete()
      .eq("id", sticker)
      .select("id");
    expect(held.error?.message).toContain("product_has_stock");
    expect((await setQuantity("owner", sticker, 0)).error).toBeNull();
    const gone = await db("owner")
      .from("products")
      .delete()
      .eq("id", sticker)
      .select("id");
    expect(gone.data).toHaveLength(1);
    const { data: left } = await service
      .from("stock_movements")
      .select("id")
      .eq("product_id", sticker);
    expect(left).toEqual([]);
  });
});

describe("races", () => {
  const expected =
    /units_blocked|unit_not_in_fleet|unit_blocks_tenant_id_unit_id_fkey|violates foreign key/;

  it("twelve writers: six lower the quantity while six block units, and nothing is left half done", async () => {
    for (let round = 0; round < 3; round++) {
      const helmet = await general("gear", 12);
      const units = await unitsOf(helmet);
      const results = await Promise.all([
        ...units.slice(0, 6).map((unit) =>
          db("staff")
            .from("unit_blocks")
            .insert({
              tenant_id: shop.id,
              unit_id: unit.id,
              kind: "downtime",
              period: period(hours(1), hours(3)),
            })
            .then((r) => ({ what: "block", unit: unit.id, error: r.error })),
        ),
        ...Array.from({ length: 6 }, () =>
          setQuantity("owner", helmet, 6).then((r) => ({
            what: "lower",
            unit: "",
            error: r.error,
          })),
        ),
      ]);
      // Every refusal is a clean, known one: no deadlock, no half-written row.
      for (const result of results)
        if (result.error)
          expect(result.error.message, result.what).toMatch(expected);

      const after = await unitsOf(helmet);
      const { data: blocks } = await service
        .from("unit_blocks")
        .select("unit_id")
        .in(
          "unit_id",
          units.map((u) => u.id),
        );
      const blocked = new Set(blocks!.map((b) => b.unit_id));
      const inStock = after.filter((u) => u.status === "active");
      // Every block that was saved is on a unit that is still in stock.
      for (const id of blocked) expect(inStock.map((u) => u.id)).toContain(id);
      // A block that reported success is really there.
      for (const result of results)
        if (result.what === "block" && !result.error)
          expect(blocked.has(result.unit)).toBe(true);
      // The quantity is what one of the writers asked for, or untouched.
      const lowered = results.some((r) => r.what === "lower" && !r.error);
      expect(inStock).toHaveLength(lowered ? 6 : 12);
      expect((await stock(helmet)).in_stock).toBe(inStock.length);
    }
  }, 120_000);

  it("two people setting different quantities at once end on one of them, with rows to match", async () => {
    const helmet = await general("gear", 2);
    const results = await Promise.all([
      setQuantity("owner", helmet, 9),
      setQuantity("manager", helmet, 5),
      setQuantity("owner", helmet, 9),
      setQuantity("manager", helmet, 5),
    ]);
    for (const result of results) expect(result.error).toBeNull();
    const count = (await unitsOf(helmet)).length;
    expect([5, 9]).toContain(count);
    expect((await stock(helmet)).in_stock).toBe(count);
  });

  it("twelve staff marking the last free helmet damaged: one does, eleven are told there is none", async () => {
    const helmet = await general("gear", 1);
    const results = await Promise.all(
      Array.from({ length: 12 }, () => damaged("staff", helmet, 1)),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    for (const result of results)
      if (result.error)
        expect(result.error.message).toContain("not_enough_free");
    expect(await stock(helmet)).toMatchObject({ damaged: 1, available: 0 });
  });
});

describe("manual order", () => {
  const order = async (tenant: TestTenant) => {
    const { data, error } = await service
      .from("products")
      .select("id, sort_position")
      .eq("tenant_id", tenant.id)
      .order("sort_position", { nullsFirst: false })
      .order("name");
    if (error) throw error;
    return data;
  };
  const move = (
    role: Role,
    product: string,
    target: string,
    place: "before" | "after",
    current?: string[],
    tenant: TestTenant = lane,
  ) =>
    db(role, tenant).rpc("move_product", {
      p_product_id: product,
      p_target_id: target,
      p_place: place,
      p_current_order: current,
    });
  let lane: TestTenant;
  let rival: TestTenant;
  let ids: string[];

  beforeAll(async () => {
    [lane, rival] = await Promise.all([
      createTenant("order-a"),
      createTenant("order-b"),
    ]);
    // Two vehicles and two general products: they share the one order.
    ids = [
      await vehicle(lane),
      await general("gear", 0, { tenant: lane }),
      await vehicle(lane),
      await general("service", 0, { tenant: lane }),
    ];
    await vehicle(rival);
    await vehicle(rival);
  }, 120_000);

  afterAll(async () => {
    await Promise.all([deleteTenant(lane), deleteTenant(rival)]);
  });

  it("starts as A to Z: no product has a position, and a new one gets none", async () => {
    expect((await order(lane)).every((p) => p.sort_position === null)).toBe(
      true,
    );
  });

  it("is refused to staff, mechanics, drivers, another shop's owner and signed-out visitors", async () => {
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const { error } = await move(role, ids[0], ids[1], "after", ids);
      expect(error?.code, role).toBe("42501");
      const reset = await db(role, lane).rpc("reset_product_order", {
        p_tenant_id: lane.id,
      });
      expect(reset.error?.code, role).toBe("42501");
    }
    const outsider = await move("owner", ids[0], ids[1], "after", ids, rival);
    expect(outsider.error?.code).toBe("42501");
    const reset = await db("owner", rival).rpc("reset_product_order", {
      p_tenant_id: lane.id,
    });
    expect(reset.error?.code).toBe("42501");
    const signedOut = await anonClient().rpc("move_product", {
      p_product_id: ids[0],
      p_target_id: ids[1],
      p_place: "after",
    });
    expect(signedOut.error).not.toBeNull();
    // Staff can't write the position by hand either.
    const byHand = await db("staff", lane)
      .from("products")
      .update({ sort_position: 1 })
      .eq("id", ids[0])
      .select("id");
    expect(byHand.data ?? []).toEqual([]);
    expect((await order(lane)).every((p) => p.sort_position === null)).toBe(
      true,
    );
  });

  it("the first move saves the order on screen with the one change, for every product", async () => {
    // On screen: 0, 1, 2, 3. "Move down" on the first.
    expect(
      (await move("owner", ids[0], ids[1], "after", ids)).error,
    ).toBeNull();
    expect(await order(lane)).toEqual([
      { id: ids[1], sort_position: 1 },
      { id: ids[0], sort_position: 2 },
      { id: ids[2], sort_position: 3 },
      { id: ids[3], sort_position: 4 },
    ]);
  });

  it("is kept, and later moves need no order from the caller", async () => {
    // "Move up" on the last, by a manager; a stale order sent with it is ignored.
    expect(
      (await move("manager", ids[3], ids[2], "before", [...ids].reverse()))
        .error,
    ).toBeNull();
    expect((await order(lane)).map((p) => p.id)).toEqual([
      ids[1],
      ids[0],
      ids[3],
      ids[2],
    ]);
    // Over several lines at once (what a drag will ask for).
    expect((await move("owner", ids[2], ids[1], "before")).error).toBeNull();
    expect(await order(lane)).toEqual([
      { id: ids[2], sort_position: 1 },
      { id: ids[1], sort_position: 2 },
      { id: ids[0], sort_position: 3 },
      { id: ids[3], sort_position: 4 },
    ]);
  });

  it("puts a new product at the bottom of a custom order", async () => {
    const added = await general("sale_item", 0, { tenant: lane });
    const bike = await vehicle(lane);
    const saved = await order(lane);
    expect(saved.slice(-2)).toEqual([
      { id: added, sort_position: 5 },
      { id: bike, sort_position: 6 },
    ]);
    ids = saved.map((p) => p.id);
  });

  it("refuses a target in another shop, itself, or a place that isn't before or after", async () => {
    const [theirs] = await order(rival);
    expect(
      (await move("owner", ids[0], theirs.id, "before")).error?.message,
    ).toContain("invalid_move");
    expect(
      (await move("owner", ids[0], ids[0], "before")).error?.message,
    ).toContain("invalid_move");
    expect(
      (await move("owner", ids[0], ids[1], "sideways" as "before")).error
        ?.message,
    ).toContain("invalid_move");
  });

  it("never touches another shop's order", async () => {
    expect((await order(rival)).every((p) => p.sort_position === null)).toBe(
      true,
    );
    // And the other shop's own order is its own.
    const theirs = (await order(rival)).map((p) => p.id);
    expect(
      (await move("owner", theirs[0], theirs[1], "after", theirs, rival)).error,
    ).toBeNull();
    expect((await order(rival)).map((p) => p.id)).toEqual([
      theirs[1],
      theirs[0],
    ]);
    expect((await order(lane)).map((p) => p.id)).toEqual(ids);
  });

  it("everyone in the shop reads the saved order", async () => {
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const { data } = await db(role, lane)
        .from("products")
        .select("id")
        .order("sort_position");
      expect(
        data!.map((p) => p.id),
        role,
      ).toEqual(ids);
    }
  });

  it("reset puts the shop back on A to Z, and a new product then has no position", async () => {
    const reset = await db("manager", lane).rpc("reset_product_order", {
      p_tenant_id: lane.id,
    });
    expect(reset.error).toBeNull();
    expect((await order(lane)).every((p) => p.sort_position === null)).toBe(
      true,
    );
    await vehicle(lane);
    expect((await order(lane)).every((p) => p.sort_position === null)).toBe(
      true,
    );
    // The other shop kept its custom order.
    expect((await order(rival)).every((p) => p.sort_position !== null)).toBe(
      true,
    );
  });
});

describe("Moto Mangos: change model and disconnect", () => {
  /** A listed product on preset A with one vehicle and a booking on it. */
  async function listed() {
    const id = await vehicle(shop, { catalog_id: presetA });
    const { data: unit } = await db("owner")
      .from("units")
      .insert({
        tenant_id: shop.id,
        product_id: id,
        location_id: shop.locationId,
        plate: name("PL"),
      })
      .select("id")
      .single();
    const on = await db("owner")
      .from("products")
      .update({ marketplace_listed: true, instant_units: 1, ready_now: 1 })
      .eq("id", id)
      .select("id");
    expect(on.error).toBeNull();
    // A booking made through Moto Mangos holds the vehicle (hand-made here:
    // orders arrive in Phase 3).
    const { data: block } = await service
      .from("unit_blocks")
      .insert({
        tenant_id: shop.id,
        unit_id: unit!.id,
        kind: "allocation",
        period: period(hours(24), hours(72)),
        note: "Moto Mangos booking",
      })
      .select("*")
      .single();
    return { id, unitId: unit!.id, block: block! };
  }
  const product = async (id: string) =>
    (
      await service
        .from("products")
        .select(
          "catalog_id, make, model, cc, transmission, marketplace_listed, instant_units, request_units, ready_now, catalog_approved_at",
        )
        .eq("id", id)
        .single()
    ).data!;
  const blockNow = async (id: string) =>
    (await service.from("unit_blocks").select("*").eq("id", id).single()).data;
  const events = async (id: string, action: string) =>
    (
      await service
        .from("audit_events")
        .select("actor, before, after")
        .eq("entity", "products")
        .eq("entity_id", id)
        .eq("action", action)
    ).data!;

  it("change model: owners and managers only, never another shop's product", async () => {
    const { id } = await listed();
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const { error } = await db(role).rpc("change_listing_entry", {
        p_product_id: id,
        p_catalog_id: presetB,
      });
      expect(error?.code, role).toBe("42501");
      const off = await db(role).rpc("disconnect_listing", {
        p_product_id: id,
      });
      expect(off.error?.code, role).toBe("42501");
    }
    const change = { p_product_id: id, p_catalog_id: presetB };
    const off = { p_product_id: id };
    const them = db("owner", other);
    expect((await them.rpc("change_listing_entry", change)).error?.code).toBe(
      "42501",
    );
    expect((await them.rpc("disconnect_listing", off)).error?.code).toBe(
      "42501",
    );
    const signedOut = anonClient();
    expect(
      (await signedOut.rpc("change_listing_entry", change)).error,
    ).not.toBeNull();
    expect(
      (await signedOut.rpc("disconnect_listing", off)).error,
    ).not.toBeNull();
    expect((await product(id)).catalog_id).toBe(presetA);
  });

  it("change model moves it to the new entry, keeps the listing on, leaves the booking alone, and is audited", async () => {
    const { id, block } = await listed();
    const { data, error } = await db("manager").rpc("change_listing_entry", {
      p_product_id: id,
      p_catalog_id: presetB,
    });
    expect(error).toBeNull();
    expect(data).toEqual({ upcoming_bookings: 1 });
    const { data: entry } = await service
      .schema("public")
      .from("bike_catalog")
      .select("make, model")
      .eq("id", presetB)
      .single();
    expect(await product(id)).toMatchObject({
      catalog_id: presetB,
      make: entry!.make,
      model: entry!.model,
      marketplace_listed: true,
      instant_units: 1,
      ready_now: 1,
    });
    expect(await blockNow(block.id)).toEqual(block);
    const audit = await events(id, "listing_change_model");
    expect(audit).toHaveLength(1);
    expect(audit[0].actor).toBe(shop.members.manager.id);
    expect(audit[0].before).toMatchObject({ catalog_id: presetA });
    expect(audit[0].after).toMatchObject({
      catalog_id: presetB,
      upcoming_bookings: 1,
    });
  });

  it("change model refuses the same entry, an entry that isn't approved, and a product not on the list", async () => {
    const { id } = await listed();
    const call = (product_id: string, catalog_id: string) =>
      db("owner").rpc("change_listing_entry", {
        p_product_id: product_id,
        p_catalog_id: catalog_id,
      });
    expect((await call(id, presetA)).error?.message).toContain("same_model");
    const { data: waiting } = await service
      .schema("public")
      .from("bike_catalog")
      .insert({
        make: "Testmake",
        model: name("Waiting"),
        type: "city_scooter",
        transmission: "automatic",
        cc: 125,
        status: "requested",
        requested_by_tenant_id: shop.id,
      })
      .select("id")
      .single();
    expect((await call(id, waiting!.id)).error?.message).toContain(
      "catalog_entry_not_usable",
    );
    const own = await vehicle();
    expect((await call(own, presetB)).error?.message).toContain("not_on_list");
    expect(
      (await db("owner").rpc("disconnect_listing", { p_product_id: own })).error
        ?.message,
    ).toContain("not_on_list");
    // A product waiting on its own request is not disconnected from under the reviewer.
    const pending = await vehicle(shop, { catalog_id: waiting!.id });
    expect(
      (await db("owner").rpc("disconnect_listing", { p_product_id: pending }))
        .error?.message,
    ).toContain("request_pending");
    await service.from("products").delete().eq("id", pending);
    await removeCatalogEntry(waiting!.id);
  });

  it("disconnect switches the listing off, clears the entry, leaves the booking alone, and is audited", async () => {
    const { id, block, unitId } = await listed();
    const { data, error } = await db("owner").rpc("disconnect_listing", {
      p_product_id: id,
    });
    expect(error).toBeNull();
    expect(data).toEqual({ upcoming_bookings: 1 });
    expect(await product(id)).toEqual({
      catalog_id: null,
      make: null,
      model: null,
      cc: null,
      transmission: null,
      marketplace_listed: false,
      instant_units: 0,
      request_units: 0,
      ready_now: 0,
      catalog_approved_at: null,
    });
    // The booked vehicle is still booked, for the same dates, and still in the fleet.
    expect(await blockNow(block.id)).toEqual(block);
    const { data: unit } = await service
      .from("units")
      .select("status")
      .eq("id", unitId)
      .single();
    expect(unit!.status).toBe("active");
    const audit = await events(id, "listing_disconnect");
    expect(audit).toHaveLength(1);
    expect(audit[0].actor).toBe(shop.members.owner.id);
    expect(audit[0].before).toMatchObject({
      catalog_id: presetA,
      marketplace_listed: true,
      instant_units: 1,
    });
    // It can be put on the list again afterwards.
    const again = await db("owner")
      .from("products")
      .update({ catalog_id: presetB })
      .eq("id", id)
      .select("id");
    expect(again.data).toHaveLength(1);
  });
});

describe("another shop", () => {
  it("can't count, damage, lose or resolve this shop's stock, and reads none of it", async () => {
    const helmet = await general("gear", 4);
    await lost("staff", helmet, 1);
    const args = {
      p_product_id: helmet,
      p_location_id: shop.locationId,
      p_quantity: 1,
    };
    for (const role of ["owner", "staff"] as const) {
      const them = db(role, other);
      expect((await them.rpc("mark_units_damaged", args)).error?.code).toBe(
        "42501",
      );
      expect((await them.rpc("mark_units_repaired", args)).error?.code).toBe(
        "42501",
      );
      expect((await them.rpc("mark_units_lost", args)).error?.code).toBe(
        "42501",
      );
      expect(
        (await them.rpc("resolve_lost_units", { ...args, p_action: "remove" }))
          .error?.code,
      ).toBe("42501");
      const seen = await them.rpc("product_stock", { p_tenant_id: shop.id });
      expect(seen.data ?? []).toEqual([]);
    }
    const made = await db("owner", other).rpc("create_general_product", {
      p_tenant_id: shop.id,
      p_type: "gear",
      p_name: name("Sneaky"),
    });
    expect(made.error?.code).toBe("42501");
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const { error } = await db(role).rpc("create_general_product", {
        p_tenant_id: shop.id,
        p_type: "service",
        p_name: name("Not mine to add"),
      });
      expect(error?.code, role).toBe("42501");
    }
    expect(await stock(helmet)).toEqual({
      in_stock: 3,
      damaged: 0,
      lost: 1,
      available: 3,
    });
  });
});
