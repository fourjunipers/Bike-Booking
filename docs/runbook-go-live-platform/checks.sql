-- Read-only checks for docs/RUNBOOK-GO-LIVE-PLATFORM.md. Nothing here writes.
-- Paste one block at a time into the Supabase SQL editor (live project).
-- "Expected" values are from the dry run on a copy of live, 12 Nov 2026.

-- ===========================================================================
-- A. BEFORE applying (runbook step 2). Keep the output of A1 to compare later.
-- ===========================================================================

-- A1. Rows in every marketplace table. Run again after applying: same numbers.
-- On 12 Nov 2026: bike_catalog 25, bike_models 2, bookings 0, price_days 60,
-- profiles 3, shops 2, shop_hours 14, stations 182 (others 0, 1 or 2).
select relname as table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from public.%I', relname),
                           false, true, '')))[1]::text::int as row_count
from pg_stat_user_tables
where schemaname = 'public' and relname <> 'spatial_ref_sys'
order by relname;

-- A2. Migrations on record. Expected before: 27, newest 20261108000100.
select count(*) as migrations, max(version) as newest
from supabase_migrations.schema_migrations;

-- A3. The extensions the migrations turn on can be installed here.
-- Expected: two rows (btree_gist, pg_cron), installed_version empty for both.
-- If pg_cron is missing the migrations still apply; only the hourly document
-- reminder job is skipped.
select name, default_version, installed_version
from pg_available_extensions
where name in ('pg_cron', 'btree_gist');

-- A4. Nothing in the way. Expected: no rows.
select n.nspname as schema, c.relname as name
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where (n.nspname in ('platform', 'platform_private'))
   or (n.nspname = 'public' and c.relname in ('tenants', 'memberships', 'vehicle_types'));

-- A5. Every catalog entry fits the new rules. Expected: 0.
select count(*) as entries_outside_new_range
from public.bike_catalog
where cc not between 1 and 20000;

-- ===========================================================================
-- B. AFTER applying (runbook step 4).
-- ===========================================================================

-- B1. Expected: 48, newest 20261111001300.
select count(*) as migrations, max(version) as newest
from supabase_migrations.schema_migrations;

-- B2. Re-run A1. Every number must match what you saved.

-- B3. The catalog: every row got the defaults, nothing else changed.
-- Expected: total = motorbike_with_defaults (25 = 25 on 12 Nov 2026).
select count(*) as total,
       count(*) filter (where vehicle_type = 'motorbike' and specs = '{}'
                          and requested_by_tenant_id is null) as motorbike_with_defaults
from public.bike_catalog;

-- B4. The public can't read the catalog's three private columns. Expected: 0.
select count(*) as private_columns_readable
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'bike_catalog'
  and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
  and column_name in ('request_note', 'requested_by_tenant_id', 'review_notes');

-- B5. ...and can read the 22 columns the marketplace uses. Expected: 22 for
-- anon and 22 for authenticated. (21 once 20261112000300 is applied, which
-- also makes requested_by_shop_id private.)
select grantee, count(*) as readable_columns
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'bike_catalog'
  and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
group by grantee order by grantee;

-- B6. The platform is empty. Expected: 0, 0, 0.
select (select count(*) from platform.tenants) as shops,
       (select count(*) from platform.memberships) as members,
       (select count(*) from platform.platform_admins) as platform_admins;

-- B7. Reference data. Expected: atv,boat,car,motorbike,other
select string_agg(key, ',' order by key) as vehicle_types from public.vehicle_types;

-- B8. The hourly job. Expected: one row, platform-renewal-notifications,
-- '7 * * * *', active = true.
select jobname, schedule, active from cron.job;

-- ===========================================================================
-- C. RLS checks (runbook step 7). Run after step 4, and again after the two
--    dashboard changes.
-- ===========================================================================

-- C1. Every platform table has RLS on and at least one policy.
-- Expected: 14 rows, rls_enabled true on each, policy counts 1, 2 or 4.
select * from platform.platform_rls_report();

-- C2. No platform policy is open to everyone. Expected: no rows.
select * from platform.platform_open_policies();

-- C3. The public (anon) can touch nothing in the platform schema and
-- signed-in users can't truncate. Expected: 15 rows, the last two columns
-- false on every row.
select * from platform.platform_exposure_report();

-- C4. Expected: anon_usage false, default_grantees {service_role}.
select * from platform.platform_schema_access();

-- C5. No table in public or platform is without RLS. Expected: no rows.
select schemaname, tablename
from pg_tables
where schemaname in ('public', 'platform') and not rowsecurity
  and tablename <> 'spatial_ref_sys';

-- C6. A fingerprint of every grant to the public roles. Run before and after
-- turning off "Automatically expose new tables": the two results must match
-- (the switch should only affect tables created later).
select grantee, table_schema, count(*) as grants,
       md5(string_agg(table_name || ':' || privilege_type, ','
                      order by table_name, privilege_type)) as fingerprint
from information_schema.role_table_grants
where grantee in ('anon', 'authenticated') and table_schema in ('public', 'platform')
group by grantee, table_schema
order by grantee, table_schema;
