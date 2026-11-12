/**
 * The independent Phase 1a review (11 Nov 2026): one test per finding. Each
 * failed before its migration (20261111000700 to 20261111001300) and passes
 * after. The numbers are the review's.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runningAt } from "@/lib/fleet";
import {
  anonClient,
  createCatalogEntry,
  createTenant,
  createUser,
  deleteTenant,
  deleteUser,
  hours,
  period,
  removeCatalogEntry,
  serviceClient,
  sqlAs,
  type TestTenant,
  type TestUser,
} from "./helpers";

let shop: TestTenant;
let other: TestTenant;
// Its own shop: before the fix this race really does leave it with no owner.
let team: TestTenant;
let admin: TestUser;
let admin2: TestUser;
let presetId: string;
const catalogIds: string[] = [];
const service = serviceClient();
const tag = Math.random().toString(36).slice(2, 8);

let counter = 0;
const ownModel = (extra: object = {}) => ({
  tenant_id: shop.id,
  catalog_id: null,
  name: `Review ${tag} ${++counter}`,
  make: "Reviewmake",
  model: `R ${tag} ${counter}`,
  vehicle_type: "motorbike",
  cc: 125,
  transmission: "automatic" as const,
  ...extra,
});

async function addModel(extra: object = {}): Promise<string> {
  const { data, error } = await service
    .from("models")
    .insert(ownModel(extra))
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function addUnit(modelId: string, status = "active"): Promise<string> {
  const { data, error } = await service
    .from("units")
    .insert({
      tenant_id: shop.id,
      model_id: modelId,
      location_id: shop.locationId,
      plate: `RV-${tag}-${++counter}`,
      status,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Submits one of the shop's models for Moto Mangos; returns the catalog entry's id. */
async function submit(
  modelId: string,
  note = "A private note",
): Promise<string> {
  const { data, error } = await shop.members.owner.db.rpc(
    "submit_model_to_catalog",
    { p_model_id: modelId, p_type: "city_scooter", p_note: note },
  );
  if (error) throw error;
  catalogIds.push(data);
  return data;
}

const review = (
  who: TestUser,
  catalogId: string,
  approve: boolean,
  mergeInto?: string,
) =>
  who.db.rpc("review_catalog_request", {
    p_catalog_id: catalogId,
    p_approve: approve,
    p_merge_into: mergeInto,
  });

const catalogRow = async (id: string) =>
  (
    await service
      .schema("public")
      .from("bike_catalog")
      .select("status, request_note, requested_by_tenant_id, review_notes")
      .eq("id", id)
      .single()
  ).data!;

const block = (unitId: string, from: Date, to?: Date) => ({
  tenant_id: shop.id,
  unit_id: unitId,
  kind: "downtime",
  period: period(from, to),
});

const futureBlocks = async (unitId: string) =>
  (
    await service
      .from("unit_blocks")
      .select("id")
      .eq("unit_id", unitId)
      .overlaps("period", period(new Date(), hours(100_000)))
  ).data!.length;

beforeAll(async () => {
  presetId = await createCatalogEntry("review");
  [shop, other, team, admin, admin2] = await Promise.all([
    createTenant("review-a"),
    createTenant("review-b"),
    createTenant("review-team"),
    createUser("review-admin"),
    createUser("review-admin2"),
  ]);
  await service
    .from("platform_admins")
    .insert([{ user_id: admin.id }, { user_id: admin2.id }]);
}, 120_000);

afterAll(async () => {
  await Promise.all([
    deleteTenant(shop),
    deleteTenant(other),
    deleteTenant(team),
  ]);
  await Promise.all([deleteUser(admin), deleteUser(admin2)]);
  for (const id of [presetId, ...catalogIds]) await removeCatalogEntry(id);
});

