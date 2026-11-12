-- Platform Phase 1a: link to the one vehicle catalog (docs/platform/SPEC.md ›
-- Review decisions › Legacy mapping; docs/platform/MAPPING.md §3).
--
-- public.bike_catalog stays the only catalog. This adds the path for cars
-- (vehicle type + a specs field) and lets a platform shop request a missing
-- entry and use its own pending request. Nothing the marketplace reads changes:
-- the new columns have defaults and its queries don't name them.

-- Platform-wide reference data (no tenant): what kinds of vehicle exist and
-- which specs each has. Anyone may read it, like approved catalog entries.
create table public.vehicle_types (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null,
  -- JSON Schema for bike_catalog.specs of this type.
  spec_schema jsonb not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.vehicle_types (key, name, spec_schema) values
  ('motorbike', 'Motorbike', '{"type": "object", "properties": {}}'),
  ('car', 'Car', '{
    "type": "object",
    "properties": {
      "seats": {"type": "integer", "minimum": 1, "maximum": 20},
      "doors": {"type": "integer", "minimum": 1, "maximum": 6},
      "fuel_type": {"enum": ["petrol", "diesel", "hybrid", "electric"]},
      "luggage_litres": {"type": "integer", "minimum": 0}
    }
  }');

alter table public.vehicle_types enable row level security;
revoke insert, update, delete on public.vehicle_types from anon, authenticated;
grant select on public.vehicle_types to anon, authenticated;

-- Reference data with no tenant and nothing private in it, so it is open to
-- read. (The no-open-policy rule covers tenant data in the platform schema.)
create policy "Anyone reads vehicle types"
on public.vehicle_types for select to anon, authenticated
using (true);

alter table public.bike_catalog
  add column vehicle_type text not null default 'motorbike' references public.vehicle_types (key),
  -- Specs that aren't bike columns (a car's seats, fuel type…), by the type's schema.
  add column specs jsonb not null default '{}' check (jsonb_typeof(specs) = 'object'),
  -- The platform shop that asked for this entry. Merged with
  -- requested_by_shop_id at Phase 3M, when a shop's tenant takes its UUID.
  add column requested_by_tenant_id uuid references platform.tenants (id) on delete set null;

create index bike_catalog_requested_by_tenant_idx on public.bike_catalog (requested_by_tenant_id)
  where requested_by_tenant_id is not null;

create policy "Tenant members read their shop's catalog requests"
on public.bike_catalog for select to authenticated
using (requested_by_tenant_id = any ((select platform_private.my_tenant_ids())::uuid[]));

create policy "Platform admins read every catalog entry"
on public.bike_catalog for select to authenticated
using ((select platform_private.is_platform_admin()));

-- A shop can list an approved entry, or its own pending request.
create function platform_private.can_use_catalog(p_catalog_id uuid, p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bike_catalog
    where id = p_catalog_id
      and (status = 'approved' or (status = 'requested' and requested_by_tenant_id = p_tenant_id))
  );
$$;

-- An owner or manager asks for a missing entry. Returns its id.
create function platform.request_catalog_entry(
  p_tenant_id uuid,
  p_make text,
  p_model text,
  p_year_from int,
  p_year_to int,
  p_type public.bike_type,
  p_transmission public.transmission,
  p_cc int,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not platform_private.has_role(p_tenant_id, '{owner,manager}') then
    raise exception 'Only owners and managers can request a catalog entry'
      using errcode = '42501';
  end if;

  insert into public.bike_catalog (
    make, model, year_from, year_to, type, transmission, cc, request_note,
    status, requested_by_tenant_id
  )
  values (
    btrim(p_make), btrim(p_model), p_year_from, p_year_to, p_type, p_transmission, p_cc,
    nullif(btrim(p_note), ''), 'requested', p_tenant_id
  )
  returning id into v_id;

  perform platform_private.audit(p_tenant_id, 'bike_catalog', v_id::text, 'request',
    null, jsonb_build_object('make', btrim(p_make), 'model', btrim(p_model)));
  return v_id;
end;
$$;

-- A platform admin approves or rejects a request.
create function platform.review_catalog_request(p_catalog_id uuid, p_approve boolean, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not platform_private.is_platform_admin() then
    raise exception 'Only platform admins can review catalog entries'
      using errcode = '42501';
  end if;

  update public.bike_catalog
  set status = case when p_approve then 'approved' else 'rejected' end::public.catalog_status,
      review_notes = nullif(btrim(p_notes), ''),
      reviewed_at = now()
  where id = p_catalog_id and status = 'requested';
  if not found then
    raise exception 'Catalog request not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function platform.request_catalog_entry(uuid, text, text, int, int, public.bike_type, public.transmission, int, text) from public, anon;
revoke all on function platform.review_catalog_request(uuid, boolean, text) from public, anon;
grant execute on function platform.request_catalog_entry(uuid, text, text, int, int, public.bike_type, public.transmission, int, text) to authenticated;
grant execute on function platform.review_catalog_request(uuid, boolean, text) to authenticated;
