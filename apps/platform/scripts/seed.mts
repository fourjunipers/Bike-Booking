/**
 * Demo data for the platform: two shops in different countries, one user per
 * role, one user who works in both shops, a platform admin, and (Phase 1a)
 * BSR's location details plus 20 demo bikes read from scripts/demo/bsr-fleet.csv
 * through the same CSV reader and checks the import screen uses, BSR tax and
 * insurance records in every state, and a third shop with 150 bikes in 5
 * models for trying the fleet list at size.
 *
 *   npm run seed -w @mango/platform            local Supabase
 *   npm run seed:staging -w @mango/platform    mango-works-staging
 *
 * Safe to run again: it updates what's there and skips bikes already imported.
 * The plates and frame numbers are clearly fake (DEMO-…); the real fleet
 * arrives later through CSV import. Every demo user gets the password in
 * DEMO_PASSWORD (apps/platform/.env.local, never committed). Never runs
 * against any other project.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "../lib/csv.ts";
import { planImport } from "../lib/fleet-import.ts";

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

const auth = { persistSession: false, autoRefreshToken: false };
/** Platform tables. */
const db = createClient(url, key, { auth, db: { schema: "platform" } });
/** The shared catalog and marketplace profiles. */
const pub = createClient(url, key, { auth });

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
  // 150 bikes in 5 models, for trying the fleet list at size.
  {
    slug: "big-fleet",
    name: "Big Fleet Demo",
    country: "US",
    currency: "USD",
    timezone: "America/New_York",
    locale: "en-US",
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
  {
    email: "owner@big.demo.test",
    name: "Dana (owner)",
    roles: { "big-fleet": "owner" },
  },
  // Mango Works staff: approves catalog requests at /admin/catalog.
  { email: "admin@mangoworks.demo.test", name: "Mango (admin)", roles: {} },
];
const platformAdmin = "admin@mangoworks.demo.test";

/** Catalog entries the demo fleet uses, added only where the project lacks them. */
const catalog: {
  slug: string;
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
  cc: number;
  type: "city_scooter" | "touring" | "adventure";
  transmission: "automatic" | "manual";
}[] = [
  [
    "honda-pcx-160-2026",
    "Honda",
    "PCX 160",
    2026,
    2026,
    160,
    "city_scooter",
    "automatic",
  ],
  [
    "honda-adv-160-2026",
    "Honda",
    "ADV 160",
    2026,
    2026,
    160,
    "city_scooter",
    "automatic",
  ],
  [
    "honda-click-160-2023-2025",
    "Honda",
    "Click 160",
    2023,
    2025,
    160,
    "city_scooter",
    "automatic",
  ],
  [
    "yamaha-nmax-2026",
    "Yamaha",
    "NMAX",
    2026,
    2026,
    155,
    "city_scooter",
    "automatic",
  ],
  [
    "yamaha-aerox-155-2024-2026",
    "Yamaha",
    "Aerox 155",
    2024,
    2026,
    155,
    "city_scooter",
    "automatic",
  ],
  [
    "honda-scoopy-2025-2026",
    "Honda",
    "Scoopy",
    2025,
    2026,
    110,
    "city_scooter",
    "automatic",
  ],
  [
    "yamaha-fazzio-2025-2026",
    "Yamaha",
    "Fazzio",
    2025,
    2026,
    125,
    "city_scooter",
    "automatic",
  ],
  [
    "honda-giorno-2025-2026",
    "Honda",
    "Giorno",
    2025,
    2026,
    125,
    "city_scooter",
    "automatic",
  ],
  [
    "honda-nx500-2025",
    "Honda",
    "NX500",
    2025,
    2025,
    471,
    "adventure",
    "manual",
  ],
  [
    "honda-cb500x-2022-2023",
    "Honda",
    "CB500X",
    2022,
    2023,
    471,
    "adventure",
    "manual",
  ],
  [
    "honda-forza-350",
    "Honda",
    "Forza 350",
    null,
    null,
    330,
    "touring",
    "automatic",
  ],
].map(([slug, make, model, year_from, year_to, cc, type, transmission]) => ({
  slug,
  make,
  model,
  year_from,
  year_to,
  cc,
  type,
  transmission,
})) as never;

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

