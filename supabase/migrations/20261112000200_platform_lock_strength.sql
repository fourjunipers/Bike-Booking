-- Re-check of the Phase 1a review, follow-up 1: locks no stronger than needed.
--
-- Three places took a full row lock (FOR UPDATE) to make changes go one at a
-- time. A full row lock also blocks, and is blocked by, the share lock every
-- foreign-key check takes on the row it points at. So:
--
-- * A team change (set_member_role, remove_member) locked the shop's row in
--   tenants and waited behind any open transaction that had inserted a row
--   pointing at the shop: a downtime, a bike, a model.
-- * The counts trigger locked the model a bike leaves. Two bikes swapping
--   models at once each held the share lock on the model they arrive on and
--   waited for the full lock on the model they leave: a deadlock.
--
-- FOR NO KEY UPDATE still conflicts with itself, so team changes and count
-- clamps still go one at a time, but it doesn't conflict with foreign-key
-- checks. None of the three changes a key column.
--
-- Functions are replaced in place (same name and arguments), so their grants
-- stay as they are.

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
  perform 1 from platform.tenants where id = target.tenant_id for no key update;
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

  perform 1 from platform.tenants where id = target.tenant_id for no key update;
  select * into target from platform.memberships where id = p_membership_id;
  if target.id is null then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;

  perform platform_private.assert_can_change(target, null);
  delete from platform.memberships where id = p_membership_id;
end;
$$;

create or replace function platform_private.units_clamp_model_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_model record;
  v_active int;
  v_instant int;
  v_request int;
  v_ready int;
begin
  -- Only when a bike stops counting for old.model_id.
  if tg_op = 'UPDATE' and not (
    old.status = 'active' and (new.status <> 'active' or new.model_id <> old.model_id)
  ) then
    return null;
  end if;
  if tg_op = 'DELETE' and old.status <> 'active' then
    return null;
  end if;

  -- Lock the model first, so two bikes leaving at once count one after the
  -- other and a model being saved right now is seen (or sees this). Not a
  -- full row lock: that would wait for bikes arriving on this model.
  select id, tenant_id, instant_units, request_units, ready_now into v_model
  from platform.models
  where id = old.model_id
  for no key update;
  -- Gone already: the model or the whole tenant is being deleted.
  if not found or not exists (select 1 from platform.tenants where id = v_model.tenant_id) then
    return null;
  end if;

  select count(*) into v_active
  from platform.units
  where tenant_id = v_model.tenant_id and model_id = v_model.id and status = 'active';

  v_instant := least(v_model.instant_units, v_active);
  v_request := least(v_model.request_units, v_active - v_instant);
  v_ready := least(v_model.ready_now, v_active);
  if v_instant = v_model.instant_units
    and v_request = v_model.request_units
    and v_ready = v_model.ready_now
  then
    return null;
  end if;

  update platform.models
  set instant_units = v_instant, request_units = v_request, ready_now = v_ready
  where id = v_model.id;

  insert into platform.audit_events (tenant_id, entity, entity_id, action, actor, before, after)
  values (
    v_model.tenant_id, 'models', v_model.id::text, 'clamp_booking_counts', (select auth.uid()),
    jsonb_build_object(
      'instant_units', v_model.instant_units,
      'request_units', v_model.request_units,
      'ready_now', v_model.ready_now
    ),
    jsonb_build_object(
      'instant_units', v_instant,
      'request_units', v_request,
      'ready_now', v_ready,
      'active_units', v_active,
      'because_unit', old.id,
      'unit_change', case
        when tg_op = 'DELETE' then 'deleted'
        when new.model_id <> old.model_id then 'moved to another model'
        else 'status ' || old.status || ' -> ' || new.status
      end
    )
  );
  return null;
end;
$$;