describe("1. the catalog's private fields", () => {
  const privateColumns = [
    "request_note",
    "requested_by_tenant_id",
    "review_notes",
  ];
  // What the marketplace's public and vendor pages select.
  const publicColumns =
    "id, slug, make, model, year_from, year_to, cc, type, transmission, abs, underseat_storage, usb_charger, key_type, description, stock_photo, status";

  it("approving clears the shop's note and which shop asked; the audit row keeps them", async () => {
    const entry = await submit(await addModel(), "Only for the admin");
    expect(await catalogRow(entry)).toMatchObject({
      request_note: "Only for the admin",
      requested_by_tenant_id: shop.id,
    });
    expect((await review(admin, entry, true)).error).toBeNull();
    expect(await catalogRow(entry)).toMatchObject({
      status: "approved",
      request_note: null,
      requested_by_tenant_id: null,
    });
    const { data: audit } = await service
      .from("audit_events")
      .select("tenant_id, before")
      .eq("entity", "bike_catalog")
      .eq("entity_id", entry)
      .eq("action", "approve")
      .single();
    expect(audit).toMatchObject({
      tenant_id: shop.id,
      before: { request_note: "Only for the admin" },
    });
  });

  it("no visitor and no shop user can select the private columns, on any entry", async () => {
    const waiting = await submit(await addModel(), "Still private");
    const readers = {
      anon: anonClient(),
      "the shop that asked": shop.members.owner.db,
      "another shop": other.members.owner.db,
      // An admin is a signed-in user too: the admin path is the function.
      admin: admin.db,
    };
    for (const [who, db] of Object.entries(readers)) {
      const catalog = () => db.schema("public").from("bike_catalog");
      for (const column of privateColumns) {
        const { data, error } = await catalog().select(column).limit(1);
        expect(error?.code, `${who}: ${column}`).toBe("42501");
        expect(data, `${who}: ${column}`).toBeNull();
      }
      expect((await catalog().select("*").limit(1)).error?.code, who).toBe(
        "42501",
      );
      // Filtering on one is refused too, so it can't be guessed at.
      const guess = await catalog()
        .select("id")
        .eq("requested_by_tenant_id", shop.id);
      expect(guess.error?.code, who).toBe("42501");
    }
    // The shop still sees its own waiting request, minus those columns.
    const own = await shop.members.manager.db
      .schema("public")
      .from("bike_catalog")
      .select(publicColumns)
      .eq("id", waiting);
    expect(own.data).toHaveLength(1);
    const others = await other.members.owner.db
      .schema("public")
      .from("bike_catalog")
      .select("id")
      .eq("id", waiting);
    expect(others.data).toEqual([]);
  });

  it("the marketplace still reads what it needs: approved entries, by name, signed out", async () => {
    const { data, error } = await anonClient()
      .schema("public")
      .from("bike_catalog")
      .select(publicColumns)
      .eq("id", presetId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ make: "Testmake", status: "approved" });
  });

  it("platform admins see waiting requests with the private fields; nobody else gets a row", async () => {
    const waiting = await submit(await addModel(), "For the admin's eyes");
    const { data, error } = await admin.db.rpc("catalog_requests");
    expect(error).toBeNull();
    expect(data!.find((r: { id: string }) => r.id === waiting)).toMatchObject({
      request_note: "For the admin's eyes",
      requested_by_tenant_id: shop.id,
      requested_by_tenant_name: "Test review-a",
    });
    for (const db of [shop.members.owner.db, other.members.owner.db]) {
      expect((await db.rpc("catalog_requests")).data).toEqual([]);
    }
    expect((await anonClient().rpc("catalog_requests")).error).not.toBeNull();
  });
});

describe("2. the audit helper checks its caller", () => {
  const forge = (userId: string, tenantId: string, action: string) =>
    sqlAs(
      userId,
      `select platform_private.audit('${tenantId}', 'units', 'forged', '${action}');`,
    );
  const written = async (tenantId: string, action: string) =>
    (
      await service
        .from("audit_events")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("action", action)
    ).data!.length;

  it("a signed-in user of tenant A can't write an audit row for tenant B", async () => {
    const action = `forged-${tag}`;
    const attempt = forge(shop.members.owner.id, other.id, action);
    expect(attempt.failed).toContain("audit_not_allowed");
    expect(await written(other.id, action)).toBe(0);
  });

  it("a member can for their own tenant, and a platform admin for any (catalog reviews)", async () => {
    const action = `own-${tag}`;
    expect(forge(shop.members.staff.id, shop.id, action).failed).toBe("");
    expect(forge(admin.id, shop.id, action).failed).toBe("");
    expect(await written(shop.id, action)).toBe(2);
  });
});

