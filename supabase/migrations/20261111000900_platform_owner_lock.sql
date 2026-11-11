-- Platform Phase 1a review, fix 3: two owners can't remove each other at once.
--
-- "A shop needs at least one owner" was checked by reading the other owners
-- and then writing. Two owners demoting (or removing) each other at the same
-- instant each saw the other still an owner, and both writes went through: a
-- shop with no owner. Team changes for one shop now queue: each takes a lock
-- on the tenant's row first, then reads the membership again and checks.

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

  -- One team change per shop at a time.
  perform 1 from platform.tenants where id = target.tenant_id for update;
  -- Read again: whoever held the lock before may have changed or removed it.
  select * into target from platform.memberships where id = p_membership_id;
  if target.id is null then
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

  perform 1 from platform.tenants where id = target.tenant_id for update;
  select * into target from platform.memberships where id = p_membership_id;
  if target.id is null then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  perform platform_private.assert_can_change(target, null);
  delete from platform.memberships where id = p_membership_id;
end;
$$;

-- The check reads the team as it is now, after the lock, not as it was when
-- the calling statement began.
alter function platform_private.assert_can_change(platform.memberships, platform.platform_role) volatile;
