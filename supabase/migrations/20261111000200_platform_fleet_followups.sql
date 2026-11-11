-- Platform Phase 1a follow-ups (owner, 11 Nov 2026).
--
-- * Units: a model year; "first registered", the "borrowed" status and its
--   active-from/active-to window are removed.
-- * Odometer: a lower reading is no longer refused for staff and mechanics
--   (the app asks them to confirm; the audit trail records who and what).
-- * Model-year bands: each shop's own year ranges per model, for the fleet list.
-- * Tax and insurance renewals: the minimum log (kind, provider, reference,
--   cost, start, expiry), reminder settings per shop, and an outbox the
--   reminders are queued in until a sender exists.

-- Units ---------------------------------------------------------------------------

-- Keep what the dropped column said about the bike's age, where there's nothing better.
alter table platform.units
  add column model_year smallint check (model_year between 1950 and 2100);

update platform.units
set model_year = extract(year from first_registered)::smallint
where first_registered is not null
  and extract(year from first_registered) between 1950 and 2100;

-- No shop has borrowed units yet; any that exist become ordinary active bikes.
update platform.units set status = 'active' where status = 'borrowed';

alter table platform.units
  drop constraint units_status_check,
  add constraint units_status_check check (status in ('active', 'maintenance', 'retired', 'sold')),
  drop column first_registered,
  -- Also drops the check that compared the two dates.
  drop column active_from,
  drop column active_to;

create index units_model_year_idx on platform.units (tenant_id, model_id, model_year);

-- What each role may change. Owners and managers change anything. Staff and
-- mechanics change only the odometer (up or down) and switch a unit between
-- active and maintenance.
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

-- CSV import: model_year replaces first_registered.
--   p_units: [{model_id, location_id, plate, plate_pending, frame_number,
--              engine_number, colour, model_year, current_odometer_km,
--              purchase_date, purchase_price, purchased_from}]
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

  insert into platform.models (id, tenant_id, catalog_id, name)
  select m.id, p_tenant_id, m.catalog_id, m.name
  from jsonb_to_recordset(coalesce(p_models, '[]')) as m (id uuid, catalog_id uuid, name text);
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

-- Model-year bands -------------------------------------------------------------------
-- A shop's own year ranges for one of its models, e.g. 2014–2019, 2020–2023,
-- 2024–2026. Only for grouping the fleet list; a model with none shows one
-- group for all years.

create table platform.model_year_bands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants (id) on delete cascade,
  model_id uuid not null,
  year_from smallint not null check (year_from between 1950 and 2100),
  year_to smallint not null check (year_to between 1950 and 2100),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, model_id) references platform.models (tenant_id, id) on delete cascade,
  check (year_to >= year_from),
  -- A year belongs to one band of a model at most.
  constraint model_year_bands_no_overlap
    exclude using gist (model_id with =, int4range(year_from, year_to, '[]') with &&)
);

create trigger model_year_bands_audit after insert or update or delete on platform.model_year_bands
for each row execute function platform_private.audit_row();

alter table platform.model_year_bands enable row level security;
grant select, insert, update, delete on platform.model_year_bands to authenticated;

create policy "Members read year bands"
on platform.model_year_bands for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids())::uuid[]));
create policy "Owners and managers add year bands"
on platform.model_year_bands for insert to authenticated
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers change year bands"
on platform.model_year_bands for update to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]))
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers remove year bands"
on platform.model_year_bands for delete to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));

-- Tax and insurance renewals -----------------------------------------------------------
-- Every renewal is a record; the latest expiry of each kind is the current one
-- (SPEC › Fleet › Tax and insurance log). Everyone in the shop reads the
-- dates. The cost is money, so it sits in its own table that only owners and
-- managers read, like purchase prices.

create table platform.unit_renewals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants (id) on delete cascade,
  unit_id uuid not null,
  kind text not null
    check (kind in ('road_tax', 'compulsory_insurance', 'voluntary_insurance', 'inspection')),
  provider text check (length(provider) <= 200),
  reference_no text check (length(reference_no) <= 100),
  starts_at date,
  expires_at date not null,
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, unit_id) references platform.units (tenant_id, id) on delete cascade,
  check (starts_at is null or expires_at >= starts_at)
);

create index unit_renewals_unit_idx on platform.unit_renewals (tenant_id, unit_id, kind, expires_at desc);

