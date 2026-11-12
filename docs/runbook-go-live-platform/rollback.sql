-- EMERGENCY ONLY. Undoes the 21 platform migrations (20261109000100 to
-- 20261111001300) and puts the database back to the 27-migration state the
-- marketplace runs on. See docs/RUNBOOK-GO-LIVE-PLATFORM.md › Rollback.
--
-- It works from any point: after all 21, or after `supabase db push` stopped
-- part-way. It runs in one transaction, so it either undoes everything or
-- changes nothing.
--
-- It REFUSES to run once the platform holds a shop (a row in tenants): from
-- then on rolling back would delete a shop's data, and the answer is a
-- forward fix, not this script.
--
-- Run as the `postgres` user (Supabase SQL editor, or psql with the session
-- pooler connection string). Tested on a copy of live, 12 Nov 2026: schema
-- identical to live's afterwards, every marketplace row unchanged.

begin;

do $$
declare
  n bigint := 0;
begin
  if to_regclass('platform.tenants') is not null then
    execute 'select count(*) from platform.tenants' into n;
  elsif to_regclass('public.tenants') is not null then
    execute 'select count(*) from public.tenants' into n;
  end if;
  if n > 0 then
    raise exception 'The platform holds % shop(s). Rolling back would delete them. Stop and fix forward.', n;
  end if;
end;
$$;

-- The hourly job, then the scheduler itself (not installed before).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job
    where jobname = 'platform-renewal-notifications';
    if not exists (select 1 from cron.job) then
      drop extension pg_cron;
    end if;
  end if;
end;
$$;

-- The catalog: back to one table-wide read grant, the old engine-size range
-- and no platform columns.
drop policy if exists "Tenant members read their shop's catalog requests" on public.bike_catalog;
drop policy if exists "Platform admins read every catalog entry" on public.bike_catalog;

revoke select on public.bike_catalog from anon, authenticated;
do $$
declare
  cols text;
begin
  -- Column grants are separate from the table grant; take them all away.
  select string_agg(quote_ident(attname), ', ') into cols
  from pg_attribute
  where attrelid = 'public.bike_catalog'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke select (%s) on public.bike_catalog from anon, authenticated', cols);
end;
$$;
grant select on public.bike_catalog to anon, authenticated;

do $$
begin
  -- Only narrow the range again if every entry still fits it.
  if not exists (select 1 from public.bike_catalog where cc not between 50 and 2500) then
    alter table public.bike_catalog
      drop constraint bike_catalog_cc_check,
      add constraint bike_catalog_cc_check check (cc between 50 and 2500);
  else
    raise warning 'bike_catalog has entries outside 50-2500 cc: the wider check is kept';
  end if;
end;
$$;

alter table public.bike_catalog
  drop column if exists vehicle_type,
  drop column if exists specs,
  drop column if exists requested_by_tenant_id;

-- Everything the platform owns (its models point at vehicle_types, so first).
drop schema if exists platform cascade;

drop table if exists public.vehicle_types;

-- Left in public only when the push stopped before 20261110000100 moved them.
drop function if exists public.platform_rls_report();
drop function if exists public.tenant_members(uuid);
drop function if exists public.remove_member(uuid);
do $$
begin
  if to_regtype('public.platform_role') is not null then
    drop function if exists public.set_member_role(uuid, public.platform_role);
  end if;
end;
$$;
drop schema if exists platform_private cascade;
drop table if exists public.memberships cascade;
drop table if exists public.tenants cascade;
drop type if exists public.platform_role;

-- Added for the platform's "no overlapping blocks" rule; nothing else uses it.
drop extension if exists btree_gist;

-- Forget the 21 migrations, so `supabase db push` offers them again.
delete from supabase_migrations.schema_migrations
where version between '20261109000100' and '20261111001300';

commit;
