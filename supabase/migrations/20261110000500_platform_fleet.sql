-- Platform Phase 1a: fleet core (docs/platform/SPEC.md › Fleet, Review
-- decisions; docs/platform/MAPPING.md §4–5).
--
-- models          what renters book; each links to a catalog entry
-- units           each real vehicle
-- unit_financials purchase and sale details, owner and manager only
-- unit_blocks     every time a unit is held (allocation, downtime, hold,
--                 transfer), with ONE exclusion constraint: the availability
--                 lock. Phase 1a writes downtime; Phases 2–3 add the rest.
--
-- Every child carries tenant_id and references its parent by (tenant_id, id).
-- Money is bigint minor units with the tenant's currency. Distances are km.

create extension if not exists btree_gist with schema extensions;

-- Models ---------------------------------------------------------------------------

create table platform.models (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants (id) on delete cascade,
  catalog_id uuid not null references public.bike_catalog (id) on delete restrict,
  -- The shop's own name for it. Several models may share a catalog entry.
  name text not null check (length(btrim(name)) between 1 and 120),
  description text check (length(description) <= 2000),
  -- Storage paths; uploading arrives with the booking page work.
  photos text[] not null default '{}' check (cardinality(photos) <= 12),
  bookable_online boolean not null default false,
  -- Null = the shop default (Phase 2).
  buffer_before_minutes int check (buffer_before_minutes between 0 and 10080),
  buffer_after_minutes int check (buffer_after_minutes between 0 and 10080),
  -- Minor units of deposit_currency. Null = the shop default (Phase 2).
  deposit bigint check (deposit >= 0),
  deposit_currency text,
  min_age smallint check (min_age between 14 and 99),
  licence_class text check (length(licence_class) <= 60),
  -- Booking modes: the rest of the active units are walk-in only.
  instant_units int not null default 0 check (instant_units >= 0),
  request_units int not null default 0 check (request_units >= 0),
  ready_now int not null default 0 check (ready_now >= 0),
  ready_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, deposit_currency) references platform.tenants (id, currency),
  check ((deposit is null) = (deposit_currency is null))
);

create unique index models_name_idx on platform.models (tenant_id, lower(btrim(name)));
create index models_catalog_idx on platform.models (catalog_id);

-- Units -----------------------------------------------------------------------------

create table platform.units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants (id) on delete cascade,
  model_id uuid not null,
  location_id uuid not null,
  -- Free-form: any country's plate. Unique within the shop when filled in.
  plate text check (length(btrim(plate)) between 1 and 30),
  -- No plate yet (a new bike waiting for registration). Check-out warns.
  plate_pending boolean not null default false,
  frame_number text check (length(frame_number) <= 40),
  engine_number text check (length(engine_number) <= 40),
  colour text check (length(colour) <= 40),
  first_registered date,
  -- Always km; shown in the shop's distance unit.
  current_odometer_km numeric(9, 1) not null default 0 check (current_odometer_km >= 0),
  status text not null default 'active'
    check (status in ('active', 'maintenance', 'retired', 'sold', 'borrowed')),
  -- A borrowed unit's window (sub-rental).
  active_from date,
  active_to date,
  -- What the QR sticker encodes. Opaque, so a sticker says nothing by itself.
  qr_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  notes text check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, model_id) references platform.models (tenant_id, id),
  foreign key (tenant_id, location_id) references platform.locations (tenant_id, id),
  check (plate is not null or plate_pending),
  check (active_to is null or active_from is null or active_to >= active_from)
);

create unique index units_plate_idx on platform.units (tenant_id, lower(btrim(plate))) where plate is not null;
create index units_model_idx on platform.units (tenant_id, model_id);
create index units_location_idx on platform.units (tenant_id, location_id);

-- Purchase and sale: owner and manager only ------------------------------------------

create table platform.unit_financials (
  tenant_id uuid not null references platform.tenants (id) on delete cascade,
  unit_id uuid not null,
  currency text not null,
  purchase_date date,
  purchase_price bigint check (purchase_price >= 0),
  purchased_from text check (length(purchased_from) <= 200),
  sold_at date,
  sale_price bigint check (sale_price >= 0),
  sold_to text check (length(sold_to) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (unit_id),
  foreign key (tenant_id, unit_id) references platform.units (tenant_id, id) on delete cascade,
  foreign key (tenant_id, currency) references platform.tenants (id, currency)
);

-- Unit blocks: the availability lock ------------------------------------------------

create table platform.unit_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants (id) on delete cascade,
  unit_id uuid not null,
  kind text not null check (kind in ('allocation', 'downtime', 'hold', 'transfer')),
  -- [start, end). An open end means the block lasts until someone ends it.
  period tstzrange not null check (
    not isempty(period) and lower(period) is not null and lower_inc(period) and not upper_inc(period)
  ),
  note text check (length(note) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, unit_id) references platform.units (tenant_id, id),
  -- One unit can never be in two blocks at once, whatever their kinds.
  constraint unit_blocks_no_overlap exclude using gist (unit_id with =, period with &&)
);

