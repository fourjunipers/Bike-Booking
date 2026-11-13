/**
 * Follow-ups from the re-check of the Phase 1a review (12 Nov 2026).
 * Migrations 20261112000200 to 20261112000400. Each test failed before its
 * migration and passes after.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTenant,
  createUser,
  deleteTenant,
  deleteUser,
  hours,
  period,
  removeCatalogEntry,
  serviceClient,
  sql,
  sqlBackground,
  type TestTenant,
  type TestUser,
} from "./helpers";

let shop: TestTenant;
let other: TestTenant;
let admin: TestUser;
const catalogIds: string[] = [];
const service = serviceClient();
const tag = Math.random().toString(36).slice(2, 8);

let counter = 0;
async function addModel(extra: object = {}): Promise<string> {
  const { data, error } = await service
    .from("products")
    .insert({
      tenant_id: shop.id,
      catalog_id: null,
      name: `Recheck ${tag} ${++counter}`,
      make: "Recheckmake",
      model: `RC ${tag} ${counter}`,
      vehicle_type: "motorbike",
      cc: 125,
      transmission: "automatic" as const,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function addUnit(modelId: string): Promise<string> {
  const { data, error } = await service
    .from("units")
    .insert({
      tenant_id: shop.id,
      product_id: modelId,
      location_id: shop.locationId,
      plate: `RC-${tag}-${++counter}`,
      status: "active",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function submit(modelId: string): Promise<string> {
  const { data, error } = await shop.members.owner.db.rpc(
    "submit_product_to_catalog",
    { p_product_id: modelId, p_type: "city_scooter", p_note: "Please add" },
  );
  if (error) throw error;
  catalogIds.push(data);
  return data;
}

const reject = (catalogId: string, notes?: string) =>
  admin.db.rpc("review_catalog_request", {
    p_catalog_id: catalogId,
    p_approve: false,
    p_notes: notes,
  });

const outcome = async (modelId: string, db = service) =>
  (
    await db
      .from("products")
      .select("catalog_id, catalog_rejected_at, catalog_reject_reason")
      .eq("id", modelId)
      .maybeSingle()
  ).data;

/** Waits until a background session is sitting on its "hold" marker. */
async function holding(marker: string) {
  for (let i = 0; i < 100; i++) {
    const { out } = sql(
      `select count(*) from pg_stat_activity where state = 'active' and query like '%${marker}%' and pid <> pg_backend_pid();`,
    );
    if (out === "1") return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`No session reached ${marker}`);
}

beforeAll(async () => {
  [shop, other, admin] = await Promise.all([
    createTenant("recheck-a"),
    createTenant("recheck-b"),
    createUser("recheck-admin"),
  ]);
  await service.from("platform_admins").insert({ user_id: admin.id });
}, 120_000);

afterAll(async () => {
  await Promise.all([deleteTenant(shop), deleteTenant(other)]);
  await deleteUser(admin);
  for (const id of catalogIds) await removeCatalogEntry(id);
});

