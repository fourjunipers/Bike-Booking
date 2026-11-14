/**
 * Rental gear, the stock rework (migration 20261114000100): in repair, lost
 * and written off. Who may do what, the record each unit out of service
 * carries (the day it happened, expected back, notes), the counts, the
 * quantity rule, races, and shop against shop. Every rule is tried by role.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gearActions, gearRoles } from "@/lib/gear-permissions";
import type { Role } from "@/lib/roles";
import {
  anonClient,
  createTenant,
  deleteTenant,
  hours,
  period,
  serviceClient,
  sql,
  type Db,
  type TestTenant,
} from "./helpers";

let shop: TestTenant;
let other: TestTenant;
/** Today on the calendar of the shop's location. */
let today: string;
const service = serviceClient();
const tag = Math.random().toString(36).slice(2, 8);
let counter = 0;
const name = (what: string) => `${what} ${tag} ${++counter}`;
const everyRole: Role[] = ["owner", "manager", "staff", "mechanic", "driver"];

const db = (role: Role, tenant: TestTenant = shop): Db =>
  tenant.members[role].db;

/** "2026-11-14" moved by whole days. */
const day = (from: string, days: number) =>
  new Date(Date.parse(`${from}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

async function gear(
  quantity: number,
  options: { track?: boolean; tenant?: TestTenant } = {},
): Promise<string> {
  const tenant = options.tenant ?? shop;
  const { data, error } = await db("owner", tenant).rpc(
    "create_general_product",
    {
      p_tenant_id: tenant.id,
      p_type: "gear",
      p_name: name("Helmet"),
      p_track_units: options.track ?? false,
      p_quantities: [{ location_id: tenant.locationId, quantity }],
    },
  );
  if (error) throw error;
  return data;
}

async function stock(productId: string, tenant: TestTenant = shop) {
  const { data, error } = await db("owner", tenant).rpc("product_stock", {
    p_tenant_id: tenant.id,
  });
  if (error) throw error;
  const row = data.find((r) => r.product_id === productId);
  return {
    in_stock: row?.in_stock ?? 0,
    in_repair: row?.in_repair ?? 0,
    lost: row?.lost ?? 0,
    available: row?.available ?? 0,
  };
}

/** A product's units with their records and whether downtime runs on each. */
async function unitsOf(productId: string) {
  const { data, error } = await service
    .from("units")
    .select(
      "id, status, label, problem_on, expected_back, problem_notes, unit_blocks(kind, period)",
    )
    .eq("product_id", productId)
    .order("created_at")
    .order("id");
  if (error) throw error;
  return data.map(({ unit_blocks, ...unit }) => ({
    ...unit,
    // Open-ended downtime: the repair is running.
    in_repair: unit_blocks.some(
      (b) => b.kind === "downtime" && String(b.period).endsWith(",)"),
    ),
    blocks: unit_blocks.length,
  }));
}

type Kind = "repair" | "lost" | "damaged";
const report = (
  role: Role,
  productId: string,
  kind: Kind,
  extra: {
    quantity?: number;
    units?: string[];
    on?: string;
    back?: string;
    notes?: string;
  } = {},
  tenant: TestTenant = shop,
) =>
  db(role, tenant).rpc("report_gear_problem", {
    p_product_id: productId,
    p_location_id: shop.locationId,
    p_kind: kind,
    p_quantity: extra.units ? undefined : (extra.quantity ?? 1),
    p_unit_ids: extra.units,
    p_happened_on: extra.on,
    p_expected_back: extra.back,
    p_notes: extra.notes,
  });

type Resolve = "back_in_use" | "found" | "write_off";
const resolve = (
  role: Role,
  unitId: string,
  action: Resolve,
  tenant: TestTenant = shop,
) =>
  db(role, tenant).rpc("resolve_unit_problem", {
    p_unit_id: unitId,
    p_action: action,
  });

const edit = (
  role: Role,
  unitId: string,
  values: { on: string; back?: string; notes?: string },
  tenant: TestTenant = shop,
) =>
  db(role, tenant).rpc("update_unit_problem", {
    p_unit_id: unitId,
    p_happened_on: values.on,
    p_expected_back: values.back,
    p_notes: values.notes,
  });

const events = async (productId: string, action: string) =>
  (
    await service
      .from("audit_events")
      .select("action, actor, before, after")
      .eq("entity", "products")
      .eq("entity_id", productId)
      .eq("action", action)
      .order("id")
  ).data!;

/** One unit in the state asked for, on a product of its own. */
async function unitIn(state: "repair" | "lost", notes?: string) {
  const product = await gear(1);
  const { error } = await report("owner", product, state, { notes });
  if (error) throw error;
  const [unit] = await unitsOf(product);
  return { product, unit: unit.id };
}

beforeAll(async () => {
  [shop, other] = await Promise.all([
    createTenant("gear-rework"),
    createTenant("gear-rework-other"),
  ]);
  const asked = sql(
    `select platform_private.location_today('${shop.locationId}');`,
  );
  expect(asked.failed).toBe("");
  today = asked.out;
  expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
}, 120_000);

afterAll(async () => {
  await Promise.all([deleteTenant(shop), deleteTenant(other)]);
});

describe("who may do what", () => {
  it("the database and lib/gear-permissions say the same, action by action", () => {
    const rows = sql(`
      select a || ' ' || array_to_string(platform_private.gear_roles(a), ',')
      from unnest(array['${gearActions.join("','")}', 'no_such_action']) a;
    `);
    expect(rows.failed).toBe("");
    expect(rows.out.split("\n")).toEqual([
      ...gearActions.map(
        (action) => `${action} ${gearRoles(action).join(",")}`,
      ),
      // psql's output is trimmed: an action nobody knows has no roles.
      "no_such_action",
    ]);
  });

  it("in repair: owners, managers, staff and mechanics mark it; a driver can't. Counted in stock, not available", async () => {
    const helmet = await gear(6);
    for (const role of ["owner", "manager", "staff", "mechanic"] as const)
      expect((await report(role, helmet, "repair")).error, role).toBeNull();
    expect((await report("driver", helmet, "repair")).error?.code).toBe(
      "42501",
    );
    expect(await stock(helmet)).toEqual({
      in_stock: 6,
      in_repair: 4,
      lost: 0,
      available: 2,
    });
  });

  it("back in use: the same four roles; a driver can't", async () => {
    for (const role of ["owner", "manager", "staff", "mechanic"] as const) {
      const { product, unit } = await unitIn("repair", "strap");
      expect((await resolve(role, unit, "back_in_use")).error, role).toBeNull();
      expect(await stock(product)).toEqual({
        in_stock: 1,
        in_repair: 0,
        lost: 0,
        available: 1,
      });
      // Its record is cleared; the repair's block has ended.
      expect(await unitsOf(product)).toMatchObject([
        {
          status: "active",
          problem_on: null,
          expected_back: null,
          problem_notes: null,
          in_repair: false,
        },
      ]);
    }
    const { unit } = await unitIn("repair");
    expect((await resolve("driver", unit, "back_in_use")).error?.code).toBe(
      "42501",
    );
  });

  it("lost: owners, managers and staff mark it; a mechanic and a driver can't. Not counted in stock, not available", async () => {
    const helmet = await gear(20);
    for (const role of ["owner", "manager", "staff"] as const)
      expect((await report(role, helmet, "lost")).error, role).toBeNull();
    for (const role of ["mechanic", "driver"] as const)
      expect((await report(role, helmet, "lost")).error?.code, role).toBe(
        "42501",
      );
    expect(await stock(helmet)).toEqual({
      in_stock: 17,
      in_repair: 0,
      lost: 3,
      available: 17,
    });
    // Directly on the row, the guard says the same.
    const [unit] = (await unitsOf(helmet)).filter((u) => u.status === "active");
    const byMechanic = await db("mechanic")
      .from("units")
      .update({ status: "lost" })
      .eq("id", unit.id)
      .select("id");
    expect(byMechanic.error?.code).toBe("42501");
  });

  it("found, back in use: owners and managers only, by the function and by hand", async () => {
    const { product, unit } = await unitIn("lost", "left at the pier");
    for (const role of ["staff", "mechanic", "driver"] as const) {
      expect((await resolve(role, unit, "found")).error?.code, role).toBe(
        "42501",
      );
      const byHand = await db(role)
        .from("units")
        .update({ status: "active" })
        .eq("id", unit)
        .select("id");
      expect(byHand.data ?? [], `${role} by hand`).toEqual([]);
    }
    expect(await stock(product)).toMatchObject({ in_stock: 0, lost: 1 });
    expect((await resolve("manager", unit, "found")).error).toBeNull();
    expect(await stock(product)).toEqual({
      in_stock: 1,
      in_repair: 0,
      lost: 0,
      available: 1,
    });
    expect(await unitsOf(product)).toMatchObject([
      { status: "active", problem_on: null, problem_notes: null },
    ]);
  });

  it("writing off as damaged is for owners and managers only: from the dialog, from a line in repair, and by hand", async () => {
    const helmet = await gear(4);
    for (const role of ["staff", "mechanic", "driver"] as const)
      expect((await report(role, helmet, "damaged")).error?.code, role).toBe(
        "42501",
      );
    expect(await stock(helmet)).toMatchObject({ in_stock: 4 });

    expect((await report("staff", helmet, "repair")).error).toBeNull();
    const inRepair = (await unitsOf(helmet)).find((u) => u.in_repair)!;
    for (const role of ["staff", "mechanic", "driver"] as const) {
      expect(
        (await resolve(role, inRepair.id, "write_off")).error?.code,
        role,
      ).toBe("42501");
      const gone = await db(role)
        .from("units")
        .delete()
        .eq("id", inRepair.id)
        .select("id");
      expect(gone.data ?? [], `${role} deleting by hand`).toEqual([]);
      const retired = await db(role)
        .from("units")
        .update({ status: "retired" })
        .eq("id", inRepair.id)
        .select("id");
      expect(retired.data ?? [], `${role} retiring by hand`).toEqual([]);
    }
    expect(await stock(helmet)).toMatchObject({ in_stock: 4, in_repair: 1 });

    // A manager from the line; an owner straight from the dialog.
    expect(
      (await resolve("manager", inRepair.id, "write_off")).error,
    ).toBeNull();
    expect((await report("owner", helmet, "damaged")).error).toBeNull();
    expect(await stock(helmet)).toEqual({
      in_stock: 2,
      in_repair: 0,
      lost: 0,
      available: 2,
    });
    expect(await unitsOf(helmet)).toHaveLength(2);
  });

  it("writing off a lost unit: owners and managers only", async () => {
    const { product, unit } = await unitIn("lost");
    for (const role of ["staff", "mechanic", "driver"] as const)
      expect((await resolve(role, unit, "write_off")).error?.code, role).toBe(
        "42501",
      );
    expect((await resolve("owner", unit, "write_off")).error).toBeNull();
    expect(await unitsOf(product)).toEqual([]);
    expect(await stock(product)).toMatchObject({ in_stock: 0, lost: 0 });
  });

  it("each action only fits its own state", async () => {
    const repair = await unitIn("repair");
    const lost = await unitIn("lost");
    const helmet = await gear(1);
    const [inUse] = await unitsOf(helmet);
    expect(
      (await resolve("owner", repair.unit, "found")).error?.message,
    ).toContain("not_lost");
    expect(
      (await resolve("owner", lost.unit, "back_in_use")).error?.message,
    ).toContain("not_in_repair");
    for (const action of ["back_in_use", "found", "write_off"] as const)
      expect(
        (await resolve("owner", inUse.id, action)).error?.message,
        action,
      ).toMatch(/not_in_repair|not_lost|not_out_of_service/);
    const odd = await db("owner").rpc("resolve_unit_problem", {
      p_unit_id: repair.unit,
      p_action: "sell",
    });
    expect(odd.error?.message).toContain("invalid_action");
    expect(await stock(helmet)).toMatchObject({ in_stock: 1, available: 1 });
  });
});

describe("each unit's own record", () => {
  it("in repair: the day it happened, expected back and notes, on every unit; the repair has no end", async () => {
    const helmet = await gear(5);
    const on = day(today, -2);
    const back = day(today, 3);
    expect(
      (
        await report("staff", helmet, "repair", {
          quantity: 2,
          on,
          back,
          notes: "  Cracked visor  ",
        })
      ).error,
    ).toBeNull();
    const units = await unitsOf(helmet);
    const out = units.filter((u) => u.in_repair);
    expect(out).toHaveLength(2);
    for (const unit of out)
      expect(unit).toMatchObject({
        status: "active",
        problem_on: on,
        expected_back: back,
        problem_notes: "Cracked visor",
      });
    for (const unit of units.filter((u) => !u.in_repair))
      expect(unit).toMatchObject({ problem_on: null, problem_notes: null });
    expect(await events(helmet, "units_in_repair")).toMatchObject([
      {
        actor: shop.members.staff.id,
        after: {
          quantity: 2,
          location_id: shop.locationId,
          happened_on: on,
          expected_back: back,
          notes: "Cracked visor",
        },
      },
    ]);
  });

  it("the day defaults to today at the location; lost has no expected back", async () => {
    const helmet = await gear(3);
    expect((await report("staff", helmet, "repair")).error).toBeNull();
    expect(
      (await report("staff", helmet, "lost", { notes: "Not returned" })).error,
    ).toBeNull();
    const units = await unitsOf(helmet);
    expect(units.find((u) => u.in_repair)).toMatchObject({
      problem_on: today,
      expected_back: null,
      problem_notes: null,
    });
    expect(units.find((u) => u.status === "lost")).toMatchObject({
      problem_on: today,
      expected_back: null,
      problem_notes: "Not returned",
    });
    const refused = await report("staff", helmet, "lost", {
      back: day(today, 2),
    });
    expect(refused.error?.message).toContain("expected_before_happened");
  });

  it("each line is edited on its own, by whoever may mark it that way", async () => {
    const helmet = await gear(4);
    await report("staff", helmet, "repair", { quantity: 2, notes: "Strap" });
    await report("staff", helmet, "lost");
    const units = await unitsOf(helmet);
    const [first, second] = units.filter((u) => u.in_repair);
    const lostUnit = units.find((u) => u.status === "lost")!;

    // A mechanic edits a repair's line, not a lost unit's; a driver neither.
    const on = day(today, -1);
    const back = day(today, 5);
    expect(
      (await edit("mechanic", first.id, { on, back, notes: "Strap replaced" }))
        .data,
    ).toEqual({ changed: true });
    expect((await edit("mechanic", lostUnit.id, { on })).error?.code).toBe(
      "42501",
    );
    expect((await edit("driver", first.id, { on })).error?.code).toBe("42501");
    expect(
      (await edit("staff", lostUnit.id, { on, notes: "Customer lost it" }))
        .error,
    ).toBeNull();

    const after = await unitsOf(helmet);
    expect(after.find((u) => u.id === first.id)).toMatchObject({
      problem_on: on,
      expected_back: back,
      problem_notes: "Strap replaced",
    });
    // The other unit in repair is exactly as it was.
    expect(after.find((u) => u.id === second.id)).toMatchObject({
      problem_on: today,
      expected_back: null,
      problem_notes: "Strap",
    });
    expect(after.find((u) => u.id === lostUnit.id)).toMatchObject({
      problem_on: on,
      expected_back: null,
      problem_notes: "Customer lost it",
    });
    // Saving the same again changes nothing and writes nothing.
    expect(
      (await edit("staff", first.id, { on, back, notes: "Strap replaced" }))
        .data,
    ).toEqual({ changed: false });
    const edits = await events(helmet, "unit_problem_edit");
    expect(edits).toHaveLength(2);
    expect(edits[0]).toMatchObject({
      actor: shop.members.mechanic.id,
      before: { happened_on: today, expected_back: null, notes: "Strap" },
      after: {
        state: "repair",
        happened_on: on,
        expected_back: back,
        notes: "Strap replaced",
      },
    });
  });

  it("what is refused: a day in the future, expected back before the day or on a lost unit, long notes, a unit in use", async () => {
    const helmet = await gear(3);
    const future = await report("staff", helmet, "repair", {
      on: day(today, 1),
    });
    expect(future.error?.message).toContain("date_in_future");
    const early = await report("staff", helmet, "repair", {
      on: day(today, -3),
      back: day(today, -4),
    });
    expect(early.error?.message).toContain("expected_before_happened");
    const long = await report("staff", helmet, "repair", {
      notes: "x".repeat(501),
    });
    expect(long.error?.message).toContain("notes_too_long");
    for (const quantity of [0, -1, 1001])
      expect(
        (await report("staff", helmet, "repair", { quantity })).error?.message,
        String(quantity),
      ).toContain("quantity_out_of_range");
    const odd = await db("owner").rpc("report_gear_problem", {
      p_product_id: helmet,
      p_location_id: shop.locationId,
      p_kind: "stolen",
      p_quantity: 1,
    });
    expect(odd.error?.message).toContain("invalid_kind");
    const elsewhere = await db("owner").rpc("report_gear_problem", {
      p_product_id: helmet,
      p_location_id: other.locationId,
      p_kind: "repair",
      p_quantity: 1,
    });
    expect(elsewhere.error?.message).toContain("location_not_found");
    expect(await stock(helmet)).toMatchObject({ in_stock: 3, available: 3 });

    await report("staff", helmet, "repair");
    await report("staff", helmet, "lost");
    const units = await unitsOf(helmet);
    const inRepair = units.find((u) => u.in_repair)!;
    const lostUnit = units.find((u) => u.status === "lost")!;
    const inUse = units.find((u) => u.status === "active" && !u.in_repair)!;
    expect(
      (await edit("staff", inRepair.id, { on: day(today, 1) })).error?.message,
    ).toContain("date_in_future");
    expect(
      (await edit("staff", inRepair.id, { on: today, back: day(today, -1) }))
        .error?.message,
    ).toContain("expected_before_happened");
    expect(
      (await edit("staff", lostUnit.id, { on: today, back: day(today, 1) }))
        .error?.message,
    ).toContain("expected_before_happened");
    expect(
      (await edit("staff", inRepair.id, { on: today, notes: "x".repeat(501) }))
        .error?.message,
    ).toContain("notes_too_long");
    expect(
      (await edit("staff", inUse.id, { on: today })).error?.message,
    ).toContain("not_out_of_service");
  });

  it("the table holds it too: no record on a vehicle, none without its day, no expected back before it or on a lost unit", async () => {
    const helmet = await gear(2);
    await report("owner", helmet, "lost");
    const units = await unitsOf(helmet);
    const lostUnit = units.find((u) => u.status === "lost")!;
    const inUse = units.find((u) => u.status === "active")!;
    const write = (id: string, values: object) =>
      db("owner").from("units").update(values).eq("id", id).select("id");
    expect(
      (await write(lostUnit.id, { expected_back: day(today, 1) })).error
        ?.message,
    ).toContain("units_problem_check");
    expect(
      (await write(inUse.id, { problem_notes: "No day" })).error?.message,
    ).toContain("units_problem_check");
    expect(
      (
        await write(inUse.id, {
          problem_on: today,
          expected_back: day(today, -1),
        })
      ).error?.message,
    ).toContain("units_problem_check");
    expect(
      (await write(inUse.id, { problem_on: today, problem_notes: "" })).error
        ?.message,
    ).toContain("units_problem_notes_check");

    const { data: bike } = await db("owner")
      .from("products")
      .insert({
        tenant_id: shop.id,
        name: name("Bike"),
        vehicle_type: "motorbike",
        categories: ["city_scooter"],
      })
      .select("id")
      .single();
    const onVehicle = await db("owner")
      .from("units")
      .insert({
        tenant_id: shop.id,
        product_id: bike!.id,
        location_id: shop.locationId,
        plate: name("PL"),
        problem_on: today,
      });
    expect(onVehicle.error?.message).toContain("units_problem_check");

    // A lost unit put back by hand has no record left.
    expect((await write(lostUnit.id, { status: "active" })).error).toBeNull();
    expect(
      (await unitsOf(helmet)).find((u) => u.id === lostUnit.id),
    ).toMatchObject({ status: "active", problem_on: null });
  });
});

describe("written off: gone for good, with a record in the History", () => {
  it("as damaged, from a line in repair: the unit leaves stock and the event keeps its day, expected back and notes", async () => {
    const helmet = await gear(3);
    const on = day(today, -4);
    await report("staff", helmet, "repair", {
      on,
      back: day(today, 2),
      notes: "Shell split",
    });
    const unit = (await unitsOf(helmet)).find((u) => u.in_repair)!;
    expect((await resolve("owner", unit.id, "write_off")).error).toBeNull();
    expect(await stock(helmet)).toEqual({
      in_stock: 2,
      in_repair: 0,
      lost: 0,
      available: 2,
    });
    expect((await unitsOf(helmet)).map((u) => u.id)).not.toContain(unit.id);
    expect(await events(helmet, "units_written_off")).toMatchObject([
      {
        actor: shop.members.owner.id,
        after: {
          quantity: 1,
          reason: "damaged",
          happened_on: on,
          expected_back: day(today, 2),
          notes: "Shell split",
        },
      },
    ]);
    // It can't come back.
    for (const action of ["back_in_use", "found", "write_off"] as const)
      expect(
        (await resolve("owner", unit.id, action)).error,
        action,
      ).not.toBeNull();
  });

  it("as damaged, straight from the dialog; and as lost, from a lost line", async () => {
    const helmet = await gear(4);
    expect(
      (
        await report("manager", helmet, "damaged", {
          quantity: 2,
          on: day(today, -1),
          notes: "Run over",
        })
      ).error,
    ).toBeNull();
    await report("staff", helmet, "lost", { notes: "Never returned" });
    const lostUnit = (await unitsOf(helmet)).find((u) => u.status === "lost")!;
    expect(
      (await resolve("manager", lostUnit.id, "write_off")).error,
    ).toBeNull();
    expect(await stock(helmet)).toEqual({
      in_stock: 1,
      in_repair: 0,
      lost: 0,
      available: 1,
    });
    expect(
      (await events(helmet, "units_written_off")).map((e) => e.after),
    ).toMatchObject([
      {
        quantity: 2,
        reason: "damaged",
        happened_on: day(today, -1),
        notes: "Run over",
      },
      {
        quantity: 1,
        reason: "lost",
        happened_on: today,
        notes: "Never returned",
      },
    ]);
  });

  it("a unit with bookings on record is retired, not deleted, and leaves stock all the same", async () => {
    const helmet = await gear(2);
    const units = await unitsOf(helmet);
    for (const unit of units) {
      const past = await service.from("unit_blocks").insert({
        tenant_id: shop.id,
        unit_id: unit.id,
        kind: "allocation",
        period: period(hours(-48), hours(-24)),
      });
      expect(past.error).toBeNull();
    }
    await report("owner", helmet, "repair", { notes: "Buckle" });
    const inRepair = (await unitsOf(helmet)).find((u) => u.in_repair)!;
    expect((await resolve("owner", inRepair.id, "write_off")).error).toBeNull();
    expect((await report("owner", helmet, "damaged")).error).toBeNull();
    expect(await unitsOf(helmet)).toMatchObject([
      { status: "retired", problem_on: null, problem_notes: null },
      { status: "retired", problem_on: null, problem_notes: null },
    ]);
    expect(await stock(helmet)).toEqual({
      in_stock: 0,
      in_repair: 0,
      lost: 0,
      available: 0,
    });
  });
});

describe("tracked gear: which unit", () => {
  it("the unit that was picked is the one marked, and the History names it", async () => {
    const camera = await gear(3, { track: true });
    const units = await unitsOf(camera);
    await db("owner")
      .from("units")
      .update({ label: "Cam B" })
      .eq("id", units[1].id);
    expect(
      (await report("staff", camera, "repair", { units: [units[1].id] })).error,
    ).toBeNull();
    const after = await unitsOf(camera);
    expect(after.filter((u) => u.in_repair).map((u) => u.id)).toEqual([
      units[1].id,
    ]);
    expect((await events(camera, "units_in_repair"))[0].after).toMatchObject({
      quantity: 1,
      labels: ["Cam B"],
    });
    expect(
      (await resolve("mechanic", units[1].id, "back_in_use")).error,
    ).toBeNull();
    expect((await events(camera, "units_back_in_use"))[0].after).toMatchObject({
      quantity: 1,
      labels: ["Cam B"],
    });
  });

  it("refuses a unit already out of service, a unit of another product, and a count that doesn't match", async () => {
    const camera = await gear(2, { track: true });
    const elsewhere = await gear(1, { track: true });
    const [first, second] = await unitsOf(camera);
    const [stranger] = await unitsOf(elsewhere);
    await report("staff", camera, "repair", { units: [first.id] });
    expect(
      (await report("staff", camera, "lost", { units: [first.id] })).error
        ?.message,
    ).toContain("unit_not_free");
    expect(
      (await report("staff", camera, "repair", { units: [stranger.id] })).error
        ?.message,
    ).toContain("unit_not_found");
    const mismatch = await db("staff").rpc("report_gear_problem", {
      p_product_id: camera,
      p_location_id: shop.locationId,
      p_kind: "repair",
      p_quantity: 2,
      p_unit_ids: [second.id],
    });
    expect(mismatch.error?.message).toContain("quantity_out_of_range");
    expect(await stock(camera)).toMatchObject({ in_repair: 1, available: 1 });
    expect(await stock(elsewhere)).toMatchObject({
      in_repair: 0,
      available: 1,
    });
  });
});

describe("only units in use and free are taken", () => {
  it("a booked unit is never put out of service from under its booking", async () => {
    const helmet = await gear(3);
    const [booked] = await unitsOf(helmet);
    await service.from("unit_blocks").insert({
      tenant_id: shop.id,
      unit_id: booked.id,
      kind: "allocation",
      period: period(hours(24), hours(48)),
    });
    for (const kind of ["repair", "lost", "damaged"] as const) {
      const tooMany = await report("owner", helmet, kind, { quantity: 3 });
      expect(tooMany.error?.message, kind).toContain("not_enough_free");
      expect(tooMany.error?.details, kind).toBe("2");
    }
    expect(
      (await report("owner", helmet, "repair", { quantity: 2 })).error,
    ).toBeNull();
    const after = await unitsOf(helmet);
    expect(after.find((u) => u.id === booked.id)).toMatchObject({
      status: "active",
      in_repair: false,
      problem_on: null,
    });
    // Nothing free is left to report.
    const none = await report("owner", helmet, "lost");
    expect(none.error?.details).toBe("0");
  });
});

describe("quantity", () => {
  it("lowering it removes only free units, never ones in repair or lost", async () => {
    const helmet = await gear(6);
    await report("staff", helmet, "repair", { quantity: 2, notes: "Wash" });
    await report("staff", helmet, "lost", { notes: "Gone" });
    expect(await stock(helmet)).toEqual({
      in_stock: 5,
      in_repair: 2,
      lost: 1,
      available: 3,
    });
    const set = (quantity: number) =>
      db("owner").rpc("set_stock_quantity", {
        p_product_id: helmet,
        p_location_id: shop.locationId,
        p_quantity: quantity,
      });
    const tooLow = await set(1);
    expect(tooLow.error?.message).toContain("units_blocked");
    expect(tooLow.error?.details).toBe("2");
    expect((await set(2)).error).toBeNull();
    expect(await stock(helmet)).toEqual({
      in_stock: 2,
      in_repair: 2,
      lost: 1,
      available: 0,
    });
    const left = await unitsOf(helmet);
    expect(left.filter((u) => u.in_repair)).toHaveLength(2);
    for (const unit of left.filter((u) => u.in_repair))
      expect(unit.problem_notes).toBe("Wash");
    expect(left.filter((u) => u.status === "lost")).toMatchObject([
      { problem_notes: "Gone" },
    ]);
    // Raising it adds units in use, with no record.
    expect((await set(4)).error).toBeNull();
    expect(await stock(helmet)).toMatchObject({ in_stock: 4, available: 2 });
  });
});

describe("races", () => {
  it("twelve staff marking the last free helmet in repair: one does, eleven are told there is none", async () => {
    const helmet = await gear(1);
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        report("staff", helmet, "repair", { notes: `Writer ${i}` }),
      ),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    for (const result of results)
      if (result.error) {
        expect(result.error.message).toContain("not_enough_free");
        expect(result.error.details).toBe("0");
      }
    expect(await stock(helmet)).toMatchObject({ in_repair: 1, available: 0 });
    const [unit] = await unitsOf(helmet);
    expect(unit.blocks).toBe(1);
    expect(unit.problem_notes).toMatch(/^Writer \d+$/);
  });

  it("repair, lost and written off reported at once on four units: every unit ends in exactly one state", async () => {
    for (let round = 0; round < 3; round++) {
      const helmet = await gear(4);
      const results = await Promise.all([
        ...Array.from({ length: 4 }, () => report("staff", helmet, "repair")),
        ...Array.from({ length: 4 }, () => report("staff", helmet, "lost")),
        ...Array.from({ length: 4 }, () => report("owner", helmet, "damaged")),
      ]);
      const done = results.filter((r) => !r.error);
      expect(done).toHaveLength(4);
      for (const result of results)
        if (result.error)
          expect(result.error.message).toContain("not_enough_free");
      const units = await unitsOf(helmet);
      const counts = await stock(helmet);
      const inRepair = units.filter((u) => u.in_repair);
      const lost = units.filter((u) => u.status === "lost");
      // No unit is both lost and in repair, and none is left in use.
      for (const unit of lost) expect(unit.in_repair).toBe(false);
      expect(inRepair.length + lost.length).toBe(units.length);
      expect(counts).toEqual({
        in_stock: inRepair.length,
        in_repair: inRepair.length,
        lost: lost.length,
        available: 0,
      });
      // Every unit still here has its record; the written-off ones are gone.
      for (const unit of units) expect(unit.problem_on).toBe(today);
      const writtenOff = (await events(helmet, "units_written_off")).length;
      expect(units.length + writtenOff).toBe(4);
    }
  }, 120_000);

  it("back in use and write off pressed at once on one unit in repair: one of them happens, once", async () => {
    for (let round = 0; round < 4; round++) {
      const { product, unit } = await unitIn("repair", "Race");
      const results = await Promise.all([
        ...Array.from({ length: 4 }, () =>
          resolve("mechanic", unit, "back_in_use").then((r) => ({
            what: "back",
            error: r.error,
          })),
        ),
        ...Array.from({ length: 4 }, () =>
          resolve("owner", unit, "write_off").then((r) => ({
            what: "off",
            error: r.error,
          })),
        ),
      ]);
      for (const result of results)
        if (result.error)
          expect(result.error.message, result.what).toMatch(
            /not_in_repair|not_out_of_service|role_not_allowed|only_owner_or_manager/,
          );
      expect(results.filter((r) => !r.error)).toHaveLength(1);
      const won = results.find((r) => !r.error)!.what;
      const units = await unitsOf(product);
      if (won === "back")
        expect(units).toMatchObject([
          { status: "active", in_repair: false, problem_on: null },
        ]);
      else expect(units).toEqual([]);
      expect(await stock(product)).toEqual({
        in_stock: won === "back" ? 1 : 0,
        in_repair: 0,
        lost: 0,
        available: won === "back" ? 1 : 0,
      });
      expect(
        (await events(product, "units_back_in_use")).length +
          (await events(product, "units_written_off")).length,
      ).toBe(1);
    }
  }, 120_000);

  it("found and write off pressed at once on one lost unit: one of them happens, once", async () => {
    for (let round = 0; round < 4; round++) {
      const { product, unit } = await unitIn("lost");
      const results = await Promise.all([
        ...Array.from({ length: 4 }, () =>
          resolve("manager", unit, "found").then((r) => ({
            what: "found",
            error: r.error,
          })),
        ),
        ...Array.from({ length: 4 }, () =>
          resolve("owner", unit, "write_off").then((r) => ({
            what: "off",
            error: r.error,
          })),
        ),
      ]);
      for (const result of results)
        if (result.error)
          expect(result.error.message, result.what).toMatch(
            /not_lost|not_out_of_service|only_owner_or_manager/,
          );
      expect(results.filter((r) => !r.error)).toHaveLength(1);
      const won = results.find((r) => !r.error)!.what;
      expect(await stock(product)).toEqual({
        in_stock: won === "found" ? 1 : 0,
        in_repair: 0,
        lost: 0,
        available: won === "found" ? 1 : 0,
      });
      expect(await unitsOf(product)).toHaveLength(won === "found" ? 1 : 0);
    }
  }, 120_000);

  it("six lower the quantity while six mark units in repair: nothing in repair is removed, and the counts add up", async () => {
    for (let round = 0; round < 3; round++) {
      const helmet = await gear(6);
      const results = await Promise.all([
        ...Array.from({ length: 6 }, () =>
          report("staff", helmet, "repair", { notes: "Kept" }).then((r) => ({
            what: "repair",
            error: r.error,
          })),
        ),
        ...Array.from({ length: 6 }, () =>
          db("owner")
            .rpc("set_stock_quantity", {
              p_product_id: helmet,
              p_location_id: shop.locationId,
              p_quantity: 2,
            })
            .then((r) => ({ what: "lower", error: r.error })),
        ),
      ]);
      for (const result of results)
        if (result.error)
          expect(result.error.message, result.what).toMatch(
            /units_blocked|not_enough_free/,
          );
      const marked = results.filter(
        (r) => r.what === "repair" && !r.error,
      ).length;
      const units = await unitsOf(helmet);
      const inRepair = units.filter((u) => u.in_repair);
      // Every repair that reported success is still there, with its record.
      expect(inRepair).toHaveLength(marked);
      for (const unit of inRepair) expect(unit.problem_notes).toBe("Kept");
      expect(await stock(helmet)).toEqual({
        in_stock: units.length,
        in_repair: marked,
        lost: 0,
        available: units.length - marked,
      });
      expect(await events(helmet, "units_in_repair")).toHaveLength(marked);
    }
  }, 120_000);

  it("two people editing one line at once: both are saved in turn and the line ends as one of them wrote it", async () => {
    const { product, unit } = await unitIn("repair");
    const results = await Promise.all([
      edit("staff", unit, { on: today, notes: "First" }),
      edit("mechanic", unit, { on: day(today, -1), notes: "Second" }),
    ]);
    for (const result of results) expect(result.error).toBeNull();
    const [line] = await unitsOf(product);
    expect([`${today} First`, `${day(today, -1)} Second`]).toContain(
      `${line.problem_on} ${line.problem_notes}`,
    );
    expect(line.in_repair).toBe(true);
  });
});

describe("another shop", () => {
  it("no role of another shop reports on, edits or resolves this shop's gear, or reads its records", async () => {
    const helmet = await gear(4);
    await report("staff", helmet, "repair", { notes: "Ours" });
    await report("staff", helmet, "lost", { notes: "Ours too" });
    const before = await unitsOf(helmet);
    const inRepair = before.find((u) => u.in_repair)!;
    const lostUnit = before.find((u) => u.status === "lost")!;

    for (const role of everyRole) {
      const who = `${role} of ${other.slug}`;
      for (const kind of ["repair", "lost", "damaged"] as const)
        expect(
          (await report(role, helmet, kind, {}, other)).error?.code,
          `${who} ${kind}`,
        ).toBe("42501");
      expect(
        (
          await report(
            role,
            helmet,
            "repair",
            {
              units: [
                before.find((u) => !u.in_repair && u.status === "active")!.id,
              ],
            },
            other,
          )
        ).error?.code,
        who,
      ).toBe("42501");
      for (const [unit, action] of [
        [inRepair.id, "back_in_use"],
        [inRepair.id, "write_off"],
        [lostUnit.id, "found"],
        [lostUnit.id, "write_off"],
      ] as const)
        expect(
          (await resolve(role, unit, action, other)).error?.code,
          `${who} ${action}`,
        ).toBe("42501");
      for (const unit of [inRepair.id, lostUnit.id])
        expect(
          (await edit(role, unit, { on: today, notes: "Theirs" }, other)).error
            ?.code,
          who,
        ).toBe("42501");
      // Reading: none of this shop's units, so none of their records.
      const seen = await db(role, other)
        .from("units")
        .select("id, problem_on, problem_notes")
        .eq("product_id", helmet);
      expect(seen.data ?? [], who).toEqual([]);
      const byHand = await db(role, other)
        .from("units")
        .update({ problem_notes: "Theirs" })
        .eq("id", inRepair.id)
        .select("id");
      expect(byHand.data ?? [], who).toEqual([]);
    }
    expect(await unitsOf(helmet)).toEqual(before);
    expect(await stock(helmet)).toEqual({
      in_stock: 3,
      in_repair: 1,
      lost: 1,
      available: 2,
    });
  });

  it("every role of the shop reads the records; a signed-out visitor reads and does nothing", async () => {
    const helmet = await gear(2);
    await report("staff", helmet, "repair", { notes: "Visible" });
    const unit = (await unitsOf(helmet)).find((u) => u.in_repair)!;
    for (const role of everyRole) {
      const seen = await db(role)
        .from("units")
        .select("id, problem_on, problem_notes")
        .eq("id", unit.id);
      expect(seen.data, role).toEqual([
        { id: unit.id, problem_on: today, problem_notes: "Visible" },
      ]);
    }
    const anon = anonClient();
    expect(
      (await anon.from("units").select("id").eq("id", unit.id)).data ?? [],
    ).toEqual([]);
    expect(
      (
        await anon.rpc("report_gear_problem", {
          p_product_id: helmet,
          p_location_id: shop.locationId,
          p_kind: "repair",
          p_quantity: 1,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await anon.rpc("resolve_unit_problem", {
          p_unit_id: unit.id,
          p_action: "back_in_use",
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await anon.rpc("update_unit_problem", {
          p_unit_id: unit.id,
          p_happened_on: today,
        })
      ).error,
    ).not.toBeNull();
    expect(await stock(helmet)).toMatchObject({ in_repair: 1, available: 1 });
  });
});
