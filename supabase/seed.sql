-- Local development seed. Loaded by `npx supabase db reset`.
--
-- Sign in locally with a magic link for any of these emails and open the
-- link from Mailpit (http://127.0.0.1:54324):
--   admin@bike-booking.test     admin (also needs to be in ADMIN_EMAILS)
--   customer@bike-booking.test  customer with one booking at BSR
--   owner@bsr.test              BSR Bike Shop owner
--   staff@bsr.test              BSR Bike Shop staff
--   owner@draft-shop.test       owner of a draft shop the public can't see
--
-- TODO(owner): BSR's address, pin, hours, contacts, policies and fleet below
-- are PLACEHOLDERS. Replace with the real details.

-- Users ------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
  u.email, '', now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('name', u.name),
  now(), now(), '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@bike-booking.test', 'Platform Admin'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'customer@bike-booking.test', 'Test Customer'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'owner@bsr.test', 'BSR Owner'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'staff@bsr.test', 'BSR Staff'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'owner@draft-shop.test', 'Draft Shop Owner')
) as u (id, email, name);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email like '%.test';

-- profiles rows were created by the on_auth_user_created trigger.
update public.profiles set role = 'admin'
where id = 'a0000000-0000-4000-8000-000000000001';

update public.profiles set role = 'vendor_staff'
where id in (
  'a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000004',
  'a0000000-0000-4000-8000-000000000005'
);

update public.profiles
set whatsapp = '+61400000000', notify_channels = '{email,whatsapp}'
where id = 'a0000000-0000-4000-8000-000000000002';

-- BSR Bike Shop (live, PLACEHOLDER details) ------------------------------

insert into public.shops (
  id, name, slug, about, location, maps_url, nearest_station, status,
  boost_level, cutoff_minutes, buffer_before_h, buffer_after_h,
  request_window_min, submitted_at, approved_at, terms_accepted_at
) values (
  'b0000000-0000-4000-8000-000000000001',
  'BSR Bike Shop',
  'bsr-bike-shop',
  'PLACEHOLDER: scooter and motorbike rental near Phra Khanong BTS.',
  extensions.st_setsrid(extensions.st_makepoint(100.6017, 13.7149), 4326)::extensions.geography,
  'https://maps.google.com/?q=13.7149,100.6017',
  'Phra Khanong (BTS)',
  'live',
  'normal',
  120, 1, 1, 120,
  now(), now(), now()
);

insert into public.shop_contacts (shop_id, whatsapp, line_id)
values ('b0000000-0000-4000-8000-000000000001', '+66800000000', 'bsr-placeholder');

insert into public.shop_members (shop_id, user_id, role) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'owner'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'staff');

-- Open 09:00–19:00 every day.
insert into public.shop_hours (shop_id, weekday, open, close)
select 'b0000000-0000-4000-8000-000000000001', d, '09:00', '19:00'
from generate_series(0, 6) as d;

insert into public.shop_closures (shop_id, start_date, end_date, note)
values ('b0000000-0000-4000-8000-000000000001', '2027-04-13', '2027-04-15', 'Songkran (placeholder)');

insert into public.shop_policies (
  shop_id, deposit_type, deposit_amount, licence_required, helmets,
  insurance_type, phone_holder, rain_gear, notes
) values (
  'b0000000-0000-4000-8000-000000000001', 'cash_deposit', 3000, 'motorbike', 2,
  'Third-party', true, true,
  'PLACEHOLDER: return with the same fuel level. Late returns ฿100 per hour.'
);

insert into public.bike_models (
  id, shop_id, make, model, year_from, year_to, type, transmission, cc, qty,
  booking_mode, ready_today_on, ready_today_count, ready_today_updated_at,
  downtime_count
) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Honda', 'Click 125', 2022, 2025, 'city_scooter', 'automatic', 125, 6,
   'instant', true, 3, now(), 1),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'Honda', 'PCX 160', 2023, 2025, 'city_scooter', 'automatic', 160, 4,
   'instant', false, 0, now(), 0),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001',
   'Yamaha', 'XMAX 300', 2023, 2025, 'touring', 'automatic', 292, 2,
   'request', false, 0, null, 0);

