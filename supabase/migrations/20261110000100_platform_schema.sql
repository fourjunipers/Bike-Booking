-- Platform Phase 1a: the platform gets its own schema (docs/platform/SPEC.md ›
-- Review decisions › Names; owner decision 10 Nov 2026).
--
-- * Platform tables move out of `public`, which stays the marketplace's. The
--   platform app's database client points at `platform` only.
-- * Signed-out visitors (anon) get no access to the schema at all.
-- * Nothing in it is granted by default: every table and function names who
--   may use it. The `authenticated` role includes every Moto Mangos sign-up,
--   so a grant alone is never the protection; RLS and function checks are.
-- * RLS uses the set form: tenant_id = any ((select my_tenant_ids())).
--
-- `platform` must be listed under API › Exposed schemas in each hosted project
-- (supabase/config.toml does it locally).

create schema platform;

grant usage on schema platform to authenticated, service_role;
grant all on all tables in schema platform to service_role;
alter default privileges in schema platform grant all on tables to service_role;
alter default privileges in schema platform grant all on sequences to service_role;
alter default privileges in schema platform grant execute on functions to service_role;
-- Postgres lets everyone execute a new function, and that default can't be
-- switched off per schema. So every function in `platform` revokes it by name
-- and checks the caller itself.

-- Move Phase 0 -----------------------------------------------------------------

alter type public.platform_role set schema platform;
alter table public.tenants set schema platform;
alter table public.memberships set schema platform;
alter function public.tenant_members(uuid) set schema platform;
alter function public.set_member_role(uuid, platform.platform_role) set schema platform;
alter function public.remove_member(uuid) set schema platform;
drop function public.platform_rls_report();

grant all on platform.tenants, platform.memberships to service_role;

-- The platform keeps its own copy of this helper, so dropping marketplace
-- objects later can't break it.
create function platform_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger tenants_set_updated_at on platform.tenants;
create trigger tenants_set_updated_at
before update on platform.tenants
for each row execute function platform_private.set_updated_at();

drop trigger memberships_set_updated_at on platform.memberships;
create trigger memberships_set_updated_at
before update on platform.memberships
for each row execute function platform_private.set_updated_at();

-- Parents are referenced by (tenant_id, id), so a child row can't point at
-- another shop's parent.
alter table platform.memberships add constraint memberships_tenant_id_id_key unique (tenant_id, id);

-- Membership helpers -------------------------------------------------------------
-- SECURITY DEFINER so policies on memberships don't recurse. The bodies named
-- public.memberships, so each is recreated.

-- The caller's tenants, optionally only those where they hold one of p_roles.
-- Policies call it as (select platform_private.my_tenant_ids(...)), which
-- Postgres evaluates once per statement, not once per row.
create function platform_private.my_tenant_ids(p_roles platform.platform_role[] default null)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(tenant_id), '{}')
  from platform.memberships
  where user_id = (select auth.uid())
    and (p_roles is null or role = any (p_roles));
$$;

create or replace function platform_private.is_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from platform.memberships
    where tenant_id = p_tenant_id and user_id = (select auth.uid())
  );
$$;

create or replace function platform_private.has_role(p_tenant_id uuid, p_roles platform.platform_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from platform.memberships
    where tenant_id = p_tenant_id
      and user_id = (select auth.uid())
      and role = any (p_roles)
  );
$$;

-- The caller's role in a tenant; null when they aren't a member.
create function platform_private.my_role(p_tenant_id uuid)
returns platform.platform_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from platform.memberships
  where tenant_id = p_tenant_id and user_id = (select auth.uid());
$$;

grant execute on function platform_private.my_tenant_ids(platform.platform_role[]) to authenticated;
grant execute on function platform_private.my_role(uuid) to authenticated;

-- Platform admins ------------------------------------------------------------------
-- The one place the platform-admin role is defined (owner, 10 Nov 2026): Mango
-- Works staff who approve catalog entries and, later, run the platform. Not
-- tied to a tenant, and not the marketplace's profiles.role. Rows are added
-- with the service role only.

create table platform.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text check (length(note) <= 200),
  created_at timestamptz not null default now()
);

alter table platform.platform_admins enable row level security;
grant select on platform.platform_admins to authenticated;

create policy "Admins read their own row"
on platform.platform_admins for select
to authenticated
using (user_id = (select auth.uid()));

create function platform_private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from platform.platform_admins where user_id = (select auth.uid())
  );
$$;

grant execute on function platform_private.is_platform_admin() to authenticated;