/** Creates the shop with its default location, or updates its settings. */
async function upsertTenant(tenant: (typeof tenants)[number]): Promise<string> {
  const { data: found, error } = await db
    .from("tenants")
    .select("id")
    .eq("slug", tenant.slug)
    .maybeSingle();
  if (error) throw error;
  if (found) {
    const { error: updateError } = await db
      .from("tenants")
      .update({
        name: tenant.name,
        country: tenant.country,
        locale: tenant.locale,
        // Back to the demo's starting point: the browser tests read distances
        // in km, and someone trying the settings may have left it on miles.
        distance_unit: "km",
      })
      .eq("id", found.id);
    if (updateError) throw updateError;
    return found.id;
  }
  const { data: id, error: createError } = await db.rpc("create_tenant", {
    p_name: tenant.name,
    p_slug: tenant.slug,
    p_country: tenant.country,
    p_currency: tenant.currency,
    p_locale: tenant.locale,
    p_timezone: tenant.timezone,
  });
  if (createError) throw createError;
  return id;
}

/** BSR's shop details (docs/marketplace/BSR_SEED.md), hours and one yearly closure. */
async function seedBsrLocation(tenantId: string): Promise<string> {
  const { data: location, error } = await db
    .from("locations")
    .update({
      name: "BSR Bike Shop",
      address:
        "79/37 Soi Phumichit, Rama 4, Phra Khanong, Khlong Toei, Bangkok 10110",
      phone: "+66850550247",
      whatsapp: "+66850550247",
      line_id: "bsrbikeshop",
      email: "info@bsrbikeshop.com",
    })
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .select("id")
    .single();
  if (error) throw error;

  // Mon–Fri 10:00–18:00, Sat–Sun 11:00–16:00. 0 = Sunday.
  const hours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    tenant_id: tenantId,
    location_id: location.id,
    weekday,
    open: weekday === 0 || weekday === 6 ? "11:00" : "10:00",
    close: weekday === 0 || weekday === 6 ? "16:00" : "18:00",
  }));
  const { error: hoursError } = await db
    .from("location_hours")
    .upsert(hours, { onConflict: "location_id,weekday" });
  if (hoursError) throw hoursError;

  const { count } = await db
    .from("location_closures")
    .select("*", { count: "exact", head: true })
    .eq("location_id", location.id);
  if (!count) {
    const { error: closureError } = await db.from("location_closures").insert({
      tenant_id: tenantId,
      location_id: location.id,
      start_date: "2027-04-13",
      end_date: "2027-04-15",
      note: "Songkran",
      repeats_yearly: true,
    });
    if (closureError) throw closureError;
  }
  return location.id;
}

type CatalogRow = {
  id: string;
  slug: string;
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
};

/** Makes sure the catalog entries exist, and returns every approved entry. */
async function seedCatalog(): Promise<CatalogRow[]> {
  const { data: existing, error } = await pub
    .from("bike_catalog")
    .select("slug")
    .in(
      "slug",
      catalog.map((c) => c.slug),
    );
  if (error) throw error;
  const have = new Set(existing.map((c) => c.slug));
  const missing = catalog.filter((c) => !have.has(c.slug));
  if (missing.length > 0) {
    const { error: insertError } = await pub.from("bike_catalog").insert(
      missing.map((c) => ({
        ...c,
        status: "approved",
        reviewed_at: new Date().toISOString(),
      })),
    );
    if (insertError) throw insertError;
  }
  console.log(
    `  catalog  ${catalog.length} entries (${missing.length} added, ${have.size} already there)`,
  );
  const { data: approved, error: listError } = await pub
    .from("bike_catalog")
    .select("id, slug, make, model, year_from, year_to")
    .eq("status", "approved");
  if (listError) throw listError;
  return approved;
}

