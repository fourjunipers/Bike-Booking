-- Platform Phase 0: memberships and roles (docs/platform/SPEC.md › Data model,
-- Team, settings and platform). Staff are auth users with a membership; one user
-- can belong to several tenants. Marketplace profiles are separate.

create type public.platform_role as enum ('owner', 'manager', 'staff', 'mechanic', 'driver');

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.platform_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

create trigger memberships_set_updated_at
before update on public.memberships
for each row execute function public.set_updated_at();

-- Membership checks for RLS. SECURITY DEFINER so the policies on memberships
-- don't recurse into themselves.
create function platform_private.is_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where tenant_id = p_tenant_id and user_id = (select auth.uid())
  );
$$;

create function platform_private.has_role(p_tenant_id uuid, p_roles public.platform_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where tenant_id = p_tenant_id
      and user_id = (select auth.uid())
      and role = any (p_roles)
  );
$$;

revoke all on function platform_private.is_member(uuid) from public;
revoke all on function platform_private.has_role(uuid, public.platform_role[]) from public;
grant execute on function platform_private.is_member(uuid) to authenticated;
grant execute on function platform_private.has_role(uuid, public.platform_role[]) to authenticated;

-- Tenants: members read their own tenants; owners and managers edit settings.
create policy "Members read their tenants"
on public.tenants for select
to authenticated
using ((select platform_private.is_member(id)));

create policy "Owners and managers update their tenant"
on public.tenants for update
to authenticated
using ((select platform_private.has_role(id, '{owner,manager}')))
with check ((select platform_private.has_role(id, '{owner,manager}')));

-- Memberships: members see who else is in their tenant. All changes go through
-- the functions below, which enforce who may change what.
alter table public.memberships enable row level security;
revoke insert, update, delete on public.memberships from anon, authenticated;
grant select on public.memberships to authenticated;

create policy "Members read memberships of their tenants"
on public.memberships for select
to authenticated
using ((select platform_private.is_member(tenant_id)));

-- The team list: members with their name and email (profiles are readable only
-- by their own user, so this joins them for fellow members).
create function public.tenant_members(p_tenant_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  role public.platform_role,
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
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.tenant_id = p_tenant_id
    and platform_private.is_member(p_tenant_id)
  order by m.role, coalesce(p.name, u.email);
$$;

-- Who may change a membership:
-- - owners change anyone, including making or unmaking owners;
-- - managers change staff, mechanics and drivers, and can't grant owner or manager;
-- - a tenant always keeps at least one owner.
create function platform_private.assert_can_change(
  p_membership public.memberships,
  p_new_role public.platform_role
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_role public.platform_role;
begin
  select role into caller_role
  from public.memberships
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
      select 1 from public.memberships
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

revoke all on function platform_private.assert_can_change(public.memberships, public.platform_role) from public;

create function public.set_member_role(p_membership_id uuid, p_role public.platform_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.memberships;
begin
  select * into target from public.memberships where id = p_membership_id;
  -- Same answer for "no such membership" and "not your tenant".
  if target.id is null or not platform_private.is_member(target.tenant_id) then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  perform platform_private.assert_can_change(target, p_role);
  update public.memberships set role = p_role where id = p_membership_id;
end;
$$;

create function public.remove_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.memberships;
begin
  select * into target from public.memberships where id = p_membership_id;
  if target.id is null or not platform_private.is_member(target.tenant_id) then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  perform platform_private.assert_can_change(target, null);
  delete from public.memberships where id = p_membership_id;
end;
$$;

revoke all on function public.tenant_members(uuid) from public, anon;
revoke all on function public.set_member_role(uuid, public.platform_role) from public, anon;
revoke all on function public.remove_member(uuid) from public, anon;
grant execute on function public.tenant_members(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, public.platform_role) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
