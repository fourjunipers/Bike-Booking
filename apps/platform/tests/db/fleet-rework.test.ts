/**
 * Fleet rework (migration 20261113000100): categories on every model, the
 * approval date for the shop, the CSV import carrying categories, retiring a
 * make & model, and withdrawing a request when its model is deleted.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCatalogEntry,
  createTenant,
  createUser,
  deleteTenant,
  deleteUser,
  removeCatalogEntry,
  serviceClient,
  type TestTenant,
  type TestUser,
} from "./helpers";

let shop: TestTenant;
let admin: TestUser;
let presetId: string;
const catalogIds: string[] = [];
const service = serviceClient();
const tag = Math.random().toString(36).slice(2, 8);

let counter = 0;
const own = (extra: object = {}) => ({
  tenant_id: shop.id,
  catalog_id: null,
  name: `Rework ${tag} ${++counter}`,
  make: "Reworkmake",
  model: `RW ${tag} ${counter}`,
  vehicle_type: "motorbike",
  cc: 125,
  transmission: "automatic" as const,
  ...extra,
});

const row = async (id: string) =>
  (
    await service
      .from("products")
      .select(
        "catalog_id, categories, catalog_approved_at, catalog_rejected_at, catalog_reject_reason, marketplace_listed",
      )
      .eq("id", id)
      .single()
  ).data!;

async function addModel(extra: object = {}): Promise<string> {
  const { data, error } = await shop.members.owner.db
    .from("products")
    .insert(own(extra))
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function submit(modelId: string): Promise<string> {
  const { data, error } = await shop.members.owner.db.rpc(
    "submit_product_to_catalog",
    { p_product_id: modelId, p_year: 2024, p_type: "sport" },
  );
  if (error) throw error;
  catalogIds.push(data);
  return data;
}

beforeAll(async () => {
  presetId = await createCatalogEntry("rework");
  [shop, admin] = await Promise.all([
    createTenant("rework"),
    createUser("rework-admin"),
  ]);
  await service.from("platform_admins").insert({ user_id: admin.id });
}, 120_000);

afterAll(async () => {
  await deleteTenant(shop);
  await deleteUser(admin);
  for (const id of [presetId, ...catalogIds]) await removeCatalogEntry(id);
});

describe("a model's categories", () => {
  it("a motorbike put on a list entry takes the entry's type", async () => {
    const id = await addModel({ catalog_id: presetId });
    // createCatalogEntry files its entries as city scooters.
    expect((await row(id)).categories).toEqual(["city_scooter"]);
  });

  it("a model can have several", async () => {
    const id = await addModel({ categories: ["touring", "adventure"] });
    expect((await row(id)).categories).toEqual(["touring", "adventure"]);
    // Cleared on a list entry, it goes back to the entry's type.
    await shop.members.owner.db
      .from("products")
      .update({ catalog_id: presetId, categories: [] })
      .eq("id", id)
      .throwOnError();
    expect((await row(id)).categories).toEqual(["city_scooter"]);
  });

  it("the shop's own choice is kept, on a list entry or not", async () => {
    const listed = await addModel({
      catalog_id: presetId,
      categories: ["touring"],
    });
    expect((await row(listed)).categories).toEqual(["touring"]);
    const car = await addModel({
      vehicle_type: "car",
      cc: null,
      transmission: null,
      categories: ["suv", "pickup"],
    });
    expect((await row(car)).categories).toEqual(["suv", "pickup"]);
  });

  it("a typed-in model has no category until the shop gives one", async () => {
    expect((await row(await addModel())).categories).toEqual([]);
  });

  it("only lower-case keys are stored", async () => {
    for (const categories of [
      ["Not A Key!"],
      ["suv", "Pickup"],
      // A comma inside one value can't pass as two keys.
      ["suv,pickup"],
      [""],
      Array.from({ length: 11 }, (_, i) => `key_${i}`),
    ]) {
      const { error } = await shop.members.owner.db
        .from("products")
        .insert(own({ categories }));
      expect(error?.code, JSON.stringify(categories)).toBe("23514");
    }
  });
});

describe("the shop is told when Moto Mangos adds its model", () => {
  const review = (catalogId: string, approve: boolean, mergeInto?: string) =>
    admin.db.rpc("review_catalog_request", {
      p_catalog_id: catalogId,
      p_approve: approve,
      p_merge_into: mergeInto,
    });

  it("approving sets the date on the shop's model", async () => {
    const model = await addModel();
    const entry = await submit(model);
    expect((await row(model)).catalog_approved_at).toBeNull();
    expect((await review(entry, true)).error).toBeNull();
    const after = await row(model);
    expect(after.catalog_id).toBe(entry);
    expect(Date.parse(after.catalog_approved_at!)).toBeGreaterThan(
      Date.now() - 60_000,
    );
    expect(after.catalog_rejected_at).toBeNull();
    // Sending it was asking for it to be listed: approved means listed.
    expect(after.marketplace_listed).toBe(true);
    // The shop can still switch it off.
    await shop.members.owner.db
      .from("products")
      .update({ marketplace_listed: false })
      .eq("id", model)
      .throwOnError();
    expect((await row(model)).marketplace_listed).toBe(false);
  });

  it("merging into an existing entry sets it too", async () => {
    const model = await addModel();
    const entry = await submit(model);
    expect((await review(entry, false, presetId)).error).toBeNull();
    const after = await row(model);
    expect(after.catalog_id).toBe(presetId);
    expect(after.catalog_approved_at).not.toBeNull();
    expect(after.marketplace_listed).toBe(true);
  });

  it("rejecting sets the rejection, not an approval", async () => {
    const model = await addModel();
    expect((await review(await submit(model), false)).error).toBeNull();
    const after = await row(model);
    expect(after.catalog_approved_at).toBeNull();
    expect(after.catalog_rejected_at).not.toBeNull();
    expect(after.marketplace_listed).toBe(false);
  });

  it("a rejected model can be sent again: it waits again, and the old reason stays on the old request", async () => {
    const model = await addModel();
    const first = await submit(model);
    const rejected = await admin.db.rpc("review_catalog_request", {
      p_catalog_id: first,
      p_approve: false,
      p_notes: "Add the model years",
    });
    expect(rejected.error).toBeNull();
    const back = await row(model);
    // Back with the shop, with the reason.
    expect(back.catalog_id).toBeNull();
    expect(back.catalog_reject_reason).toBe("Add the model years");

    const second = await submit(model);
    expect(second).not.toBe(first);
    const waiting = await row(model);
    expect(waiting.catalog_id).toBe(second);
    // Pending again: the model no longer shows the old outcome...
    expect(waiting.catalog_rejected_at).toBeNull();
    expect(waiting.catalog_reject_reason).toBeNull();
    // ...which is kept on the request that was turned down.
    const { data: entries } = await service
      .schema("public")
      .from("bike_catalog")
      .select("id, status, review_notes")
      .in("id", [first, second]);
    expect(entries?.find((e) => e.id === first)).toMatchObject({
      status: "rejected",
      review_notes: "Add the model years",
    });
    expect(entries?.find((e) => e.id === second)?.status).toBe("requested");
  });

  it("the shop can't write the date, and moving the model off the entry clears it", async () => {
    const model = await addModel();
    const entry = await submit(model);
    await review(entry, true);
    const manager = shop.members.manager.db;
    await manager
      .from("products")
      .update({ catalog_approved_at: null })
      .eq("id", model);
    expect((await row(model)).catalog_approved_at).not.toBeNull();

    const forged = await addModel({
      catalog_approved_at: new Date().toISOString(),
    });
    expect((await row(forged)).catalog_approved_at).toBeNull();

    await manager
      .from("products")
      .update({ catalog_id: presetId })
      .eq("id", model);
    expect(await row(model)).toMatchObject({
      catalog_id: presetId,
      catalog_approved_at: null,
    });
  });
});

describe("CSV import", () => {
  it("saves each new model's categories, and a list model takes the list's", async () => {
    const [carId, listedId] = [randomUUID(), randomUUID()];
    const { data, error } = await shop.members.owner.db.rpc("import_fleet", {
      p_tenant_id: shop.id,
      p_models: [
        {
          id: carId,
          catalog_id: null,
          name: `Import car ${tag}`,
          make: "Importmake",
          model: `Car ${tag}`,
          vehicle_type: "car",
          cc: null,
          transmission: null,
          categories: ["suv", "pickup"],
        },
        { id: listedId, catalog_id: presetId, name: `Import listed ${tag}` },
      ],
      p_units: [
        {
          product_id: carId,
          location_id: shop.locationId,
          plate: `IMP-${tag}`,
          plate_pending: false,
        },
      ],
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ products: 2, units: 1 });
    expect((await row(carId)).categories).toEqual(["suv", "pickup"]);
    expect((await row(listedId)).categories).toEqual(["city_scooter"]);
  });
});

describe("retiring a make & model", () => {
  const owner = () => shop.members.owner.db;
  const addUnit = async (modelId: string, status = "active") => {
    const { data, error } = await service
      .from("units")
      .insert({
        tenant_id: shop.id,
        product_id: modelId,
        location_id: shop.locationId,
        plate: `RW-${tag}-${++counter}`,
        status,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  };
  const retire = (id: string, on = true) =>
    owner()
      .from("products")
      .update({ retired_at: on ? new Date().toISOString() : null })
      .eq("id", id)
      .select("retired_at, marketplace_listed");
  const setStatus = (unit: string, status: string) =>
    owner().from("units").update({ status }).eq("id", unit).select("status");

  it("is refused while one of its vehicles is in the fleet, and allowed once they are all retired or sold", async () => {
    const model = await addModel();
    const first = await addUnit(model);
    const second = await addUnit(model, "maintenance");
    expect((await retire(model)).error?.message).toContain(
      "model_has_active_units",
    );
    await setStatus(first, "retired");
    expect((await retire(model)).error?.message).toContain(
      "model_has_active_units",
    );
    await setStatus(second, "sold");
    const done = await retire(model);
    expect(done.error).toBeNull();
    expect(done.data?.[0].retired_at).not.toBeNull();
  });

  it("takes the model off Moto Mangos, and it can't be listed while retired", async () => {
    const model = await addModel({
      catalog_id: presetId,
      marketplace_listed: true,
    });
    expect((await row(model)).marketplace_listed).toBe(true);
    const done = await retire(model);
    expect(done.error).toBeNull();
    expect(done.data?.[0].marketplace_listed).toBe(false);
    const listed = await owner()
      .from("products")
      .update({ marketplace_listed: true })
      .eq("id", model)
      .select("id");
    expect(listed.error?.message).toContain("model_retired");
    // Restored, it can be listed again.
    expect((await retire(model, false)).error).toBeNull();
    const again = await owner()
      .from("products")
      .update({ marketplace_listed: true })
      .eq("id", model)
      .select("marketplace_listed");
    expect(again.data).toEqual([{ marketplace_listed: true }]);
  });

  it("a retired model takes no vehicle that is in the fleet until it is restored", async () => {
    const model = await addModel();
    const unit = await addUnit(model, "retired");
    expect((await retire(model)).error).toBeNull();
    // Not a new one...
    const added = await owner()
      .from("units")
      .insert({
        tenant_id: shop.id,
        product_id: model,
        location_id: shop.locationId,
        plate: `RW-${tag}-new`,
      });
    expect(added.error?.message).toContain("model_retired");
    // ...and not its own vehicle restored.
    expect((await setStatus(unit, "active")).error?.message).toContain(
      "model_retired",
    );
    expect((await retire(model, false)).error).toBeNull();
    expect((await setStatus(unit, "active")).data).toEqual([
      { status: "active" },
    ]);
  });

  it("only an owner or a manager can retire one, and the audit trail says who", async () => {
    const model = await addModel();
    const staff = await shop.members.staff.db
      .from("products")
      .update({ retired_at: new Date().toISOString() })
      .eq("id", model)
      .select("id");
    expect(staff.data ?? []).toEqual([]);
    expect((await retire(model)).error).toBeNull();
    const { data: audit } = await service
      .from("audit_events")
      .select("action, actor, after")
      .eq("entity", "products")
      .eq("entity_id", model)
      .order("id", { ascending: false })
      .limit(1);
    expect(audit?.[0]).toMatchObject({
      action: "update",
      actor: shop.members.owner.id,
    });
    expect(
      (audit?.[0].after as { retired_at?: string }).retired_at,
    ).toBeTruthy();
  });
});

describe("deleting vehicles and models", () => {
  const past = (days: number) =>
    new Date(Date.now() - days * 86_400_000).toISOString();
  const unitWithBlock = async (kind: string) => {
    const model = await addModel();
    const { data: unit } = await service
      .from("units")
      .insert({
        tenant_id: shop.id,
        product_id: model,
        location_id: shop.locationId,
        plate: `RW-${tag}-${kind}-${++counter}`,
      })
      .select("id")
      .single();
    const { error } = await service.from("unit_blocks").insert({
      tenant_id: shop.id,
      unit_id: unit!.id,
      kind,
      period: `[${past(3)},${past(2)})`,
    });
    expect(error).toBeNull();
    return unit!.id;
  };

  it("a vehicle's old downtime goes with it: it can be deleted (it could not before)", async () => {
    const unit = await unitWithBlock("downtime");
    const owner = shop.members.owner.db;
    const { data, error } = await owner
      .from("units")
      .delete()
      .eq("id", unit)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: unit }]);
    const { data: left } = await service
      .from("unit_blocks")
      .select("id")
      .eq("unit_id", unit);
    expect(left).toEqual([]);
    // Who deleted it is on record.
    const { data: audit } = await service
      .from("audit_events")
      .select("action, actor")
      .eq("entity", "units")
      .eq("entity_id", unit)
      .eq("action", "delete");
    expect(audit).toEqual([{ action: "delete", actor: shop.members.owner.id }]);
  });

  it("staff can't delete a vehicle, and its downtime stays", async () => {
    const unit = await unitWithBlock("downtime");
    const { data } = await shop.members.staff.db
      .from("units")
      .delete()
      .eq("id", unit)
      .select("id");
    expect(data ?? []).toEqual([]);
    const { data: left } = await service
      .from("unit_blocks")
      .select("id")
      .eq("unit_id", unit);
    expect(left).toHaveLength(1);
  });

  it("a vehicle that was on a booking can't be deleted, but can be retired", async () => {
    const unit = await unitWithBlock("allocation");
    const owner = shop.members.owner.db;
    const deleted = await owner.from("units").delete().eq("id", unit);
    // What the app turns into "Retire instead".
    expect(deleted.error?.code).toBe("23503");
    const retired = await owner
      .from("units")
      .update({ status: "retired" })
      .eq("id", unit)
      .select("status");
    expect(retired.data).toEqual([{ status: "retired" }]);
  });

  it("deleting a model that waits for review withdraws its request", async () => {
    const model = await addModel();
    const entry = await submit(model);
    const { error } = await shop.members.owner.db
      .from("products")
      .delete()
      .eq("id", model);
    expect(error).toBeNull();
    const { data } = await service
      .schema("public")
      .from("bike_catalog")
      .select("status, review_notes, reviewed_at")
      .eq("id", entry)
      .single();
    expect(data).toMatchObject({
      status: "rejected",
      review_notes: "Withdrawn: the shop deleted the model.",
    });
    expect(data?.reviewed_at).not.toBeNull();
  });

  it("deleting a model on the list leaves the list entry alone", async () => {
    const model = await addModel({ catalog_id: presetId });
    await shop.members.owner.db
      .from("products")
      .delete()
      .eq("id", model)
      .throwOnError();
    const { data } = await service
      .schema("public")
      .from("bike_catalog")
      .select("status")
      .eq("id", presetId)
      .single();
    expect(data?.status).toBe("approved");
  });
});