/** The 20 demo bikes, through the real CSV reader and import checks. */
async function seedBsrFleet(
  tenantId: string,
  locationId: string,
  approved: CatalogRow[],
) {
  const [{ data: products }, { data: units }] = await Promise.all([
    db
      .from("products")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("type", "vehicle"),
    db.from("units").select("plate, frame_number").eq("tenant_id", tenantId),
  ]);
  const table = parseCsv(
    readFileSync(new URL("./demo/bsr-fleet.csv", import.meta.url), "utf8"),
  );
  // Running again: leave out the bikes already there (matched by frame number).
  const frames = new Set((units ?? []).map((u) => u.frame_number));
  table.rows = table.rows.filter((r) => !frames.has(r.values.frame_number));
  if (table.rows.length === 0) {
    console.log(`  fleet  ${frames.size} demo bikes already imported`);
    return;
  }

  const plan = planImport(table, {
    currency: "THB",
    distanceUnit: "km",
    locations: [{ id: locationId, name: "BSR Bike Shop", isDefault: true }],
    products: products ?? [],
    plates: (units ?? []).flatMap((u) => (u.plate ? [u.plate] : [])),
    newId: randomUUID,
  });
  if (plan.errors.length > 0) {
    console.error(plan.errors);
    fail("scripts/demo/bsr-fleet.csv has errors");
  }

  // import_fleet runs as a signed-in owner or manager; the seed has no session,
  // so it saves the same plan with the service role.
  if (plan.products.length > 0) {
    const { error } = await db.from("products").insert(
      plan.products.map((product) => {
        // The demo shop's products are all on the Moto Mangos list: each is
        // put on the entry its name starts with (the one whose years cover
        // its first vehicle), as a shop would by picking it on the product's
        // Moto Mangos panel. The database then fills in the list's details.
        const year = plan.units.find(
          (u) => u.product_id === product.id,
        )?.model_year;
        const entries = approved.filter((c) =>
          product.name
            .toLowerCase()
            .startsWith(`${c.make} ${c.model}`.toLowerCase()),
        );
        const entry =
          entries.find(
            (c) =>
              year != null &&
              c.year_from !== null &&
              year >= c.year_from &&
              year <= (c.year_to ?? c.year_from),
          ) ?? entries[0];
        return {
          ...product,
          tenant_id: tenantId,
          catalog_id: entry?.id ?? null,
        };
      }) as never,
    );
    if (error) throw error;
  }
  for (const unit of plan.units) {
    const { purchase_date, purchase_price, purchased_from, ...row } = unit;
    const { data, error } = await db
      .from("units")
      .insert({ ...row, tenant_id: tenantId })
      .select("id")
      .single();
    if (error) throw error;
    const { error: moneyError } = await db.from("unit_financials").insert({
      tenant_id: tenantId,
      unit_id: data.id,
      currency: "THB",
      purchase_date,
      purchase_price,
      purchased_from,
    });
    if (moneyError) throw moneyError;
  }
  console.log(
    `  fleet  ${plan.units.length} demo bikes in ${plan.products.length} new products (fake DEMO- plates)`,
  );
}

