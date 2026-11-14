-- Products, stage B (docs/products-redesign.md §5.7, owner 13 Nov 2026).
--
-- General products: rental gear, items for sale, services. The Stage A
-- migration (20261113000200) is not touched; everything here builds on it.
--
-- 1. Unit rules per type. A vehicle unit keeps its rule (a plate, or "plate
--    pending"). A gear unit is a nameless row: no plate, frame or engine
--    number, year or odometer (units_gear_fields); it may carry a label when its product is
--    tracked unit by unit. Services and items for sale have no units (the
--    Stage A foreign key already says so).
-- 2. Unit status "lost". Owners, managers and staff may set it; a mechanic
--    may not. Only an owner or manager brings a lost unit back or removes it.
--    A lost unit takes no new blocks.
-- 3. A general product stores no buffers and no deposit.
-- 4. Stock functions for gear counted by quantity: set_stock_quantity(),
--    mark_units_damaged(), mark_units_repaired(), mark_units_lost(),
--    resolve_lost_units(); create_general_product(); product_stock().
--    Lock order, always: the product-and-location locks first (namespace
--    1a02), sorted by key; then the per-unit locks (namespace 1a01, the one
--    unit_blocks_guard takes), sorted by key. Lowering a quantity is refused
--    while the units it would remove are blocked.
-- 5. platform.stock_movements: the ledger for items for sale. Append-only.
-- 6. products.sort_position: one manual order per shop, shared by Fleet and
--    the Products list. move_product() and reset_product_order().
-- 7. Moto Mangos: change_listing_entry() and disconnect_listing() for a
--    product already on a list entry.
--
-- New table: stock_movements, granted on purpose below. Every new function
-- starts closed (revoke from public, anon) and is granted to authenticated
-- where a signed-in member calls it. Nothing in public is touched.

-- 1. Unit rules per type ----------------------------------------------------------------

alter table platform.units
  add column label text
    constraint units_label_check check (length(btrim(label)) between 1 and 60),
  drop constraint units_status_check,
  add constraint units_status_check
    check (status in ('active', 'maintenance', 'retired', 'sold', 'lost')),
  -- Was: plate is not null or plate_pending, for every unit.
  drop constraint units_check,
  add constraint units_check check (
    product_type <> 'vehicle'
    or ((plate is not null or plate_pending) and label is null)
  );

-- The gear half of the rule. A trigger that runs after the row's foreign
-- keys, not a check, so a unit that claims a type its product doesn't have
-- is still refused by the key first (as Stage A's tests expect).
create function platform_private.units_gear_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'units_gear_fields_check' using errcode = '23514';
end;
$$;

revoke all on function platform_private.units_gear_fields() from public, anon, authenticated;

create trigger units_gear_fields
after insert or update on platform.units
for each row
when (
  new.product_type = 'gear' and (
    new.plate is not null or new.plate_pending
    or new.frame_number is not null or new.engine_number is not null
    or new.model_year is not null or new.current_odometer_km <> 0
  )
)
execute function platform_private.units_gear_fields();

-- A label names one unit of its product ("GoPro 3"): no two alike, ignoring
-- case and spacing.
create unique index units_label_idx
  on platform.units (tenant_id, product_id, platform_private.norm(label))
  where label is not null;

-- Only a product tracked unit by unit has labelled units.
create function platform_private.units_label_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.label is not null and not exists (
    select 1 from platform.products p
    where p.id = new.product_id and p.tracking = 'unit'
  ) then
    raise exception 'label_needs_tracking' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function platform_private.units_label_guard() from public, anon, authenticated;

create trigger units_label_guard
before insert or update of label, product_id on platform.units
for each row execute function platform_private.units_label_guard();

-- 2. Lost --------------------------------------------------------------------------------
-- units_guard as it stood (20261112000200), plus the lost status:
--   staff and mechanics: active <-> maintenance, as before;
--   staff: active or maintenance -> lost;
--   everything else, and every way out of lost: owners and managers.
-- A unit can't be marked lost while a booking, hold or transfer on it has
-- not ended (the same refusal as selling or retiring). Its downtime means
-- nothing once it is gone: what hasn't started is removed, what is running
-- ends now.

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
  end if;
  return new;
end;
$$;

-- unit_blocks_guard as it stood (20261111000400), with lost beside sold and
-- retired: a unit that is gone takes no new block.
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
      where id = new.unit_id and status in ('sold', 'retired', 'lost')
    )
  then
    raise exception 'unit_not_in_fleet' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- 3. General products: no buffers, no deposit ------------------------------------------------
-- (Owner, 13 Nov 2026: hidden and not stored. The deposit is per vehicle;
-- gear, services and items for sale add nothing to it.)

alter table platform.products
  add column sort_position integer,
  add constraint products_general_fields_check check (
    type = 'vehicle'
    or (
      buffer_before_minutes is null and buffer_after_minutes is null
      and deposit is null and deposit_currency is null
    )
  );

-- Gear switched back from "tracked unit by unit" to "counted": its labels
-- go. Refused while a unit has purchase details, which belong to one unit.
create function platform_private.products_tracking_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.tracking = 'unit' and new.tracking = 'bulk' then
    if exists (
      select 1 from platform.unit_financials f
      join platform.units u on u.id = f.unit_id
      where u.product_id = new.id
    ) then
      raise exception 'tracked_units_have_records' using errcode = 'P0001';
    end if;
    update platform.units set label = null
    where product_id = new.id and label is not null;
  end if;
  return new;
end;
$$;

revoke all on function platform_private.products_tracking_guard() from public, anon, authenticated;

create trigger products_tracking_guard
before update of tracking on platform.products
for each row
when (new.tracking is distinct from old.tracking)
execute function platform_private.products_tracking_guard();

-- 4. Locks -----------------------------------------------------------------------------------
-- Product-and-location locks first, sorted; then unit locks, sorted. "Sorted"
-- is by the lock's own key (the hash), then by the text behind it, so two
-- callers can never take the same pair in opposite orders.

create function platform_private.lock_product_stock(p_product_id uuid, p_location_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_key integer;
begin
  for v_key in
    select distinct hashtext(p_product_id::text || ':' || l::text)
    from unnest(p_location_ids) l
    order by 1
  loop
    perform pg_advisory_xact_lock(x'1a02'::int, v_key);
  end loop;
end;
$$;

create function platform_private.lock_units(p_unit_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_key integer;
begin
  for v_key in
    select distinct hashtext(u::text)
    from unnest(p_unit_ids) u
    order by 1
  loop
    perform pg_advisory_xact_lock(x'1a01'::int, v_key);
  end loop;
end;
$$;

revoke all on function platform_private.lock_product_stock(uuid, uuid[]) from public, anon;
revoke all on function platform_private.lock_units(uuid[]) from public, anon;
grant execute on function platform_private.lock_product_stock(uuid, uuid[]) to authenticated;
grant execute on function platform_private.lock_units(uuid[]) to authenticated;

-- The product a stock function works on, for a member in one of p_roles.
-- "No such product", "not your shop" and "not your role" get the same kind
-- of answer. The functions below run as the caller, so RLS and the guards
-- above stay the real rule; this gives the clear refusal first.
create function platform_private.stock_product(
  p_product_id uuid,
  p_location_id uuid,
  p_roles platform.platform_role[],
  p_types text[]
)
returns platform.products
language plpgsql
stable
set search_path = ''
as $$
declare
  v_product platform.products;
begin
  select * into v_product from platform.products where id = p_product_id;
  if v_product.id is null or not platform_private.has_role(v_product.tenant_id, p_roles) then
    raise exception '%',
      case when p_roles = '{owner,manager}' then 'only_owner_or_manager' else 'role_not_allowed' end
      using errcode = '42501';
  end if;
  if not v_product.type = any (p_types) then
    raise exception 'no_stock_for_type' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from platform.locations
    where id = p_location_id and tenant_id = v_product.tenant_id
  ) then
    raise exception 'location_not_found' using errcode = 'P0001';
  end if;
  return v_product;
end;
$$;

revoke all on function platform_private.stock_product(uuid, uuid, platform.platform_role[], text[]) from public, anon;
grant execute on function platform_private.stock_product(uuid, uuid, platform.platform_role[], text[]) to authenticated;

-- 5. The ledger for items for sale --------------------------------------------------------------
-- An item for sale is used up, not lent: what is on hand is the sum of this
-- ledger. Stage B writes "received" and "adjusted" rows; "sold" and
-- "returned" come with orders (Phase 3). Rows are never changed or removed
-- (they go only with their product).

create table platform.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants (id) on delete cascade,
  product_id uuid not null,
  product_type text not null default 'sale_item'
    constraint stock_movements_product_type_check check (product_type = 'sale_item'),
  location_id uuid not null,
  kind text not null
    constraint stock_movements_kind_check check (kind in ('received', 'adjusted', 'sold', 'returned')),
  -- Signed: stock in is above zero, stock out below.
  quantity integer not null
    constraint stock_movements_quantity_check check (quantity <> 0 and quantity between -100000 and 100000),
  note text constraint stock_movements_note_check check (length(note) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, product_id, product_type)
    references platform.products (tenant_id, id, type) on delete cascade,
  foreign key (tenant_id, location_id) references platform.locations (tenant_id, id),
  constraint stock_movements_sign_check check (
    case kind
      when 'received' then quantity > 0
      when 'returned' then quantity > 0
      when 'sold' then quantity < 0
      else true
    end
  )
);

create index stock_movements_product_idx
  on platform.stock_movements (tenant_id, product_id, location_id);

-- Who did it is the signed-in person, whatever the client sends; and what
-- is on hand never goes below zero. The lock makes two writers count one
-- after the other.
create function platform_private.stock_movements_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := (select auth.uid());
  perform platform_private.lock_product_stock(new.product_id, array[new.location_id]);
  if new.quantity + coalesce((
    select sum(m.quantity) from platform.stock_movements m
    where m.product_id = new.product_id and m.location_id = new.location_id
  ), 0) < 0 then
    raise exception 'stock_below_zero' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function platform_private.stock_movements_guard() from public, anon, authenticated;

create trigger stock_movements_guard
before insert on platform.stock_movements
for each row execute function platform_private.stock_movements_guard();

create trigger stock_movements_audit
after insert or update or delete on platform.stock_movements
for each row execute function platform_private.audit_row();

alter table platform.stock_movements enable row level security;

-- Read and add only: no update, no delete.
grant select, insert on platform.stock_movements to authenticated;

create policy "Members read stock movements"
on platform.stock_movements for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids())::uuid[]));

