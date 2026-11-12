-- Platform Phase 1a: shops' own vehicles, and one catalog for Moto Mangos
-- (owner decision, 11 Nov 2026; replaces the spec rule "a model can't be saved
-- without a catalog entry").
--
-- * A shop's model no longer needs a catalog entry. Its make, model, vehicle
--   type, engine size and transmission live on the model itself, so a shop
--   can add any vehicle (bike, car, ATV, boat) with no approval.
-- * The catalog's approved entries are the presets every shop picks from.
--   A model linked to one takes its make, model and specs from it.
-- * The approval queue appears at one point only: when a shop wants a model
--   on Moto Mangos and no preset matches. It submits the model; a platform
--   admin approves it (it becomes a preset for every shop) or merges it into
--   an existing entry. Only a model linked to an approved entry can be listed.

-- Ignoring case and spacing: "Honda PCX", "honda  pcx" and "HondaPCX" are one name.
create function platform_private.norm(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(lower(coalesce(p_text, '')), '\s+', '', 'g');
$$;

grant execute on function platform_private.norm(text) to authenticated, service_role;

insert into public.vehicle_types (key, name, spec_schema) values
  ('atv', 'ATV', '{"type": "object", "properties": {}}'),
  ('boat', 'Boat', '{"type": "object", "properties": {}}'),
  ('other', 'Other', '{"type": "object", "properties": {}}')
on conflict (key) do nothing;

-- Models carry their own description ----------------------------------------------

alter table platform.models
  alter column catalog_id drop not null,
  add column make text check (length(btrim(make)) between 1 and 40),
  -- The model's name as a catalog would write it, e.g. "PCX 160". `name`
  -- stays the shop's own label for it.
  add column model text check (length(btrim(model)) between 1 and 60),
  add column vehicle_type text references public.vehicle_types (key),
  add column cc int check (cc between 1 and 20000),
  add column transmission public.transmission,
  -- The shop wants this model on Moto Mangos. Takes effect when the
  -- marketplace reads the platform (Phase 3M).
  add column marketplace_listed boolean not null default false;

update platform.models m
set make = c.make,
    model = c.model,
    vehicle_type = c.vehicle_type,
    cc = c.cc,
    transmission = c.transmission
from public.bike_catalog c
where c.id = m.catalog_id;

alter table platform.models
  alter column make set not null,
  alter column model set not null,
  alter column vehicle_type set not null,
  -- Moto Mangos search filters by engine size and transmission.
  add constraint models_motorbike_specs_check
    check (vehicle_type <> 'motorbike' or (cc is not null and transmission is not null));

-- A shop can't have the same make and model of its own twice. (Models on
-- catalog entries may share a make and model: the catalog has one entry per
-- generation, and a shop may keep two models on one entry.)
create unique index models_own_make_model_idx
  on platform.models (tenant_id, platform_private.norm(make), platform_private.norm(model))
  where catalog_id is null;

-- A linked model takes its description from the catalog; a model can be
-- listed on Moto Mangos only while it is linked to an approved entry.
create or replace function platform_private.models_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
    where tenant_id = new.tenant_id and model_id = new.id and status = 'active';
    if new.instant_units + new.request_units > v_active or new.ready_now > v_active then
      raise exception 'more_units_than_active' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- CSV import: a new model is either a catalog entry or the shop's own.
--   p_models: [{id, name, catalog_id}] or
--             [{id, name, make, model, vehicle_type, cc, transmission}]
create or replace function platform.import_fleet(p_tenant_id uuid, p_models jsonb, p_units jsonb)
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

  insert into platform.models (id, tenant_id, catalog_id, name, make, model, vehicle_type, cc, transmission)
  select m.id, p_tenant_id, m.catalog_id, m.name, m.make, m.model, m.vehicle_type, m.cc, m.transmission
  from jsonb_to_recordset(coalesce(p_models, '[]')) as m (
    id uuid, catalog_id uuid, name text, make text, model text, vehicle_type text,
    cc int, transmission public.transmission
  );
  get diagnostics v_models = row_count;

  with incoming as (
    select gen_random_uuid() as id, u.*
    from jsonb_to_recordset(coalesce(p_units, '[]')) as u (
      model_id uuid, location_id uuid, plate text, plate_pending boolean,
      frame_number text, engine_number text, colour text, model_year smallint,
      current_odometer_km numeric, purchase_date date, purchase_price bigint,
      purchased_from text
    )
  ),
  added as (
    insert into platform.units (
      id, tenant_id, model_id, location_id, plate, plate_pending, frame_number,
      engine_number, colour, model_year, current_odometer_km
    )
    select id, p_tenant_id, model_id, location_id, plate, coalesce(plate_pending, plate is null),
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
    null, jsonb_build_object('models', v_models, 'units', v_units));
  return jsonb_build_object('models', v_models, 'units', v_units);
end;
$$;

-- Listing on Moto Mangos: submit, approve, merge, reject ------------------------------

-- The old request path made a catalog entry before the shop had a model.
drop function platform.request_catalog_entry(uuid, text, text, int, int, public.bike_type, public.transmission, int, text);

-- An owner or manager submits one of the shop's own models to the catalog.
-- The model is linked to the submission while it waits. Returns the entry's id.
create function platform.submit_model_to_catalog(
  p_model_id uuid,
  p_type public.bike_type,
  p_year_from int default null,
  p_year_to int default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_model platform.models;
  v_id uuid;
begin
  select * into v_model from platform.models where id = p_model_id;
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

  update platform.models set catalog_id = v_id where id = p_model_id;
  perform platform_private.audit(v_model.tenant_id, 'bike_catalog', v_id::text, 'submit',
    null, jsonb_build_object('model_id', p_model_id, 'make', v_model.make, 'model', v_model.model));
  return v_id;
end;
$$;

-- A platform admin decides a submission:
--  * approve: it becomes a preset for every shop;
--  * merge (p_merge_into): every model waiting on it moves to that existing
--    approved entry, so one bike has one entry;
--  * reject: the models go back to being the shop's own, unlisted.
drop function platform.review_catalog_request(uuid, boolean, text);

create function platform.review_catalog_request(
  p_catalog_id uuid,
  p_approve boolean,
  p_notes text default null,
  p_merge_into uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_slug text;
begin
  if not platform_private.is_platform_admin() then
    raise exception 'Only platform admins can review catalog entries'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.bike_catalog where id = p_catalog_id and status = 'requested'
  ) then
    raise exception 'Catalog request not found' using errcode = 'P0002';
  end if;

  if p_merge_into is not null then
    select slug into v_target_slug
    from public.bike_catalog
    where id = p_merge_into and status = 'approved';
    if v_target_slug is null then
      raise exception 'merge_target_not_approved' using errcode = 'P0001';
    end if;
    update platform.models set catalog_id = p_merge_into where catalog_id = p_catalog_id;
    update public.bike_catalog
    set status = 'rejected',
        review_notes = concat_ws(' ', nullif(btrim(p_notes), ''), 'Merged into ' || v_target_slug || '.'),
        reviewed_at = now()
    where id = p_catalog_id;
  elsif p_approve then
    update public.bike_catalog
    set status = 'approved', review_notes = nullif(btrim(p_notes), ''), reviewed_at = now()
    where id = p_catalog_id;
  else
    update platform.models
    set catalog_id = null, marketplace_listed = false
    where catalog_id = p_catalog_id;
    update public.bike_catalog
    set status = 'rejected', review_notes = nullif(btrim(p_notes), ''), reviewed_at = now()
    where id = p_catalog_id;
  end if;
end;
$$;

revoke all on function platform.submit_model_to_catalog(uuid, public.bike_type, int, int, text) from public, anon;
revoke all on function platform.review_catalog_request(uuid, boolean, text, uuid) from public, anon;
grant execute on function platform.submit_model_to_catalog(uuid, public.bike_type, int, int, text) to authenticated;
grant execute on function platform.review_catalog_request(uuid, boolean, text, uuid) to authenticated;