/** A date `days` from today, as YYYY-MM-DD. */
const dayFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Tax and insurance records that show every state on the day the seed runs:
 * insurance expiring in 30 days (the spec's acceptance check), one in 5 days,
 * road tax that expired 3 days ago, and some comfortably in the future.
 * Added once: skipped when the shop already has any.
 */
async function seedBsrRenewals(tenantId: string) {
  const { count } = await db
    .from("unit_renewals")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (count) {
    console.log(`  renewals  ${count} already there`);
    return;
  }
  const { data: units, error } = await db
    .from("units")
    .select("id, plate")
    .eq("tenant_id", tenantId)
    .in("plate", ["DEMO-001", "DEMO-002", "DEMO-003", "DEMO-004"]);
  if (error) throw error;
  const id = (plate: string) => units.find((u) => u.plate === plate)?.id;
  const records: [string, string, number, number][] = [
    // plate, kind, expires in days, cost in baht
    ["DEMO-001", "compulsory_insurance", 30, 645],
    ["DEMO-001", "road_tax", 200, 100],
    ["DEMO-002", "road_tax", -3, 100],
    ["DEMO-002", "compulsory_insurance", 120, 645],
    ["DEMO-003", "compulsory_insurance", 5, 645],
    ["DEMO-003", "road_tax", 300, 100],
    ["DEMO-004", "compulsory_insurance", 250, 645],
    ["DEMO-004", "road_tax", 250, 100],
  ];
  let added = 0;
  for (const [plate, kind, days, cost] of records) {
    const unitId = id(plate);
    if (!unitId) continue;
    const { data, error: renewalError } = await db
      .from("unit_renewals")
      .insert({
        tenant_id: tenantId,
        unit_id: unitId,
        kind,
        provider: "Demo provider (not a real policy)",
        reference_no: `DEMO-${plate.slice(-3)}-${kind === "road_tax" ? "T" : "I"}`,
        starts_at: dayFromNow(days - 365),
        expires_at: dayFromNow(days),
      })
      .select("id")
      .single();
    if (renewalError) throw renewalError;
    const { error: costError } = await db.from("unit_renewal_costs").insert({
      tenant_id: tenantId,
      renewal_id: data.id,
      currency: "THB",
      cost: cost * 100,
    });
    if (costError) throw costError;
    added++;
  }
  console.log(`  renewals  ${added} demo tax and insurance records`);
}

/**
 * A big demo shop for trying the fleet list at size: 150 bikes in 5 models,
 * model years 2014 to 2026 with three year bands per model, two locations and
 * a mix of statuses. Fake BIG- plates. Added once.
 */
async function seedBigFleet(tenantId: string, approved: CatalogRow[]) {
  const { count } = await db
    .from("units")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((count ?? 0) >= 150) {
    console.log(`  big fleet  ${count} bikes already there`);
    return;
  }
  if (count)
    fail("the big demo shop is half-seeded; delete its bikes and run again");

  const { data: main, error } = await db
    .from("locations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .single();
  if (error) throw error;
  const { data: airport, error: airportError } = await db
    .from("locations")
    .upsert(
      {
        tenant_id: tenantId,
        name: "Airport desk",
        timezone: "America/New_York",
      },
      { onConflict: "tenant_id,id" },
    )
    .select("id")
    .single();
  if (airportError) throw airportError;

  const slugs = [
    "honda-pcx-160-2026",
    "honda-click-160-2023-2025",
    "honda-scoopy-2025-2026",
    "yamaha-nmax-2026",
    "yamaha-aerox-155-2024-2026",
  ];
  const colours = ["White", "Black", "Red", "Blue", "Grey"];
  const models: { id: string; name: string }[] = [];
  for (const slug of slugs) {
    const entry = approved.find((c) => c.slug === slug);
    if (!entry) fail(`catalog entry ${slug} is missing`);
    const { data, error: modelError } = await db
      .from("products")
      .insert({
        tenant_id: tenantId,
        catalog_id: entry.id,
        make: entry.make,
        model: entry.model,
        vehicle_type: "motorbike",
        name: `${entry.make} ${entry.model}`,
      })
      .select("id, name")
      .single();
    if (modelError) throw modelError;
    models.push(data);
    const { error: bandError } = await db.from("product_year_bands").insert(
      [
        [2014, 2019],
        [2020, 2023],
        [2024, 2026],
      ].map(([year_from, year_to]) => ({
        tenant_id: tenantId,
        product_id: data.id,
        year_from,
        year_to,
      })),
    );
    if (bandError) throw bandError;
  }

  const rows = Array.from({ length: 150 }, (_, i) => {
    const n = i + 1;
    return {
      tenant_id: tenantId,
      product_id: models[i % 5].id,
      location_id: n % 4 === 0 ? airport.id : main.id,
      plate: `BIG-${String(n).padStart(3, "0")}`,
      frame_number: `BIGFRAME${String(n).padStart(4, "0")}`,
      colour: colours[n % colours.length],
      // A few with no model year, to show the "unknown year" band.
      model_year: n % 17 === 0 ? null : 2014 + (n % 13),
      current_odometer_km: n * 311,
      status:
        n % 29 === 0 ? "retired" : n % 11 === 0 ? "maintenance" : "active",
    };
  });
  const { error: unitError } = await db.from("units").insert(rows);
  if (unitError) throw unitError;
  console.log("  big fleet  150 demo bikes in 5 models (fake BIG- plates)");
}

async function main() {
  console.log(`Seeding ${staging ? "STAGING" : "local"}: ${url}`);

  const tenantIds = new Map<string, string>();
  for (const tenant of tenants) {
    tenantIds.set(tenant.slug, await upsertTenant(tenant));
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
    await pub.from("profiles").update({ name: user.name }).eq("id", id);

    for (const [slug, role] of Object.entries(user.roles)) {
      const { error } = await db
        .from("memberships")
        .upsert(
          { tenant_id: tenantIds.get(slug)!, user_id: id, role },
          { onConflict: "tenant_id,user_id" },
        );
      if (error) throw error;
    }
    if (user.email === platformAdmin) {
      const { error } = await db
        .from("platform_admins")
        .upsert({ user_id: id, note: "Demo platform admin" });
      if (error) throw error;
    }
    const where =
      Object.entries(user.roles)
        .map(([slug, role]) => `${role} at /${slug}`)
        .join(", ") || "platform admin (/admin/catalog)";
    console.log(`  user  ${user.email.padEnd(28)} ${where}`);
  }

  const bsr = tenantIds.get("bsr")!;
  const locationId = await seedBsrLocation(bsr);
  const approved = await seedCatalog();
  await seedBsrFleet(bsr, locationId, approved);
  await seedBsrRenewals(bsr);
  await seedBigFleet(tenantIds.get("big-fleet")!, approved);

  console.log("Done. Every demo user's password is DEMO_PASSWORD.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
