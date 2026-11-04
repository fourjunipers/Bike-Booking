-- Prepared for other countries (owner decision, 4 Nov 2026). Every amount on
-- a shop, its models, prices, extras and bookings is a whole number in the
-- shop's currency. Thailand / THB only for now; nothing else reads these yet.
-- TODO(multi-country): per-country fee settings, money helpers per currency
-- (VND has no minor unit), time zone per country, country in URLs.

alter table public.shops
  -- ISO 3166-1 alpha-2.
  add column country text not null default 'TH' check (country ~ '^[A-Z]{2}$'),
  -- ISO 4217.
  add column currency text not null default 'THB' check (currency ~ '^[A-Z]{3}$');

create index shops_country_idx on public.shops (country, status);

-- A booking keeps the currency it was priced in, even if the shop's changes.
alter table public.bookings
  add column currency text not null default 'THB' check (currency ~ '^[A-Z]{3}$');

-- Bookings always take their shop's currency.
-- TODO(phase-4): the create-booking RPC sets this explicitly too.
create function public.booking_set_currency()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select currency into new.currency from public.shops where id = new.shop_id;
  return new;
end;
$$;

create trigger bookings_set_currency
before insert on public.bookings
for each row execute function public.booking_set_currency();

-- Country and currency are set by admin (service role), not by vendors: the
-- shops column grants from Phase 1/2 don't include them.
