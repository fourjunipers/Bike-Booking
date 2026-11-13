-- Products, stage A (docs/products-redesign.md, owner 13 Nov 2026).
--
-- platform.models becomes platform.products: one table for everything a shop
-- rents, sells or charges for. Stage A renames and adds the type; only
-- vehicles exist on screen, and they behave exactly as before.
--
-- 1. Renames: models -> products, units.model_id -> product_id,
--    model_year_bands -> product_year_bands (and its model_id), with their
--    constraints, indexes, triggers, policies and trigger functions.
-- 2. products.type (vehicle, gear, sale_item, service) and products.tracking
--    (unit, bulk, consumable, none). Every existing row is a vehicle tracked
--    by unit. The type never changes once a product exists.
-- 3. Vehicle-only columns (make, model, vehicle_type and the rest) are
--    required for a vehicle and must be empty for anything else.
-- 4. units.product_type, kept equal to its product's type by a composite
--    foreign key, so later checks on a unit can depend on what it is a unit
--    of. Only vehicles and gear have units.
-- 5. The ten functions whose bodies name the old table or column are
--    re-created (Postgres does not rewrite function bodies on a rename).
--    They are in this same file so nothing, the hourly reminder job
--    included, ever runs against a half-renamed schema.
--
-- No table is created and no new function is reachable over the API. The
-- renamed tables keep their grants, restated below under the new names;
-- renamed functions keep theirs.
-- submit_product_to_catalog() replaces submit_model_to_catalog() (a
-- parameter is renamed, which needs a drop) and is granted again on purpose.
-- Nothing in public is touched: bike_catalog and vehicle_types stay as they are.

-- 1. Renames ---------------------------------------------------------------------------

alter table platform.models rename to products;
alter table platform.model_year_bands rename to product_year_bands;
alter table platform.units rename column model_id to product_id;
alter table platform.product_year_bands rename column model_id to product_id;

-- A rename keeps a table's grants and policies. They are restated here on
-- purpose all the same (20261112000100: every table the API roles can reach
-- has its grant written in a migration, under the name it has now).
grant select, insert, update, delete
  on platform.products, platform.product_year_bands
  to authenticated;

-- Constraints (and the indexes behind primary keys and unique constraints).
do $$
declare
  r record;
  v_new text;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.connamespace = 'platform'::regnamespace
      and c.conrelid in ('platform.products'::regclass, 'platform.product_year_bands'::regclass, 'platform.units'::regclass)
      and c.conname ~ '^(models_|model_year_bands_|units_tenant_id_model_id_)'
    order by c.conname
  loop
    v_new := regexp_replace(r.conname, '^models_', 'products_');
    v_new := regexp_replace(v_new, '^model_year_bands_', 'product_year_bands_');
    v_new := replace(v_new, '_model_id_', '_product_id_');
    execute format('alter table %s rename constraint %I to %I', r.tbl, r.conname, v_new);
  end loop;
end;
$$;

alter index platform.models_catalog_idx rename to products_catalog_idx;
alter index platform.models_name_idx rename to products_name_idx;
alter index platform.units_model_idx rename to units_product_idx;
alter index platform.units_model_year_idx rename to units_product_year_idx;

alter trigger models_audit on platform.products rename to products_audit;
alter trigger models_default_category on platform.products rename to products_default_category;
alter trigger models_guard on platform.products rename to products_guard;
alter trigger models_keep_catalog_outcome on platform.products rename to products_keep_catalog_outcome;
alter trigger models_retire_guard on platform.products rename to products_retire_guard;
alter trigger models_set_updated_at on platform.products rename to products_set_updated_at;
alter trigger models_withdraw_request on platform.products rename to products_withdraw_request;
alter trigger model_year_bands_audit on platform.product_year_bands rename to product_year_bands_audit;
alter trigger units_clamp_model_counts on platform.units rename to units_clamp_product_counts;
alter trigger units_model_not_retired on platform.units rename to units_product_not_retired;

alter policy "Members read models" on platform.products rename to "Members read products";
alter policy "Owners and managers add models" on platform.products rename to "Owners and managers add products";
alter policy "Owners and managers change models" on platform.products rename to "Owners and managers change products";
alter policy "Owners and managers remove models" on platform.products rename to "Owners and managers remove products";

