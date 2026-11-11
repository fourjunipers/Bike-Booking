/**
 * Tenant isolation (docs/platform/SPEC.md › Review decisions › Isolation
 * tests). For every tenant-scoped table:
 *  - a fixture row exists for each of two tenants (a missing one fails);
 *  - no member of tenant A, in any role, can read, insert, update or delete
 *    tenant B's rows, or move its own rows into tenant B;
 *  - a row can't point at another tenant's parent, even for the service role.
 *
 * The table list comes from the database (platform_rls_report), so a new table
 * with a tenant_id fails here until it has a fixture, a payload and a change.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { roles } from "@/lib/roles";
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
  type Db,
  type TestTenant,
  type TestUser,
} from "./helpers";

type Row = Record<string, unknown>;
type Fixture = TestTenant & { modelId: string; unitId: string };

let a: Fixture;
let b: Fixture;
let outsider: TestUser;
let catalogId: string;
let tables: {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
}[];

/** The table name comes from the database, so the typed client can't know it. */
const from = (db: Db, table: string) => db.from(table as "units");
const tenantColumn = (table: string) =>
  table === "tenants" ? "id" : "tenant_id";

/** One fixture row in every tenant-scoped table, for one tenant. */
async function addFixtures(tenant: TestTenant): Promise<Fixture> {
  const service = serviceClient();
  const ok = <T>(result: { data: T; error: unknown }) => {
    if (result.error) throw result.error;
    return result.data;
  };
  // tenants, memberships and locations come from createTenant.
  ok(
    await service.from("location_hours").insert({
      tenant_id: tenant.id,
      location_id: tenant.locationId,
      weekday: 1,
      open: "10:00",
      close: "18:00",
    }),
  );
  ok(
    await service.from("location_closures").insert({
      tenant_id: tenant.id,
      location_id: tenant.locationId,
      start_date: "2027-04-13",
      end_date: "2027-04-15",
    }),
  );
  const model = ok(
    await service
      .from("models")
      .insert({ tenant_id: tenant.id, catalog_id: catalogId, name: "Fixture" })
      .select("id")
      .single(),
  )!;
  const unit = ok(
    await service
      .from("units")
      .insert({
        tenant_id: tenant.id,
        model_id: model.id,
        location_id: tenant.locationId,
        plate: "FIX-1",
      })
      .select("id")
      .single(),
  )!;
  ok(
    await service.from("unit_financials").insert({
      tenant_id: tenant.id,
      unit_id: unit.id,
      currency: tenant.currency,
      purchase_price: 1000,
    }),
  );
  ok(
    await service.from("unit_blocks").insert({
      tenant_id: tenant.id,
      unit_id: unit.id,
      kind: "downtime",
      period: period(hours(1), hours(2)),
    }),
  );
  // audit_events: written by the triggers on the rows above.
  return { ...tenant, modelId: model.id, unitId: unit.id };
}

/** A new, valid row for `t` in each table: what an attacker would try to add. */
const payloads: Record<string, (t: Fixture, userId: string) => Row> = {
  tenants: () => ({
    name: "Sneaky",
    slug: `sneaky-${Date.now()}`,
    country: "TH",
    currency: "THB",
    locale: "th",
  }),
  memberships: (t, userId) => ({
    tenant_id: t.id,
    user_id: userId,
    role: "owner",
  }),
  locations: (t) => ({
    tenant_id: t.id,
    name: "Sneaky branch",
    timezone: "Asia/Tokyo",
  }),
  location_hours: (t) => ({
    tenant_id: t.id,
    location_id: t.locationId,
    weekday: 2,
    open: "09:00",
    close: "17:00",
  }),
  location_closures: (t) => ({
    tenant_id: t.id,
    location_id: t.locationId,
    start_date: "2028-01-01",
    end_date: "2028-01-02",
  }),
  models: (t) => ({ tenant_id: t.id, catalog_id: catalogId, name: "Sneaky" }),
  units: (t) => ({
    tenant_id: t.id,
    model_id: t.modelId,
    location_id: t.locationId,
    plate: "SNEAKY-1",
  }),
  unit_financials: (t) => ({
    tenant_id: t.id,
    unit_id: t.unitId,
    currency: t.currency,
    sale_price: 1,
  }),
  unit_blocks: (t) => ({
    tenant_id: t.id,
    unit_id: t.unitId,
    kind: "downtime",
    period: period(hours(50), hours(51)),
  }),
  audit_events: (t) => ({
    tenant_id: t.id,
    entity: "units",
    entity_id: t.unitId,
    action: "forged",
  }),
};