describe("3. owners changing each other at the same instant", () => {
  const owners = async () =>
    (
      await service
        .from("memberships")
        .select("id")
        .eq("tenant_id", team.id)
        .eq("role", "owner")
    ).data!.length;
  const makeBothOwners = async () => {
    const { error } = await service
      .from("memberships")
      .update({ role: "owner" })
      .in("id", [
        team.members.owner.membershipId,
        team.members.manager.membershipId,
      ]);
    if (error) throw error;
  };

  it("two owners demoting each other: one succeeds, the other is refused, an owner remains", async () => {
    for (let round = 0; round < 10; round++) {
      await makeBothOwners();
      const results = await Promise.all([
        team.members.owner.db.rpc("set_member_role", {
          p_membership_id: team.members.manager.membershipId,
          p_role: "manager",
        }),
        team.members.manager.db.rpc("set_member_role", {
          p_membership_id: team.members.owner.membershipId,
          p_role: "manager",
        }),
      ]);
      expect(await owners(), `round ${round}`).toBe(1);
      // The loser is told why: either the last owner can't go, or (having
      // just been demoted) they are no longer allowed to change an owner.
      const errors = results.filter((r) => r.error);
      expect(errors, `round ${round}`).toHaveLength(1);
      expect(["P0001", "42501"], `round ${round}`).toContain(
        errors[0].error!.code,
      );
    }
    await makeBothOwners();
    await service
      .from("memberships")
      .update({ role: "manager" })
      .eq("id", team.members.manager.membershipId);
  }, 60_000);

  it("the same for one owner removing the other while being demoted by them", async () => {
    for (let round = 0; round < 5; round++) {
      // A second owner to race with, added fresh each round.
      const { data: second, error } = await service
        .from("memberships")
        .insert({
          tenant_id: team.id,
          user_id: other.members.owner.id,
          role: "owner",
        })
        .select("id")
        .single();
      if (error) throw error;
      await Promise.all([
        team.members.owner.db.rpc("remove_member", {
          p_membership_id: second.id,
        }),
        other.members.owner.db.rpc("set_member_role", {
          p_membership_id: team.members.owner.membershipId,
          p_role: "staff",
        }),
      ]);
      expect(await owners(), `round ${round}`).toBeGreaterThanOrEqual(1);
      await service
        .from("memberships")
        .update({ role: "owner" })
        .eq("id", team.members.owner.membershipId);
      await service.from("memberships").delete().eq("id", second.id);
    }
  }, 60_000);
});

describe("4. a sold or retired bike never has a future block", () => {
  let modelId: string;
  beforeAll(async () => {
    modelId = await addModel();
  });
  const statusOf = async (unitId: string) =>
    (await service.from("units").select("status").eq("id", unitId).single())
      .data!.status;

  it("selling a bike while someone adds a block to it: one wins, never both", async () => {
    for (let round = 0; round < 12; round++) {
      const unitId = await addUnit(modelId);
      const [sale, added] = await Promise.all([
        shop.members.owner.db
          .from("units")
          .update({ status: round % 2 ? "sold" : "retired" })
          .eq("id", unitId)
          .select("id"),
        shop.members.mechanic.db
          .from("unit_blocks")
          .insert(block(unitId, hours(1))),
      ]);
      const gone = (await statusOf(unitId)) !== "active";
      const blocked = (await futureBlocks(unitId)) > 0;
      expect(gone && blocked, `round ${round}: sold with a future block`).toBe(
        false,
      );
      expect(
        [sale.error?.message, added.error?.message].filter(Boolean),
        `round ${round}`,
      ).toHaveLength(1);
      if (sale.error)
        expect(sale.error.message).toContain("unit_has_future_blocks");
      else expect(added.error?.message).toContain("unit_not_in_fleet");
    }
  }, 60_000);

  it("a block can't be moved onto a sold bike", async () => {
    const [inFleet, sold, alsoInFleet] = await Promise.all([
      addUnit(modelId),
      addUnit(modelId, "sold"),
      addUnit(modelId),
    ]);
    const { data: added, error } = await service
      .from("unit_blocks")
      .insert(block(inFleet, hours(5), hours(6)))
      .select("id")
      .single();
    if (error) throw error;
    for (const db of [service, shop.members.manager.db]) {
      const moved = await db
        .from("unit_blocks")
        .update({ unit_id: sold })
        .eq("id", added.id)
        .select("id");
      expect(moved.error?.message).toContain("unit_not_in_fleet");
    }
    expect(await futureBlocks(sold)).toBe(0);
    // Moving it to a bike that is in the fleet still works.
    const ok = await service
      .from("unit_blocks")
      .update({ unit_id: alsoInFleet })
      .eq("id", added.id)
      .select("unit_id");
    expect(ok.data).toEqual([{ unit_id: alsoInFleet }]);
  });

  it("a sold bike's old block can be shortened but not stretched into the future", async () => {
    const unitId = await addUnit(modelId);
    const { data: old, error } = await service
      .from("unit_blocks")
      .insert(block(unitId, hours(-10), hours(-5)))
      .select("id")
      .single();
    if (error) throw error;
    const sale = await service
      .from("units")
      .update({ status: "sold" })
      .eq("id", unitId);
    expect(sale.error).toBeNull();

    const change = (from: Date, to?: Date) =>
      service
        .from("unit_blocks")
        .update({ period: period(from, to) })
        .eq("id", old.id)
        .select("id");
    expect((await change(hours(-10), hours(48))).error?.message).toContain(
      "unit_not_in_fleet",
    );
    expect((await change(hours(-10))).error?.message).toContain(
      "unit_not_in_fleet",
    );
    expect((await change(hours(-20), hours(-5))).error?.message).toContain(
      "unit_not_in_fleet",
    );
    expect(await futureBlocks(unitId)).toBe(0);
    expect((await change(hours(-10), hours(-6))).data).toHaveLength(1);
  });
});