create policy "Owners and managers record stock"
on platform.stock_movements for insert to authenticated
with check (
  kind in ('received', 'adjusted')
  and tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[])
);

-- An item for sale with stock on hand isn't deleted by accident: its
-- quantity is set to zero first. (Gear is held by its unit rows.)
create function platform_private.products_stock_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.type = 'sale_item'
    -- The whole tenant going: its products go with it.
    and exists (select 1 from platform.tenants where id = old.tenant_id)
    and coalesce((
      select sum(m.quantity) from platform.stock_movements m where m.product_id = old.id
    ), 0) > 0
  then
    raise exception 'product_has_stock' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

revoke all on function platform_private.products_stock_guard() from public, anon, authenticated;

create trigger products_stock_guard
before delete on platform.products
for each row execute function platform_private.products_stock_guard();

-- 6. Stock functions -----------------------------------------------------------------------------

-- The quantity of a gear product or an item for sale at one location.
-- Owners and managers only.
--   Gear: raising adds nameless units; lowering removes units that no block
--   holds now or later (unlabelled ones first). If too few are free it
--   refuses with units_blocked, and the detail is the lowest quantity that
--   could be set. A unit with bookings on record is retired, not deleted,
--   so its history stays.
--   Item for sale: the difference goes into the ledger.
create function platform.set_stock_quantity(p_product_id uuid, p_location_id uuid, p_quantity integer)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_product platform.products;
  v_current integer;
  v_max integer := 100000;
  v_free uuid[];
  v_remove uuid[];
