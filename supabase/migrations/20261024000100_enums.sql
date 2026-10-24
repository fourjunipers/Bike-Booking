-- Fixed value sets used across the schema (SPEC "Data model").

create type public.user_role as enum ('customer', 'vendor_staff', 'admin');
create type public.app_language as enum ('en', 'th');
create type public.notify_channel as enum ('email', 'whatsapp');

create type public.shop_status as enum ('draft', 'pending', 'live', 'suspended');
create type public.boost_level as enum ('featured', 'preferred', 'normal');
create type public.shop_member_role as enum ('owner', 'staff');

create type public.bike_type as enum (
  'city_scooter', 'touring', 'adventure', 'sport', 'classic', 'off_road'
);
create type public.transmission as enum ('automatic', 'semi_auto', 'manual');

-- How a bike model confirms bookings.
create type public.booking_mode as enum ('instant', 'request');
-- How a particular booking was made ("now" = Get your bike now).
create type public.booking_kind as enum ('instant', 'request', 'now');

create type public.booking_status as enum (
  'pending_vendor',
  'declined',
  'expired',
  'confirmed_unpaid',
  'paid',
  'picked_up',
  'returned',
  'cancelled_customer',
  'cancelled_vendor',
  'cancelled_unpaid',
  'no_show'
);
create type public.booking_actor as enum ('customer', 'vendor', 'admin', 'system');
create type public.payment_method as enum ('card', 'promptpay');

create type public.deposit_type as enum ('passport_held', 'cash_deposit', 'passport_copy');
create type public.licence_type as enum ('none', 'car', 'motorbike', 'international_permit');

create type public.promotion_kind as enum ('pct', 'fixed', 'long_rental', 'new_customer');

-- Shared trigger: keep updated_at current on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
