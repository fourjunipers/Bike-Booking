/**
 * No default grants to the Data API roles (migration 20261112000100).
 *
 * Live has "Automatically expose new tables" turned off, so a table created
 * in `public` is closed until a migration grants it. These tests keep local
 * and CI the same, and fail when a table is reachable over the API without a
 * grant written in a migration.
 *
 * Adding a table? Grant on purpose in the same migration, e.g.
 *   grant select on public.thing to anon, authenticated;
 * Adding a function? `revoke all on function ... from public, anon;` then
 * grant execute to the roles that should call it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sql } from "./helpers";

const migrationsDir = fileURLToPath(
  new URL("../../../../supabase/migrations", import.meta.url),
);

/**
 * Tables from before the switch (the first 27 migrations, 8 Nov 2026 and
 * earlier). They got their access from the old defaults, narrowed by explicit
 * revokes. This list is closed: never add to it.
 */
const legacyPublicTables = [
  "bike_catalog",
  "bike_model_downtime",
  "bike_model_policies",
  "bike_models",
  "booking_events",
  "bookings",
  "delivery_zones",
  "price_days",
  "profiles",
  "promotion_models",
  "promotions",
  "ranking_settings",
  "reviews",
  "shop_closures",
  "shop_contacts",
  "shop_extra_models",
  "shop_extras",
  "shop_hours",
  "shop_invites",
  "shop_members",
  "shop_policies",
  "shops",
  "stations",
].map((table) => `public.${table}`);

/**
 * Marketplace functions from before the switch that anyone may execute
 * (Postgres' own default; their bodies and RLS do the guarding). Closed list.
 */
const legacyPublicFunctions = [
  "bike_catalog_set_slug",
  "bike_model_shop_id",
  "booking_set_currency",
  "can_use_catalog",
  "fill_review_from_booking",
  "flag_bike_model_edit",
  "flag_model_child_edit",
  "flag_shop_edit",
  "handle_line_identity",
  "handle_new_user",
  "handle_user_email_change",
  "is_admin",
  "is_bike_model_public",
  "is_catalog_approved",
  "is_shop_closed_on",
  "is_shop_live",
  "is_shop_member",
  "is_shop_owner",
  "longest_walkin",
  "model_offer",
  "promotion_shop_id",
  "protect_last_owner",
  "reject_booking_event_change",
  "rental_days",
  "rental_price",
  "repair_conflicts",
  "search_offers",
  "set_updated_at",
  "shop_coordinates",
  "shop_extra_shop_id",
  "shop_open_at",
  "shop_stats",
  "slugify",
  "station_list",
  "try_uuid",
].map((name) => `public.${name}`);

/** psql's command tags (BEGIN, CREATE TABLE…), which aren't result rows. */
const commandTag =
  /^(BEGIN|COMMIT|ROLLBACK|GRANT|REVOKE|CREATE [A-Z ]+|DROP [A-Z ]+)$/;

function lines(statement: string): string[] {
  const { out, failed } = sql(statement);
  expect(failed).toBe("");
  return out.split("\n").filter((line) => line && !commandTag.test(line));
}

/**
 * Created in public by the first platform migrations, granted there, then
 * moved with "alter table ... set schema platform" (20261110000100). Their
 * grants are written under the old name.
 */
const movedFromPublic = ["platform.tenants", "platform.memberships"];

/** Every migration, comments removed, as one lower-case string. */
function migrationsText(): string {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(`${migrationsDir}/${file}`, "utf8"))
    .join("\n")
    .replace(/--[^\n]*/g, "")
    .toLowerCase();
}

/** True when some migration grants on this table to anon or authenticated. */
export function hasExplicitGrant(migrations: string, table: string): boolean {
  const name = table.replace(".", "\\.");
  return new RegExp(
    `\\bgrant\\b[^;]*\\bon\\b[^;]*\\b${name}\\b[^;]*\\bto\\b[^;]*\\b(anon|authenticated)\\b`,
  ).test(migrations);
}

