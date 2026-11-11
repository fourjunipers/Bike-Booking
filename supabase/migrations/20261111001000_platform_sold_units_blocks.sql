-- Platform Phase 1a review, fix 4: a sold or retired bike never has a future block.
--
-- Two gaps:
--  (a) Selling a bike checked for future blocks without waiting for block
--      writers. Someone adding downtime at the same instant didn't see the
--      sale, the sale didn't see the block, and both were saved.
--  (b) "This bike is in the fleet" was checked only when a block was added,
--      not when one was changed: a block could be moved onto a sold bike, or
--      a sold bike's old block stretched into the future.
--
-- (a) Selling or retiring now takes the same per-bike advisory lock that
--     block writes take, then checks. Whoever comes second sees the first.
-- (b) The in-fleet check runs on UPDATE too. On a sold or retired bike a
--     block may only be shortened or left as it is.
--
-- LOCK ORDER RULE: code that needs the lock of more than one bike in one
-- transaction takes them in sorted unit_id order (the block guard below does
-- for a block moved from one bike to another; Phase 2's multi-bike bookings
-- must too). A single statement that changes many bikes takes them in
-- whatever order the rows come, so such statements should be ordered by id.

create or replace function platform_private.units_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role platform.platform_role;
  v_free text[] := array['current_odometer_km', 'status', 'updated_at'];
begin
  if (select auth.uid()) is not null then
    v_role := platform_private.my_role(new.tenant_id);
    if v_role is null or v_role not in ('owner', 'manager') then
      if (to_jsonb(new) - v_free) is distinct from (to_jsonb(old) - v_free) then
        raise exception 'only_owner_or_manager' using errcode = '42501';
      end if;
      if new.status is distinct from old.status
        and not (old.status in ('active', 'maintenance') and new.status in ('active', 'maintenance'))
      then
        raise exception 'only_owner_or_manager' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Selling or retiring: its future blocks must be moved or ended first.
  if new.status in ('sold', 'retired') and old.status not in ('sold', 'retired') then
    -- Wait for anyone writing this bike's blocks right now (same lock as
    -- unit_blocks_guard), so the check below sees what they saved.
    perform pg_advisory_xact_lock(x'1a01'::int, hashtext(new.id::text));
    if exists (
      select 1 from platform.unit_blocks b
      where b.unit_id = new.id and (upper_inf(b.period) or upper(b.period) > now())
    ) then
      raise exception 'unit_has_future_blocks' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create or replace function platform_private.unit_blocks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moved boolean := tg_op = 'UPDATE' and new.unit_id <> old.unit_id;
begin
  -- Namespace 1a01 keeps this apart from any other advisory lock.
  if v_moved then
    -- Two bikes: always in sorted unit_id order (see the rule above).
    perform pg_advisory_xact_lock(x'1a01'::int, hashtext(least(old.unit_id, new.unit_id)::text));
    perform pg_advisory_xact_lock(x'1a01'::int, hashtext(greatest(old.unit_id, new.unit_id)::text));
  else
    perform pg_advisory_xact_lock(x'1a01'::int, hashtext(new.unit_id::text));
  end if;

  -- A new block, a block moved to another bike, or a period that now covers
  -- time it didn't before: the bike must be in the fleet. Shortening a block
  -- (ending it) stays possible on any bike.
  if (tg_op = 'INSERT' or v_moved or not new.period <@ old.period)
    and exists (
      select 1 from platform.units
      where id = new.unit_id and status in ('sold', 'retired')
    )
  then
    raise exception 'unit_not_in_fleet' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
