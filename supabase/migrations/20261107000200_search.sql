-- Phase 3: availability, prices for chosen dates, shop stats, ranking and
-- model-first search. Rules mirror lib/availability.ts, lib/pricing.ts,
-- lib/rental-days.ts and lib/ranking.ts; DB tests check they agree.
--
-- Bookings are private, so everything that counts them is security definer
-- and returns only numbers, never booking rows.

-- Ranking weights (admin setting) -----------------------------------------------

create table public.ranking_settings (
  id boolean primary key default true check (id),
  boost numeric(4, 3) not null default 0.30 check (boost >= 0),
  rating numeric(4, 3) not null default 0.20 check (rating >= 0),
  response numeric(4, 3) not null default 0.15 check (response >= 0),
  cancellation numeric(4, 3) not null default 0.15 check (cancellation >= 0),
  distance numeric(4, 3) not null default 0.20 check (distance >= 0),
  updated_at timestamptz not null default now()
);
insert into public.ranking_settings default values;

alter table public.ranking_settings enable row level security;
revoke insert, update, delete on public.ranking_settings from anon, authenticated;
create policy "Anyone reads ranking weights"
on public.ranking_settings for select to anon, authenticated using (true);

-- Price for a number of days (lib/pricing.ts priceForDays with dailyAfter30) --

create function public.rental_price(p_bike_model_id uuid, p_days int)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select m.price_after_30 as rate,
      (select total from public.price_days where bike_model_id = m.id and day = 30) as month
    from public.bike_models m
    where m.id = p_bike_model_id
  )
  select case
    when p_days is null or p_days < 1 then null
    when p_days <= 30 then
      (select total from public.price_days where bike_model_id = p_bike_model_id and day = p_days)
    when m.rate is null or m.month is null then null
    else m.month
      + ((p_days - 30) / 30) * least(30 * m.rate, m.month)
      + least(((p_days - 30) % 30) * m.rate, m.month)
  end
  from m;
$$;

grant execute on function public.rental_price(uuid, int) to anon, authenticated;

-- Rental days (lib/rental-days.ts): every started 24 hours is a day.
create function public.rental_days(p_start timestamptz, p_end timestamptz)
returns int
language sql
immutable
set search_path = ''
as $$
  select greatest(ceil(extract(epoch from (p_end - p_start)) / 86400.0)::int, 1);
$$;

grant execute on function public.rental_days(timestamptz, timestamptz) to anon, authenticated;

-- Availability (lib/availability.ts offerFor) ---------------------------------

-- Free units in the pool and how a new advance booking would confirm
-- ('instant', 'request' or null). Bookings holding a unit: confirmed_unpaid,
-- paid, picked_up. TODO(phase-7): pending delivery requests on Instant units.
create function public.model_offer(
  p_bike_model_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (free int, mode text)
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select bm.qty, bm.instant_qty, bm.request_qty,
      make_interval(hours => coalesce(bm.buffer_before_h, s.buffer_before_h)) as bb,
      make_interval(hours => coalesce(bm.buffer_after_h, s.buffer_after_h)) as ba
    from public.bike_models bm
    join public.shops s on s.id = bm.shop_id
    where bm.id = p_bike_model_id
  ),
  w as (select m.*, p_start - m.bb as ws, p_end + m.ba as we from m),
  held as (
    select b.start_at - w.bb as s, b.end_at + w.ba as e, b.mode
    from public.bookings b, w
    where b.bike_model_id = p_bike_model_id
      and b.status in ('confirmed_unpaid', 'paid', 'picked_up')
      and b.start_at - w.bb < w.we
      and b.end_at + w.ba > w.ws
  ),
  pts as (
    select w.ws as p from w
    union select h.s from held h, w where h.s > w.ws and h.s < w.we
    union select h.e from held h, w where h.e > w.ws and h.e < w.we
    union
    select (d at time zone 'Asia/Bangkok')
    from w,
      generate_series(
        date_trunc('day', w.ws at time zone 'Asia/Bangkok') + interval '1 day',
        w.we at time zone 'Asia/Bangkok',
        interval '1 day'
      ) as d
    where (d at time zone 'Asia/Bangkok') < w.we
  ),
  counts as (
    select
      (select count(*) from held h where h.s <= pts.p and pts.p < h.e) as used,
      (select count(*) from held h where h.s <= pts.p and pts.p < h.e and h.mode = 'instant') as inst,
      (select count(*) from held h where h.s <= pts.p and pts.p < h.e and h.mode = 'request') as req,
      public.units_in_repair(p_bike_model_id, (pts.p at time zone 'Asia/Bangkok')::date) as rep
    from pts
  ),
  peak as (
    select coalesce(max(used + rep), 0) as used, coalesce(max(inst), 0) as inst,
      coalesce(max(req), 0) as req
    from counts
  )
  select greatest(w.qty - peak.used, 0)::int,
    case
      when w.qty - peak.used > 0 and peak.inst < w.instant_qty then 'instant'
      when w.qty - peak.used > 0 and peak.req < w.request_qty then 'request'
    end
  from w, peak;