/** A harmless change an attacker would try on another tenant's rows. */
const changes: Record<string, Row> = {
  tenants: { name: "Hijacked" },
  memberships: { role: "owner" },
  locations: { name: "Hijacked" },
  location_hours: { open: "00:01" },
  location_closures: { note: "Hijacked" },
  models: { name: "Hijacked" },
  units: { notes: "Hijacked" },
  unit_financials: { sold_to: "Hijacked" },
  unit_blocks: { note: "Hijacked" },
  audit_events: { action: "hijacked" },
};

/** Every row of every table that belongs to `tenant`, as the service role sees it. */
async function snapshot(tenant: TestTenant): Promise<Record<string, Row[]>> {
  const service = serviceClient();
  const result: Record<string, Row[]> = {};
  for (const { table_name } of tables) {
    const { data, error } = await from(service, table_name)
      .select("*")
      .eq(tenantColumn(table_name), tenant.id);
    if (error) throw new Error(`${table_name}: ${error.message}`);
    result[table_name] = (data as Row[]).sort((x, y) =>
      JSON.stringify(x).localeCompare(JSON.stringify(y)),
    );
  }
  return result;
}

async function visibleTenantIds(db: Db, table: string): Promise<string[]> {
  const column = tenantColumn(table);
  const { data, error } = await from(db, table).select(column);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data as unknown as Row[]).map((row) => String(row[column]));
}

beforeAll(async () => {
  catalogId = await createCatalogEntry("iso");
  const [tenantA, tenantB, user] = await Promise.all([
    createTenant("iso-a"),
    createTenant("iso-b"),
    createUser("iso-outsider"),
  ]);
  outsider = user;
  [a, b] = await Promise.all([addFixtures(tenantA), addFixtures(tenantB)]);
  const { data, error } = await serviceClient().rpc("platform_rls_report");
  if (error) throw error;
  tables = data;
}, 120_000);

afterAll(async () => {
  await Promise.all([deleteTenant(a), deleteTenant(b), deleteUser(outsider)]);
  await removeCatalogEntry(catalogId);
});