describe("5. review_catalog_request", () => {
  it("(a) leaves marketplace shops' requests alone: only a platform shop's request is found", async () => {
    // A waiting entry no platform shop sent (the marketplace's own queue).
    const { data: entry, error } = await service
      .schema("public")
      .from("bike_catalog")
      .insert({
        make: "Marketmake",
        model: `M ${tag}`,
        type: "city_scooter",
        transmission: "automatic",
        cc: 125,
        status: "requested",
      })
      .select("id")
      .single();
    if (error) throw error;
    catalogIds.push(entry.id);
    for (const approve of [true, false]) {
      const result = await review(admin, entry.id, approve);
      expect(result.error?.code).toBe("P0002");
    }
    expect((await review(admin, entry.id, false, presetId)).error?.code).toBe(
      "P0002",
    );
    expect((await catalogRow(entry.id)).status).toBe("requested");
  });

  it("(a) two admins deciding the same request at once: one decision, one audit row", async () => {
    for (let round = 0; round < 8; round++) {
      const entry = await submit(await addModel());
      const results = await Promise.all([
        review(admin, entry, true),
        review(admin2, entry, false),
      ]);
      const codes = results.map((r) => r.error?.code ?? "ok").sort();
      expect(codes, `round ${round}`).toEqual(["P0002", "ok"]);
      const { data: audit } = await service
        .from("audit_events")
        .select("action")
        .eq("entity", "bike_catalog")
        .eq("entity_id", entry)
        .in("action", ["approve", "reject", "merge"]);
      expect(audit, `round ${round}`).toHaveLength(1);
      // What was recorded is what the entry says.
      expect((await catalogRow(entry)).status, `round ${round}`).toBe(
        audit![0].action === "approve" ? "approved" : "rejected",
      );
    }
  }, 60_000);

  it("(b) reject, when the shop has since added the same make and model again: no error, the model stays linked, and the answer says so", async () => {
    const twin = { make: "Twinmake", model: `Twin ${tag}` };
    const first = await addModel(twin);
    const entry = await submit(first);
    // Allowed while the first one is linked to its submission.
    const second = await addModel({ ...twin, make: "twin make" });
    const untouched = await addModel();

    const { data, error } = await review(admin, entry, false);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      decision: "reject",
      kept_linked: [{ model_id: first }],
    });
    expect((await catalogRow(entry)).status).toBe("rejected");
    const { data: models } = await service
      .from("models")
      .select("id, catalog_id, marketplace_listed")
      .in("id", [first, second, untouched])
      .order("created_at");
    expect(models).toEqual([
      { id: first, catalog_id: entry, marketplace_listed: false },
      { id: second, catalog_id: null, marketplace_listed: false },
      { id: untouched, catalog_id: null, marketplace_listed: false },
    ]);
    const { data: audit } = await service
      .from("audit_events")
      .select("after")
      .eq("entity_id", entry)
      .eq("action", "reject")
      .single();
    expect(
      (audit!.after as { kept_linked: { model_id: string }[] }).kept_linked,
    ).toMatchObject([{ model_id: first }]);
  });

  it("(b) an ordinary reject still gives the model back, and says nothing stayed linked", async () => {
    const modelId = await addModel();
    const { data } = await review(admin, await submit(modelId), false);
    expect(data).toEqual({ decision: "reject", kept_linked: [] });
    const { data: model } = await service
      .from("models")
      .select("catalog_id")
      .eq("id", modelId)
      .single();
    expect(model?.catalog_id).toBeNull();
  });

  it("(c) approve, merge and reject each write one audit row, under the shop, by the admin", async () => {
    const entries = {
      approve: await submit(await addModel()),
      merge: await submit(await addModel()),
      reject: await submit(await addModel()),
    };
    expect((await review(admin, entries.approve, true)).data).toMatchObject({
      decision: "approve",
    });
    expect(
      (await review(admin, entries.merge, false, presetId)).data,
    ).toMatchObject({ decision: "merge" });
    expect((await review(admin, entries.reject, false)).data).toMatchObject({
      decision: "reject",
    });
    for (const [action, entry] of Object.entries(entries)) {
      const { data } = await service
        .from("audit_events")
        .select("tenant_id, actor, action")
        .eq("entity", "bike_catalog")
        .eq("entity_id", entry)
        .neq("action", "submit");
      expect(data, action).toEqual([
        { tenant_id: shop.id, actor: admin.id, action },
      ]);
    }
  });
});