create table platform.unit_renewal_costs (
  renewal_id uuid primary key,
  tenant_id uuid not null references platform.tenants (id) on delete cascade,
  currency text not null,
  -- Minor units of currency.
  cost bigint not null check (cost >= 0),
  foreign key (tenant_id, renewal_id) references platform.unit_renewals (tenant_id, id) on delete cascade,
  foreign key (tenant_id, currency) references platform.tenants (id, currency)
);

create trigger unit_renewals_set_updated_at before update on platform.unit_renewals
for each row execute function platform_private.set_updated_at();
create trigger unit_renewals_audit after insert or update or delete on platform.unit_renewals
for each row execute function platform_private.audit_row();
create trigger unit_renewal_costs_audit after insert or update or delete on platform.unit_renewal_costs
for each row execute function platform_private.audit_row('renewal_id');

alter table platform.unit_renewals enable row level security;
alter table platform.unit_renewal_costs enable row level security;
grant select, insert, update, delete on platform.unit_renewals, platform.unit_renewal_costs to authenticated;

-- Renewals: every member reads; owners, managers, staff and mechanics record them.
create policy "Members read renewals"
on platform.unit_renewals for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids())::uuid[]));
create policy "Shop staff add renewals"
on platform.unit_renewals for insert to authenticated
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager,staff,mechanic}'))::uuid[]));
create policy "Shop staff change renewals"
on platform.unit_renewals for update to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager,staff,mechanic}'))::uuid[]))
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager,staff,mechanic}'))::uuid[]));
create policy "Owners and managers remove renewals"
on platform.unit_renewals for delete to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));

-- Costs: owners and managers only, for everything.
create policy "Owners and managers read renewal costs"
on platform.unit_renewal_costs for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers add renewal costs"
on platform.unit_renewal_costs for insert to authenticated
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers change renewal costs"
on platform.unit_renewal_costs for update to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]))
with check (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));
create policy "Owners and managers remove renewal costs"
on platform.unit_renewal_costs for delete to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));

-- A renewal cost is money too, so it locks the currency like the others.
create or replace function platform_private.tenants_lock_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from platform.models where tenant_id = new.id and deposit is not null)
    or exists (select 1 from platform.unit_financials where tenant_id = new.id)
    or exists (select 1 from platform.unit_renewal_costs where tenant_id = new.id)
  then
    raise exception 'currency_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function platform.currency_locked(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select platform_private.is_member(p_tenant_id) and (
    exists (select 1 from platform.models where tenant_id = p_tenant_id and deposit is not null)
    or exists (select 1 from platform.unit_financials where tenant_id = p_tenant_id)
    or exists (select 1 from platform.unit_renewal_costs where tenant_id = p_tenant_id)
  );
$$;

-- Reminder settings ------------------------------------------------------------------------

alter table platform.tenants
  -- Days before an expiry when a reminder is due. The largest also decides
  -- when a renewal first shows on the dashboard.
  add column renewal_reminder_days int[] not null default '{45,30,14,7}'
    check (
      cardinality(renewal_reminder_days) <= 10
      and 0 < all (renewal_reminder_days)
      and 366 > all (renewal_reminder_days)
    ),
  -- Day of the month for a digest of everything expiring that month. Null = off.
  add column renewal_digest_day smallint check (renewal_digest_day between 1 and 28);

grant update (renewal_reminder_days, renewal_digest_day) on platform.tenants to authenticated;

-- Notification outbox -----------------------------------------------------------------------
-- Messages waiting for a sender. Nothing sends yet: email and LINE plumbing
-- arrive with Phase 3 (jobs + outbox + email) and Phase 6 (LINE). Rows are
-- written by database functions only; (tenant_id, dedupe_key) makes queueing
-- safe to repeat.

create table platform.notification_outbox (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references platform.tenants (id) on delete cascade,
  kind text not null check (kind in ('renewal_reminder', 'renewal_expired', 'renewal_digest')),
  dedupe_key text not null,
  -- What the message is about; the sender turns it into words per language.
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (tenant_id, dedupe_key)
);

create index notification_outbox_queued_idx on platform.notification_outbox (created_at)
  where status = 'queued';

alter table platform.notification_outbox enable row level security;
grant select on platform.notification_outbox to authenticated;

create policy "Owners and managers read their outbox"
on platform.notification_outbox for select to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));