-- Trigger functions: triggers point at them by id, so a rename is safe.
alter function platform_private.models_guard() rename to products_guard;
alter function platform_private.models_keep_catalog_outcome() rename to products_keep_catalog_outcome;
alter function platform_private.models_default_category() rename to products_default_category;
alter function platform_private.models_retire_guard() rename to products_retire_guard;
alter function platform_private.models_withdraw_request() rename to products_withdraw_request;
alter function platform_private.units_clamp_model_counts() rename to units_clamp_product_counts;
alter function platform_private.units_model_not_retired() rename to units_product_not_retired;

-- The audit trail names a row's table. Rows written before today keep
-- everything but that label, so a product's history is found in one place.
update platform.audit_events set entity = 'products' where entity = 'models';
update platform.audit_events set entity = 'product_year_bands' where entity = 'model_year_bands';

-- 2. Type and tracking ---------------------------------------------------------------------

alter table platform.products
  add column type text not null default 'vehicle'
    constraint products_type_check check (type in ('vehicle', 'gear', 'sale_item', 'service')),
  add column tracking text not null default 'unit'
    constraint products_tracking_check check (tracking in ('unit', 'bulk', 'consumable', 'none')),
  -- A vehicle is always tracked by unit; gear by quantity or by unit; an item
  -- for sale is used up; a service has no stock.
  add constraint products_type_tracking_check check (
    (type = 'vehicle' and tracking = 'unit')
    or (type = 'gear' and tracking in ('bulk', 'unit'))
    or (type = 'sale_item' and tracking = 'consumable')
    or (type = 'service' and tracking = 'none')
  ),
  -- For units.product_type below.
  add constraint products_tenant_id_id_type_key unique (tenant_id, id, type);

-- 3. Vehicle-only columns ---------------------------------------------------------------------

alter table platform.products
  alter column make drop not null,
  alter column model drop not null,
  alter column vehicle_type drop not null,
  add constraint products_vehicle_fields_check check (
    case
      when type = 'vehicle' then
        make is not null and model is not null and vehicle_type is not null
      else
        make is null and model is null and vehicle_type is null
        and cc is null and transmission is null and catalog_id is null
        and min_age is null and licence_class is null
        and catalog_approved_at is null and catalog_rejected_at is null
        and catalog_reject_reason is null
        -- Moto Mangos lists vehicles only.
        and not marketplace_listed
        and instant_units = 0 and request_units = 0 and ready_now = 0
    end
  );

-- "No two of the shop's own with the same make and model" is about vehicles.
drop index platform.models_own_make_model_idx;
create unique index products_own_make_model_idx
  on platform.products (tenant_id, platform_private.norm(make), platform_private.norm(model))
  where catalog_id is null and type = 'vehicle';

-- What a product is never changes: its units, bookings and history all
-- depend on it. (Tracking can change, between bulk and unit, for gear only;
-- the check above allows nothing else.)
create function platform_private.products_type_fixed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type is distinct from old.type then
    raise exception 'product_type_fixed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function platform_private.products_type_fixed() from public, anon, authenticated;

create trigger products_type_fixed
before update of type on platform.products
for each row execute function platform_private.products_type_fixed();

-- 4. A unit knows what it is a unit of ---------------------------------------------------------

alter table platform.units
  add column product_type text not null default 'vehicle'
    constraint units_product_type_check check (product_type in ('vehicle', 'gear')),
  drop constraint units_tenant_id_product_id_fkey,
  add constraint units_tenant_id_product_id_type_fkey
    foreign key (tenant_id, product_id, product_type)
    references platform.products (tenant_id, id, type);

-- 5. Functions that name the old table or column ------------------------------------------------
-- Each is its latest definition (20261111000300 to 20261113000100) with
-- platform.models -> platform.products and model_id -> product_id; nothing
-- else changes, except: the clamp's audit row is filed under 'products', and
-- import_fleet() answers {"products": n, "units": n} and reads "product_id"
-- from each unit.

drop function platform.submit_model_to_catalog(uuid, public.bike_type, integer, integer, text);

create or replace function platform_private.products_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_active int;
  v_entry record;