describe("6. booking-mode counts follow the active bikes", () => {
  const counts = async (modelId: string) =>
    (
      await service
        .from("models")
        .select("instant_units, request_units, ready_now")
        .eq("id", modelId)
        .single()
    ).data!;
  const clamps = async (modelId: string) =>
    (
      await service
        .from("audit_events")
        .select("actor, before, after")
        .eq("entity", "models")
        .eq("entity_id", modelId)
        .eq("action", "clamp_booking_counts")
        .order("id")
    ).data!;

  it("moving a bike to maintenance clamps the counts down, with an audit row; coming back doesn't raise them", async () => {
    const modelId = await addModel();
    const units = [
      await addUnit(modelId),
      await addUnit(modelId),
      await addUnit(modelId),
    ];
    const set = await shop.members.manager.db
      .from("models")
      .update({ instant_units: 2, request_units: 1, ready_now: 3 })
      .eq("id", modelId)
      .select("id");
    expect(set.data).toHaveLength(1);

    // A mechanic takes one off the road.
    const off = await shop.members.mechanic.db
      .from("units")
      .update({ status: "maintenance" })
      .eq("id", units[0])
      .select("id");
    expect(off.data).toHaveLength(1);
    expect(await counts(modelId)).toEqual({
      instant_units: 2,
      request_units: 0,
      ready_now: 2,
    });
    expect(await clamps(modelId)).toMatchObject([
      {
        actor: shop.members.mechanic.id,
        before: { instant_units: 2, request_units: 1, ready_now: 3 },
        after: {
          instant_units: 2,
          request_units: 0,
          ready_now: 2,
          active_units: 2,
          because_unit: units[0],
          unit_change: "status active -> maintenance",
        },
      },
    ]);

    // Back on the road: nothing goes up by itself.
    await shop.members.mechanic.db
      .from("units")
      .update({ status: "active" })
      .eq("id", units[0]);
    expect(await counts(modelId)).toEqual({
      instant_units: 2,
      request_units: 0,
      ready_now: 2,
    });
    expect(await clamps(modelId)).toHaveLength(1);
  });

  it("selling, deleting and moving a bike to another model clamp too; a change that leaves enough bikes doesn't", async () => {
    const [modelId, elsewhere] = [await addModel(), await addModel()];
    const units = [];
    for (let i = 0; i < 4; i++) units.push(await addUnit(modelId));
    await service
      .from("models")
      .update({ instant_units: 2, request_units: 1, ready_now: 2 })
      .eq("id", modelId);

    // 4 -> 3 active: still enough for 2 + 1.
    await service.from("units").update({ status: "sold" }).eq("id", units[0]);
    expect(await clamps(modelId)).toHaveLength(0);
    // 3 -> 2: request_units gives way first.
    await service.from("units").delete().eq("id", units[1]);
    expect(await counts(modelId)).toEqual({
      instant_units: 2,
      request_units: 0,
      ready_now: 2,
    });
    // 2 -> 1: moved to another model.
    await service
      .from("units")
      .update({ model_id: elsewhere })
      .eq("id", units[2]);
    expect(await counts(modelId)).toEqual({
      instant_units: 1,
      request_units: 0,
      ready_now: 1,
    });
    expect((await clamps(modelId)).map((c) => c.after)).toMatchObject([
      { unit_change: "deleted", active_units: 2 },
      { unit_change: "moved to another model", active_units: 1 },
    ]);
    // The model it moved to isn't touched.
    expect(await clamps(elsewhere)).toHaveLength(0);
  });

  it("two bikes leaving at the same instant are both counted", async () => {
    for (let round = 0; round < 6; round++) {
      const modelId = await addModel();
      const units = [
        await addUnit(modelId),
        await addUnit(modelId),
        await addUnit(modelId),
      ];
      await service
        .from("models")
        .update({ instant_units: 3, ready_now: 3 })
        .eq("id", modelId);
      await Promise.all(
        units
          .slice(0, 2)
          .map((id, i) =>
            shop.members[i ? "staff" : "mechanic"].db
              .from("units")
              .update({ status: "maintenance" })
              .eq("id", id),
          ),
      );
      expect(await counts(modelId), `round ${round}`).toEqual({
        instant_units: 1,
        request_units: 0,
        ready_now: 1,
      });
    }
  }, 60_000);
});

