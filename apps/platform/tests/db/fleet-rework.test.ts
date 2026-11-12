/**
 * Fleet rework (migration 20261113000100): categories on every model, the
 * approval date for the shop, and the CSV import carrying categories.
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
      .from("models")
      .select(
        "catalog_id, categories, catalog_approved_at, catalog_rejected_at, catalog_reject_reason, marketplace_listed",
      )
      .eq("id", id)
      .single()
  ).data!;

async function addModel(extra: object = {}): Promise<string> {
  const { data, error } = await shop.members.owner.db
    .from("models")
    .insert(own(extra))
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function submit(modelId: string): Promise<string> {
  const { data, error } = await shop.members.owner.db.rpc(
    "submit_model_to_catalog",
    { p_model_id: modelId, p_type: "sport" },
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
      .from("models")
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
        .from("models")
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
      .from("models")
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
      .from("models")
      .update({ catalog_approved_at: null })
      .eq("id", model);
    expect((await row(model)).catalog_approved_at).not.toBeNull();

    const forged = await addModel({
      catalog_approved_at: new Date().toISOString(),
    });
    expect((await row(forged)).catalog_approved_at).toBeNull();

    await manager
      .from("models")
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
          model_id: carId,
          location_id: shop.locationId,
          plate: `IMP-${tag}`,
          plate_pending: false,
        },
      ],
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ models: 2, units: 1 });
    expect((await row(carId)).categories).toEqual(["suv", "pickup"]);
    expect((await row(listedId)).categories).toEqual(["city_scooter"]);
  });
});