-- Policies, set form -------------------------------------------------------------

drop policy "Members read their tenants" on platform.tenants;
drop policy "Owners and managers update their tenant" on platform.tenants;
drop policy "Members read memberships of their tenants" on platform.memberships;

create policy "Members read their tenants"
on platform.tenants for select
to authenticated
using (id = any ((select platform_private.my_tenant_ids())::uuid[]));

create policy "Owners and managers update their tenant"
on platform.tenants for update
to authenticated
using (id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]))
with check (id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));

create policy "Members read memberships of their tenants"
on platform.memberships for select
to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids())::uuid[]));

-- Team functions (bodies named public.memberships) -------------------------------

create or replace function platform.tenant_members(p_tenant_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  role platform.platform_role,
  name text,
  email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.user_id, m.role, p.name, coalesce(p.email, u.email), m.created_at
  from platform.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.tenant_id = p_tenant_id
    and platform_private.is_member(p_tenant_id)
  order by m.role, coalesce(p.name, u.email);
$$;

create or replace function platform_private.assert_can_change(
  p_membership platform.memberships,
  p_new_role platform.platform_role
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_role platform.platform_role;
begin
  select role into caller_role
  from platform.memberships
  where tenant_id = p_membership.tenant_id and user_id = (select auth.uid());

  if caller_role is null or caller_role not in ('owner', 'manager') then
    raise exception 'Only owners and managers can change the team'
      using errcode = '42501';
  end if;

  if caller_role = 'manager' and (
    p_membership.role in ('owner', 'manager')
    or p_new_role in ('owner', 'manager')
  ) then
    raise exception 'Managers can only change staff, mechanics and drivers'
      using errcode = '42501';
  end if;

  if p_membership.role = 'owner'
    and (p_new_role is null or p_new_role <> 'owner')
    and not exists (
      select 1 from platform.memberships
      where tenant_id = p_membership.tenant_id
        and role = 'owner'
        and id <> p_membership.id
    )
  then
    raise exception 'A shop needs at least one owner'
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function platform.set_member_role(p_membership_id uuid, p_role platform.platform_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target platform.memberships;
begin
  select * into target from platform.memberships where id = p_membership_id;
  -- Same answer for "no such membership" and "not your tenant".
  if target.id is null or not platform_private.is_member(target.tenant_id) then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  perform platform_private.assert_can_change(target, p_role);
  update platform.memberships set role = p_role where id = p_membership_id;
end;
$$;

create or replace function platform.remove_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target platform.memberships;
begin
  select * into target from platform.memberships where id = p_membership_id;
  if target.id is null or not platform_private.is_member(target.tenant_id) then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  perform platform_private.assert_can_change(target, null);
  delete from platform.memberships where id = p_membership_id;
end;
$$;

-- RLS report -------------------------------------------------------------------------
-- Every tenant-scoped table (platform tables with a tenant_id, plus tenants)
-- with its RLS state, so the isolation tests cover each new table without being
-- told about it, and fail when one has no fixture. Service role only.

create function platform.platform_rls_report()
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
      where p.schemaname = 'platform' and p.tablename = c.relname)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'platform'
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

-- Policies that grant a role every row: none may exist for authenticated or
-- anon on a platform table (SPEC › Review decisions › Tenant keys).
create function platform.platform_open_policies()
returns table (table_name text, policy_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.tablename::text, p.policyname::text
  from pg_catalog.pg_policies p
  where p.schemaname = 'platform'
    and (p.roles && array['authenticated', 'anon', 'public']::name[])
    and (
      regexp_replace(coalesce(p.qual, ''), '[\s()]', '', 'g') = 'true'
      or regexp_replace(coalesce(p.with_check, ''), '[\s()]', '', 'g') = 'true'
    );
$$;

-- Grants ------------------------------------------------------------------------------

revoke all on function platform.tenant_members(uuid) from public, anon;
revoke all on function platform.set_member_role(uuid, platform.platform_role) from public, anon;
revoke all on function platform.remove_member(uuid) from public, anon;
grant execute on function platform.tenant_members(uuid) to authenticated, service_role;
grant execute on function platform.set_member_role(uuid, platform.platform_role) to authenticated, service_role;
grant execute on function platform.remove_member(uuid) to authenticated, service_role;
revoke all on function platform.platform_rls_report() from public, anon, authenticated;
revoke all on function platform.platform_open_policies() from public, anon, authenticated;
grant execute on function platform.platform_rls_report() to service_role;
grant execute on function platform.platform_open_policies() to service_role;
