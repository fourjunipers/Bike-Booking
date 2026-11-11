import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mango/db/database.types";
import type { Role } from "@/lib/roles";

/** Clients point at the `platform` schema, like the app (`.schema("public")` for the catalog). */
export type Db = SupabaseClient<Database, "platform">;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url ?? "")) {
  // Never run these against a hosted project: they create and delete users.
  throw new Error("DB tests only run against local Supabase (127.0.0.1)");
}

const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "platform" as const },
};

export function serviceClient(): Db {
  return createClient<Database, "platform">(url, serviceKey, options);
}

export function anonClient(): Db {
  return createClient<Database, "platform">(url, anonKey, options);
}

// One throwaway password per test run; the users are deleted afterwards.
const password = randomBytes(12).toString("hex");

export type TestUser = { id: string; email: string; db: Db };

/** Creates a confirmed user and returns a client signed in as them. */
export async function createUser(label: string): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@platform-test.test`;
  const service = serviceClient();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: `Test ${label}` },
  });
  if (error) throw error;

  const db = anonClient();
  const { error: signInError } = await db.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;
  return { id: data.user.id, email, db };
}

export type TestTenant = {
  id: string;
  slug: string;
  currency: string;
  /** The default location every tenant is created with. */
  locationId: string;
  members: Record<Role, TestUser & { membershipId: string }>;
};

/** A tenant (with its default location) and one user in every role. */
export async function createTenant(
  label: string,
  shop: {
    country: string;
    currency: string;
    locale: string;
    timezone: string;
  } = {
    country: "VN",
    currency: "VND",
    locale: "vi-VN",
    timezone: "Asia/Ho_Chi_Minh",
  },
): Promise<TestTenant> {
  const service = serviceClient();
  const slug = `${label}-${randomUUID().slice(0, 8)}`;
  const { data: tenantId, error } = await service.rpc("create_tenant", {
    p_name: `Test ${label}`,
    p_slug: slug,
    p_country: shop.country,
    p_currency: shop.currency,
    p_locale: shop.locale,
    p_timezone: shop.timezone,
  });
  if (error) throw error;
  const tenant = { id: tenantId };
  const { data: location, error: locationError } = await service
    .from("locations")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("is_default", true)
    .single();
  if (locationError) throw locationError;

  const roles: Role[] = ["owner", "manager", "staff", "mechanic", "driver"];
  const members = {} as TestTenant["members"];
  for (const role of roles) {
    const user = await createUser(`${label}-${role}`);
    const { data: membership, error: memberError } = await service
      .from("memberships")
      .insert({ tenant_id: tenant.id, user_id: user.id, role })
      .select("id")
      .single();
    if (memberError) throw memberError;
    members[role] = { ...user, membershipId: membership.id };
  }
  return {
    id: tenant.id,
    slug,
    currency: shop.currency,
    locationId: location.id,
    members,
  };
}

/** Removes a tenant (memberships cascade) and its users. */
export async function deleteTenant(tenant: TestTenant | undefined) {
  if (!tenant) return;
  const service = serviceClient();
  await service.from("tenants").delete().eq("id", tenant.id);
  for (const member of Object.values(tenant.members)) {
    await service.auth.admin.deleteUser(member.id);
  }
}

export async function deleteUser(user: TestUser | undefined) {
  if (user) await serviceClient().auth.admin.deleteUser(user.id);
}

/** An approved catalog entry to hang test models on; removed with removeCatalogEntry. */
export async function createCatalogEntry(label: string): Promise<string> {
  const { data, error } = await serviceClient()
    .schema("public")
    .from("bike_catalog")
    .insert({
      make: "Testmake",
      model: `${label} ${randomUUID().slice(0, 8)}`,
      type: "city_scooter",
      transmission: "automatic",
      cc: 125,
      status: "approved",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function removeCatalogEntry(id: string | undefined) {
  if (id)
    await serviceClient()
      .schema("public")
      .from("bike_catalog")
      .delete()
      .eq("id", id);
}

/** "[from, to)" as Postgres reads a time range; no `to` = open-ended. */
export function period(from: Date, to?: Date): string {
  return `[${from.toISOString()},${to ? to.toISOString() : ""})`;
}

export const hours = (n: number) => new Date(Date.now() + n * 3_600_000);

/**
 * A model row's own description. For a model on a catalog entry the database
 * replaces these with the entry's values; they are here so the row is complete.
 */
export const modelSpec = {
  make: "Testmake",
  model: "Test",
  vehicle_type: "motorbike",
  cc: 125,
  transmission: "automatic" as const,
};