begin
  if new.catalog_id is not null then
    if tg_op = 'INSERT' or new.catalog_id is distinct from old.catalog_id then
      select c.make, c.model, c.vehicle_type, c.cc, c.transmission, c.status, c.requested_by_tenant_id
      into v_entry
      from public.bike_catalog c
      where c.id = new.catalog_id;
      -- An approved entry, or this shop's own submission while it waits.
      if not found or not (
        v_entry.status = 'approved'
        or (v_entry.status = 'requested' and v_entry.requested_by_tenant_id = new.tenant_id)
      ) then
        raise exception 'catalog_entry_not_usable' using errcode = 'P0001';
      end if;
      new.make := v_entry.make;
      new.model := v_entry.model;
      new.vehicle_type := v_entry.vehicle_type;
      new.cc := v_entry.cc;
      new.transmission := v_entry.transmission;
    else
      -- Still linked to the same entry: its description isn't edited here.
      new.make := old.make;
      new.model := old.model;
      new.vehicle_type := old.vehicle_type;
      new.cc := old.cc;
      new.transmission := old.transmission;
    end if;
  end if;

  if new.marketplace_listed and (
    new.catalog_id is null
    or not exists (
      select 1 from public.bike_catalog where id = new.catalog_id and status = 'approved'
    )
  ) then
    raise exception 'not_listable' using errcode = 'P0001';
  end if;

  if new.instant_units + new.request_units > 0 or new.ready_now > 0 then
    select count(*) into v_active from platform.units
    where tenant_id = new.tenant_id and product_id = new.id and status = 'active';
    if new.instant_units + new.request_units > v_active or new.ready_now > v_active then
      raise exception 'more_units_than_active' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$function$
;

create or replace function platform_private.products_retire_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.retired_at is null then
    return new;
  end if;
  if tg_op = 'INSERT' or old.retired_at is null then
    -- Being retired now.
    if exists (
      select 1 from platform.units u
      where u.product_id = new.id and u.status not in ('sold', 'retired')
    ) then
      raise exception 'model_has_active_units' using errcode = 'P0001';
    end if;
    new.marketplace_listed := false;
    new.instant_units := 0;
    new.request_units := 0;
    new.ready_now := 0;
  elsif new.marketplace_listed then
    -- Still retired: restore it before listing it.
    raise exception 'model_retired' using errcode = 'P0001';
  end if;
  return new;
end;
$function$
;

create or replace function platform_private.products_withdraw_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.catalog_id is not null then
    update public.bike_catalog c
    set status = 'rejected',
        review_notes = 'Withdrawn: the shop deleted the model.',
        reviewed_at = now()
    where c.id = old.catalog_id
      and c.status = 'requested'
      and not exists (select 1 from platform.products m where m.catalog_id = c.id);
  end if;
  return old;
end;
$function$
;

create or replace function platform_private.tenants_lock_currency()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists (select 1 from platform.products where tenant_id = new.id and deposit is not null)
    or exists (select 1 from platform.unit_financials where tenant_id = new.id)
    or exists (select 1 from platform.unit_renewal_costs where tenant_id = new.id)
  then
    raise exception 'currency_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$function$
;

create or replace function platform_private.units_clamp_product_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_model record;
  v_active int;
  v_instant int;
  v_request int;
  v_ready int;
begin
  -- Only when a bike stops counting for old.product_id.
  if tg_op = 'UPDATE' and not (
    old.status = 'active' and (new.status <> 'active' or new.product_id <> old.product_id)
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
  from platform.products
  where id = old.product_id
  for no key update;
  -- Gone already: the model or the whole tenant is being deleted.
  if not found or not exists (select 1 from platform.tenants where id = v_model.tenant_id) then
    return null;
  end if;

  select count(*) into v_active
  from platform.units
  where tenant_id = v_model.tenant_id and product_id = v_model.id and status = 'active';

  v_instant := least(v_model.instant_units, v_active);
  v_request := least(v_model.request_units, v_active - v_instant);
  v_ready := least(v_model.ready_now, v_active);
  if v_instant = v_model.instant_units
    and v_request = v_model.request_units
    and v_ready = v_model.ready_now
  then
    return null;
  end if;

  update platform.products
  set instant_units = v_instant, request_units = v_request, ready_now = v_ready
  where id = v_model.id;

  insert into platform.audit_events (tenant_id, entity, entity_id, action, actor, before, after)
  values (
    v_model.tenant_id, 'products', v_model.id::text, 'clamp_booking_counts', (select auth.uid()),
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
        when new.product_id <> old.product_id then 'moved to another model'
        else 'status ' || old.status || ' -> ' || new.status
      end
    )
  );
  return null;
