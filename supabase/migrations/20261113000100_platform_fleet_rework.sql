-- Fleet rework (owner, 12 Nov 2026): categories on every model, and the result
-- of a Moto Mangos review kept where the shop can be told about it.
--
-- 1. platform.models.categories: what kind of motorbike, car, off-road vehicle
--    or boat a model is (scooter, SUV, ATV, jet ski...). A model can have
--    several ("adventure" and "touring"), so it is a list. Renters will filter
--    by it; the shop sets it once on the model instead of each time it sends a
--    model to Moto Mangos. The lists are first guesses and live in the app
--    (apps/platform/lib/vehicle-kinds.ts) so they can change with no
--    migration: the database only checks each value's shape.
--    A motorbike model on a catalog entry takes the entry's type when it has
--    no categories of its own; existing models are filled in the same way.
-- 2. platform.models.catalog_approved_at: when Moto Mangos added (or merged)
--    the model's request. With catalog_rejected_at from 20261112000400 this
--    lets the dashboard and the fleet list show the result of a review. Set
--    only by review_catalog_request(); the shop can't write it.
-- 3. import_fleet() carries a model's categories from the CSV.
--
-- No new table and no new function reachable over the API, so no new grants
-- (20261112000100): the columns sit on platform.models, which grants to
-- authenticated on purpose; review_catalog_request() and import_fleet() are
-- replaced in place and keep their grants; the one new function is a trigger
-- function in platform_private with everything revoked.

alter table platform.models
  add column categories text[] not null default '{}'
    constraint models_categories_shape check (
      -- Up to 10 lower-case keys, none null. The comma test: no key holds a
      -- comma, so the joined text below splits back into the same keys.
      cardinality(categories) <= 10
      and array_position(categories, null) is null
      and cardinality(categories)
        = coalesce(cardinality(string_to_array(array_to_string(categories, ','), ',')), 0)
      and array_to_string(categories, ',')
        ~ '^([a-z][a-z0-9_]{0,39}(,[a-z][a-z0-9_]{0,39})*)?$'
    ),
  add column catalog_approved_at timestamptz;

-- A motorbike on a catalog entry: the entry's type, unless the shop chose one.
create function platform_private.models_default_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if cardinality(new.categories) = 0 and new.catalog_id is not null then
    select c.type::text into v_type
    from public.bike_catalog c
    where c.id = new.catalog_id and c.vehicle_type = 'motorbike';
    if v_type is not null then
      new.categories := array[v_type];
    end if;
  end if;
  return new;
end;
$$;

revoke all on function platform_private.models_default_category() from public, anon, authenticated;

create trigger models_default_category
before insert or update of catalog_id, categories on platform.models
for each row execute function platform_private.models_default_category();

-- Existing models (the trigger above fills them; nothing else changes).
update platform.models set categories = '{}' where categories = '{}' and catalog_id is not null;

-- The review outcome is the reviewer's to write, as in 20261112000400, now
-- with the approval date as well.
create or replace function platform_private.models_keep_catalog_outcome()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.catalog_rejected_at := null;
      new.catalog_reject_reason := null;
      new.catalog_approved_at := null;
    else
      new.catalog_rejected_at := old.catalog_rejected_at;
      new.catalog_reject_reason := old.catalog_reject_reason;
      new.catalog_approved_at := old.catalog_approved_at;
      -- The shop moved the model to another entry, or off the list: a past
      -- approval no longer describes it.
      if new.catalog_id is distinct from old.catalog_id then
        new.catalog_approved_at := null;
      end if;
    end if;
  end if;
  if tg_op = 'UPDATE' and new.catalog_id is not null
    and new.catalog_id is distinct from old.catalog_id
  then
    -- On a catalog entry now: an old rejection no longer applies.
    new.catalog_rejected_at := null;
    new.catalog_reject_reason := null;
  end if;
  return new;
end;
$$;

-- The review function, as in 20261112000400, plus the approval date on the
-- shop's models when a request is approved or merged.
create or replace function platform.review_catalog_request(
  p_catalog_id uuid,
  p_approve boolean,
  p_notes text default null,
  p_merge_into uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
    update platform.models
    set catalog_id = p_merge_into, catalog_approved_at = now()
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
    update platform.models set catalog_approved_at = now() where catalog_id = p_catalog_id;
  else
    v_decision := 'reject';
    for v_model in
      select m.id, m.tenant_id, m.name, m.make, m.model
      from platform.models m
      where m.catalog_id = p_catalog_id
      order by m.created_at, m.id
    loop
      if exists (
        select 1 from platform.models o
        where o.tenant_id = v_model.tenant_id
          and o.catalog_id is null
          and o.id <> v_model.id
          and platform_private.norm(o.make) = platform_private.norm(v_model.make)
          and platform_private.norm(o.model) = platform_private.norm(v_model.model)
      ) then
        -- The shop already has this make and model as its own: giving this
        -- one back too would make two. It stays linked, unlisted.
        v_kept := v_kept || jsonb_build_object('model_id', v_model.id, 'name', v_model.name);
        update platform.models
        set catalog_rejected_at = now(), catalog_reject_reason = v_notes
        where id = v_model.id;
      else
        update platform.models
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
$$;

-- The CSV import, as in 20261111000300, plus each new model's categories.
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

  insert into platform.models (id, tenant_id, catalog_id, name, make, model, vehicle_type, cc, transmission, categories)
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
