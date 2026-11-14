-- Rental gear: the stock rework (owner, 14 Nov 2026; docs/products-redesign.md §5.9).
--
-- Builds on Stage B (20261113000300), which is not touched. Rental gear only:
-- items for sale and their ledger are as they were.
--
-- A unit of gear is in one of three states:
--   in use      counted in stock; available unless a booking holds it.
--   in repair   counted in stock, not available. An open-ended downtime
--               block, as before, so the availability rule is unchanged.
--   lost        not counted in stock, not available (status 'lost').
-- A unit written off (damaged for good, or a loss confirmed) leaves the
-- product: its row is deleted, or retired when bookings on record need it.
--
-- 1. Each unit out of service carries its own record: the day it happened,
--    the day it is expected back (in repair only) and notes. Three columns on
--    platform.units. No new table.
-- 2. platform_private.gear_roles(): the one place that says which role may do
--    which gear action. Every function below asks it.
-- 3. units_guard: staff and mechanics may write the three new columns on
--    gear; the record is cleared when a unit stops being lost.
-- 4. report_gear_problem(), update_unit_problem(), resolve_unit_problem()
--    replace mark_units_damaged(), mark_units_repaired(), mark_units_lost()
--    and resolve_lost_units(), which are dropped.
-- 5. product_stock() answers "in_repair" where it said "damaged".
-- 6. Existing data: a damaged unit becomes in repair, a lost unit stays lost.
--
-- No new table. Every new function starts closed (revoke from public, anon)
-- and is granted to authenticated where a signed-in member calls it.

-- 1. The record on a unit out of service ----------------------------------------------------
-- Dates are calendar days at the unit's location, so they are plain dates.

alter table platform.units
  add column problem_on date,
  add column expected_back date,
  add column problem_notes text
    constraint units_problem_notes_check check (length(problem_notes) between 1 and 500),
  add constraint units_problem_check check (
    -- Gear only.
    (product_type = 'gear'
      or (problem_on is null and expected_back is null and problem_notes is null))
    -- Nothing without the day it happened.
    and (problem_on is not null or (expected_back is null and problem_notes is null))
    -- Expected back: on or after that day, and never on a lost unit.
    and (expected_back is null or (expected_back >= problem_on and status <> 'lost'))
  );

-- 2. Who may do what ----------------------------------------------------------------------------
-- The one place. apps/platform/lib/gear-permissions.ts mirrors it for what the
-- screen offers, and a test holds the two together.
--   set_quantity  change the quantity                      owner, manager
--   mark_repair   mark in repair; edit that line           owner, manager, staff, mechanic
--   back_in_use   put a unit in repair back in use         owner, manager, staff, mechanic
--   mark_lost     mark lost; edit that line                owner, manager, staff
--   found         mark a lost unit found, back in use      owner, manager
--   write_off     write off, as damaged or as lost         owner, manager

create function platform_private.gear_roles(p_action text)
returns platform.platform_role[]
language sql
immutable
set search_path = ''
as $$
  select (case p_action
    when 'set_quantity' then '{owner,manager}'
    when 'mark_repair' then '{owner,manager,staff,mechanic}'
    when 'back_in_use' then '{owner,manager,staff,mechanic}'
    when 'mark_lost' then '{owner,manager,staff}'
    when 'found' then '{owner,manager}'
    when 'write_off' then '{owner,manager}'
    else '{}'
  end)::platform.platform_role[];
$$;

revoke all on function platform_private.gear_roles(text) from public, anon;
grant execute on function platform_private.gear_roles(text) to authenticated;

