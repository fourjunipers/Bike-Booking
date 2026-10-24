import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url?.startsWith("http://127.0.0.1")) {
  // Never run these against a hosted project: they create and delete users.
  throw new Error("DB tests only run against local Supabase (127.0.0.1)");
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** Seeded IDs (supabase/seed.sql). */
export const seed = {
  users: {
    admin: "admin@bike-booking.test",
    customer: "customer@bike-booking.test",
    bsrOwner: "owner@bsr.test",
    bsrStaff: "staff@bsr.test",
    draftOwner: "owner@draft-shop.test",
  },
  customerId: "a0000000-0000-4000-8000-000000000002",
  bsrShop: "b0000000-0000-4000-8000-000000000001",
  draftShop: "b0000000-0000-4000-8000-000000000002",
  bsrPcx: "c0000000-0000-4000-8000-000000000002",
  draftModel: "c0000000-0000-4000-8000-000000000004",
  booking: "d0000000-0000-4000-8000-000000000001",
} as const;

export function serviceClient(): Db {
  return createClient<Database>(url, serviceKey, options);
}

export function anonClient(): Db {
  return createClient<Database>(url, anonKey, options);
}

/** A client signed in as `email`, using an admin-generated magic link. */
export async function signedInClient(email: string): Promise<Db> {
  const { data, error } = await serviceClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;

  const client = anonClient();
  const { error: verifyError } = await client.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) throw verifyError;
  return client;
}

/** Creates a confirmed user for one test file; delete it with deleteUser. */
export async function createUser(prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@bike-booking.test`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, email };
}

export async function deleteUser(id: string) {
  await serviceClient().auth.admin.deleteUser(id);
}