describe("1. locks no stronger than they need to be", () => {
  it("a team change doesn't wait behind an open downtime insert in the same shop", async () => {
    const unit = await addUnit(await addModel());
    const marker = `hold-team-${tag}`;
    // A second session adds downtime and keeps its transaction open for 4 s.
    const open = sqlBackground(`
      begin;
      insert into platform.unit_blocks (tenant_id, unit_id, kind, period)
      values ('${shop.id}', '${unit}', 'downtime', '${period(hours(1), hours(2))}');
      select pg_sleep(4) /* ${marker} */;
      rollback;
    `);
    await holding(marker);

    const started = Date.now();
    const role = await shop.members.owner.db.rpc("set_member_role", {
      p_membership_id: shop.members.staff.membershipId,
      p_role: "mechanic",
    });
    const afterRole = Date.now() - started;
    const removed = await shop.members.owner.db.rpc("remove_member", {
      p_membership_id: shop.members.driver.membershipId,
    });
    const afterBoth = Date.now() - started;

    expect(role.error).toBeNull();
    expect(removed.error).toBeNull();
    // Well under a second each; behind the lock they took the full 4 s.
    expect(afterRole).toBeLessThan(1000);
    expect(afterBoth).toBeLessThan(2000);
    expect((await open).failed).toBe("");

    const { data: team } = await service
      .from("memberships")
      .select("id, role")
      .eq("tenant_id", shop.id);
    expect(
      team!.find((m) => m.id === shop.members.staff.membershipId)?.role,
    ).toBe("mechanic");
    expect(team!.some((m) => m.id === shop.members.driver.membershipId)).toBe(
      false,
    );
  });

  it("team changes in one shop still go one at a time", async () => {
    const marker = `hold-serial-${tag}`;
    // The first change holds the shop's lock for 1.5 s.
    const first = sqlBackground(`
      begin;
      select 1 from platform.tenants where id = '${shop.id}' for no key update;
      select pg_sleep(1.5) /* ${marker} */;
      commit;
    `);
    await holding(marker);
    const started = Date.now();
    const { error } = await shop.members.owner.db.rpc("set_member_role", {
      p_membership_id: shop.members.staff.membershipId,
      p_role: "staff",
    });
    expect(error).toBeNull();
    expect(Date.now() - started).toBeGreaterThan(700);
    await first;
  });

  it("two bikes swapping models at the same moment both finish: no deadlock", async () => {
    const [modelX, modelY] = [await addModel(), await addModel()];
    const [bikeA, bikeB] = [await addUnit(modelX), await addUnit(modelY)];
    // Each session first holds what a bike arriving on a model holds (the
    // foreign key's share lock on the model it moves to), waits until the
    // other has done the same, then moves its bike. With a full row lock in
    // the counts trigger each then waited for the other: a deadlock.
    const swap = (bike: string, to: string) =>
      sqlBackground(`
        begin;
        select 1 from platform.products where id = '${to}' for key share;
        select pg_sleep(1.2);
        update platform.units set product_id = '${to}' where id = '${bike}';
        commit;
      `);
    const results = await Promise.all([
      swap(bikeA, modelY),
      swap(bikeB, modelX),
    ]);
    for (const result of results) {
      expect(result.failed).not.toMatch(/deadlock/i);
    }
    // Both finished, or one was refused for a reason a person can read.
    const refused = results.filter((r) => r.failed);
    expect(refused.length).toBeLessThanOrEqual(1);
    const { data: bikes } = await service
      .from("units")
      .select("id, product_id")
      .in("id", [bikeA, bikeB]);
    const modelOf = (id: string) => bikes!.find((b) => b.id === id)!.product_id;
    if (refused.length === 0) {
      expect(modelOf(bikeA)).toBe(modelY);
      expect(modelOf(bikeB)).toBe(modelX);
    }
  }, 30_000);

  it("the counts are still clamped when a bike leaves a model", async () => {
    const model = await addModel();
    const [one] = [await addUnit(model), await addUnit(model)];
    await service
      .from("products")
      .update({ instant_units: 2, ready_now: 2 })
      .eq("id", model);
    await service.from("units").update({ status: "sold" }).eq("id", one);
    const { data } = await service
      .from("products")
      .select("instant_units, request_units, ready_now")
      .eq("id", model)
      .single();
    expect(data).toEqual({ instant_units: 1, request_units: 0, ready_now: 1 });
  });
});

describe("3. which marketplace shop asked for a catalog entry is private", () => {
  const publicColumns =
    "id, slug, make, model, year_from, year_to, cc, type, transmission, abs, underseat_storage, usb_charger, key_type, description, stock_photo, status";

  it("the public and signed-in users can't select requested_by_shop_id", async () => {
    for (const db of [anonClient(), shop.members.owner.db]) {
      const catalog = db.schema("public").from("bike_catalog");
      const hidden = await catalog.select("id, requested_by_shop_id").limit(1);
      expect(hidden.error?.code).toBe("42501");
      const all = await db
        .schema("public")
        .from("bike_catalog")
        .select("*")
        .limit(1);
      expect(all.error?.code).toBe("42501");
    }
  });

  it("the columns the marketplace reads still work", async () => {
    for (const db of [anonClient(), shop.members.owner.db]) {
      const { data, error } = await db
        .schema("public")
        .from("bike_catalog")
        .select(publicColumns)
        .limit(5);
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    }
  });

  it("exactly 21 columns are readable, none of the four private ones", () => {
    const { out, failed } = sql(`
      select grantee || ' ' || count(*) || ' ' || count(*) filter (where column_name in
        ('request_note', 'requested_by_tenant_id', 'review_notes', 'requested_by_shop_id'))
      from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'bike_catalog'
        and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
      group by grantee order by grantee;
    `);
    expect(failed).toBe("");
    expect(out.split("\n")).toEqual(["anon 21 0", "authenticated 21 0"]);
  });
});