create index unit_blocks_tenant_idx on platform.unit_blocks (tenant_id, unit_id);

-- updated_at and audit -----------------------------------------------------------------

create trigger models_set_updated_at before update on platform.models
for each row execute function platform_private.set_updated_at();
create trigger units_set_updated_at before update on platform.units
for each row execute function platform_private.set_updated_at();
create trigger unit_financials_set_updated_at before update on platform.unit_financials
for each row execute function platform_private.set_updated_at();
create trigger unit_blocks_set_updated_at before update on platform.unit_blocks
for each row execute function platform_private.set_updated_at();

create trigger models_audit after insert or update or delete on platform.models
for each row execute function platform_private.audit_row();
create trigger units_audit after insert or update or delete on platform.units
for each row execute function platform_private.audit_row();
create trigger unit_financials_audit after insert or update or delete on platform.unit_financials
for each row execute function platform_private.audit_row('unit_id');
create trigger unit_blocks_audit after insert or update or delete on platform.unit_blocks
for each row execute function platform_private.audit_row();

-- Rules --------------------------------------------------------------------------------

-- A model needs a catalog entry its shop may use, and its booking-mode counts
-- can never exceed its active units.
create function platform_private.models_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active int;
begin
  if (tg_op = 'INSERT' or new.catalog_id is distinct from old.catalog_id)
    and not platform_private.can_use_catalog(new.catalog_id, new.tenant_id)
  then
    raise exception 'catalog_entry_not_usable' using errcode = 'P0001';
  end if;

  if new.instant_units + new.request_units > 0 or new.ready_now > 0 then
    select count(*) into v_active from platform.units
    where tenant_id = new.tenant_id and model_id = new.id and status = 'active';
    if new.instant_units + new.request_units > v_active or new.ready_now > v_active then
      raise exception 'more_units_than_active' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger models_guard before insert or update on platform.models
for each row execute function platform_private.models_guard();

-- Units: what each role may change, and when a unit may leave the fleet.
-- Owners and managers change anything. Staff and mechanics change only the
-- odometer (never down) and switch a unit between active and maintenance.
create function platform_private.units_guard()
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
      if new.current_odometer_km < old.current_odometer_km then
        raise exception 'odometer_lower_needs_manager' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Selling or retiring: its future blocks must be moved or ended first.
  if new.status in ('sold', 'retired') and old.status not in ('sold', 'retired')
    and exists (
      select 1 from platform.unit_blocks b
      where b.unit_id = new.id and (upper_inf(b.period) or upper(b.period) > now())
    )
  then
    raise exception 'unit_has_future_blocks' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger units_guard before update on platform.units
for each row execute function platform_private.units_guard();

-- No new block on a unit that has left the fleet.
create function platform_private.unit_blocks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from platform.units
    where id = new.unit_id and status in ('sold', 'retired')
  ) then
    raise exception 'unit_not_in_fleet' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger unit_blocks_guard before insert on platform.unit_blocks
for each row execute function platform_private.unit_blocks_guard();

-- Currency lock: once any amount is stored, the shop currency can no longer
-- change (the amounts would silently mean something else).
create function platform_private.tenants_lock_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from platform.models where tenant_id = new.id and deposit is not null)
    or exists (select 1 from platform.unit_financials where tenant_id = new.id)
  then
    raise exception 'currency_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger tenants_lock_currency
before update of currency on platform.tenants
for each row when (new.currency is distinct from old.currency)
execute function platform_private.tenants_lock_currency();