describe("default grants", () => {
  it("postgres' defaults in public and platform give the API roles nothing, except service_role in platform", () => {
    const rows = lines(`
      select n.nspname || ' ' || d.defaclobjtype::text || ' ' || pg_get_userbyid(a.grantee)
      from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
      cross join lateral aclexplode(d.defaclacl) a
      where pg_get_userbyid(d.defaclrole) = 'postgres'
        and n.nspname in ('public', 'platform')
        and a.grantee <> 0
        and pg_get_userbyid(a.grantee) in ('anon', 'authenticated', 'service_role')
      group by 1 order by 1;
    `);
    expect(rows).toEqual([
      "platform S service_role",
      "platform f service_role",
      "platform r service_role",
    ]);
  });

  it("a new table or sequence is closed to anon, authenticated and (in public) service_role until it is granted", () => {
    const rows = lines(`
      begin;
      create table public.zz_grant_probe (id serial primary key);
      create table platform.zz_grant_probe (id serial primary key);
      select format('%s %s tables:%s sequences:%s', s, r,
        has_table_privilege(r, s || '.zz_grant_probe',
          'select, insert, update, delete, truncate, references, trigger'),
        has_sequence_privilege(r, s || '.zz_grant_probe_id_seq', 'usage, select, update'))
      from unnest(array['public', 'platform']) s,
           unnest(array['anon', 'authenticated', 'service_role']) r
      order by s, r;
      rollback;
    `);
    expect(rows).toEqual([
      "platform anon tables:f sequences:f",
      "platform authenticated tables:f sequences:f",
      "platform service_role tables:t sequences:t",
      "public anon tables:f sequences:f",
      "public authenticated tables:f sequences:f",
      "public service_role tables:f sequences:f",
    ]);
  });

  it("an explicit grant is what opens a new table", () => {
    const rows = lines(`
      begin;
      create table public.zz_grant_probe (id int);
      grant select on public.zz_grant_probe to anon;
      select has_table_privilege('anon', 'public.zz_grant_probe', 'select')::text
        || ' ' || has_table_privilege('anon', 'public.zz_grant_probe', 'insert')::text
        || ' ' || has_table_privilege('authenticated', 'public.zz_grant_probe', 'select')::text;
      rollback;
    `);
    expect(rows).toEqual(["true false false"]);
  });
});

describe("every table the API roles can reach was granted on purpose", () => {
  it("tables in public and platform reachable by anon or authenticated have a grant in a migration", () => {
    const reachable = lines(`
      select n.nspname || '.' || c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'platform')
        and c.relkind in ('r', 'v', 'm', 'p', 'f')
        and not exists (select 1 from pg_depend d
                        where d.objid = c.oid and d.deptype = 'e')
        and (has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')
          or has_table_privilege('authenticated', c.oid, 'select, insert, update, delete, truncate, references, trigger')
          or has_any_column_privilege('anon', c.oid, 'select, insert, update, references')
          or has_any_column_privilege('authenticated', c.oid, 'select, insert, update, references'))
      order by 1;
    `);
    // Sanity: the query sees the tables it should.
    expect(reachable).toContain("public.shops");
    expect(reachable).toContain("platform.units");

    const migrations = migrationsText();
    const withoutGrant = reachable.filter(
      (table) =>
        !legacyPublicTables.includes(table) &&
        !hasExplicitGrant(migrations, table) &&
        !(
          movedFromPublic.includes(table) &&
          hasExplicitGrant(migrations, table.replace("platform.", "public."))
        ),
    );
    expect(
      withoutGrant,
      "Reachable by anon or authenticated with no grant in a migration. Add `grant ... on <table> to ...` to the migration that creates it.",
    ).toEqual([]);
  });

  it("the grant finder reads real statements and ignores look-alikes", () => {
    const text = `
      grant select on public.vehicle_types to anon, authenticated;
      grant select (id, name) on platform.tenants to authenticated;
      revoke select on public.hidden from anon;
      grant all on public.internal to service_role;
      create table public.later (id int); grant usage on schema x to anon;
    `;
    expect(hasExplicitGrant(text, "public.vehicle_types")).toBe(true);
    expect(hasExplicitGrant(text, "platform.tenants")).toBe(true);
    expect(hasExplicitGrant(text, "public.hidden")).toBe(false);
    expect(hasExplicitGrant(text, "public.internal")).toBe(false);
    expect(hasExplicitGrant(text, "public.later")).toBe(false);
  });

  it("no function in public or platform is open to everyone, apart from the marketplace's from before the switch", () => {
    const open = lines(`
      select distinct n.nspname || '.' || p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'platform')
        and not exists (select 1 from pg_depend d
                        where d.objid = p.oid and d.deptype = 'e')
        and (p.proacl is null or exists (
          select 1 from aclexplode(p.proacl) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
      order by 1;
    `);
    expect(
      open.filter((name) => !legacyPublicFunctions.includes(name)),
      "Executable by PUBLIC (so by anon). Add `revoke all on function ... from public, anon;` and grant execute on purpose.",
    ).toEqual([]);
  });
});