$$;

grant execute on function public.model_offer(uuid, timestamptz, timestamptz) to anon, authenticated;

-- The longest walk-in rental in whole days from p_start (lib/availability.ts
-- longestWalkIn), up to p_max_days. 0 = none free now.
create function public.longest_walkin(
  p_bike_model_id uuid,
  p_start timestamptz,
  p_max_days int default 90
)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  days int := 0;
begin
  while days < p_max_days loop
    if (select o.free from public.model_offer(
          p_bike_model_id, p_start, p_start + make_interval(days => days + 1)) o) < 1 then
      exit;
    end if;
    days := days + 1;
  end loop;
  return days;
end;
$$;

grant execute on function public.longest_walkin(uuid, timestamptz, int) to anon, authenticated;

-- Opening hours and closures -------------------------------------------------------

-- Whether the shop is open at an instant (Bangkok weekday hours, no closure).
create function public.shop_open_at(p_shop_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shop_hours h
    where h.shop_id = p_shop_id
      and h.weekday = extract(dow from (p_at at time zone 'Asia/Bangkok'))::int
      and (p_at at time zone 'Asia/Bangkok')::time >= h.open
      and (p_at at time zone 'Asia/Bangkok')::time <= h.close
  )
  and not public.is_shop_closed_on(p_shop_id, (p_at at time zone 'Asia/Bangkok')::date);
$$;

grant execute on function public.shop_open_at(uuid, timestamptz) to anon, authenticated;

-- Shop stats for ranking --------------------------------------------------------

-- Platform rating, request response rate and vendor cancellation rate. Null
-- rates = no data yet (ranking treats them as neutral).
create function public.shop_stats(p_shop_id uuid)
returns table (
  rating numeric, review_count int, response_rate numeric, cancellation_rate numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select round(avg(r.rating), 2) from public.reviews r
      where r.shop_id = p_shop_id and not r.hidden),
    (select count(*)::int from public.reviews r
      where r.shop_id = p_shop_id and not r.hidden),
    (select case when count(*) = 0 then null
        else count(*) filter (where b.status <> 'expired')::numeric / count(*) end
      from public.bookings b
      where b.shop_id = p_shop_id and b.mode = 'request' and b.status <> 'pending_vendor'),
    (select case when count(*) = 0 then null
        else count(*) filter (where b.status = 'cancelled_vendor')::numeric / count(*) end
      from public.bookings b
      where b.shop_id = p_shop_id
        and b.status in ('confirmed_unpaid', 'paid', 'picked_up', 'returned',
          'cancelled_customer', 'cancelled_vendor', 'cancelled_unpaid', 'no_show'));
$$;

grant execute on function public.shop_stats(uuid) to anon, authenticated;

