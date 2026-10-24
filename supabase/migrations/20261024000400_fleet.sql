-- Bike models (tracked per model with a quantity) and their day-price tables
-- (SPEC "Fleet management", "Pricing").

create table public.bike_models (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  make text not null,
  model text not null,
  year_from smallint check (year_from between 1950 and 2100),
  year_to smallint check (year_to between 1950 and 2100),
  type public.bike_type not null,
  transmission public.transmission not null,
  cc smallint not null check (cc > 0),
  -- At least 1 photo is required at submission (Phase 2), up to 8.
  photos text[] not null default '{}' check (cardinality(photos) <= 8),
  qty int not null check (qty >= 0),
  booking_mode public.booking_mode not null default 'instant',
  -- Null = use the shop default.
  buffer_before_h int check (buffer_before_h >= 0),
  buffer_after_h int check (buffer_after_h >= 0),
  ready_today_on boolean not null default false,
  ready_today_count int not null default 0 check (ready_today_count >= 0),
  ready_today_updated_at timestamptz,
  downtime_count int not null default 0 check (downtime_count >= 0),
  downtime_until date,
  visible boolean not null default true,
  flagged_for_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (year_to is null or year_from is null or year_to >= year_from),
  -- TODO(phase-4): also subtract bikes currently on rent.
  check (ready_today_count + downtime_count <= qty)
);

create index bike_models_shop_id_idx on public.bike_models (shop_id);

create trigger bike_models_set_updated_at
before update on public.bike_models
for each row execute function public.set_updated_at();

create table public.price_days (
  bike_model_id uuid not null references public.bike_models (id) on delete cascade,
  day smallint not null check (day between 1 and 30),
  total int not null check (total >= 0),
  is_anchor boolean not null default false,
  is_manual boolean not null default false,
  primary key (bike_model_id, day)
);

-- A model is public when it is visible and its shop is live.
create function public.is_bike_model_public(p_bike_model_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bike_models m
    join public.shops s on s.id = m.shop_id
    where m.id = p_bike_model_id and m.visible and s.status = 'live'
  );
$$;

create function public.bike_model_shop_id(p_bike_model_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select shop_id from public.bike_models where id = p_bike_model_id;
$$;

-- RLS --------------------------------------------------------------------

alter table public.bike_models enable row level security;
alter table public.price_days enable row level security;

-- Staff manage the fleet too. flagged_for_review is admin-controlled.
revoke insert, update on public.bike_models from anon, authenticated;
grant insert (
  shop_id, make, model, year_from, year_to, type, transmission, cc, photos, qty,
  booking_mode, buffer_before_h, buffer_after_h, ready_today_on, ready_today_count,
  ready_today_updated_at, downtime_count, downtime_until, visible
) on public.bike_models to authenticated;
grant update (
  make, model, year_from, year_to, type, transmission, cc, photos, qty,
  booking_mode, buffer_before_h, buffer_after_h, ready_today_on, ready_today_count,
  ready_today_updated_at, downtime_count, downtime_until, visible
) on public.bike_models to authenticated;

create policy "Anyone reads visible models of live shops"
on public.bike_models for select to anon, authenticated
using (visible and public.is_shop_live(shop_id));

create policy "Members read their shop's models"
on public.bike_models for select to authenticated
using (public.is_shop_member(shop_id));

create policy "Members add models to their shop"
on public.bike_models for insert to authenticated
with check (public.is_shop_member(shop_id));

create policy "Members update their shop's models"
on public.bike_models for update to authenticated
using (public.is_shop_member(shop_id))
with check (public.is_shop_member(shop_id));

create policy "Members delete their shop's models"
on public.bike_models for delete to authenticated
using (public.is_shop_member(shop_id));

create policy "Anyone reads prices of public models"
on public.price_days for select to anon, authenticated
using (public.is_bike_model_public(bike_model_id));

create policy "Members read their shop's prices"
on public.price_days for select to authenticated
using (public.is_shop_member(public.bike_model_shop_id(bike_model_id)));

create policy "Members write their shop's prices"
on public.price_days for all to authenticated
using (public.is_shop_member(public.bike_model_shop_id(bike_model_id)))
with check (public.is_shop_member(public.bike_model_shop_id(bike_model_id)));