/**
 * Products, stage B (20261113000300): one new table and its functions. What
 * each role may do is written here in full, so a later migration that widens
 * it fails this test.
 */
describe("products stage B: the stock ledger and the stock functions", () => {
  it("stock_movements: members read and add, nobody changes or removes, signed-out visitors get nothing", () => {
    const rows = lines(`
      select r || ' ' || coalesce(string_agg(p, ',' order by p)
        filter (where has_table_privilege(r, 'platform.stock_movements', p)), 'none')
      from unnest(array['anon', 'authenticated']) r,
           unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p
      group by r order by r;
    `);
    expect(rows).toEqual(["anon none", "authenticated insert,select"]);
    expect(
      hasExplicitGrant(migrationsText(), "platform.stock_movements"),
    ).toBe(true);
  });

  it("every stage B function is closed to signed-out visitors and to PUBLIC; members call the ones meant for them", () => {
    const rows = lines(`
      select n.nspname || '.' || p.proname || ' '
        || has_function_privilege('anon', p.oid, 'execute') || ' '
        || has_function_privilege('authenticated', p.oid, 'execute') || ' '
        || coalesce((select bool_or(a.grantee = 0) from aclexplode(p.proacl) a), p.proacl is null)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('platform', 'platform_private')
        and p.proname in (
          'set_stock_quantity', 'mark_units_damaged', 'mark_units_repaired',
          'mark_units_lost', 'resolve_lost_units', 'create_general_product',
          'product_stock', 'move_product', 'reset_product_order',
          'change_listing_entry', 'disconnect_listing',
          'lock_product_stock', 'lock_units', 'stock_product', 'upcoming_bookings',
          'units_gear_fields', 'units_label_guard', 'products_tracking_guard',
          'products_sort_bottom', 'products_stock_guard', 'stock_movements_guard')
      order by 1;
    `);
    expect(rows).toEqual([
      // name, anon, authenticated, PUBLIC
      "platform.change_listing_entry false true false",
      "platform.create_general_product false true false",
      "platform.disconnect_listing false true false",
      "platform.mark_units_damaged false true false",
      "platform.mark_units_lost false true false",
      "platform.mark_units_repaired false true false",
      "platform.move_product false true false",
      "platform.product_stock false true false",
      "platform.reset_product_order false true false",
      "platform.resolve_lost_units false true false",
      "platform.set_stock_quantity false true false",
      // Helpers the functions above call as the member.
      "platform_private.lock_product_stock false true false",
      "platform_private.lock_units false true false",
      // Trigger functions: nobody calls them.
      "platform_private.products_sort_bottom false false false",
      "platform_private.products_stock_guard false false false",
      "platform_private.products_tracking_guard false false false",
      "platform_private.stock_movements_guard false false false",
      "platform_private.stock_product false true false",
      "platform_private.units_gear_fields false false false",
      "platform_private.units_label_guard false false false",
      "platform_private.upcoming_bookings false true false",
    ]);
  });
});