-- Queues what is due, for every shop. "Today" is the calendar date at the
-- bike's location. For each bike and kind only the latest renewal counts, and
-- sold or retired bikes are left out.
--  * reminder: once per reminder day reached (45, 30, 14, 7 by default). A
--    record added late queues only the nearest one, not the ones it skipped.
--  * expired: once, the day after the expiry date.
--  * digest: once a month from the shop's chosen day, listing what expires
--    that month, if anything does.
-- Returns how many messages were added.
create function platform_private.queue_renewal_notifications(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_added int := 0;
  v_rows int;
begin
  create temporary table renewal_now on commit drop as
  select distinct on (r.unit_id, r.kind)
    r.id, r.tenant_id, r.unit_id, r.kind, r.expires_at, u.plate,
    (p_now at time zone l.timezone)::date as today,
    t.renewal_reminder_days
  from platform.unit_renewals r
  join platform.units u on u.id = r.unit_id
  join platform.locations l on l.id = u.location_id
  join platform.tenants t on t.id = r.tenant_id
  where u.status not in ('sold', 'retired')
  order by r.unit_id, r.kind, r.expires_at desc;

  insert into platform.notification_outbox (tenant_id, kind, dedupe_key, payload)
  select n.tenant_id, 'renewal_reminder', 'renewal:' || n.id || ':' || d.days,
    jsonb_build_object('renewal_id', n.id, 'unit_id', n.unit_id, 'plate', n.plate,
      'renewal_kind', n.kind, 'expires_at', n.expires_at, 'days_before', d.days)
  from renewal_now n
  cross join lateral (
    select min(x) as days from unnest(n.renewal_reminder_days) x where n.expires_at - x <= n.today
  ) d
  where d.days is not null and n.expires_at >= n.today
  on conflict (tenant_id, dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  v_added := v_added + v_rows;

  insert into platform.notification_outbox (tenant_id, kind, dedupe_key, payload)
  select n.tenant_id, 'renewal_expired', 'renewal:' || n.id || ':expired',
    jsonb_build_object('renewal_id', n.id, 'unit_id', n.unit_id, 'plate', n.plate,
      'renewal_kind', n.kind, 'expires_at', n.expires_at)
  from renewal_now n
  where n.expires_at < n.today
  on conflict (tenant_id, dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  v_added := v_added + v_rows;

  insert into platform.notification_outbox (tenant_id, kind, dedupe_key, payload)
  select t.id, 'renewal_digest', 'digest:' || to_char(d.today, 'YYYY-MM'),
    jsonb_build_object('month', to_char(d.today, 'YYYY-MM'), 'items', i.items)
  from platform.tenants t
  join platform.locations l on l.tenant_id = t.id and l.is_default
  cross join lateral (select (p_now at time zone l.timezone)::date as today) d
  cross join lateral (
    select jsonb_agg(jsonb_build_object('renewal_id', n.id, 'unit_id', n.unit_id, 'plate', n.plate,
        'renewal_kind', n.kind, 'expires_at', n.expires_at) order by n.expires_at, n.plate) as items
    from renewal_now n
    where n.tenant_id = t.id
      and date_trunc('month', n.expires_at::timestamp) = date_trunc('month', d.today::timestamp)
  ) i
  where t.renewal_digest_day is not null
    and extract(day from d.today) >= t.renewal_digest_day
    and i.items is not null
  on conflict (tenant_id, dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  v_added := v_added + v_rows;

  drop table renewal_now;
  return v_added;
end;
$$;

revoke all on function platform_private.queue_renewal_notifications(timestamptz) from public, anon, authenticated;
grant execute on function platform_private.queue_renewal_notifications(timestamptz) to service_role;

-- The same, callable over the API by the service role (tests, and the jobs
-- runner when Phase 3 builds one).
create function platform.queue_renewal_notifications(p_now timestamptz default now())
returns int
language sql
security definer
set search_path = ''
as $$
  select platform_private.queue_renewal_notifications(p_now);
$$;

revoke all on function platform.queue_renewal_notifications(timestamptz) from public, anon, authenticated;
grant execute on function platform.queue_renewal_notifications(timestamptz) to service_role;

-- Run it every hour with Supabase Cron (pg_cron), the scheduler the spec names
-- for background jobs. Hourly, because "today" differs by time zone. Where the
-- extension isn't available the queue simply isn't filled on a schedule.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'platform-renewal-notifications',
      '7 * * * *',
      'select platform_private.queue_renewal_notifications()'
    );
  else
    raise notice 'pg_cron is not available: renewal notifications are not queued on a schedule';
  end if;
end;
$$;
