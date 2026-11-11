-- Platform Phase 1a: tidy leftover grants, and a report the tests use to prove
-- that nothing in the platform schema is readable without RLS.
--
-- tenants and memberships were created in `public` in Phase 0, where Supabase
-- grants every privilege to anon and authenticated on new tables. Phase 0
-- revoked insert, update and delete; select (anon) and truncate, references
-- and trigger (both roles) came along when the tables moved. None of it could
-- be used: anon has no access to the schema, no policy names anon, and the
-- Data API has no truncate. It is removed so each layer holds on its own.
-- Tables created in `platform` itself never get such grants: the schema's
-- default privileges name the service role only.

revoke all on platform.tenants, platform.memberships from anon;
revoke truncate, references, trigger on platform.tenants, platform.memberships from authenticated;

-- Every table, view and materialized view in the platform schema, with what
-- protects it. Unlike platform_rls_report this isn't limited to tables with a
-- tenant_id (platform_admins has none). Service role only.
create function platform.platform_exposure_report()
returns table (
  relation text,
  kind text,
  rls_enabled boolean,
  policy_count int,
  anon_has_any_privilege boolean,
  authenticated_can_truncate boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.relname::text,
    case c.relkind when 'v' then 'view' when 'm' then 'matview' else 'table' end,
    c.relrowsecurity,
    (select count(*)::int from pg_catalog.pg_policies p
      where p.schemaname = 'platform' and p.tablename = c.relname),
    has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger'),
    has_table_privilege('authenticated', c.oid, 'truncate')
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'platform' and c.relkind in ('r', 'p', 'v', 'm')
  order by c.relname;
$$;

-- Whether a role may use the platform schema at all, and what a NEW table in
-- it would be granted automatically.
create function platform.platform_schema_access()
returns table (anon_usage boolean, default_grantees text[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    has_schema_privilege('anon', 'platform', 'usage'),
    coalesce((
      select array_agg(distinct g.grantee::regrole::text order by g.grantee::regrole::text)
      from pg_catalog.pg_default_acl d
      join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
      cross join lateral aclexplode(d.defaclacl) g
      where n.nspname = 'platform' and g.grantee <> 0
    ), '{}');
$$;

revoke all on function platform.platform_exposure_report() from public, anon, authenticated;
revoke all on function platform.platform_schema_access() from public, anon, authenticated;
grant execute on function platform.platform_exposure_report() to service_role;
grant execute on function platform.platform_schema_access() to service_role;