describe("every tenant table", () => {
  it("is found by the report", () => {
    expect(tables.map((t) => t.table_name)).toEqual([
      "audit_events",
      "location_closures",
      "location_hours",
      "locations",
      "memberships",
      "models",
      "tenants",
      "unit_blocks",
      "unit_financials",
      "units",
    ]);
  });

  it("has RLS switched on and at least one policy", () => {
    for (const t of tables) {
      expect.soft(t.rls_enabled, `${t.table_name}: RLS`).toBe(true);
      expect
        .soft(t.policy_count, `${t.table_name}: policies`)
        .toBeGreaterThan(0);
    }
  });

  it("is never readable without RLS: every platform table, with or without a tenant_id", async () => {
    const { data, error } = await serviceClient().rpc(
      "platform_exposure_report",
    );
    expect(error).toBeNull();
    // Every tenant table, plus the ones with no tenant_id (platform_admins).
    expect(data!.map((r) => r.relation)).toEqual(
      expect.arrayContaining([
        ...tables.map((t) => t.table_name),
        "platform_admins",
      ]),
    );
    for (const r of data!) {
      // A view would run as its owner and skip RLS unless written with care,
      // so none may exist until one is added here with its own test.
      expect.soft(r.kind, `${r.relation}: kind`).toBe("table");
      expect.soft(r.rls_enabled, `${r.relation}: RLS`).toBe(true);
      expect.soft(r.policy_count, `${r.relation}: policies`).toBeGreaterThan(0);
      expect
        .soft(r.anon_has_any_privilege, `${r.relation}: anon grant`)
        .toBe(false);
      expect
        .soft(r.authenticated_can_truncate, `${r.relation}: truncate`)
        .toBe(false);
    }
  });

  it("gives a new table nothing automatically: only the service role is in the schema's default grants", async () => {
    const { data, error } = await serviceClient().rpc("platform_schema_access");
    expect(error).toBeNull();
    expect(data).toEqual([
      { anon_usage: false, default_grantees: ["service_role"] },
    ]);
  });

  it("has no policy that lets a role see every row", async () => {
    const { data, error } = await serviceClient().rpc("platform_open_policies");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("has a fixture row for each tenant, a payload and a change to try", async () => {
    for (const tenant of [a, b]) {
      const rows = await snapshot(tenant);
      for (const { table_name } of tables) {
        expect
          .soft(rows[table_name].length, `${table_name}: fixture row`)
          .toBeGreaterThan(0);
      }
    }
    for (const { table_name } of tables) {
      expect.soft(payloads[table_name], `${table_name}: payload`).toBeDefined();
      expect.soft(changes[table_name], `${table_name}: change`).toBeDefined();
    }
  });
});

describe("reading", () => {
  it("shows no row of tenant B to any member of tenant A, whatever their role", async () => {
    for (const role of roles) {
      for (const { table_name } of tables) {
        const ids = await visibleTenantIds(a.members[role].db, table_name);
        expect(ids, `${role} reading ${table_name}`).not.toContain(b.id);
      }
    }
  });

  it("works the other way round too", async () => {
    for (const role of roles) {
      for (const { table_name } of tables) {
        const ids = await visibleTenantIds(b.members[role].db, table_name);
        expect(ids, `${role} reading ${table_name}`).not.toContain(a.id);
      }
    }
  });

  it("shows nothing to a signed-in user with no membership", async () => {
    for (const { table_name } of tables) {
      expect(await visibleTenantIds(outsider.db, table_name)).toEqual([]);
    }
  });

  it("gives signed-out visitors no access to the schema at all", async () => {
    const anon = anonClient();
    for (const { table_name } of tables) {
      const { data, error } = await from(anon, table_name).select("*").limit(1);
      expect(data ?? []).toEqual([]);
      expect(error, table_name).not.toBeNull();
    }
  });

  it("still shows members their own tenant", async () => {
    const db = a.members.staff.db;
    expect(await visibleTenantIds(db, "tenants")).toEqual([a.id]);
    const team = await visibleTenantIds(db, "memberships");
    expect(team).toHaveLength(roles.length);
    for (const table of ["locations", "models", "units", "unit_blocks"]) {
      expect(await visibleTenantIds(db, table), table).toEqual([a.id]);
    }
  });

  it("finds nothing when asked for tenant B's rows by id", async () => {
    const db = a.members.owner.db;
    const unit = await db.from("units").select("*").eq("id", b.unitId);
    expect(unit.data).toEqual([]);
    const money = await db
      .from("unit_financials")
      .select("*")
      .eq("unit_id", b.unitId);
    expect(money.data).toEqual([]);
    const token = await serviceClient()
      .from("units")
      .select("qr_token")
      .eq("id", b.unitId)
      .single();
    const byToken = await db
      .from("units")
      .select("id")
      .eq("qr_token", token.data!.qr_token);
    expect(byToken.data).toEqual([]);
  });
});

describe("writing across tenants", () => {
  let before: Record<string, Row[]>;
  let ownBefore: Record<string, Row[]>;
  const attackers = () => [
    ...roles.map((role) => ({ who: `A's ${role}`, user: a.members[role] })),
    { who: "an outsider", user: outsider },
  ];

  beforeAll(async () => {
    [before, ownBefore] = await Promise.all([snapshot(b), snapshot(a)]);
  });

  it("refuses inserts into tenant B", async () => {
    for (const { who, user } of attackers()) {
      for (const { table_name } of tables) {
        const { data, error } = await from(user.db, table_name)
          .insert(payloads[table_name](b, user.id) as never)
          .select("*");
        expect(error, `${who} inserting into ${table_name}`).not.toBeNull();
        expect(data ?? []).toEqual([]);
      }
    }
  });

  it("refuses updates of tenant B's rows", async () => {
    for (const { who, user } of attackers()) {
      for (const { table_name } of tables) {
        const { data } = await from(user.db, table_name)
          .update(changes[table_name] as never)
          .eq(tenantColumn(table_name), b.id)
          .select("*");
        // Either refused outright, or no row matched.
        expect(data ?? [], `${who} updating ${table_name}`).toEqual([]);
      }
    }
  });

  it("refuses deletes of tenant B's rows", async () => {
    for (const { who, user } of attackers()) {
      for (const { table_name } of tables) {
        const { data } = await from(user.db, table_name)
          .delete()
          .eq(tenantColumn(table_name), b.id)
          .select("*");
        expect(data ?? [], `${who} deleting from ${table_name}`).toEqual([]);
      }
    }
  });

  it("refuses moving tenant A's own rows into tenant B", async () => {
    for (const role of roles) {
      for (const { table_name } of tables) {
        if (table_name === "tenants") continue;
        const { data } = await from(a.members[role].db, table_name)
          .update({ tenant_id: b.id } as never)
          .eq("tenant_id", a.id)
          .select("*");
        expect(data ?? [], `${role} moving ${table_name}`).toEqual([]);
      }
    }
  });

  it("left every row of tenant B exactly as it was, and tenant A's too", async () => {
    expect(await snapshot(b)).toEqual(before);
    expect(await snapshot(a)).toEqual(ownBefore);
  });
});

describe("a row can't point at another tenant's parent (service role, so this is the keys, not RLS)", () => {
  const refused = async (table: string, row: Row) => {
    const { error } = await from(serviceClient(), table).insert(row as never);
    expect(error?.code, `${table}: ${error?.message}`).toBe("23503");
  };

  it("unit → model and unit → location", async () => {
    await refused("units", {
      tenant_id: a.id,
      model_id: b.modelId,
      location_id: a.locationId,
      plate: "CROSS-1",
    });
    await refused("units", {
      tenant_id: a.id,
      model_id: a.modelId,
      location_id: b.locationId,
      plate: "CROSS-2",
    });
  });

  it("block → unit and financials → unit", async () => {
    await refused("unit_blocks", {
      tenant_id: a.id,
      unit_id: b.unitId,
      kind: "downtime",
      period: period(hours(100), hours(101)),
    });
    // B's unit already has financials; use a fresh unit of B.
    const { data: unit } = await serviceClient()
      .from("units")
      .insert({
        tenant_id: b.id,
        model_id: b.modelId,
        location_id: b.locationId,
        plate: "CROSS-3",
      })
      .select("id")
      .single();
    await refused("unit_financials", {
      tenant_id: a.id,
      unit_id: unit!.id,
      currency: a.currency,
    });
    await serviceClient().from("units").delete().eq("id", unit!.id);
  });

  it("hours → location and closure → location", async () => {
    await refused("location_hours", {
      tenant_id: a.id,
      location_id: b.locationId,
      weekday: 3,
      open: "09:00",
      close: "17:00",
    });
    await refused("location_closures", {
      tenant_id: a.id,
      location_id: b.locationId,
      start_date: "2028-02-01",
      end_date: "2028-02-02",
    });
  });

  it("money → the tenant's own currency", async () => {
    await refused("models", {
      tenant_id: a.id,
      catalog_id: catalogId,
      name: "Wrong currency",
      deposit: 100,
      deposit_currency: "USD",
    });
  });
});

describe("functions, as tenant A's owner and as an outsider", () => {
  const callers = () => [
    { who: "A's owner", db: a.members.owner.db },
    { who: "an outsider", db: outsider.db },
  ];

  it("can't import into tenant B", async () => {
    for (const { who, db } of callers()) {
      const { error } = await db.rpc("import_fleet", {
        p_tenant_id: b.id,
        p_models: [],
        p_units: [
          { model_id: b.modelId, location_id: b.locationId, plate: "RPC-1" },
        ],
      });
      expect(error?.code, who).toBe("42501");
    }
  });

  it("can't request a catalog entry in tenant B's name", async () => {
    for (const { who, db } of callers()) {
      const { error } = await db.rpc("request_catalog_entry", {
        p_tenant_id: b.id,
        p_make: "Sneaky",
        p_model: "Request",
        p_year_from: null as unknown as number,
        p_year_to: null as unknown as number,
        p_type: "city_scooter",
        p_transmission: "automatic",
        p_cc: 125,
      });
      expect(error?.code, who).toBe("42501");
    }
  });

  it("learns nothing from the team list or the currency lock", async () => {
    for (const { who, db } of callers()) {
      const team = await db.rpc("tenant_members", { p_tenant_id: b.id });
      expect(team.data, who).toEqual([]);
      // B has money rows, so the true answer is "locked".
      const locked = await db.rpc("currency_locked", { p_tenant_id: b.id });
      expect(locked.data, who).toBe(false);
    }
  });

  it("can't change or remove tenant B's members", async () => {
    const target = b.members.staff.membershipId;
    for (const { db } of callers()) {
      const change = await db.rpc("set_member_role", {
        p_membership_id: target,
        p_role: "owner",
      });
      expect(change.error?.message).toBe("Membership not found");
      const remove = await db.rpc("remove_member", { p_membership_id: target });
      expect(remove.error?.message).toBe("Membership not found");
    }
  });

  it("can't create a tenant, review the catalog or run the reports", async () => {
    for (const { who, db } of callers()) {
      const create = await db.rpc("create_tenant", {
        p_name: "Sneaky",
        p_slug: "sneaky",
        p_country: "TH",
        p_currency: "THB",
        p_locale: "th",
        p_timezone: "Asia/Bangkok",
      });
      expect(create.error?.code, who).toBe("42501");
      const review = await db.rpc("review_catalog_request", {
        p_catalog_id: catalogId,
        p_approve: true,
      });
      expect(review.error?.code, who).toBe("42501");
      expect((await db.rpc("platform_rls_report")).error?.code).toBe("42501");
      expect((await db.rpc("platform_open_policies")).error?.code).toBe(
        "42501",
      );
      expect((await db.rpc("platform_exposure_report")).error?.code).toBe(
        "42501",
      );
      expect((await db.rpc("platform_schema_access")).error?.code).toBe(
        "42501",
      );
    }
  });

  it("can't see who the platform admins are", async () => {
    for (const { db } of callers()) {
      const { data } = await db.from("platform_admins").select("*");
      expect(data).toEqual([]);
    }
  });
});
