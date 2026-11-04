-- Shop-defined paid extras (SPEC "Extras"): paid at the shop, never part of
-- the booking fee. Checkout selection and booking_extras come in Phase 4.
-- TODO(phase-4): booking_extras (copied at booking) and checkout totals.

create table public.shop_extras (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (length(description) <= 500),
  -- e.g. deductible and exclusions for damage/theft cover.
  terms text check (length(terms) <= 2000),
  price_kind public.extra_price_kind not null,
  price_rental int check (price_rental > 0),
  price_1d int check (price_1d > 0),
  price_7d int check (price_7d > 0),
  price_30d int check (price_30d > 0),
  all_models boolean not null default true,
  active boolean not null default true,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (price_kind = 'rental' and price_rental is not null
      and price_1d is null and price_7d is null and price_30d is null)
    or (price_kind = 'time' and price_rental is null and price_1d is not null)
  )
);

create index shop_extras_shop_id_idx on public.shop_extras (shop_id, sort);

create trigger shop_extras_set_updated_at
before update on public.shop_extras
for each row execute function public.set_updated_at();

create table public.shop_extra_models (
  extra_id uuid not null references public.shop_extras (id) on delete cascade,
  bike_model_id uuid not null references public.bike_models (id) on delete cascade,
  primary key (extra_id, bike_model_id)
);

create index shop_extra_models_model_idx on public.shop_extra_models (bike_model_id);

create function public.shop_extra_shop_id(p_extra_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select shop_id from public.shop_extras where id = p_extra_id;
$$;

-- RLS: pricing decisions, so owners write (like promotions); staff read.

alter table public.shop_extras enable row level security;
alter table public.shop_extra_models enable row level security;

create policy "Anyone reads active extras of live shops"
on public.shop_extras for select to anon, authenticated
using (active and public.is_shop_live(shop_id));

create policy "Members read their shop's extras"
on public.shop_extras for select to authenticated
using (public.is_shop_member(shop_id));

create policy "Owners write their shop's extras"
on public.shop_extras for all to authenticated
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

create policy "Anyone reads models of public extras"
on public.shop_extra_models for select to anon, authenticated
using (
  exists (
    select 1 from public.shop_extras e
    where e.id = extra_id and e.active and public.is_shop_live(e.shop_id)
  )
);

create policy "Members read their extra models"
on public.shop_extra_models for select to authenticated
using (public.is_shop_member(public.shop_extra_shop_id(extra_id)));

create policy "Owners write their extra models"
on public.shop_extra_models for all to authenticated
using (
  public.is_shop_owner(public.shop_extra_shop_id(extra_id))
  and public.bike_model_shop_id(bike_model_id) = public.shop_extra_shop_id(extra_id)
)
with check (
  public.is_shop_owner(public.shop_extra_shop_id(extra_id))
  and public.bike_model_shop_id(bike_model_id) = public.shop_extra_shop_id(extra_id)
);
