-- Value sets added in Phase 2: bike catalog, structured "What's included",
-- deposits and shop extras (SPEC "Vendor onboarding and shop setup",
-- "Fleet management").

create type public.catalog_status as enum ('requested', 'approved', 'rejected');
create type public.key_type as enum ('keyless', 'keyed');

create type public.helmet_type as enum ('full_face', 'three_quarter', 'half');
-- Gloves, jacket, rain gear.
create type public.gear_option as enum ('included', 'paid_extra', 'not_offered');
create type public.usage_area as enum ('bangkok', 'province', 'thailand', 'cross_border');
create type public.deposit_method as enum ('cash', 'card_authorisation', 'bank_transfer');
create type public.passport_policy as enum ('held', 'copy_only');

-- Extras are a flat price per rental, or time-based (1/7/30-day prices,
-- filled like bike prices by lib/pricing.ts).
create type public.extra_price_kind as enum ('rental', 'time');

-- "Honda PCX 160" → "honda-pcx-160". Non-Latin text yields an empty string,
-- so callers supply a fallback.
create function public.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- Text → uuid, or null when it isn't one (storage paths, user input).
create function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;
