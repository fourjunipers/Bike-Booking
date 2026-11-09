/**
 * Demo data for the platform (Phase 0): two shops in different countries,
 * one user per role, and one user who works in both shops.
 *
 *   npm run seed -w @mango/platform            local Supabase
 *   npm run seed:staging -w @mango/platform    mango-works-staging
 *
 * Safe to run again: it updates what's there. Every demo user gets the
 * password in DEMO_PASSWORD (apps/platform/.env.local, never committed: the
 * repo is public). Never runs against any other project.
 */
import { createClient } from "@supabase/supabase-js";

const staging = process.argv.includes("--staging");

const url = staging
  ? process.env.STAGING_SUPABASE_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = staging
  ? process.env.STAGING_SUPABASE_SECRET_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;

function fail(message: string): never {
  console.error(`seed: ${message}`);
  process.exit(1);
}

if (!url || !key)
  fail(
    staging
      ? "set STAGING_SUPABASE_URL and STAGING_SUPABASE_SECRET_KEY in apps/platform/.env.local"
      : "set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/platform/.env.local",
  );
if (!password || password.length < 8)
  fail("set DEMO_PASSWORD (8+ characters) in apps/platform/.env.local");

const local = /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url);
if (staging === local)
  fail(
    staging
      ? `STAGING_SUPABASE_URL points at a local server (${url})`
      : `NEXT_PUBLIC_SUPABASE_URL isn't local Supabase (${url}); use seed:staging`,
  );

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Role = "owner" | "manager" | "staff" | "mechanic" | "driver";

const tenants = [
  {
    slug: "bsr",
    name: "BSR Bike Shop",
    country: "TH",
    currency: "THB",
    timezone: "Asia/Bangkok",
    locale: "th-TH",
  },
  {
    slug: "saigon-scooters",
    name: "Saigon Scooters",
    country: "VN",
    currency: "VND",
    timezone: "Asia/Ho_Chi_Minh",
    locale: "vi-VN",
  },
];

const users: { email: string; name: string; roles: Record<string, Role> }[] = [
  {
    email: "owner@bsr.demo.test",
    name: "Somchai (owner)",
    roles: { bsr: "owner" },
  },
  {
    email: "manager@bsr.demo.test",
    name: "Nok (manager)",
    roles: { bsr: "manager" },
  },
  {
    email: "staff@bsr.demo.test",
    name: "Ploy (staff)",
    roles: { bsr: "staff" },
  },
  {
    email: "mechanic@bsr.demo.test",
    name: "Lek (mechanic)",
    roles: { bsr: "mechanic" },
  },
  {
    email: "driver@bsr.demo.test",
    name: "Ton (driver)",
    roles: { bsr: "driver" },
  },
  {
    email: "owner@saigon.demo.test",
    name: "Linh (owner)",
    roles: { "saigon-scooters": "owner" },
  },
  {
    email: "staff@saigon.demo.test",
    name: "Minh (staff)",
    roles: { "saigon-scooters": "staff" },
  },
  {
    email: "both@demo.test",
    name: "Alex (works in both)",
    roles: { bsr: "manager", "saigon-scooters": "staff" },
  },
];

async function existingUsers(): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    for (const u of data.users) if (u.email) byEmail.set(u.email, u.id);
    if (data.users.length < 1000) return byEmail;
  }
}

async function main() {
  console.log(`Seeding ${staging ? "STAGING" : "local"}: ${url}`);

  const tenantIds = new Map<string, string>();
  for (const tenant of tenants) {
    const { data, error } = await db
      .from("tenants")
      .upsert(tenant, { onConflict: "slug" })
      .select("id")
      .single();
    if (error) throw error;
    tenantIds.set(tenant.slug, data.id);
    console.log(`  shop  ${tenant.name} (/${tenant.slug})`);
  }

  const known = await existingUsers();
  for (const user of users) {
    let id = known.get(user.email);
    const attributes = {
      password,
      email_confirm: true,
      user_metadata: { name: user.name },
    };
    if (id) {
      const { error } = await db.auth.admin.updateUserById(id, attributes);
      if (error) throw error;
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email: user.email,
        ...attributes,
      });
      if (error) throw error;
      id = data.user.id;
    }
    // The marketplace's sign-up trigger made a profile; give it the name.
    await db.from("profiles").update({ name: user.name }).eq("id", id);

    for (const [slug, role] of Object.entries(user.roles)) {
      const { error } = await db
        .from("memberships")
        .upsert(
          { tenant_id: tenantIds.get(slug)!, user_id: id, role },
          { onConflict: "tenant_id,user_id" },
        );
      if (error) throw error;
    }
    const where = Object.entries(user.roles)
      .map(([slug, role]) => `${role} at /${slug}`)
      .join(", ");
    console.log(`  user  ${user.email.padEnd(26)} ${where}`);
  }

  console.log("Done. Every demo user's password is DEMO_PASSWORD.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