-- 3. units_guard --------------------------------------------------------------------------------
-- As it stood (20261113000300), plus:
--   the three record columns on gear are free to everyone who works on units
--   (the functions below write them as the member);
--   a unit becoming lost has no "expected back"; a unit that stops being
--   lost has no record left.

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
  if new.product_type = 'gear' then
    v_free := v_free || array['problem_on', 'expected_back', 'problem_notes'];
  end if;

  if (select auth.uid()) is not null then
    v_role := platform_private.my_role(new.tenant_id);
    if v_role is null or v_role not in ('owner', 'manager') then
      if (to_jsonb(new) - v_free) is distinct from (to_jsonb(old) - v_free) then
        raise exception 'only_owner_or_manager' using errcode = '42501';
      end if;
      if new.status is distinct from old.status then
        if old.status in ('active', 'maintenance') and new.status in ('active', 'maintenance') then
          null;
        elsif old.status in ('active', 'maintenance') and new.status = 'lost' then
          if v_role is distinct from 'staff' then
            raise exception 'role_not_allowed' using errcode = '42501';
          end if;
        else
          raise exception 'only_owner_or_manager' using errcode = '42501';
        end if;
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

  if new.status = 'lost' and old.status <> 'lost' then
    perform pg_advisory_xact_lock(x'1a01'::int, hashtext(new.id::text));
    if exists (
      select 1 from platform.unit_blocks b
      where b.unit_id = new.id
        and b.kind <> 'downtime'
        and (upper_inf(b.period) or upper(b.period) > now())
    ) then
      raise exception 'unit_has_future_blocks' using errcode = 'P0001';
    end if;
    delete from platform.unit_blocks b
    where b.unit_id = new.id and b.kind = 'downtime' and lower(b.period) >= now();
    update platform.unit_blocks b
    set period = tstzrange(lower(b.period), now(), '[)')
    where b.unit_id = new.id and b.kind = 'downtime'
      and (upper_inf(b.period) or upper(b.period) > now());
    new.expected_back := null;
  end if;

  if old.status = 'lost' and new.status <> 'lost' then
    new.problem_on := null;
    new.expected_back := null;
    new.problem_notes := null;
  end if;
  return new;
end;
$$;

-- 4. The functions ------------------------------------------------------------------------------
-- All three run as the caller: RLS, units_guard and unit_blocks_guard stay
-- the real rule, and stock_product() gives the clear refusal first.
-- Lock order, as in Stage B: the product-and-location lock, then unit locks.

drop function platform.mark_units_damaged(uuid, uuid, integer, timestamptz);
drop function platform.mark_units_repaired(uuid, uuid, integer);
drop function platform.mark_units_lost(uuid, uuid, integer);
drop function platform.resolve_lost_units(uuid, uuid, integer, text);

-- Where a unit of gear stands: 'in_use', 'repair', 'lost', or 'gone'
-- (retired, sold, or no such unit).
create function platform_private.gear_unit_state(p_unit_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select case
      when u.status = 'lost' then 'lost'
      when u.status not in ('active', 'maintenance') then 'gone'
      when exists (
        select 1 from platform.unit_blocks b
        where b.unit_id = u.id and b.kind = 'downtime' and b.period @> now()
      ) then 'repair'
      else 'in_use'
    end
    from platform.units u
    where u.id = p_unit_id and u.product_type = 'gear'
  ), 'gone');
$$;

revoke all on function platform_private.gear_unit_state(uuid) from public, anon;
grant execute on function platform_private.gear_unit_state(uuid) to authenticated;

-- Today at a location, on its own calendar.
create function platform_private.location_today(p_location_id uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone l.timezone)::date
  from platform.locations l
  where l.id = p_location_id;
$$;

revoke all on function platform_private.location_today(uuid) from public, anon;
grant execute on function platform_private.location_today(uuid) to authenticated;

