-- Fleet modes, repair entries, minimum rental length and advance notice
-- (owner decisions, 2026-11-05).
--
-- * A model's quantity is split three ways: instant_qty units confirm
--   automatically, request_qty units need the shop to accept, and the rest are
--   walk-ins only (never booked in advance). Ready for walk-ins stays a
--   separate count on top and can use any unit.
-- * Units in repair are separate entries, each with its own count and an
--   optional back-in-service date, instead of one count and one date.
-- * Minimum rental length (days) for walk-ins and for advance bookings, and
--   the minimum notice (hours) for advance bookings. Shop defaults on shops,
--   per-model overrides on bike_models (null = shop default). Walk-ins skip
--   the notice.
-- * The shop's own year fields on bike_models go: the catalog entry's year
--   range already says which bike it is.
-- * A shop lists each catalog entry once.

-- Mode split --------------------------------------------------------------------

alter table public.bike_models
  add column instant_qty int not null default 0 check (instant_qty >= 0),
  add column request_qty int not null default 0 check (request_qty >= 0);

update public.bike_models
set instant_qty = case when booking_mode = 'instant' then qty else 0 end,
    request_qty = case when booking_mode = 'request' then qty else 0 end;

alter table public.bike_models
  add constraint bike_models_mode_split_check check (instant_qty + request_qty <= qty),
  drop column booking_mode;

drop type public.booking_mode;

-- Repair entries -------------------------------------------------------------------

create table public.bike_model_downtime (
  id uuid primary key default gen_random_uuid(),
  bike_model_id uuid not null references public.bike_models (id) on delete cascade,
  units int not null check (units between 1 and 999),
  -- The units are back in service from this date. Null = not known yet.
  back_on date,
  note text check (length(note) <= 100),
  created_at timestamptz not null default now()
);

create index bike_model_downtime_model_idx on public.bike_model_downtime (bike_model_id);

insert into public.bike_model_downtime (bike_model_id, units, back_on)
select id, downtime_count, downtime_until
from public.bike_models
where downtime_count > 0;

alter table public.bike_models
  drop column downtime_count,
  drop column downtime_until,
  add constraint bike_models_ready_check check (ready_today_count <= qty);

alter table public.bike_model_downtime enable row level security;

-- Staff manage the fleet too. Not public: search reads it through security
-- definer functions (Phase 3).
create policy "Members read their models' repair entries"
on public.bike_model_downtime for select to authenticated
using (public.is_shop_member(public.bike_model_shop_id(bike_model_id)));
create policy "Members write their models' repair entries"
on public.bike_model_downtime for all to authenticated
using (public.is_shop_member(public.bike_model_shop_id(bike_model_id)))
with check (public.is_shop_member(public.bike_model_shop_id(bike_model_id)));

-- Units of a model in repair on a date (Bangkok calendar date).
create function public.units_in_repair(p_bike_model_id uuid, p_date date)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(units), 0)::int
  from public.bike_model_downtime
  where bike_model_id = p_bike_model_id
    and (back_on is null or back_on > p_date);
$$;

revoke execute on function public.units_in_repair(uuid, date) from public, anon;
grant execute on function public.units_in_repair(uuid, date) to authenticated;

-- Bookings that no longer fit once repairs are counted: on some day from
-- p_from, the bookings holding a unit plus the units in repair exceed the
-- quantity. Day granularity (buffers ignored), as a warning for the vendor.
-- Security invoker: the caller only sees bookings RLS lets them read.
create function public.repair_conflicts(p_bike_model_id uuid, p_from date)
returns table (booking_id uuid, code text, start_at timestamptz, end_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with model as (
    select qty from public.bike_models where id = p_bike_model_id
  ),
  held as (
    select b.id, b.code, b.start_at, b.end_at,
      (b.start_at at time zone 'Asia/Bangkok')::date as first_day,
      ((b.end_at - interval '1 second') at time zone 'Asia/Bangkok')::date as last_day
    from public.bookings b
    where b.bike_model_id = p_bike_model_id
      and b.status in ('confirmed_unpaid', 'paid', 'picked_up')
      and b.end_at > p_from::timestamp at time zone 'Asia/Bangkok'
  ),
  days as (
    select d::date as day
    from generate_series(p_from, p_from + 400, interval '1 day') as d
  ),
  over_days as (
    select days.day
    from days, model
    where (select coalesce(sum(h_qty.n), 0) from (
        select 1 as n from held h where days.day between h.first_day and h.last_day
      ) h_qty) + public.units_in_repair(p_bike_model_id, days.day) > model.qty
  )
  select distinct h.id, h.code, h.start_at, h.end_at
  from held h
  join over_days o on o.day between h.first_day and h.last_day
  order by h.start_at;
$$;

grant execute on function public.repair_conflicts(uuid, date) to authenticated;

-- Minimum rental length and advance notice -------------------------------------

alter table public.shops
  add column min_days_walkin smallint not null default 1 check (min_days_walkin between 1 and 365),
  add column min_days_booking smallint not null default 1 check (min_days_booking between 1 and 365),
  add column notice_h smallint not null default 0 check (notice_h between 0 and 720);

alter table public.bike_models
  add column min_days_walkin smallint check (min_days_walkin between 1 and 365),
  add column min_days_booking smallint check (min_days_booking between 1 and 365),
  add column notice_h smallint check (notice_h between 0 and 720),
  drop column year_from,
  drop column year_to;

grant update (min_days_walkin, min_days_booking, notice_h) on public.shops to authenticated;
grant insert (instant_qty, request_qty, min_days_walkin, min_days_booking, notice_h)
  on public.bike_models to authenticated;
grant update (instant_qty, request_qty, min_days_walkin, min_days_booking, notice_h)
  on public.bike_models to authenticated;

-- One listing per catalog entry per shop.
alter table public.bike_models
  add constraint bike_models_shop_catalog_key unique (shop_id, catalog_id);

-- Deposit refund timing is no longer asked (owner, 2026-11-05).
alter table public.shop_policies drop column deposit_refund_days;
alter table public.bike_model_policies drop column deposit_refund_days;
