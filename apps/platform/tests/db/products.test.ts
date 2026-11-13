/**
 * Products, stage A (migration 20261113000200): models became products with a
 * type and a tracking mode; a unit carries its product's type; and every
 * function that named the old table or column was re-created. Each of those
 * functions is run once here, so a body still naming `models` can't hide
 * until someone clicks it.
 */
import { randomUUID } from "node:crypto";
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
  sql,
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
const vehicle = (extra: object = {}) => ({
  tenant_id: shop.id,
  catalog_id: null,
  name: `Product ${tag} ${++counter}`,
  make: "Prodmake",
  model: `PM ${tag} ${counter}`,
  vehicle_type: "motorbike",
  cc: 125,
  transmission: "automatic" as const,
  ...extra,
});

/** A product that isn't a vehicle: none of the vehicle fields. */
const other = (type: string, tracking: string, extra: object = {}) => ({
  tenant_id: shop.id,
  name: `${type} ${tag} ${++counter}`,
  type,
  tracking,
  make: null,
  model: null,
  vehicle_type: null,
  ...extra,
});

async function addVehicle(extra: object = {}): Promise<string> {
  const { data, error } = await shop.members.owner.db
    .from("products")
    .insert(vehicle(extra))
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

let plates = 0;
async function addUnit(productId: string, extra: object = {}) {
  return shop.members.owner.db
    .from("units")
    .insert({
      tenant_id: shop.id,
      product_id: productId,
      location_id: shop.locationId,
      plate: `P${tag}${++plates}`,
      ...extra,
    })
    .select("id, product_type")
    .single();
}

beforeAll(async () => {
  presetId = await createCatalogEntry("products");
  [shop, admin] = await Promise.all([
    createTenant("products"),
    createUser("products-admin"),
  ]);
  await service.from("platform_admins").insert({ user_id: admin.id });
}, 120_000);

afterAll(async () => {
  await deleteTenant(shop);
  await deleteUser(admin);
  for (const id of [presetId, ...catalogIds]) await removeCatalogEntry(id);
});

describe("the rename", () => {
  it("leaves no table, column, function, trigger, index or policy named after models", () => {
    const { out, failed } = sql(`
      select 'table ' || c.relname from pg_class c
        where c.relnamespace = 'platform'::regnamespace and c.relkind in ('r', 'i')
          and c.relname ~ '(^|_)models?(_|$)' and c.relname !~ 'model_year|make_model'
      union all
      select 'column ' || a.attrelid::regclass || '.' || a.attname from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        where c.relnamespace = 'platform'::regnamespace and c.relkind = 'r'
          and a.attnum > 0 and not a.attisdropped and a.attname = 'model_id'
      union all
      select 'function ' || p.proname from pg_proc p
        where p.pronamespace in ('platform'::regnamespace, 'platform_private'::regnamespace)
          and (p.proname ~ 'model' or p.prosrc ~ '(platform\\.models|model_id|model_year_bands)')
      union all
      select 'trigger ' || t.tgname from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        where not t.tgisinternal and c.relnamespace = 'platform'::regnamespace
          and t.tgname ~ 'model'
      union all
      select 'constraint ' || c.conname from pg_constraint c
        where c.connamespace = 'platform'::regnamespace
          and c.conname ~ '(^models_|model_year_bands|model_id)'
      union all
      select 'policy ' || p.polname from pg_policy p
        join pg_class c on c.oid = p.polrelid
        where c.relnamespace = 'platform'::regnamespace and p.polname ~ 'models';
    `);
    expect(failed).toBe("");
    expect(out).toBe("");
  });

  it("keeps the grants and row-level security of the renamed tables", () => {
    const { out, failed } = sql(`
      select c.relname || ':' || c.relrowsecurity || ':' ||
        (select string_agg(privilege_type, ',' order by privilege_type)
           from information_schema.role_table_grants g
          where g.table_schema = 'platform' and g.table_name = c.relname
            and g.grantee = 'authenticated') || ':' ||
        coalesce((select string_agg(privilege_type, ',')
           from information_schema.role_table_grants g
          where g.table_schema = 'platform' and g.table_name = c.relname
            and g.grantee = 'anon'), 'none')
      from pg_class c
      where c.relnamespace = 'platform'::regnamespace
        and c.relname in ('products', 'product_year_bands')
      order by 1;
    `);
    expect(failed).toBe("");
    expect(out.split("\n")).toEqual([
      "product_year_bands:true:DELETE,INSERT,SELECT,UPDATE:none",
      "products:true:DELETE,INSERT,SELECT,UPDATE:none",
    ]);
  });
});

describe("type and tracking", () => {
  it("a product is a vehicle tracked by unit unless it says otherwise", async () => {
    const id = await addVehicle();
    const { data } = await service
      .from("products")
      .select("type, tracking")
      .eq("id", id)
      .single();
    expect(data).toEqual({ type: "vehicle", tracking: "unit" });
  });

  it("accepts the four types with their own tracking, and nothing else", async () => {
    const insert = (type: string, tracking: string) =>
      service
        .from("products")
        .insert(
          (type === "vehicle"
            ? vehicle({ type, tracking })
            : other(type, tracking)) as never,
        )
        .select("id")
        .single();
    for (const [type, tracking] of [
      ["vehicle", "unit"],
      ["gear", "bulk"],
      ["gear", "unit"],
      ["sale_item", "consumable"],
      ["service", "none"],
    ])
      expect(
        (await insert(type, tracking)).error,
        `${type}/${tracking}`,
      ).toBeNull();
    for (const [type, tracking] of [
      ["vehicle", "bulk"],
      ["gear", "none"],
      ["sale_item", "unit"],
      ["service", "bulk"],
    ])
      expect(
        (await insert(type, tracking)).error?.message,
        `${type}/${tracking}`,
      ).toContain("products_type_tracking_check");
    expect((await insert("bundle", "none")).error?.message).toContain(
      "products_type_check",
    );
  });

  it("a vehicle needs its make, model and kind; anything else must leave the vehicle fields empty", async () => {
    for (const missing of ["make", "model", "vehicle_type"])
      expect(
        (await service.from("products").insert(vehicle({ [missing]: null })))
          .error?.message,
        missing,
      ).toContain("products_vehicle_fields_check");
    for (const extra of [
      { make: "Shoei" },
      { vehicle_type: "other" },
      { cc: 50 },
      { catalog_id: presetId },
      { min_age: 18 },
      { marketplace_listed: true },
      { instant_units: 1 },
    ])
      expect(
        (await service.from("products").insert(other("gear", "bulk", extra)))
          .error,
        JSON.stringify(extra),
      ).not.toBeNull();
  });

  it("the type never changes; tracking only as the type allows", async () => {
    const id = await addVehicle();
    const toGear = await service
      .from("products")
      .update({ type: "gear", tracking: "bulk" })
      .eq("id", id);
    expect(toGear.error?.message).toContain("product_type_fixed");

    const { data: gear } = await service
      .from("products")
      .insert(other("gear", "bulk"))
      .select("id")
      .single();
    const tracked = await service
      .from("products")
      .update({ tracking: "unit" })
      .eq("id", gear!.id);
    expect(tracked.error).toBeNull();
    const none = await service
      .from("products")
      .update({ tracking: "none" })
      .eq("id", gear!.id);
    expect(none.error?.message).toContain("products_type_tracking_check");
  });

  it("two products that aren't vehicles don't trip the own-make-and-model rule", async () => {
    const first = await service
      .from("products")
      .insert(other("service", "none"));
    const second = await service
      .from("products")
      .insert(other("service", "none"));
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
  });
});

describe("a unit knows what it is a unit of", () => {
  it("a vehicle's unit is a vehicle unit", async () => {
    const { data, error } = await addUnit(await addVehicle());
    expect(error).toBeNull();
    expect(data?.product_type).toBe("vehicle");
  });

  it("a unit can't claim a type its product doesn't have", async () => {
    const forged = await addUnit(await addVehicle(), { product_type: "gear" });
    expect(forged.error?.code).toBe("23503");
  });

  it("a service or an item for sale takes no units", async () => {
    for (const [type, tracking] of [
      ["service", "none"],
      ["sale_item", "consumable"],
    ]) {
      const { data: product } = await service
        .from("products")
        .insert(other(type, tracking))
        .select("id")
        .single();
      // As a vehicle unit the key doesn't match; as its own type it isn't allowed.
      expect((await addUnit(product!.id)).error?.code, type).toBe("23503");
      expect(
        (await addUnit(product!.id, { product_type: type })).error?.message,
        type,
      ).toContain("units_product_type_check");
    }
  });
});

describe("every re-created function runs", () => {
  it("products_guard: a known model fills in the description; listing needs an approved one", async () => {
    const id = await addVehicle({ catalog_id: presetId });
    const { data } = await service
      .from("products")
      .select("make, model, cc")
      .eq("id", id)
      .single();
    expect(data?.make).toBeTruthy();
    const own = await addVehicle();
    const listed = await shop.members.owner.db
      .from("products")
      .update({ marketplace_listed: true })
      .eq("id", own);
    expect(listed.error?.message).toContain("not_listable");
  });

  it("units_clamp_product_counts: counts follow the active units down, with an audit row under products", async () => {
    const id = await addVehicle();
    const unit = await addUnit(id);
    await addUnit(id);
    await shop.members.owner.db
      .from("products")
      .update({ instant_units: 2 })
      .eq("id", id);
    await shop.members.owner.db
      .from("units")
      .update({ status: "maintenance" })
      .eq("id", unit.data!.id);
    const { data } = await service
      .from("products")
      .select("instant_units")
      .eq("id", id)
      .single();
    expect(data?.instant_units).toBe(1);
    const { data: audit } = await service
      .from("audit_events")
      .select("entity")
      .eq("entity_id", id)
      .eq("action", "clamp_booking_counts");
    expect(audit).toEqual([{ entity: "products" }]);
  });

  it("products_retire_guard and units_product_not_retired: retire rules hold", async () => {
    const id = await addVehicle();
    const unit = await addUnit(id);
    const retire = (at: string | null) =>
      shop.members.owner.db
        .from("products")
        .update({ retired_at: at })
        .eq("id", id);
    expect((await retire(new Date().toISOString())).error?.message).toContain(
      "model_has_active_units",
    );
    await shop.members.owner.db
      .from("units")
      .update({ status: "retired" })
      .eq("id", unit.data!.id);
    expect((await retire(new Date().toISOString())).error).toBeNull();
    expect((await addUnit(id)).error?.message).toContain("model_retired");
    expect((await retire(null)).error).toBeNull();
  });

  it("submit_product_to_catalog, review_catalog_request and products_withdraw_request", async () => {
    const approved = await addVehicle({ categories: ["sport"] });
    const submit = async (productId: string) => {
      const { data, error } = await shop.members.owner.db.rpc(
        "submit_product_to_catalog",
        { p_product_id: productId, p_type: "sport" },
      );
      if (error) throw error;
      catalogIds.push(data);
      return data;
    };
    const entry = await submit(approved);
    const review = await admin.db.rpc("review_catalog_request", {
      p_catalog_id: entry,
      p_approve: true,
    });
    expect(review.error).toBeNull();
    const { data } = await service
      .from("products")
      .select("marketplace_listed, catalog_approved_at")
      .eq("id", approved)
      .single();
    expect(data?.marketplace_listed).toBe(true);
    expect(data?.catalog_approved_at).not.toBeNull();

    // Deleting a product that waits for review withdraws its request.
    const waiting = await addVehicle({ categories: ["sport"] });
    const request = await submit(waiting);
    await shop.members.owner.db.from("products").delete().eq("id", waiting);
    const { data: closed } = await service
      .schema("public")
      .from("bike_catalog")
      .select("status")
      .eq("id", request)
      .single();
    expect(closed?.status).toBe("rejected");
  });

  it("the old function name is gone", async () => {
    const { error } = await shop.members.owner.db.rpc(
      "submit_model_to_catalog" as never,
      { p_model_id: randomUUID(), p_type: "sport" } as never,
    );
    expect(error?.code).toBe("PGRST202");
  });

  it("import_fleet: reads product_id and answers with products", async () => {
    const productId = randomUUID();
    const { data, error } = await shop.members.owner.db.rpc("import_fleet", {
      p_tenant_id: shop.id,
      p_models: [{ id: productId, ...vehicle(), tenant_id: undefined }],
      p_units: [
        {
          product_id: productId,
          location_id: shop.locationId,
          plate: `IMP${tag}`,
        },
      ],
    });
    expect(error).toBeNull();
    expect(data).toEqual({ products: 1, units: 1 });
  });

  it("currency_locked and tenants_lock_currency: a deposit on a product locks the currency", async () => {
    const id = await addVehicle();
    await shop.members.owner.db
      .from("products")
      .update({ deposit: 1000, deposit_currency: shop.currency })
      .eq("id", id);
    const locked = await shop.members.owner.db.rpc("currency_locked", {
      p_tenant_id: shop.id,
    });
    expect(locked.data).toBe(true);
    const change = await service
      .from("tenants")
      .update({ currency: shop.currency === "USD" ? "EUR" : "USD" })
      .eq("id", shop.id);
    expect(change.error?.message).toContain("currency_locked");
  });

  it("the hourly reminder queue and a downtime block still run", async () => {
    const { failed } = sql(
      "select platform_private.queue_renewal_notifications();",
    );
    expect(failed).toBe("");
    const unit = await addUnit(await addVehicle());
    const block = await shop.members.owner.db.from("unit_blocks").insert({
      tenant_id: shop.id,
      unit_id: unit.data!.id,
      kind: "downtime",
      period: period(hours(1), hours(2)),
    });
    expect(block.error).toBeNull();
  });
});

describe("history", () => {
  it("a change to a product is filed under products, with who made it", async () => {
    const id = await addVehicle();
    await shop.members.manager.db
      .from("products")
      .update({ name: `Renamed ${tag}` })
      .eq("id", id);
    const { data } = await shop.members.owner.db
      .from("audit_events")
      .select("entity, action, actor, after")
      .eq("entity", "products")
      .eq("entity_id", id)
      .eq("action", "update");
    expect(data).toEqual([
      {
        entity: "products",
        action: "update",
        actor: shop.members.manager.id,
        after: { name: `Renamed ${tag}` },
      },
    ]);
    // Staff and mechanics don't read the history.
    for (const role of ["staff", "mechanic", "driver"] as const) {
      const seen = await shop.members[role].db
        .from("audit_events")
        .select("id")
        .eq("entity_id", id);
      expect(seen.data, role).toEqual([]);
    }
  });
});