-- Search ---------------------------------------------------------------------------

-- One row per public shop offer (a shop's listing of one catalog model) that
-- matches. The app groups rows into one card per catalog model.
--   p_start/p_end   advance booking dates; null = no dates (1-day prices)
--   p_now           walk-ins: ready today, shop open, before the cut off
--   p_lat/p_lng     search location; null = no distance
--   p_radius_km     only shops this close (null = any distance)
create function public.search_offers(
  p_start timestamptz default null,
  p_end timestamptz default null,
  p_now boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_type public.bike_type default null,
  p_transmission public.transmission default null,
  p_cc_min int default null,
  p_cc_max int default null,
  p_price_max_day int default null,
  p_passport_not_held boolean default false,
  p_min_rating numeric default null,
  p_catalog_id uuid default null,
  p_shop_id uuid default null
)
returns table (
  bike_model_id uuid,
  shop_id uuid,
  shop_slug text,
  shop_name text,
  catalog_id uuid,
  catalog_slug text,
  make text,
  model text,
  year_from smallint,
  year_to smallint,
  cc smallint,
  type public.bike_type,
  transmission public.transmission,
  stock_photo text,
  photo text,
  boost public.boost_level,
  shop_lat double precision,
  shop_lng double precision,
  distance_km double precision,
  days int,
  total int,
  per_day int,
  deposit int,
  mode text,
  free_units int,
  ready_today boolean,
  ready_updated_at timestamptz,
  walkin_max_days int,
  rating numeric,
  review_count int,
  score double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  w public.ranking_settings;
  here extensions.geography;
  now_ts timestamptz := now();
begin
  select * into w from public.ranking_settings;
  if p_lat is not null and p_lng is not null then
    here := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;

  return query
  with base as (
    select
      m.id as model_id, s.id as sid, s.slug as sslug, s.name as sname,
      c.id as cid, c.slug as cslug, c.make, c.model, c.year_from, c.year_to, c.cc,
      c.type, c.transmission, c.stock_photo, m.photos[1] as photo, s.boost_level,
      extensions.st_y(s.location::extensions.geometry) as slat,
      extensions.st_x(s.location::extensions.geometry) as slng,
      case when here is null or s.location is null then null
        else extensions.st_distance(s.location, here) / 1000.0 end as km,
      m.qty, m.instant_qty, m.request_qty,
      m.ready_today_on, m.ready_today_count, m.ready_today_updated_at,
      coalesce(m.min_days_walkin, s.min_days_walkin) as min_walkin,
      coalesce(m.min_days_booking, s.min_days_booking) as min_booking,
      coalesce(m.notice_h, s.notice_h) as notice,
      s.cutoff_minutes,
      coalesce(m.deposit_amount, p.deposit_amount) as dep,
      coalesce(mp.passport, p.passport) as passport
    from public.bike_models m
    join public.shops s on s.id = m.shop_id
    join public.bike_catalog c on c.id = m.catalog_id
    left join public.shop_policies p on p.shop_id = s.id
    left join public.bike_model_policies mp on mp.bike_model_id = m.id
    where s.status = 'live'
      and m.visible
      and cardinality(m.photos) > 0
      and c.status = 'approved'
      and m.price_after_30 is not null
      and (select count(*) from public.price_days d where d.bike_model_id = m.id) = 30
      and (p_type is null or c.type = p_type)
      and (p_transmission is null or c.transmission = p_transmission)
      and (p_cc_min is null or c.cc >= p_cc_min)
      and (p_cc_max is null or c.cc <= p_cc_max)
      and (p_catalog_id is null or c.id = p_catalog_id)
      and (p_shop_id is null or s.id = p_shop_id)
  ),
  near as (
    select b.* from base b
    where p_radius_km is null or b.km is null or b.km <= p_radius_km
  ),
  timed as (
    select n.*,
      case
        when p_now then coalesce(public.rental_days(now_ts, p_end), n.min_walkin)
        when p_start is not null and p_end is not null then public.rental_days(p_start, p_end)
        else 1
      end as d
    from near n
  ),
  avail as (
    select t.*,
      o.free as free_units, o.mode as offer_mode,
      case when p_now then public.longest_walkin(t.model_id, now_ts) end as walkin_max
    from timed t
    left join lateral (
      select * from public.model_offer(
        t.model_id,
        coalesce(case when p_now then now_ts end, p_start, now_ts),
        coalesce(case when p_now then now_ts + make_interval(days => t.d) end, p_end,
          now_ts + interval '1 day')
      )
    ) o on true
  ),
  usable as (
    select a.* from avail a
    where case
      when p_now then
        a.ready_today_on and a.ready_today_count >= 1
        and public.shop_open_at(a.sid, now_ts)
        and exists (
          select 1 from public.shop_hours h
          where h.shop_id = a.sid
            and h.weekday = extract(dow from (now_ts at time zone 'Asia/Bangkok'))::int
            and (now_ts at time zone 'Asia/Bangkok')::time
              <= h.close - make_interval(mins => a.cutoff_minutes)
        )
        and a.d >= a.min_walkin
        and a.walkin_max >= a.d
      when p_start is not null and p_end is not null then
        a.offer_mode is not null
        and a.d >= a.min_booking
        and p_start >= now_ts + make_interval(hours => a.notice)
        and public.shop_open_at(a.sid, p_start)
        and public.shop_open_at(a.sid, p_end)
      else a.instant_qty + a.request_qty > 0 or a.ready_today_on
    end
  ),
  priced as (
    select u.*, public.rental_price(u.model_id, u.d) as price
    from usable u
  ),
  stats as (
    select pr.*, st.rating as r, st.review_count as rc, st.response_rate as rr,
      st.cancellation_rate as cr
    from priced pr
    left join lateral public.shop_stats(pr.sid) st on true
    where pr.price is not null
      and (p_price_max_day is null or ceil(pr.price::numeric / pr.d) <= p_price_max_day)
      and (not p_passport_not_held or pr.passport = 'copy_only')
      and (p_min_rating is null or (st.review_count >= 3 and st.rating >= p_min_rating))
  ),
  ranged as (
    select x.*, min(x.km) over () as kmin, max(x.km) over () as kmax from stats x
  )
  select
    z.model_id, z.sid, z.sslug, z.sname, z.cid, z.cslug, z.make, z.model,
    z.year_from, z.year_to, z.cc, z.type, z.transmission, z.stock_photo, z.photo,
    z.boost_level, z.slat, z.slng, z.km, z.d, z.price, ceil(z.price::numeric / z.d)::int, z.dep,
    case when p_now then 'now' else z.offer_mode end,
    z.free_units, z.ready_today_on and z.ready_today_count >= 1, z.ready_today_updated_at,
    z.walkin_max, z.r, z.rc,
    (
      w.boost * case z.boost_level when 'featured' then 1 when 'preferred' then 0.6 else 0.3 end
      + w.rating * case when z.r is null or z.rc < 3 then 0.5 else least(greatest((z.r - 1) / 4, 0), 1) end
      + w.response * coalesce(z.rr, 0.5)
      + w.cancellation * case when z.cr is null then 0.5 else 1 - z.cr end
      + w.distance * case
          when z.km is null or z.kmin is null then 0.5
          when z.kmax - z.kmin < 0.001 then 1
          else 1 - (z.km - z.kmin) / (z.kmax - z.kmin) end
    )::double precision
      / nullif(w.boost + w.rating + w.response + w.cancellation + w.distance, 0)
  from ranged z;
end;
$$;

grant execute on function public.search_offers(
  timestamptz, timestamptz, boolean, double precision, double precision, double precision,
  public.bike_type, public.transmission, int, int, int, boolean, numeric, uuid, uuid
) to anon, authenticated;
