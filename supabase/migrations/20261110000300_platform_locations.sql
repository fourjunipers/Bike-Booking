-- Platform Phase 1a: locations (docs/platform/SPEC.md › Review decisions ›
-- Locations; docs/platform/MAPPING.md §1–2).
--
-- Time zone, address, map pin, opening hours, closures, contacts and market
-- belong to a location, not the tenant. Every tenant has exactly one default
-- location from the moment it exists. Nothing here assumes a country.

create table platform.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  is_default boolean not null default false,
  -- IANA time zone, e.g. Asia/Bangkok. Checked by locations_check_timezone.
  timezone text not null,
  -- Free-form, any country's format.
  address text check (length(address) <= 500),
  geo extensions.geography (point, 4326),
  maps_url text check (length(maps_url) <= 500),
  google_place_id text check (length(google_place_id) <= 300),
  -- International format, e.g. +66850550247. Shown to a renter only after a
  -- confirmed booking (docs/INTEGRATION.md §3.4).
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  whatsapp text check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  line_id text check (length(line_id) <= 100),
  email text check (length(email) <= 200),
  -- The Moto Mangos market this address falls in. Empty until the
  -- marketplace's markets table arrives at Phase 3M, which adds the reference.
  market_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create unique index locations_one_default_idx on platform.locations (tenant_id) where is_default;
create unique index locations_name_idx on platform.locations (tenant_id, lower(btrim(name)));

create trigger locations_set_updated_at
before update on platform.locations
for each row execute function platform_private.set_updated_at();

create trigger locations_audit
after insert or update or delete on platform.locations
for each row execute function platform_private.audit_row();

-- Time zone: a real IANA name, and only an owner may change it (it moves
-- every opening hour and due date of the location).
drop trigger tenants_check_timezone on platform.tenants;

create or replace function platform_private.check_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform now() at time zone new.timezone;
  exception
    when invalid_parameter_value then
      raise exception 'Unknown time zone: %', new.timezone using errcode = '22023';
  end;

  if tg_op = 'UPDATE'
    and new.timezone is distinct from old.timezone
    and (select auth.uid()) is not null
    and platform_private.my_role(new.tenant_id) is distinct from 'owner'
  then
    raise exception 'Only an owner can change a location''s time zone'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger locations_check_timezone
before insert or update of timezone on platform.locations
for each row execute function platform_private.check_timezone();

-- The default location can't be deleted or un-defaulted on its own.
create function platform_private.locations_keep_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_default and exists (select 1 from platform.tenants where id = old.tenant_id) then
      raise exception 'A shop keeps its default location' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.is_default and not new.is_default
    and not exists (
      select 1 from platform.locations
      where tenant_id = new.tenant_id and is_default and id <> new.id
    )
  then
    raise exception 'A shop keeps its default location' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger locations_keep_default
before delete or update of is_default on platform.locations
for each row execute function platform_private.locations_keep_default();

-- Opening hours: wall-clock times in the location's time zone. 0 = Sunday.
create table platform.location_hours (
  tenant_id uuid not null,
  location_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  open time not null,
  close time not null,
  primary key (location_id, weekday),
  foreign key (tenant_id, location_id) references platform.locations (tenant_id, id) on delete cascade,
  check (close > open)
);

create trigger location_hours_audit
after insert or update or delete on platform.location_hours
for each row execute function platform_private.audit_row('location_id');

-- Closures, including ones that repeat every year on the same dates
-- (@mango/core closures): start_date/end_date hold the first year.
create table platform.location_closures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  start_date date not null,
  end_date date not null,
  note text check (length(note) <= 200),
  repeats_yearly boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references platform.locations (tenant_id, id) on delete cascade,
  check (end_date >= start_date),
  check (not repeats_yearly or end_date - start_date < 365)
);

create index location_closures_location_idx on platform.location_closures (location_id, start_date);

create trigger location_closures_audit
after insert or update or delete on platform.location_closures
for each row execute function platform_private.audit_row();

-- Existing tenants: their time zone moves to a default location ------------------

insert into platform.locations (tenant_id, name, is_default, timezone)
select id, name, true, timezone from platform.tenants;

alter table platform.tenants
  drop column timezone,
  -- How distances are shown. They are always stored in km.
  add column distance_unit text not null default 'km' check (distance_unit in ('km', 'mi')),
  -- Money rows reference (tenant_id, currency), so an amount can't be saved in
  -- another currency than the shop's.
  add constraint tenants_id_currency_key unique (id, currency);

revoke update on platform.tenants from authenticated;
grant update (name, country, currency, locale, distance_unit) on platform.tenants to authenticated;

-- Every tenant has a default location: checked when the transaction ends.
create function platform_private.tenants_need_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from platform.tenants where id = new.id)
    and not exists (
      select 1 from platform.locations where tenant_id = new.id and is_default
    )
  then
    raise exception 'A shop needs a default location; create it with platform.create_tenant'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger tenants_need_location
after insert on platform.tenants
deferrable initially deferred
for each row execute function platform_private.tenants_need_location();

-- The only way to create a tenant: the shop and its default location together.
-- Sign-up (Phase 11) and the seed call it with the service role.
create function platform.create_tenant(
  p_name text,
  p_slug text,
  p_country text,
  p_currency text,
  p_locale text,
  p_timezone text,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  insert into platform.tenants (id, name, slug, country, currency, locale)
  values (v_id, p_name, p_slug, p_country, p_currency, p_locale);
  insert into platform.locations (tenant_id, name, is_default, timezone)
  values (v_id, p_name, true, p_timezone);
  return v_id;
end;
$$;

revoke all on function platform.create_tenant(text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function platform.create_tenant(text, text, text, text, text, text, uuid) to service_role;

-- RLS ------------------------------------------------------------------------------
-- Every member reads; owners and managers write.

alter table platform.locations enable row level security;
alter table platform.location_hours enable row level security;
alter table platform.location_closures enable row level security;

grant select, insert, update, delete on platform.locations, platform.location_hours, platform.location_closures to authenticated;

create policy "Members read locations"
on platform.locations for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids())::uuid[]));
create policy "Owners and managers add locations"
on platform.locations for insert to authenticated
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers change locations"
on platform.locations for update to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]))
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers remove locations"
on platform.locations for delete to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));

create policy "Members read opening hours"
on platform.location_hours for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids())::uuid[]));
create policy "Owners and managers add opening hours"
on platform.location_hours for insert to authenticated
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers change opening hours"
on platform.location_hours for update to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]))
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers remove opening hours"
on platform.location_hours for delete to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));

create policy "Members read closures"
on platform.location_closures for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids())::uuid[]));
create policy "Owners and managers add closures"
on platform.location_closures for insert to authenticated
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers change closures"
on platform.location_closures for update to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]))
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers remove closures"
on platform.location_closures for delete to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
