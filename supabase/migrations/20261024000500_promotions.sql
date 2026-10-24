-- Shop promotions (SPEC "Vendor screens"; built out in Phase 7).
-- SPEC's model_ids array is a join table so models are real foreign keys.
-- TODO(phase-7): confirm how value is read for long_rental / new_customer.

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  kind public.promotion_kind not null,
  value int not null check (value > 0),
  min_days smallint check (min_days > 0),
  start_date date,
  end_date date,
  active boolean not null default true,
  all_models boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'pct' or value <= 100),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index promotions_shop_id_idx on public.promotions (shop_id);

create trigger promotions_set_updated_at
before update on public.promotions
for each row execute function public.set_updated_at();

create table public.promotion_models (
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  bike_model_id uuid not null references public.bike_models (id) on delete cascade,
  primary key (promotion_id, bike_model_id)
);

create function public.promotion_shop_id(p_promotion_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select shop_id from public.promotions where id = p_promotion_id;
$$;

-- RLS --------------------------------------------------------------------

alter table public.promotions enable row level security;
alter table public.promotion_models enable row level security;

create policy "Anyone reads active promotions of live shops"
on public.promotions for select to anon, authenticated
using (active and public.is_shop_live(shop_id));

create policy "Members read their shop's promotions"
on public.promotions for select to authenticated
using (public.is_shop_member(shop_id));

create policy "Owners write their shop's promotions"
on public.promotions for all to authenticated
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

create policy "Anyone reads models of public promotions"
on public.promotion_models for select to anon, authenticated
using (
  exists (
    select 1 from public.promotions p
    where p.id = promotion_id and p.active and public.is_shop_live(p.shop_id)
  )
);

create policy "Members read their promotion models"
on public.promotion_models for select to authenticated
using (public.is_shop_member(public.promotion_shop_id(promotion_id)));

create policy "Owners write their promotion models"
on public.promotion_models for all to authenticated
using (
  public.is_shop_owner(public.promotion_shop_id(promotion_id))
  and public.bike_model_shop_id(bike_model_id) = public.promotion_shop_id(promotion_id)
)
with check (
  public.is_shop_owner(public.promotion_shop_id(promotion_id))
  and public.bike_model_shop_id(bike_model_id) = public.promotion_shop_id(promotion_id)
);