begin
  v_product := platform_private.stock_product(
    p_product_id, p_location_id, '{owner,manager}', '{gear,sale_item}');
  -- At most 1,000 units of gear in one place: a typo can't make a million rows.
  if v_product.type = 'gear' then
    v_max := 1000;
  end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > v_max then
    raise exception 'quantity_out_of_range' using errcode = 'P0001';
  end if;
  perform platform_private.lock_product_stock(p_product_id, array[p_location_id]);

  if v_product.type = 'sale_item' then
    select coalesce(sum(quantity), 0) into v_current
    from platform.stock_movements
    where product_id = p_product_id and location_id = p_location_id;
    if p_quantity <> v_current then
      insert into platform.stock_movements (tenant_id, product_id, location_id, kind, quantity)
      values (
        v_product.tenant_id, p_product_id, p_location_id,
        case when exists (
          select 1 from platform.stock_movements
          where product_id = p_product_id and location_id = p_location_id
        ) then 'adjusted' else 'received' end,
        p_quantity - v_current
      );
    end if;
  else
    perform platform_private.lock_units(array(
      select id from platform.units
      where product_id = p_product_id and location_id = p_location_id
        and status in ('active', 'maintenance')
    ));
    select count(*) into v_current
    from platform.units
    where product_id = p_product_id and location_id = p_location_id
      and status in ('active', 'maintenance');

    if p_quantity > v_current then
      insert into platform.units (tenant_id, product_id, product_type, location_id)
      select v_product.tenant_id, p_product_id, 'gear', p_location_id
      from generate_series(1, p_quantity - v_current);
    elsif p_quantity < v_current then
      select coalesce(array_agg(u.id order by (u.label is not null), u.created_at desc, u.id), '{}')
      into v_free
      from platform.units u
      where u.product_id = p_product_id and u.location_id = p_location_id
        and u.status in ('active', 'maintenance')
        and not exists (
          select 1 from platform.unit_blocks b
          where b.unit_id = u.id and (upper_inf(b.period) or upper(b.period) > now())
        );
      if cardinality(v_free) < v_current - p_quantity then
        raise exception 'units_blocked'
          using errcode = 'P0001', detail = (v_current - cardinality(v_free))::text;
      end if;
      v_remove := v_free[1:v_current - p_quantity];
      delete from platform.units u
      where u.id = any (v_remove)
        and not exists (
          select 1 from platform.unit_blocks b
          where b.unit_id = u.id and b.kind <> 'downtime'
        );
      update platform.units set status = 'retired'
      where id = any (v_remove);
    end if;
  end if;

  if p_quantity <> v_current then
    perform platform_private.audit(
      v_product.tenant_id, 'products', p_product_id::text, 'stock_adjust',
      jsonb_build_object('quantity', v_current, 'location_id', p_location_id),
      jsonb_build_object('quantity', p_quantity, 'location_id', p_location_id));
  end if;
  return jsonb_build_object('from', v_current, 'to', p_quantity);