-- Whether the currency is locked, for the settings screen.
create function platform.currency_locked(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select platform_private.is_member(p_tenant_id) and (
    exists (select 1 from platform.models where tenant_id = p_tenant_id and deposit is not null)
    or exists (select 1 from platform.unit_financials where tenant_id = p_tenant_id)
  );
$$;

revoke all on function platform.currency_locked(uuid) from public, anon;
grant execute on function platform.currency_locked(uuid) to authenticated;

-- CSV import ---------------------------------------------------------------------------
-- The app parses and checks the file; this saves it in one transaction, so a
-- file is imported whole or not at all. Runs as the caller: RLS and every
-- constraint above apply. Owners and managers only.
--   p_models: [{id, catalog_id, name}]
--   p_units:  [{model_id, location_id, plate, plate_pending, frame_number,
--               engine_number, colour, first_registered, current_odometer_km,
--               purchase_date, purchase_price, purchased_from}]

create function platform.import_fleet(p_tenant_id uuid, p_models jsonb, p_units jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_currency text;
  v_models int;
  v_units int;
begin
  if not platform_private.has_role(p_tenant_id, '{owner,manager}') then
    raise exception 'only_owner_or_manager' using errcode = '42501';
  end if;
  select currency into v_currency from platform.tenants where id = p_tenant_id;

  insert into platform.models (id, tenant_id, catalog_id, name)
  select m.id, p_tenant_id, m.catalog_id, m.name
  from jsonb_to_recordset(coalesce(p_models, '[]')) as m (id uuid, catalog_id uuid, name text);
  get diagnostics v_models = row_count;

  with incoming as (
    select gen_random_uuid() as id, u.*
    from jsonb_to_recordset(coalesce(p_units, '[]')) as u (
      model_id uuid, location_id uuid, plate text, plate_pending boolean,
      frame_number text, engine_number text, colour text, first_registered date,
      current_odometer_km numeric, purchase_date date, purchase_price bigint,
      purchased_from text
    )
  ),
  added as (
    insert into platform.units (
      id, tenant_id, model_id, location_id, plate, plate_pending, frame_number,
      engine_number, colour, first_registered, current_odometer_km
    )
    select id, p_tenant_id, model_id, location_id, plate, coalesce(plate_pending, plate is null),
      frame_number, engine_number, colour, first_registered, coalesce(current_odometer_km, 0)
    from incoming
    returning id
  ),
  money as (
    insert into platform.unit_financials (
      tenant_id, unit_id, currency, purchase_date, purchase_price, purchased_from
    )
    select p_tenant_id, i.id, v_currency, i.purchase_date, i.purchase_price, i.purchased_from
    from incoming i
    where i.purchase_date is not null or i.purchase_price is not null or i.purchased_from is not null
    returning 1
  )
  select count(*) into v_units from added;

  perform platform_private.audit(p_tenant_id, 'fleet', p_tenant_id::text, 'import',
    null, jsonb_build_object('models', v_models, 'units', v_units));
  return jsonb_build_object('models', v_models, 'units', v_units);
end;
$$;

revoke all on function platform.import_fleet(uuid, jsonb, jsonb) from public, anon;
grant execute on function platform.import_fleet(uuid, jsonb, jsonb) to authenticated;
grant execute on function platform_private.audit(uuid, text, text, text, jsonb, jsonb) to authenticated;

-- RLS ------------------------------------------------------------------------------------

alter table platform.models enable row level security;
alter table platform.units enable row level security;
alter table platform.unit_financials enable row level security;
alter table platform.unit_blocks enable row level security;

grant select, insert, update, delete
  on platform.models, platform.units, platform.unit_financials, platform.unit_blocks
  to authenticated;

-- Models: every member reads; owners and managers write.
create policy "Members read models"
on platform.models for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids())::uuid[]));
create policy "Owners and managers add models"
on platform.models for insert to authenticated
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers change models"
on platform.models for update to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]))
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers remove models"
on platform.models for delete to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));

-- Units: every member reads; owners and managers add and remove; staff and
-- mechanics may update, limited to odometer and status by units_guard.
create policy "Members read units"
on platform.units for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids())::uuid[]));
create policy "Owners and managers add units"
on platform.units for insert to authenticated
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Shop staff change units"
on platform.units for update to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager,staff,mechanic}'))::uuid[]))
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager,staff,mechanic}'))::uuid[]));
create policy "Owners and managers remove units"
on platform.units for delete to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));

-- Financials: owners and managers only, for everything.
create policy "Owners and managers read unit financials"
on platform.unit_financials for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers add unit financials"
on platform.unit_financials for insert to authenticated
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers change unit financials"
on platform.unit_financials for update to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]))
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers remove unit financials"
on platform.unit_financials for delete to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));

-- Blocks: every member reads. Owners, managers, staff and mechanics write
-- downtime only; allocations, holds and transfers come from the booking
-- functions of Phases 2 and 3.
create policy "Members read unit blocks"
on platform.unit_blocks for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids())::uuid[]));
create policy "Shop staff add downtime"
on platform.unit_blocks for insert to authenticated
with check (
  kind = 'downtime'
  and tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager,staff,mechanic}'))::uuid[])
);
create policy "Shop staff change downtime"
on platform.unit_blocks for update to authenticated
using (
  kind = 'downtime'
  and tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager,staff,mechanic}'))::uuid[])
)
with check (
  kind = 'downtime'
  and tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager,staff,mechanic}'))::uuid[])
);
create policy "Shop staff remove downtime"
on platform.unit_blocks for delete to authenticated
using (
  kind = 'downtime'
  and tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager,staff,mechanic}'))::uuid[])
);
