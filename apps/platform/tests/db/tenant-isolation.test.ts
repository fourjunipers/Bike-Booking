/**
 * Phase 0 acceptance (docs/platform/SPEC.md › Build plan): two tenants, and a
 * user of one cannot read any row of the other.
 *
 * The table list comes from the database (platform_rls_report), so every new
 * table with a tenant_id is covered here without editing this file.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { roles } from "@/lib/roles";
import {
  anonClient,
  createTenant,
  createUser,
  deleteTenant,
  deleteUser,
  serviceClient,
  type Db,
  type TestTenant,
  type TestUser,
} from "./helpers";

let a: TestTenant;
let b: TestTenant;
let outsider: TestUser;
let tables: { table_name: string; rls_enabled: boolean; policy_count: number }[];

beforeAll(async () => {
  [a, b, outsider] = await Promise.all([
    createTenant("iso-a"),
    createTenant("iso-b"),
    createUser("iso-outsider"),
  ]);
  const { data, error } = await serviceClient().rpc("platform_rls_report");
  if (error) throw error;
  tables = data;
});

afterAll(async () => {
  await Promise.all([deleteTenant(a), deleteTenant(b), deleteUser(outsider)]);
});

/** Every row `db` can see in `table`, with the tenant each belongs to. */
async function visibleTenantIds(db: Db, table: string): Promise<string[]> {
  const column = table === "tenants" ? "id" : "tenant_id";
  // The table name comes from the database, so the typed client can't know it.
  const { data, error } = await (db as unknown as Db)
    .from(table as "memberships")
    .select(column as "tenant_id");
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data as Record<string, string>[]).map((row) => row[column]);
}

describe("every tenant table", () => {
  it("is found by the report, starting with tenants and memberships", () => {
    const names = tables.map((t) => t.table_name);
    expect(names).toEqual(expect.arrayContaining(["tenants", "memberships"]));
  });

  it("has RLS switched on and at least one policy", () => {
    for (const t of tables) {
      expect.soft(t.rls_enabled, `${t.table_name}: RLS`).toBe(true);
      expect.soft(t.policy_count, `${t.table_name}: policies`).toBeGreaterThan(0);
    }
  });

  it("shows no row of tenant B to any member of tenant A, whatever their role", async () => {
    for (const role of roles) {
      const db = a.members[role].db;
      for (const { table_name } of tables) {
        const ids = await visibleTenantIds(db, table_name);
        expect(ids, `${role} reading ${table_name}`).not.toContain(b.id);
      }
    }
  });

  it("works the other way round too", async () => {
    for (const role of roles) {
      const db = b.members[role].db;
      for (const { table_name } of tables) {
        const ids = await visibleTenantIds(db, table_name);
        expect(ids, `${role} reading ${table_name}`).not.toContain(a.id);
      }
    }
  });

  it("shows nothing to a signed-in user with no membership", async () => {
    for (const { table_name } of tables) {
      expect(await visibleTenantIds(outsider.db, table_name)).toEqual([]);
    }
  });

  it("shows nothing to signed-out visitors", async () => {
    const anon = anonClient();
    for (const { table_name } of tables) {
      const { data } = await anon
        .from(table_name as "memberships")
        .select("*")
        .limit(1);
      // Either no grant at all (error, data null) or no rows.
      expect(data ?? []).toEqual([]);
    }
  });
});

describe("members still see their own tenant", () => {
  it("reads its tenant row and the whole team", async () => {
    const db = a.members.staff.db;
    expect(await visibleTenantIds(db, "tenants")).toEqual([a.id]);
    const team = await visibleTenantIds(db, "memberships");
    expect(team).toHaveLength(roles.length);
    expect(new Set(team)).toEqual(new Set([a.id]));
  });
});

describe("asking for tenant B by id, as tenant A's owner", () => {
  let db: Db;
  beforeAll(() => {
    db = a.members.owner.db;
  });

  it("finds no tenant and no memberships", async () => {
    const tenant = await db.from("tenants").select("*").eq("id", b.id);
    expect(tenant.data).toEqual([]);
    const team = await db.from("memberships").select("*").eq("tenant_id", b.id);
    expect(team.data).toEqual([]);
  });

  it("gets an empty team list", async () => {
    const { data, error } = await db.rpc("tenant_members", {
      p_tenant_id: b.id,
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("can't rename tenant B", async () => {
    const { data } = await db
      .from("tenants")
      .update({ name: "Hijacked" })
      .eq("id", b.id)
      .select("id");
    expect(data).toEqual([]);
    const { data: still } = await serviceClient()
      .from("tenants")
      .select("name")
      .eq("id", b.id)
      .single();
    expect(still?.name).toBe("Test iso-b");
  });

  it("can't change or remove tenant B's members", async () => {
    const target = b.members.staff.membershipId;
    const change = await db.rpc("set_member_role", {
      p_membership_id: target,
      p_role: "owner",
    });
    expect(change.error?.message).toBe("Membership not found");
    const remove = await db.rpc("remove_member", { p_membership_id: target });
    expect(remove.error?.message).toBe("Membership not found");
  });

  it("can't add itself to tenant B", async () => {
    const { error } = await db.from("memberships").insert({
      tenant_id: b.id,
      user_id: a.members.owner.id,
      role: "owner",
    });
    expect(error?.code).toBe("42501");
  });

  it("can't create a tenant", async () => {
    const { error } = await db.from("tenants").insert({
      name: "Sneaky",
      slug: "sneaky",
      country: "TH",
      currency: "THB",
      timezone: "Asia/Bangkok",
      locale: "th",
    });
    expect(error?.code).toBe("42501");
  });

  it("can't call the RLS report", async () => {
    const { error } = await db.rpc("platform_rls_report");
    expect(error?.code).toBe("42501");
  });
});