end;
$$;

-- "2 helmets are being cleaned or repaired until Friday": downtime on that
-- many free units, from this minute until p_until (open-ended when null).
-- Owners, managers, staff and mechanics, as for a vehicle's downtime.
create function platform.mark_units_damaged(
  p_product_id uuid,
  p_location_id uuid,
  p_quantity integer,
  p_until timestamptz default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_product platform.products;
  v_from timestamptz := date_trunc('minute', now());
  v_period tstzrange;
  v_units uuid[];
begin
  v_product := platform_private.stock_product(
    p_product_id, p_location_id, '{owner,manager,staff,mechanic}', '{gear}');
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then
    raise exception 'quantity_out_of_range' using errcode = 'P0001';
  end if;
  if p_until is not null and p_until <= v_from then
    raise exception 'until_in_past' using errcode = 'P0001';
  end if;
  v_period := tstzrange(v_from, p_until, '[)');
  perform platform_private.lock_product_stock(p_product_id, array[p_location_id]);
  perform platform_private.lock_units(array(
    select id from platform.units
    where product_id = p_product_id and location_id = p_location_id and status = 'active'
  ));
  select coalesce(array_agg(u.id order by (u.label is not null), u.created_at, u.id), '{}')
  into v_units
  from platform.units u
  where u.product_id = p_product_id and u.location_id = p_location_id
    and u.status = 'active'
    and not exists (
      select 1 from platform.unit_blocks b
      where b.unit_id = u.id and b.period && v_period
    );
  if cardinality(v_units) < p_quantity then
    raise exception 'not_enough_free'
      using errcode = 'P0001', detail = cardinality(v_units)::text;
  end if;
  insert into platform.unit_blocks (tenant_id, unit_id, kind, period)
  select v_product.tenant_id, u, 'downtime', v_period
  from unnest(v_units[1:p_quantity]) u;
  perform platform_private.audit(
    v_product.tenant_id, 'products', p_product_id::text, 'units_damaged', null,
    jsonb_strip_nulls(jsonb_build_object(
      'quantity', p_quantity, 'location_id', p_location_id, 'until', p_until)));
  return jsonb_build_object('quantity', p_quantity);
end;
$$;

-- Back in use: ends the downtime running on that many units, now.
create function platform.mark_units_repaired(p_product_id uuid, p_location_id uuid, p_quantity integer)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_product platform.products;
  v_now timestamptz := date_trunc('minute', now());
  v_blocks uuid[];
begin
  v_product := platform_private.stock_product(
    p_product_id, p_location_id, '{owner,manager,staff,mechanic}', '{gear}');
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then
    raise exception 'quantity_out_of_range' using errcode = 'P0001';
  end if;
  perform platform_private.lock_product_stock(p_product_id, array[p_location_id]);
  perform platform_private.lock_units(array(
    select id from platform.units
    where product_id = p_product_id and location_id = p_location_id
      and status in ('active', 'maintenance')
  ));
  -- The ones due back soonest first.
  select coalesce(array_agg(b.id order by upper(b.period) nulls last, b.id), '{}')
  into v_blocks
  from platform.unit_blocks b
  join platform.units u on u.id = b.unit_id
  where u.product_id = p_product_id and u.location_id = p_location_id
    and u.status in ('active', 'maintenance')
    and b.kind = 'downtime' and b.period @> now();
  if cardinality(v_blocks) < p_quantity then
    raise exception 'not_enough_damaged'
      using errcode = 'P0001', detail = cardinality(v_blocks)::text;
  end if;
  v_blocks := v_blocks[1:p_quantity];
  -- Started within this minute: nothing left to keep.
  delete from platform.unit_blocks b
  where b.id = any (v_blocks) and lower(b.period) >= v_now;
  update platform.unit_blocks b
  set period = tstzrange(lower(b.period), v_now, '[)')
  where b.id = any (v_blocks);
  perform platform_private.audit(
    v_product.tenant_id, 'products', p_product_id::text, 'units_repaired', null,
    jsonb_build_object('quantity', p_quantity, 'location_id', p_location_id));
  return jsonb_build_object('quantity', p_quantity);
end;
$$;

-- Lost: that many units leave stock at once. Owners, managers and staff;
-- units_guard refuses a mechanic. Units with nothing on them go first, then
-- ones that are only damaged.
create function platform.mark_units_lost(p_product_id uuid, p_location_id uuid, p_quantity integer)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_product platform.products;
  v_units uuid[];
begin
  v_product := platform_private.stock_product(
    p_product_id, p_location_id, '{owner,manager,staff}', '{gear}');
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then
    raise exception 'quantity_out_of_range' using errcode = 'P0001';
  end if;
  perform platform_private.lock_product_stock(p_product_id, array[p_location_id]);
  perform platform_private.lock_units(array(
    select id from platform.units
    where product_id = p_product_id and location_id = p_location_id
      and status in ('active', 'maintenance')
  ));
  select coalesce(array_agg(u.id order by
    exists (
      select 1 from platform.unit_blocks b
      where b.unit_id = u.id and (upper_inf(b.period) or upper(b.period) > now())
    ),
    (u.label is not null), u.created_at desc, u.id), '{}')
  into v_units
  from platform.units u
  where u.product_id = p_product_id and u.location_id = p_location_id
    and u.status in ('active', 'maintenance')
    and not exists (
      select 1 from platform.unit_blocks b
      where b.unit_id = u.id and b.kind <> 'downtime'
        and (upper_inf(b.period) or upper(b.period) > now())
    );
  if cardinality(v_units) < p_quantity then
    raise exception 'units_blocked'
      using errcode = 'P0001', detail = cardinality(v_units)::text;
  end if;
  update platform.units set status = 'lost'
  where id = any (v_units[1:p_quantity]);
  perform platform_private.audit(
    v_product.tenant_id, 'products', p_product_id::text, 'units_lost', null,
    jsonb_build_object('quantity', p_quantity, 'location_id', p_location_id));
  return jsonb_build_object('quantity', p_quantity);
end;
$$;

-- What became of lost units: found again ("restore": back in stock) or gone
-- for good ("remove": the loss is confirmed, which lowers the quantity).
-- Owners and managers only.
create function platform.resolve_lost_units(
  p_product_id uuid,
  p_location_id uuid,
  p_quantity integer,
  p_action text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_product platform.products;
  v_units uuid[];
begin
  v_product := platform_private.stock_product(
    p_product_id, p_location_id, '{owner,manager}', '{gear}');
  if p_action is null or p_action not in ('restore', 'remove') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then
    raise exception 'quantity_out_of_range' using errcode = 'P0001';
  end if;
  perform platform_private.lock_product_stock(p_product_id, array[p_location_id]);
  perform platform_private.lock_units(array(
    select id from platform.units
    where product_id = p_product_id and location_id = p_location_id and status = 'lost'
  ));
  select coalesce(array_agg(u.id order by (u.label is not null), u.updated_at desc, u.id), '{}')
  into v_units
  from platform.units u
  where u.product_id = p_product_id and u.location_id = p_location_id and u.status = 'lost';
  if cardinality(v_units) < p_quantity then
    raise exception 'not_enough_lost'
      using errcode = 'P0001', detail = cardinality(v_units)::text;
  end if;
  v_units := v_units[1:p_quantity];
  if p_action = 'restore' then
    update platform.units set status = 'active' where id = any (v_units);
  else
    delete from platform.units u
    where u.id = any (v_units)
      and not exists (
        select 1 from platform.unit_blocks b
        where b.unit_id = u.id and b.kind <> 'downtime'
      );
    update platform.units set status = 'retired' where id = any (v_units);
  end if;
  perform platform_private.audit(
    v_product.tenant_id, 'products', p_product_id::text,
    case when p_action = 'restore' then 'lost_restored' else 'lost_removed' end, null,
    jsonb_build_object('quantity', p_quantity, 'location_id', p_location_id));
  return jsonb_build_object('quantity', p_quantity);
end;
$$;

-- A general product and its first quantities, saved together or not at all.
-- p_quantities: [{"location_id": "...", "quantity": 20}, ...]; ignored for
-- a service, which has no stock.
create function platform.create_general_product(
  p_tenant_id uuid,
  p_type text,
  p_name text,
  p_description text default null,
  p_track_units boolean default false,
  p_quantities jsonb default '[]'
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_row record;
begin
  if not platform_private.has_role(p_tenant_id, '{owner,manager}') then
    raise exception 'only_owner_or_manager' using errcode = '42501';
  end if;
  if p_type is null or p_type not in ('gear', 'sale_item', 'service') then
    raise exception 'invalid_type' using errcode = 'P0001';
  end if;
  insert into platform.products (tenant_id, type, tracking, name, description)
  values (
    p_tenant_id, p_type,
    case p_type
      when 'gear' then case when p_track_units then 'unit' else 'bulk' end
      when 'sale_item' then 'consumable'
      else 'none'
    end,
    btrim(p_name), nullif(btrim(p_description), '')
  )
  returning id into v_id;

  if p_type <> 'service' then
    -- Every product-and-location lock up front, sorted.
    perform platform_private.lock_product_stock(v_id, array(
      select q.location_id
      from jsonb_to_recordset(coalesce(p_quantities, '[]')) as q (location_id uuid, quantity integer)
    ));
    for v_row in
      select q.location_id, q.quantity
      from jsonb_to_recordset(coalesce(p_quantities, '[]')) as q (location_id uuid, quantity integer)
      where q.quantity is distinct from 0
    loop
      perform platform.set_stock_quantity(v_id, v_row.location_id, v_row.quantity);
    end loop;
  end if;
  return v_id;
end;
$$;

-- Stock by product and location, counted in the database so a shop with
-- many helmets doesn't send every row to the screen.
--   in_stock   units in use (not lost, retired or sold); on hand for an item for sale
--   damaged    of those, under downtime at this moment
--   lost       units marked lost
--   available  active units no block holds at this moment
create function platform.product_stock(p_tenant_id uuid)
returns table (
  product_id uuid,
  location_id uuid,
  in_stock integer,
  damaged integer,
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

revoke all on function platform.set_stock_quantity(uuid, uuid, integer) from public, anon;
revoke all on function platform.mark_units_damaged(uuid, uuid, integer, timestamptz) from public, anon;
revoke all on function platform.mark_units_repaired(uuid, uuid, integer) from public, anon;
revoke all on function platform.mark_units_lost(uuid, uuid, integer) from public, anon;
revoke all on function platform.resolve_lost_units(uuid, uuid, integer, text) from public, anon;
revoke all on function platform.create_general_product(uuid, text, text, text, boolean, jsonb) from public, anon;
revoke all on function platform.product_stock(uuid) from public, anon;
grant execute on function platform.set_stock_quantity(uuid, uuid, integer) to authenticated;
grant execute on function platform.mark_units_damaged(uuid, uuid, integer, timestamptz) to authenticated;
grant execute on function platform.mark_units_repaired(uuid, uuid, integer) to authenticated;
grant execute on function platform.mark_units_lost(uuid, uuid, integer) to authenticated;
grant execute on function platform.resolve_lost_units(uuid, uuid, integer, text) to authenticated;
grant execute on function platform.create_general_product(uuid, text, text, text, boolean, jsonb) to authenticated;
grant execute on function platform.product_stock(uuid) to authenticated;

-- 7. Manual order --------------------------------------------------------------------------------
-- One order per shop for Fleet and the Products list. A shop with no
-- position on any product is in A to Z order (the default). Once a product
-- is moved every product has a position, and a new product goes to the
-- bottom.

create function platform_private.products_sort_bottom()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sort_position is null then
    -- Null while the shop is still A to Z: max() of no positions.
    select max(p.sort_position) + 1 into new.sort_position
    from platform.products p
    where p.tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;

revoke all on function platform_private.products_sort_bottom() from public, anon, authenticated;

create trigger products_sort_bottom
before insert on platform.products
for each row execute function platform_private.products_sort_bottom();

-- Puts one product just before or just after another of the same shop.
-- Owners and managers only. A shop still in A to Z order has no positions
-- to start from, so the caller passes the order it shows (p_current_order);
-- it is used only for products without a position, and anything it leaves
-- out follows by name.
create function platform.move_product(
  p_product_id uuid,
  p_target_id uuid,
  p_place text,
  p_current_order uuid[] default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_ids uuid[];
  v_at integer;
begin
  select tenant_id into v_tenant from platform.products where id = p_product_id;
  if v_tenant is null or not platform_private.has_role(v_tenant, '{owner,manager}') then
    raise exception 'only_owner_or_manager' using errcode = '42501';
  end if;
  if p_place is null or p_place not in ('before', 'after')
    or p_target_id is null or p_target_id = p_product_id
    or not exists (
      select 1 from platform.products where id = p_target_id and tenant_id = v_tenant
    )
  then
    raise exception 'invalid_move' using errcode = 'P0001';
  end if;
  -- One reorder at a time per shop.
  perform pg_advisory_xact_lock(x'1a03'::int, hashtext(v_tenant::text));

  select array_agg(p.id order by p.sort_position nulls last, o.ord nulls last, lower(p.name), p.id)
  into v_ids
  from platform.products p
  left join (
    select x.id, min(x.ord) as ord
    from unnest(coalesce(p_current_order, '{}')) with ordinality as x (id, ord)
    group by x.id
  ) o on o.id = p.id
  where p.tenant_id = v_tenant and p.id <> p_product_id;

  v_at := array_position(v_ids, p_target_id);
  v_ids := case p_place
    when 'before' then v_ids[1:v_at - 1] || p_product_id || v_ids[v_at:]
    else v_ids[1:v_at] || p_product_id || v_ids[v_at + 1:]
  end;

  update platform.products p
  set sort_position = o.ord
  from unnest(v_ids) with ordinality as o (id, ord)
  where p.id = o.id and p.sort_position is distinct from o.ord;
end;
$$;

-- Back to A to Z: every position is cleared.
create function platform.reset_product_order(p_tenant_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not platform_private.has_role(p_tenant_id, '{owner,manager}') then
    raise exception 'only_owner_or_manager' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(x'1a03'::int, hashtext(p_tenant_id::text));
  update platform.products set sort_position = null
  where tenant_id = p_tenant_id and sort_position is not null;
  perform platform_private.audit(p_tenant_id, 'products', p_tenant_id::text, 'order_reset');
end;
$$;

revoke all on function platform.move_product(uuid, uuid, text, uuid[]) from public, anon;
revoke all on function platform.reset_product_order(uuid) from public, anon;
grant execute on function platform.move_product(uuid, uuid, text, uuid[]) to authenticated;
grant execute on function platform.reset_product_order(uuid) to authenticated;

-- 8. Moto Mangos: change the model, or disconnect ---------------------------------------------
-- For a product already on a list entry. Owners and managers only; each
-- writes a named audit event beside the row's own.
--
-- Bookings already made are left exactly as they are: neither function
-- touches a unit or a block, so every booked vehicle stays booked for its
-- dates. Each answers with how many bookings on this product's vehicles
-- have not ended, so the screen can say they still stand.

create function platform_private.upcoming_bookings(p_product_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from platform.unit_blocks b
  join platform.units u on u.id = b.unit_id
  where u.product_id = p_product_id
    and b.kind = 'allocation'
    and (upper_inf(b.period) or upper(b.period) > now());
$$;

revoke all on function platform_private.upcoming_bookings(uuid) from public, anon;
grant execute on function platform_private.upcoming_bookings(uuid) to authenticated;

-- Moves the product to another approved list entry. The listing switch and
-- its quantities stay as they are.
create function platform.change_listing_entry(p_product_id uuid, p_catalog_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_product platform.products;
  v_entry record;
  v_upcoming integer;
begin
  select * into v_product from platform.products where id = p_product_id for update;
  if v_product.id is null or not platform_private.has_role(v_product.tenant_id, '{owner,manager}') then
    raise exception 'only_owner_or_manager' using errcode = '42501';
  end if;
  if v_product.catalog_id is null or not exists (
    select 1 from public.bike_catalog where id = v_product.catalog_id and status = 'approved'
  ) then
    raise exception 'not_on_list' using errcode = 'P0001';
  end if;
  if p_catalog_id = v_product.catalog_id then
    raise exception 'same_model' using errcode = 'P0001';
  end if;
  select c.id, c.make, c.model into v_entry
  from public.bike_catalog c
  where c.id = p_catalog_id and c.status = 'approved';
  if v_entry.id is null then
    raise exception 'catalog_entry_not_usable' using errcode = 'P0001';
  end if;

  -- products_guard copies the entry's description onto the product.
  update platform.products set catalog_id = p_catalog_id where id = p_product_id;
  v_upcoming := platform_private.upcoming_bookings(p_product_id);
  perform platform_private.audit(
    v_product.tenant_id, 'products', p_product_id::text, 'listing_change_model',
    jsonb_build_object(
      'catalog_id', v_product.catalog_id, 'make', v_product.make, 'model', v_product.model),
    jsonb_build_object(
      'catalog_id', v_entry.id, 'make', v_entry.make, 'model', v_entry.model,
      'upcoming_bookings', v_upcoming));
  return jsonb_build_object('upcoming_bookings', v_upcoming);
end;
$$;

-- Takes the product off Moto Mangos: the listing is switched off, its
-- quantities go to zero and the list entry (with the make, model, engine
-- size and transmission copied from it) is cleared. Refused while a request
-- for it is still waiting for review.
create function platform.disconnect_listing(p_product_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_product platform.products;
  v_upcoming integer;
begin
  select * into v_product from platform.products where id = p_product_id for update;
  if v_product.id is null or not platform_private.has_role(v_product.tenant_id, '{owner,manager}') then
    raise exception 'only_owner_or_manager' using errcode = '42501';
  end if;
  if v_product.catalog_id is null then
    raise exception 'not_on_list' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.bike_catalog where id = v_product.catalog_id and status = 'requested'
  ) then
    raise exception 'request_pending' using errcode = 'P0001';
  end if;

  update platform.products
  set catalog_id = null, make = null, model = null, cc = null, transmission = null,
      marketplace_listed = false, instant_units = 0, request_units = 0, ready_now = 0
  where id = p_product_id;
  v_upcoming := platform_private.upcoming_bookings(p_product_id);
  perform platform_private.audit(
    v_product.tenant_id, 'products', p_product_id::text, 'listing_disconnect',
    jsonb_build_object(
      'catalog_id', v_product.catalog_id, 'make', v_product.make, 'model', v_product.model,
      'marketplace_listed', v_product.marketplace_listed,
      'instant_units', v_product.instant_units,
      'request_units', v_product.request_units,
      'ready_now', v_product.ready_now),
    jsonb_build_object('upcoming_bookings', v_upcoming));
  return jsonb_build_object('upcoming_bookings', v_upcoming);
end;
$$;

revoke all on function platform.change_listing_entry(uuid, uuid) from public, anon;
revoke all on function platform.disconnect_listing(uuid) from public, anon;
grant execute on function platform.change_listing_entry(uuid, uuid) to authenticated;
grant execute on function platform.disconnect_listing(uuid) to authenticated;