describe("small fixes", () => {
  it("7. ending downtime only touches a block that is still running", async () => {
    const unitId = await addUnit(await addModel());
    const add = async (from: Date, to?: Date) =>
      (
        await service
          .from("unit_blocks")
          .insert(block(unitId, from, to))
          .select("id")
          .single()
      ).data!.id;
    const ended = await add(hours(-10), hours(-5));
    const running = await add(hours(-2));
    const now = new Date();
    // The update "End downtime" sends, as the mechanic.
    const end = (id: string) =>
      shop.members.mechanic.db
        .from("unit_blocks")
        .update({ period: period(hours(id === ended ? -10 : -2), now) })
        .eq("id", id)
        .overlaps("period", runningAt(now))
        .select("id, period");
    // A stale page: the block ended five hours ago. Nothing is re-extended.
    expect((await end(ended)).data).toEqual([]);
    const { data: still } = await service
      .from("unit_blocks")
      .select("period")
      .eq("id", ended)
      .single();
    expect(
      new Date(
        String(still!.period).split(",")[1].replace(/[")]/g, ""),
      ).getTime(),
    ).toBeLessThan(hours(-4).getTime());
    expect((await end(running)).data).toHaveLength(1);
  });

  it("8. a bike saved from an old form is refused: updated_at has moved on", async () => {
    const unitId = await addUnit(await addModel());
    const read = async () =>
      (
        await shop.members.manager.db
          .from("units")
          .select("updated_at, current_odometer_km")
          .eq("id", unitId)
          .single()
      ).data!;
    const opened = await read();
    // Meanwhile a mechanic records a newer reading.
    await shop.members.mechanic.db
      .from("units")
      .update({ current_odometer_km: 1500 })
      .eq("id", unitId);
    // The save the details form sends, with what it had when it was opened.
    const save = (updatedAt: string) =>
      shop.members.manager.db
        .from("units")
        .update({ colour: "Blue", current_odometer_km: 0 })
        .eq("id", unitId)
        .eq("updated_at", updatedAt)
        .select("id");
    expect((await save(opened.updated_at)).data).toEqual([]);
    expect((await read()).current_odometer_km).toBe(1500);
    // Reloaded, it saves.
    expect((await save((await read()).updated_at)).data).toHaveLength(1);
  });

  it("9. a 49 cc moped saves as the shop's own and can be submitted for Moto Mangos", async () => {
    const { data, error } = await shop.members.manager.db
      .from("models")
      .insert(ownModel({ cc: 49 }))
      .select("id")
      .single();
    expect(error).toBeNull();
    const sent = await shop.members.owner.db.rpc("submit_model_to_catalog", {
      p_model_id: data!.id,
      p_type: "city_scooter",
    });
    expect(sent.error).toBeNull();
    catalogIds.push(sent.data!);
    // Both hold the same range: the limits are 1 and 20000 on each.
    for (const cc of [0, 20001]) {
      const model = await service.from("models").insert(ownModel({ cc }));
      expect(model.error?.message, `models ${cc}`).toContain("models_cc_check");
      const entry = await service
        .schema("public")
        .from("bike_catalog")
        .insert({
          make: "Rangemake",
          model: `C ${tag} ${cc}`,
          type: "city_scooter",
          transmission: "automatic",
          cc,
        });
      expect(entry.error?.message, `catalog ${cc}`).toContain(
        "bike_catalog_cc_check",
      );
    }
  });
});