describe("4. a rejected request tells the shop why", () => {
  it("rejecting with a note puts the note and the date on the shop's model; review_notes stays private", async () => {
    const model = await addModel();
    const entry = await submit(model);
    expect(
      (await reject(entry, "  Not a production model.  ")).error,
    ).toBeNull();

    const row = await outcome(model);
    expect(row).toMatchObject({
      catalog_id: null,
      catalog_reject_reason: "Not a production model.",
    });
    expect(Date.parse(row!.catalog_rejected_at!)).toBeGreaterThan(
      Date.now() - 60_000,
    );

    // Every member of the shop can read it; another shop can't see the model.
    expect(await outcome(model, shop.members.staff.db)).toMatchObject({
      catalog_reject_reason: "Not a production model.",
    });
    expect(await outcome(model, other.members.owner.db)).toBeNull();

    // The catalog's own review note is still not readable by the shop.
    const notes = await shop.members.owner.db
      .schema("public")
      .from("bike_catalog")
      .select("review_notes")
      .eq("id", entry);
    expect(notes.error?.code).toBe("42501");
  });

  it("rejecting without a note records the date and no reason", async () => {
    const model = await addModel();
    expect((await reject(await submit(model))).error).toBeNull();
    const row = await outcome(model);
    expect(row!.catalog_rejected_at).not.toBeNull();
    expect(row!.catalog_reject_reason).toBeNull();
  });

  it("a model that stays linked to the rejected entry gets the reason too", async () => {
    const model = await addModel({ make: "Twinmake", model: `Twin ${tag}` });
    const entry = await submit(model);
    // While waiting, the shop adds the same make and model again as its own.
    await addModel({ make: "Twinmake", model: `Twin ${tag}` });
    const { data, error } = await reject(
      entry,
      "Duplicate of an existing entry",
    );
    expect(error).toBeNull();
    expect((data as { kept_linked: unknown[] }).kept_linked).toHaveLength(1);
    expect(await outcome(model)).toMatchObject({
      catalog_id: entry,
      catalog_reject_reason: "Duplicate of an existing entry",
    });
  });

  it("the shop can't write or clear the outcome itself", async () => {
    const model = await addModel();
    await reject(await submit(model), "Real reason");
    const manager = shop.members.manager.db;
    await manager
      .from("products")
      .update({ catalog_reject_reason: "Made up", catalog_rejected_at: null })
      .eq("id", model);
    expect(await outcome(model)).toMatchObject({
      catalog_reject_reason: "Real reason",
    });
    expect((await outcome(model))!.catalog_rejected_at).not.toBeNull();

    // Nor set one on a new model.
    const { data: created, error } = await manager
      .from("products")
      .insert({
        tenant_id: shop.id,
        catalog_id: null,
        name: `Forged ${tag}`,
        make: "Forgedmake",
        model: `F ${tag}`,
        vehicle_type: "motorbike",
        cc: 125,
        transmission: "automatic",
        catalog_reject_reason: "Forged",
        catalog_rejected_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(await outcome(created!.id)).toMatchObject({
      catalog_rejected_at: null,
      catalog_reject_reason: null,
    });
  });

  it("sending the model again clears the old outcome", async () => {
    const model = await addModel();
    await reject(await submit(model), "Missing the model year");
    expect((await outcome(model))!.catalog_reject_reason).toBe(
      "Missing the model year",
    );
    const again = await submit(model);
    expect(await outcome(model)).toMatchObject({
      catalog_id: again,
      catalog_rejected_at: null,
      catalog_reject_reason: null,
    });
  });
});
