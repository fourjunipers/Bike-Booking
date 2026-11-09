-- Platform Phase 0: lists every tenant-scoped table (public tables with a
-- tenant_id column, plus tenants itself) with its RLS state, so the
-- tenant-isolation tests cover each new table automatically
-- (apps/platform/tests/db). Service role only.

create function public.platform_rls_report()
returns table (table_name text, rls_enabled boolean, policy_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.relname::text,
    c.relrowsecurity,
    (select count(*)::int from pg_catalog.pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (
      c.relname = 'tenants'
      or exists (
        select 1 from pg_catalog.pg_attribute a
        where a.attrelid = c.oid
          and a.attname = 'tenant_id'
          and not a.attisdropped
      )
    )
  order by c.relname;
$$;

revoke all on function public.platform_rls_report() from public, anon, authenticated;
grant execute on function public.platform_rls_report() to service_role;