end;
$function$
;

create or replace function platform_private.units_product_not_retired()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_retired_at timestamptz;
begin
  if new.status in ('active', 'maintenance') and (
    tg_op = 'INSERT'
    or old.status in ('sold', 'retired')
    or new.product_id <> old.product_id
  ) then
    -- FOR SHARE: someone retiring the model at this instant waits for this
    -- vehicle, and this vehicle waits for them, so one sees the other.
    select m.retired_at into v_retired_at
    from platform.products m
    where m.id = new.product_id
    for share;
    if v_retired_at is not null then
      raise exception 'model_retired' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$function$
;

create or replace function platform.currency_locked(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select platform_private.is_member(p_tenant_id) and (
    exists (select 1 from platform.products where tenant_id = p_tenant_id and deposit is not null)
    or exists (select 1 from platform.unit_financials where tenant_id = p_tenant_id)
    or exists (select 1 from platform.unit_renewal_costs where tenant_id = p_tenant_id)
  );
$function$
;

create or replace function platform.import_fleet(p_tenant_id uuid, p_models jsonb, p_units jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_currency text;
  v_models int;
  v_units int;
begin
  if not platform_private.has_role(p_tenant_id, '{owner,manager}') then
    raise exception 'only_owner_or_manager' using errcode = '42501';
  end if;
  select currency into v_currency from platform.tenants where id = p_tenant_id;

  insert into platform.products (id, tenant_id, catalog_id, name, make, model, vehicle_type, cc, transmission, categories)
  select m.id, p_tenant_id, m.catalog_id, m.name, m.make, m.model, m.vehicle_type, m.cc, m.transmission,
    coalesce(m.categories, '{}')
  from jsonb_to_recordset(coalesce(p_models, '[]')) as m (
    id uuid, catalog_id uuid, name text, make text, model text, vehicle_type text,
    cc int, transmission public.transmission, categories text[]
  );
  get diagnostics v_models = row_count;

  with incoming as (
    select gen_random_uuid() as id, u.*
    from jsonb_to_recordset(coalesce(p_units, '[]')) as u (
      product_id uuid, location_id uuid, plate text, plate_pending boolean,
      frame_number text, engine_number text, colour text, model_year smallint,
      current_odometer_km numeric, purchase_date date, purchase_price bigint,
      purchased_from text
    )
  ),
  added as (
    insert into platform.units (
      id, tenant_id, product_id, location_id, plate, plate_pending, frame_number,
      engine_number, colour, model_year, current_odometer_km
    )
    select id, p_tenant_id, product_id, location_id, plate, coalesce(plate_pending, plate is null),
      frame_number, engine_number, colour, model_year, coalesce(current_odometer_km, 0)
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
    null, jsonb_build_object('products', v_models, 'units', v_units));
  return jsonb_build_object('products', v_models, 'units', v_units);
end;
$function$
;

create or replace function platform.review_catalog_request(p_catalog_id uuid, p_approve boolean, p_notes text DEFAULT NULL::text, p_merge_into uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_request record;
  v_model record;
  v_target_slug text;
  v_decision text;
  v_kept jsonb := '[]';
  v_notes text := nullif(btrim(p_notes), '');
begin
  if not platform_private.is_platform_admin() then
    raise exception 'Only platform admins can review catalog entries'
      using errcode = '42501';
  end if;
  select id, make, model, request_note, requested_by_tenant_id into v_request
  from public.bike_catalog
  where id = p_catalog_id
    and status = 'requested'
    and requested_by_tenant_id is not null
  for update;
  if not found then
    raise exception 'Catalog request not found' using errcode = 'P0002';
  end if;

  if p_merge_into is not null then
    select slug into v_target_slug
    from public.bike_catalog
    where id = p_merge_into and status = 'approved';
    if v_target_slug is null then
      raise exception 'merge_target_not_approved' using errcode = 'P0001';
    end if;
    v_decision := 'merge';
    update platform.products
    set catalog_id = p_merge_into, catalog_approved_at = now(),
        -- The shop asked for it to be listed; the target is approved.
        marketplace_listed = true
    where catalog_id = p_catalog_id;
    update public.bike_catalog
    set status = 'rejected',
        review_notes = concat_ws(' ', v_notes, 'Merged into ' || v_target_slug || '.'),
        reviewed_at = now()
    where id = p_catalog_id;
  elsif p_approve then
    v_decision := 'approve';
    update public.bike_catalog
    set status = 'approved',
        review_notes = v_notes,
        reviewed_at = now(),
        -- The entry is public from here on.
        request_note = null,
        requested_by_tenant_id = null
    where id = p_catalog_id;
    -- What the shop is told, on its own model.
    -- ...and listed, which is what the shop asked for by sending it.
    update platform.products
    set catalog_approved_at = now(), marketplace_listed = true
    where catalog_id = p_catalog_id;
  else
    v_decision := 'reject';
    for v_model in
      select m.id, m.tenant_id, m.name, m.make, m.model
      from platform.products m
      where m.catalog_id = p_catalog_id
      order by m.created_at, m.id
    loop
      if exists (
        select 1 from platform.products o
        where o.tenant_id = v_model.tenant_id
          and o.catalog_id is null
          and o.id <> v_model.id
          and platform_private.norm(o.make) = platform_private.norm(v_model.make)
          and platform_private.norm(o.model) = platform_private.norm(v_model.model)
      ) then
        -- The shop already has this make and model as its own: giving this
        -- one back too would make two. It stays linked, unlisted.
        v_kept := v_kept || jsonb_build_object('product_id', v_model.id, 'name', v_model.name);
        update platform.products
        set catalog_rejected_at = now(), catalog_reject_reason = v_notes
        where id = v_model.id;
      else
        update platform.products
        set catalog_id = null, marketplace_listed = false,
            -- What the shop is told, on its own model.
            catalog_rejected_at = now(), catalog_reject_reason = v_notes
        where id = v_model.id;
      end if;
    end loop;
    update public.bike_catalog
    set status = 'rejected', review_notes = v_notes, reviewed_at = now()
    where id = p_catalog_id;
  end if;

  perform platform_private.audit(
    v_request.requested_by_tenant_id, 'bike_catalog', p_catalog_id::text, v_decision,
    jsonb_strip_nulls(jsonb_build_object(
      'status', 'requested',
      'request_note', v_request.request_note
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'make', v_request.make,
      'model', v_request.model,
      'notes', v_notes,
      'merged_into', v_target_slug,
      'kept_linked', case when jsonb_array_length(v_kept) > 0 then v_kept end
    ))
  );

  return jsonb_build_object('decision', v_decision, 'kept_linked', v_kept);
end;
$function$
;

create or replace function platform.submit_product_to_catalog(p_product_id uuid, p_type bike_type, p_year_from integer DEFAULT NULL::integer, p_year_to integer DEFAULT NULL::integer, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_model platform.products;
  v_id uuid;
begin
  select * into v_model from platform.products where id = p_product_id;
  -- Same answer for "no such model" and "not your shop".
  if v_model.id is null or not platform_private.has_role(v_model.tenant_id, '{owner,manager}') then
    raise exception 'only_owner_or_manager' using errcode = '42501';
  end if;
  if v_model.catalog_id is not null then
    raise exception 'already_linked' using errcode = 'P0001';
  end if;
  if v_model.vehicle_type <> 'motorbike' then
    raise exception 'only_motorbikes' using errcode = 'P0001';
  end if;

  insert into public.bike_catalog (
    make, model, year_from, year_to, type, transmission, cc, vehicle_type,
    request_note, status, requested_by_tenant_id
  )
  values (
    btrim(v_model.make), btrim(v_model.model), p_year_from, p_year_to, p_type,
    v_model.transmission, v_model.cc, v_model.vehicle_type,
    nullif(btrim(p_note), ''), 'requested', v_model.tenant_id
  )
  returning id into v_id;

  update platform.products set catalog_id = v_id where id = p_product_id;
  perform platform_private.audit(v_model.tenant_id, 'bike_catalog', v_id::text, 'submit',
    null, jsonb_build_object('product_id', p_product_id, 'make', v_model.make, 'model', v_model.model));
  return v_id;
end;
$function$
;

revoke all on function platform.submit_product_to_catalog(uuid, public.bike_type, integer, integer, text) from public, anon;
grant execute on function platform.submit_product_to_catalog(uuid, public.bike_type, integer, integer, text) to authenticated;
