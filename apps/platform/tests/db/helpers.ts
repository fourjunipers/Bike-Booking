import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mango/db/database.types";
import type { Role } from "@/lib/roles";

export type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url ?? "")) {
  // Never run these against a hosted project: they create and delete users.
  throw new Error("DB tests only run against local Supabase (127.0.0.1)");
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export function serviceClient(): Db {
  return createClient<Database>(url, serviceKey, options);
}

export function anonClient(): Db {
  return createClient<Database>(url, anonKey, options);
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
  members: Record<Role, TestUser & { membershipId: string }>;
};

/** A tenant with one user in every role. */
export async function createTenant(label: string): Promise<TestTenant> {
  const service = serviceClient();
  const slug = `${label}-${randomUUID().slice(0, 8)}`;
  const { data: tenant, error } = await service
    .from("tenants")
    .insert({
      name: `Test ${label}`,
      slug,
      country: "VN",
      currency: "VND",
      timezone: "Asia/Ho_Chi_Minh",
      locale: "vi-VN",
    })
    .select("id")
    .single();
  if (error) throw error;

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
  return { id: tenant.id, slug, members };
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
