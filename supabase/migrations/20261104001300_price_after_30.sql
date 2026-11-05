-- Price per day after the first 30 days (owner decision, 2026-11-04).
-- Shorter rentals cost more per day, so repeating the day table for a second
-- month overcharged long rentals. Every bike model now needs a daily price for
-- days 31+ (see lib/pricing.ts priceForDays). Null only on models that haven't
-- been priced yet; shop_readiness treats that as missing prices.

alter table public.bike_models
  add column price_after_30 int check (price_after_30 between 1 and 1000000);

grant insert (price_after_30) on public.bike_models to authenticated;
grant update (price_after_30) on public.bike_models to authenticated;

create or replace function public.shop_readiness(p_shop_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  missing text[] := '{}';
  s public.shops;
begin
  if (select auth.uid()) is not null and not public.is_shop_member(p_shop_id) then
    raise exception 'not a member of this shop' using errcode = '42501';
  end if;
  select * into s from public.shops where id = p_shop_id;
  if not found then
    raise exception 'shop not found' using errcode = 'P0002';
  end if;

  if s.about is null or length(trim(s.about)) < 20 then
    missing := missing || 'about'::text;
  end if;
  if cardinality(s.photos) = 0 then
    missing := missing || 'shop_photo'::text;
  end if;
  if s.location is null then
    missing := missing || 'location'::text;
  end if;
  if not exists (select 1 from public.shop_hours where shop_id = p_shop_id) then
    missing := missing || 'hours'::text;
  end if;
  if not exists (
    select 1 from public.shop_contacts
    where shop_id = p_shop_id
      and coalesce(whatsapp, line_id, phone) is not null
  ) then
    missing := missing || 'contact'::text;
  end if;
  if not exists (
    select 1 from public.bike_models where shop_id = p_shop_id and visible
  ) then
    missing := missing || 'model'::text;
  end if;
  if exists (
    select 1 from public.bike_models
    where shop_id = p_shop_id and visible and cardinality(photos) = 0
  ) then
    missing := missing || 'model_photo'::text;
  end if;
  if exists (
    select 1 from public.bike_models m
    where m.shop_id = p_shop_id and m.visible
      and (
        m.price_after_30 is null
        or (select count(*) from public.price_days p where p.bike_model_id = m.id) < 30
      )
  ) then
    missing := missing || 'model_prices'::text;
  end if;
  return missing;
end;
$$;

create or replace function public.flag_bike_model_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and public.is_shop_live(new.shop_id)
    and (
      tg_op = 'INSERT'
      or new.catalog_id is distinct from old.catalog_id
      or new.photos is distinct from old.photos
      or new.deposit_amount is distinct from old.deposit_amount
      or new.price_after_30 is distinct from old.price_after_30
    )
  then
    new.flagged_for_review := true;
  end if;
  return new;
end;
$$;