-- Day prices filled linearly between anchors, rounded to the nearest ฿10
-- (SPEC "Pricing"). The PCX uses the SPEC example anchors.
-- TODO(phase-2): regenerate with lib/pricing.ts once it exists.
with anchors (bike_model_id, day, total) as (
  values
    ('c0000000-0000-4000-8000-000000000001'::uuid, 1, 250), ('c0000000-0000-4000-8000-000000000001'::uuid, 7, 1500),
    ('c0000000-0000-4000-8000-000000000001'::uuid, 14, 2600), ('c0000000-0000-4000-8000-000000000001'::uuid, 21, 3500),
    ('c0000000-0000-4000-8000-000000000001'::uuid, 30, 4200),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 1, 300), ('c0000000-0000-4000-8000-000000000002'::uuid, 7, 1800),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 14, 3200), ('c0000000-0000-4000-8000-000000000002'::uuid, 21, 4400),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 30, 5500),
    ('c0000000-0000-4000-8000-000000000003'::uuid, 1, 700), ('c0000000-0000-4000-8000-000000000003'::uuid, 7, 4200),
    ('c0000000-0000-4000-8000-000000000003'::uuid, 14, 7500), ('c0000000-0000-4000-8000-000000000003'::uuid, 21, 10000),
    ('c0000000-0000-4000-8000-000000000003'::uuid, 30, 12000)
),
days as (
  select m.bike_model_id, d.day
  from (select distinct bike_model_id from anchors) m
  cross join generate_series(1, 30) as d (day)
)
insert into public.price_days (bike_model_id, day, total, is_anchor)
select
  d.bike_model_id,
  d.day,
  case
    when a.day = b.day then a.total
    else (round((a.total + (b.total - a.total) * (d.day - a.day)::numeric / (b.day - a.day)) / 10) * 10)::int
  end,
  exists (select 1 from anchors x where x.bike_model_id = d.bike_model_id and x.day = d.day)
from days d
cross join lateral (
  select day, total from anchors
  where bike_model_id = d.bike_model_id and day <= d.day
  order by day desc limit 1
) a
cross join lateral (
  select day, total from anchors
  where bike_model_id = d.bike_model_id and day >= d.day
  order by day asc limit 1
) b;

-- A confirmed booking so the customer can see BSR's contacts.
-- Pickup 3 Nov 2026 10:00, return 17 Nov 10:00 Bangkok (UTC+7).
insert into public.bookings (
  id, code, customer_id, shop_id, bike_model_id, qty, start_at, end_at, mode,
  rental_total, discount, rental_after_promo, fee, due_at_shop, status,
  payment_method, payment_due_at
) values (
  'd0000000-0000-4000-8000-000000000001', 'K7Q4ZP',
  'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002', 1,
  '2026-11-03 03:00:00+00', '2026-11-17 03:00:00+00', 'instant',
  3200, 0, 3200, 320, 2880, 'confirmed_unpaid',
  'card', '2026-10-31 03:00:00+00'
);

insert into public.booking_events (booking_id, actor_type, actor_id, event, data)
values (
  'd0000000-0000-4000-8000-000000000001', 'customer',
  'a0000000-0000-4000-8000-000000000002', 'created',
  '{"status": "confirmed_unpaid"}'
);

-- A draft shop the public must not see -----------------------------------

insert into public.shops (id, name, slug, about, location, status)
values (
  'b0000000-0000-4000-8000-000000000002',
  'Sukhumvit Scooters',
  'sukhumvit-scooters',
  'Draft shop for testing that unapproved shops stay hidden.',
  extensions.st_setsrid(extensions.st_makepoint(100.5605, 13.7465), 4326)::extensions.geography,
  'draft'
);

insert into public.shop_contacts (shop_id, whatsapp, line_id)
values ('b0000000-0000-4000-8000-000000000002', '+66811111111', 'draft-shop');

insert into public.shop_members (shop_id, user_id, role)
values ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'owner');

insert into public.bike_models (
  id, shop_id, make, model, type, transmission, cc, qty, booking_mode
) values (
  'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002',
  'Honda', 'Scoopy', 'city_scooter', 'automatic', 110, 3, 'instant'
);