-- "Report a problem": units in use go into repair, are marked lost, or are
-- written off as damaged for good.
--   p_kind         'repair' | 'lost' | 'damaged'
--   p_quantity     how many (gear counted by quantity), or
--   p_unit_ids     which units (gear tracked unit by unit); one of the two
--   p_happened_on  the day it happened at the location; today when null,
--                  never later than today
--   p_expected_back  in repair only, optional, on or after that day
--   p_notes        optional, up to 500 characters
-- Only units that are in use and that no block holds now or later are taken:
-- a booked unit is never put out of service from under its booking. Each unit
-- gets its own record, so each can be edited and resolved on its own later.
create function platform.report_gear_problem(
  p_product_id uuid,
  p_location_id uuid,
  p_kind text,
  p_quantity integer default null,
  p_unit_ids uuid[] default null,
  p_happened_on date default null,
  p_expected_back date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_product platform.products;
  v_today date;
  v_on date;
  v_notes text := nullif(btrim(p_notes), '');
  v_from timestamptz := date_trunc('minute', now());
  v_ids uuid[];
  v_free uuid[];
  v_units uuid[];
  v_labels jsonb;
begin
  if p_kind is null or p_kind not in ('repair', 'lost', 'damaged') then
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;
  v_product := platform_private.stock_product(
    p_product_id, p_location_id,
    platform_private.gear_roles(case p_kind
      when 'repair' then 'mark_repair'
      when 'lost' then 'mark_lost'
      else 'write_off'
    end),
    '{gear}');

  v_today := platform_private.location_today(p_location_id);
  v_on := coalesce(p_happened_on, v_today);
  if v_on > v_today then
    raise exception 'date_in_future' using errcode = 'P0001';
  end if;
  if p_expected_back is not null and (p_kind <> 'repair' or p_expected_back < v_on) then
    raise exception 'expected_before_happened' using errcode = 'P0001';
  end if;
  if length(v_notes) > 500 then
    raise exception 'notes_too_long' using errcode = 'P0001';
  end if;

  select array_agg(distinct u) into v_ids from unnest(p_unit_ids) u where u is not null;
  if v_ids is null and (p_quantity is null or p_quantity < 1 or p_quantity > 1000) then
    raise exception 'quantity_out_of_range' using errcode = 'P0001';
  end if;
  if v_ids is not null and p_quantity is not null and p_quantity <> cardinality(v_ids) then
    raise exception 'quantity_out_of_range' using errcode = 'P0001';
  end if;

  perform platform_private.lock_product_stock(p_product_id, array[p_location_id]);
  perform platform_private.lock_units(array(
    select id from platform.units
    where product_id = p_product_id and location_id = p_location_id
      and status in ('active', 'maintenance')
  ));

  -- In use and free: unlabelled ones first, the newest of those first.
  select coalesce(array_agg(u.id order by (u.label is not null), u.created_at desc, u.id), '{}')
  into v_free
  from platform.units u
  where u.product_id = p_product_id and u.location_id = p_location_id
    and u.status = 'active'
    and not exists (
      select 1 from platform.unit_blocks b
      where b.unit_id = u.id and (upper_inf(b.period) or upper(b.period) > now())
    );

  if v_ids is not null then
    if exists (
      select 1 from unnest(v_ids) i
      where not exists (
        select 1 from platform.units u
        where u.id = i and u.product_id = p_product_id and u.location_id = p_location_id
      )
    ) then
      raise exception 'unit_not_found' using errcode = 'P0001';
    end if;
    if not v_ids <@ v_free then
      raise exception 'unit_not_free' using errcode = 'P0001';
    end if;
    v_units := v_ids;
  else
    if cardinality(v_free) < p_quantity then
      raise exception 'not_enough_free'
        using errcode = 'P0001', detail = cardinality(v_free)::text;
    end if;
    v_units := v_free[1:p_quantity];
  end if;

  select jsonb_agg(u.label order by u.label) filter (where u.label is not null)
  into v_labels
  from platform.units u
  where u.id = any (v_units);

  if p_kind = 'repair' then
    insert into platform.unit_blocks (tenant_id, unit_id, kind, period)
    select v_product.tenant_id, u, 'downtime', tstzrange(v_from, null, '[)')
    from unnest(v_units) u;
    update platform.units
    set problem_on = v_on, expected_back = p_expected_back, problem_notes = v_notes
    where id = any (v_units);
  elsif p_kind = 'lost' then
    update platform.units
    set status = 'lost', problem_on = v_on, expected_back = null, problem_notes = v_notes
    where id = any (v_units);
  else
    -- Damaged for good. A unit with bookings on record is retired, not
    -- deleted, so its history stays.
    delete from platform.units u
    where u.id = any (v_units)
      and not exists (
        select 1 from platform.unit_blocks b
        where b.unit_id = u.id and b.kind <> 'downtime'
      );
    update platform.units set status = 'retired'
    where id = any (v_units);
  end if;

  perform platform_private.audit(
    v_product.tenant_id, 'products', p_product_id::text,
    case p_kind
      when 'repair' then 'units_in_repair'
      when 'lost' then 'units_lost'
      else 'units_written_off'
    end,
    null,
    jsonb_strip_nulls(jsonb_build_object(
      'quantity', cardinality(v_units),
      'location_id', p_location_id,
      'reason', case when p_kind = 'damaged' then 'damaged' end,
      'happened_on', v_on,
      'expected_back', p_expected_back,
      'notes', v_notes,
      'labels', v_labels)));
  return jsonb_build_object('quantity', cardinality(v_units));
end;
$$;

-- A line of the "Out of service" list, edited: the day it happened, the day
-- it is expected back (in repair only) and the notes. Whoever may mark a unit
-- that way may edit its line.
create function platform.update_unit_problem(
  p_unit_id uuid,
  p_happened_on date,
  p_expected_back date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_unit platform.units;
  v_product platform.products;
  v_state text;
  v_notes text := nullif(btrim(p_notes), '');
  v_before jsonb;
  v_after jsonb;
begin
  -- RLS hides another shop's unit: it gets the same answer as a missing one.
  select * into v_unit from platform.units where id = p_unit_id and product_type = 'gear';
  v_state := platform_private.gear_unit_state(p_unit_id);
  if v_unit.id is null or v_state not in ('repair', 'lost') then
    if v_unit.id is null then
      raise exception 'role_not_allowed' using errcode = '42501';
    end if;
    raise exception 'not_out_of_service' using errcode = 'P0001';
  end if;
  v_product := platform_private.stock_product(
    v_unit.product_id, v_unit.location_id,
    platform_private.gear_roles(case v_state when 'repair' then 'mark_repair' else 'mark_lost' end),
    '{gear}');

  if p_happened_on is null or p_happened_on > platform_private.location_today(v_unit.location_id) then
    raise exception 'date_in_future' using errcode = 'P0001';
  end if;
  if p_expected_back is not null and (v_state <> 'repair' or p_expected_back < p_happened_on) then
    raise exception 'expected_before_happened' using errcode = 'P0001';
  end if;
  if length(v_notes) > 500 then
    raise exception 'notes_too_long' using errcode = 'P0001';
  end if;

  perform platform_private.lock_product_stock(v_unit.product_id, array[v_unit.location_id]);
  perform platform_private.lock_units(array[p_unit_id]);
  -- Someone may have resolved it while this waited.
  select * into v_unit from platform.units where id = p_unit_id;
  if v_unit.id is null or platform_private.gear_unit_state(p_unit_id) <> v_state then
    raise exception 'not_out_of_service' using errcode = 'P0001';
  end if;

  v_before := jsonb_build_object(
    'happened_on', v_unit.problem_on, 'expected_back', v_unit.expected_back,
    'notes', v_unit.problem_notes);
  v_after := jsonb_build_object(
    'happened_on', p_happened_on, 'expected_back', p_expected_back, 'notes', v_notes);
  if v_before = v_after then
    return jsonb_build_object('changed', false);
  end if;

  update platform.units
  set problem_on = p_happened_on, expected_back = p_expected_back, problem_notes = v_notes
  where id = p_unit_id;
  perform platform_private.audit(
    v_product.tenant_id, 'products', v_unit.product_id::text, 'unit_problem_edit',
    v_before,
    jsonb_strip_nulls(v_after || jsonb_build_object(
      'state', v_state, 'location_id', v_unit.location_id, 'label', v_unit.label)));
  return jsonb_build_object('changed', true);
end;
$$;

-- What becomes of one unit out of service:
--   'back_in_use'  in repair -> in use
--   'found'        lost -> in use
--   'write_off'    in repair or lost -> gone for good. It cannot be undone.
-- The History keeps the unit's record (its day, notes and label) either way.
create function platform.resolve_unit_problem(p_unit_id uuid, p_action text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_unit platform.units;
  v_product platform.products;
  v_state text;
  v_now timestamptz := date_trunc('minute', now());
begin
  if p_action is null or p_action not in ('back_in_use', 'found', 'write_off') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  -- RLS hides another shop's unit: it gets the same answer as a missing one.
  select * into v_unit from platform.units where id = p_unit_id and product_type = 'gear';
  if v_unit.id is null then
    raise exception '%',
      case when p_action = 'back_in_use' then 'role_not_allowed' else 'only_owner_or_manager' end
      using errcode = '42501';
  end if;
  v_product := platform_private.stock_product(
    v_unit.product_id, v_unit.location_id, platform_private.gear_roles(p_action), '{gear}');

  perform platform_private.lock_product_stock(v_unit.product_id, array[v_unit.location_id]);
  perform platform_private.lock_units(array[p_unit_id]);
  -- Read again under the locks: two people may press at once.
  select * into v_unit from platform.units where id = p_unit_id;
  v_state := platform_private.gear_unit_state(p_unit_id);

  if p_action = 'back_in_use' and v_state <> 'repair' then
    raise exception 'not_in_repair' using errcode = 'P0001';
  elsif p_action = 'found' and v_state <> 'lost' then
    raise exception 'not_lost' using errcode = 'P0001';
  elsif p_action = 'write_off' and v_state not in ('repair', 'lost') then
    raise exception 'not_out_of_service' using errcode = 'P0001';
  end if;

  if v_state = 'repair' then
    -- The repair ends now. Started within this minute: nothing left to keep.
    delete from platform.unit_blocks b
    where b.unit_id = p_unit_id and b.kind = 'downtime' and b.period @> now()
      and lower(b.period) >= v_now;
    update platform.unit_blocks b
    set period = tstzrange(lower(b.period), v_now, '[)')
    where b.unit_id = p_unit_id and b.kind = 'downtime' and b.period @> now();
  end if;

  if p_action = 'back_in_use' then
    update platform.units
    set problem_on = null, expected_back = null, problem_notes = null
    where id = p_unit_id;
  elsif p_action = 'found' then
    update platform.units set status = 'active' where id = p_unit_id;
  else
    -- A unit with bookings on record is retired, not deleted.
    delete from platform.units u
    where u.id = p_unit_id
      and not exists (
        select 1 from platform.unit_blocks b
        where b.unit_id = u.id and b.kind <> 'downtime'
      );
    update platform.units
    set status = 'retired', problem_on = null, expected_back = null, problem_notes = null
    where id = p_unit_id;
  end if;

  perform platform_private.audit(
    v_product.tenant_id, 'products', v_unit.product_id::text,
    case p_action
      when 'back_in_use' then 'units_back_in_use'
      when 'found' then 'units_found'
      else 'units_written_off'
    end,
    null,
    jsonb_strip_nulls(jsonb_build_object(
      'quantity', 1,
      'location_id', v_unit.location_id,
      'reason', case
        when p_action <> 'write_off' then null
        when v_state = 'repair' then 'damaged'
        else 'lost'
      end,
      'happened_on', v_unit.problem_on,
      'expected_back', v_unit.expected_back,
      'notes', v_unit.problem_notes,
      'labels', case when v_unit.label is not null then jsonb_build_array(v_unit.label) end)));
  return jsonb_build_object('quantity', 1);
end;
$$;

revoke all on function platform.report_gear_problem(uuid, uuid, text, integer, uuid[], date, date, text) from public, anon;
revoke all on function platform.update_unit_problem(uuid, date, date, text) from public, anon;
revoke all on function platform.resolve_unit_problem(uuid, text) from public, anon;
grant execute on function platform.report_gear_problem(uuid, uuid, text, integer, uuid[], date, date, text) to authenticated;
grant execute on function platform.update_unit_problem(uuid, date, date, text) to authenticated;
grant execute on function platform.resolve_unit_problem(uuid, text) to authenticated;

-- 5. Stock counts -------------------------------------------------------------------------------
-- As in Stage B, with "damaged" renamed (a return column can't be renamed
-- in place):
--   in_stock   in use + in repair (not lost, retired or sold); on hand for an item for sale
--   in_repair  of those, under downtime at this moment
--   lost       units marked lost
--   available  in use and held by no block at this moment

drop function platform.product_stock(uuid);

create function platform.product_stock(p_tenant_id uuid)
returns table (
  product_id uuid,
  location_id uuid,
  in_stock integer,
  in_repair integer,
  lost integer,
  available integer
)
language sql
stable
set search_path = ''
as $$
  select u.product_id, u.location_id,
    (count(*) filter (where u.status in ('active', 'maintenance')))::int,
    (count(*) filter (where u.status in ('active', 'maintenance') and d.hit))::int,
    (count(*) filter (where u.status = 'lost'))::int,
    (count(*) filter (where u.status = 'active' and not h.hit))::int
  from platform.units u
  cross join lateral (
    select exists (
      select 1 from platform.unit_blocks b
      where b.unit_id = u.id and b.kind = 'downtime' and b.period @> now()
    ) as hit
  ) d
  cross join lateral (
    select exists (
      select 1 from platform.unit_blocks b
      where b.unit_id = u.id and b.period @> now()
    ) as hit
  ) h
  where u.tenant_id = p_tenant_id and u.product_type = 'gear'
    and u.status in ('active', 'maintenance', 'lost')
  group by u.product_id, u.location_id
  union all
  select m.product_id, m.location_id, sum(m.quantity)::int, 0, 0, sum(m.quantity)::int
  from platform.stock_movements m
  where m.tenant_id = p_tenant_id
  group by m.product_id, m.location_id;
$$;

revoke all on function platform.product_stock(uuid) from public, anon;
grant execute on function platform.product_stock(uuid) to authenticated;

-- 6. Existing data ------------------------------------------------------------------------------
-- Nothing is removed. A gear unit that is damaged now (a downtime block is
-- running) becomes in repair: the day it happened is the day the block
-- started, the block's end (if it had one) becomes "expected back" and its
-- note becomes the notes. The block then runs until someone puts the unit
-- back in use, unless a later block on the same unit is in the way; that
-- block is left as it is and the unit comes back when it ends, as before.
-- A lost unit stays lost; the day is the day it was last changed, the
-- nearest thing on record.

with running as (
  select distinct on (b.unit_id)
    b.unit_id, b.id as block_id, b.period, b.note, l.timezone
  from platform.unit_blocks b
  join platform.units u on u.id = b.unit_id
  join platform.locations l on l.id = u.location_id
  where u.product_type = 'gear' and u.status in ('active', 'maintenance')
    and b.kind = 'downtime' and b.period @> now()
  order by b.unit_id, lower(b.period)
)
update platform.units u
set problem_on = (lower(r.period) at time zone r.timezone)::date,
    expected_back = case
      when upper_inf(r.period) then null
      else greatest(
        (upper(r.period) at time zone r.timezone)::date,
        (lower(r.period) at time zone r.timezone)::date)
    end,
    problem_notes = nullif(left(btrim(r.note), 500), '')
from running r
where u.id = r.unit_id;

update platform.unit_blocks b
set period = tstzrange(lower(b.period), null, '[)')
from platform.units u
where u.id = b.unit_id
  and u.product_type = 'gear' and u.status in ('active', 'maintenance')
  and b.kind = 'downtime' and b.period @> now() and not upper_inf(b.period)
  and not exists (
    select 1 from platform.unit_blocks later
    where later.unit_id = b.unit_id and later.id <> b.id
      and lower(later.period) >= upper(b.period)
  );

update platform.units u
set problem_on = (u.updated_at at time zone l.timezone)::date
from platform.locations l
where l.id = u.location_id
  and u.product_type = 'gear' and u.status = 'lost' and u.problem_on is null;
