-- Local development seed. Loaded by `npx supabase db reset`.
-- Generated from BSR_SEED.md Part 2 plus the owner's answers of 3–4 Nov 2026
-- (see docs/decisions.md). Edit by hand freely; the generator isn't in the repo.
--
-- Sign in locally with a magic link for any of these emails and open the
-- link from Mailpit (http://127.0.0.1:54324):
--   admin@bike-booking.test     admin (also needs to be in ADMIN_EMAILS)
--   customer@bike-booking.test  customer with one booking at BSR
--   owner@bsr.test              BSR Bike Shop owner
--   staff@bsr.test              BSR Bike Shop staff
--   owner@draft-shop.test       owner of a draft shop the public can't see
--
-- TODO(owner): check the map pin in the vendor dashboard (approximate), and
-- replace the placeholder photos with real ones.

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

-- BSR Bike Shop (live) -------------------------------------------------------

insert into public.shops (
  id, name, slug, about, photos, location, maps_url, nearest_station, status,
  boost_level, cutoff_minutes, buffer_before_h, buffer_after_h,
  request_window_min, submitted_at, approved_at, terms_accepted_at
) values (
  'b0000000-0000-4000-8000-000000000001',
  'BSR Bike Shop',
  'bsr-bike-shop',
  'Bangkok rental shop for city bikes and fully equipped touring motorcycles. 10,000,000+ km ridden by 5,000+ customers from 100+ countries. English-speaking staff, free luggage storage, one-way touring rentals, bike passports for Laos, Cambodia and Malaysia.',
  array['/images/placeholder-shop.svg'],
  -- Approximate, near BTS Phra Khanong. TODO(owner): move the pin to the shop.
  extensions.st_setsrid(extensions.st_makepoint(100.5925, 13.7140), 4326)::extensions.geography,
  'https://www.google.com/maps/search/?api=1&query=79%2F37+Soi+Phumichit%2C+Rama+4%2C+Phra+Khanong%2C+Khlong+Toei%2C+Bangkok+10110',
  'Phra Khanong (BTS)',
  'live',
  'normal',
  120, 0, 24, 120,
  now(), now(), now()
);

insert into public.shop_contacts (shop_id, whatsapp, line_id, phone, email)
values (
  'b0000000-0000-4000-8000-000000000001',
  '+66850550247', 'bsrbikeshop', '+66850550247', 'info@bsrbikeshop.com'
);

insert into public.shop_members (shop_id, user_id, role) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'owner'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'staff');

-- Mon–Fri 10:00–18:00, Sat–Sun 11:00–16:00 (0 = Sunday).
insert into public.shop_hours (shop_id, weekday, open, close)
select
  'b0000000-0000-4000-8000-000000000001', d,
  case when d between 1 and 5 then '10:00'::time else '11:00'::time end,
  case when d between 1 and 5 then '18:00'::time else '16:00'::time end
from generate_series(0, 6) as d;

-- Shop defaults for "What's included", deposit and documents. Helmet count,
-- no rain gear and refund at return are assumptions for the owner to check.
insert into public.shop_policies (
  shop_id, helmets, phone_holder, rain_gear, gloves, jacket, usb_charger,
  top_box, side_panniers, usage_area, km_limit, medical_cover,
  deposit_amount, deposit_methods, passport, deposit_refund_days,
  licence_required, min_age, experience_required, notes
) values (
  'b0000000-0000-4000-8000-000000000001', 2, true, 'not_offered', 'not_offered',
  'not_offered', false, false, false, 'bangkok', 0, true,
  2000, '{cash,card_authorisation}', 'copy_only', 0,
  'motorbike', 21, false,
  'Free luggage storage. ASEAN driving licences and International Driving Permits are accepted. City bikes may not leave Bangkok without the "Use outside Bangkok" extra.'
);

-- Bike catalog ---------------------------------------------------------------
-- One entry per BSR model, approved. Features (ABS, storage, USB, key) are
-- left blank for admin to fill in. No stock photos yet: the app shows a
-- neutral placeholder.
insert into public.bike_catalog (
  id, make, model, year_from, year_to, cc, type, transmission, status, reviewed_at
) values  ('e0000000-0000-4000-8000-000000000010', 'Honda', 'Click 125i', 2019, 2022, 125, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000011', 'Yamaha', 'Grand Filano', 2018, 2022, 125, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000012', 'Honda', 'Scoopy', 2021, 2023, 110, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000013', 'Honda', 'Lead', 2023, 2023, 125, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000014', 'Yamaha', 'Fazzio', 2025, 2026, 125, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000015', 'Honda', 'Click 150i', 2019, 2022, 150, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000016', 'Honda', 'Scoopy', 2025, 2026, 110, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000017', 'Honda', 'Giorno', 2025, 2026, 125, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000018', 'Honda', 'Lead', 2026, 2026, 125, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000019', 'Yamaha', 'Aerox 155', 2018, 2020, 155, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000020', 'Honda', 'Click 160', 2023, 2025, 160, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000021', 'Yamaha', 'Aerox 155', 2024, 2026, 155, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000022', 'Yamaha', 'NMAX', 2026, 2026, 155, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000023', 'Benelli', 'Leoncino 250', 2022, 2024, 250, 'city_scooter', 'manual', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000024', 'Honda', 'PCX 160', 2026, 2026, 160, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000025', 'Honda', 'ADV 160', 2026, 2026, 160, 'city_scooter', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000026', 'Honda', 'NX500', 2025, 2025, 471, 'adventure', 'manual', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000027', 'Honda', 'CB500X', 2022, 2023, 471, 'adventure', 'manual', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000028', 'Honda', 'CB500X', 2019, 2021, 471, 'adventure', 'manual', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000029', 'Honda', 'CB500X', 2016, 2018, 471, 'adventure', 'manual', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000030', 'Honda', 'Forza 350', null, null, 330, 'touring', 'automatic', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000031', 'Honda', 'CB300R', null, null, 286, 'sport', 'manual', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000032', 'Honda', 'CRF300L', null, null, 286, 'off_road', 'manual', 'approved', now()),
  ('e0000000-0000-4000-8000-000000000033', 'Yamaha', 'WR155', null, null, 155, 'off_road', 'manual', 'approved', now());

-- BSR fleet ----------------------------------------------------------------
-- Every model on Request, quantity 1 (owner adjusts). Touring models override
-- the ฿2,000 shop deposit with ฿5,000. Photos are placeholders until the owner
-- uploads real ones.
insert into public.bike_models (
  id, shop_id, catalog_id, photos, qty, deposit_amount, booking_mode
) values  ('c0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000010', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000011', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000012', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000013', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000014', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000015', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000016', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000016', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000017', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000017', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000018', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000018', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000019', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000019', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000020', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000021', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000022', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000022', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000023', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000023', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000024', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000025', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000025', array['/images/placeholder-bike.svg'], 1, null, 'request'),
  ('c0000000-0000-4000-8000-000000000026', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000026', array['/images/placeholder-bike.svg'], 1, 5000, 'request'),
  ('c0000000-0000-4000-8000-000000000027', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000027', array['/images/placeholder-bike.svg'], 1, 5000, 'request'),
  ('c0000000-0000-4000-8000-000000000028', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000028', array['/images/placeholder-bike.svg'], 1, 5000, 'request'),
  ('c0000000-0000-4000-8000-000000000029', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000029', array['/images/placeholder-bike.svg'], 1, 5000, 'request'),
  ('c0000000-0000-4000-8000-000000000030', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000030', array['/images/placeholder-bike.svg'], 1, 5000, 'request'),
  ('c0000000-0000-4000-8000-000000000031', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000031', array['/images/placeholder-bike.svg'], 1, 5000, 'request'),
  ('c0000000-0000-4000-8000-000000000032', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000032', array['/images/placeholder-bike.svg'], 1, 5000, 'request'),
  ('c0000000-0000-4000-8000-000000000033', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000033', array['/images/placeholder-bike.svg'], 1, 5000, 'request');

-- Touring overrides of the shop's "What's included".
insert into public.bike_model_policies (
  bike_model_id, gloves, usb_charger, top_box, side_panniers, usage_area, experience_required
) values  ('c0000000-0000-4000-8000-000000000026', 'included', true, true, true, 'thailand', true),
  ('c0000000-0000-4000-8000-000000000027', 'included', true, true, true, 'thailand', true),
  ('c0000000-0000-4000-8000-000000000028', 'included', true, true, true, 'thailand', true),
  ('c0000000-0000-4000-8000-000000000029', 'included', true, true, true, 'thailand', true),
  ('c0000000-0000-4000-8000-000000000030', 'included', true, true, null, 'thailand', true),
  ('c0000000-0000-4000-8000-000000000031', 'included', true, true, null, 'thailand', true),
  ('c0000000-0000-4000-8000-000000000032', 'included', true, true, null, 'thailand', true),
  ('c0000000-0000-4000-8000-000000000033', 'included', true, true, null, 'thailand', true);

-- Day prices filled from the anchors (days 1, 7, 14, 21, 30) with the same rule
-- as lib/pricing.ts; tests/db/seed-prices.test.ts checks they match.
with anchors (bike_model_id, day, total) as (
  values
    ('c0000000-0000-4000-8000-000000000010'::uuid, 1, 300),
    ('c0000000-0000-4000-8000-000000000010'::uuid, 7, 1400),
    ('c0000000-0000-4000-8000-000000000010'::uuid, 14, 2100),
    ('c0000000-0000-4000-8000-000000000010'::uuid, 21, 2600),
    ('c0000000-0000-4000-8000-000000000010'::uuid, 30, 3000),
    ('c0000000-0000-4000-8000-000000000011'::uuid, 1, 300),
    ('c0000000-0000-4000-8000-000000000011'::uuid, 7, 1400),
    ('c0000000-0000-4000-8000-000000000011'::uuid, 14, 2300),
    ('c0000000-0000-4000-8000-000000000011'::uuid, 21, 2800),
    ('c0000000-0000-4000-8000-000000000011'::uuid, 30, 3200),
    ('c0000000-0000-4000-8000-000000000012'::uuid, 1, 300),
    ('c0000000-0000-4000-8000-000000000012'::uuid, 7, 1500),
    ('c0000000-0000-4000-8000-000000000012'::uuid, 14, 2500),
    ('c0000000-0000-4000-8000-000000000012'::uuid, 21, 3000),
    ('c0000000-0000-4000-8000-000000000012'::uuid, 30, 3500),
    ('c0000000-0000-4000-8000-000000000013'::uuid, 1, 300),
    ('c0000000-0000-4000-8000-000000000013'::uuid, 7, 1500),
    ('c0000000-0000-4000-8000-000000000013'::uuid, 14, 2500),
    ('c0000000-0000-4000-8000-000000000013'::uuid, 21, 3000),
    ('c0000000-0000-4000-8000-000000000013'::uuid, 30, 3500),
    ('c0000000-0000-4000-8000-000000000014'::uuid, 1, 350),
    ('c0000000-0000-4000-8000-000000000014'::uuid, 7, 1500),
    ('c0000000-0000-4000-8000-000000000014'::uuid, 14, 2500),
    ('c0000000-0000-4000-8000-000000000014'::uuid, 21, 3000),
    ('c0000000-0000-4000-8000-000000000014'::uuid, 30, 3500),
    ('c0000000-0000-4000-8000-000000000015'::uuid, 1, 350),
    ('c0000000-0000-4000-8000-000000000015'::uuid, 7, 1500),
    ('c0000000-0000-4000-8000-000000000015'::uuid, 14, 2500),
    ('c0000000-0000-4000-8000-000000000015'::uuid, 21, 3000),
    ('c0000000-0000-4000-8000-000000000015'::uuid, 30, 3500),
    ('c0000000-0000-4000-8000-000000000016'::uuid, 1, 350),
    ('c0000000-0000-4000-8000-000000000016'::uuid, 7, 1700),
    ('c0000000-0000-4000-8000-000000000016'::uuid, 14, 2700),
    ('c0000000-0000-4000-8000-000000000016'::uuid, 21, 3400),
    ('c0000000-0000-4000-8000-000000000016'::uuid, 30, 3900),
    ('c0000000-0000-4000-8000-000000000017'::uuid, 1, 350),
    ('c0000000-0000-4000-8000-000000000017'::uuid, 7, 1700),
    ('c0000000-0000-4000-8000-000000000017'::uuid, 14, 2700),
    ('c0000000-0000-4000-8000-000000000017'::uuid, 21, 3400),
    ('c0000000-0000-4000-8000-000000000017'::uuid, 30, 3900),
    ('c0000000-0000-4000-8000-000000000018'::uuid, 1, 400),
    ('c0000000-0000-4000-8000-000000000018'::uuid, 7, 1800),
    ('c0000000-0000-4000-8000-000000000018'::uuid, 14, 2800),
    ('c0000000-0000-4000-8000-000000000018'::uuid, 21, 3500),
    ('c0000000-0000-4000-8000-000000000018'::uuid, 30, 4000),
    ('c0000000-0000-4000-8000-000000000019'::uuid, 1, 400),
    ('c0000000-0000-4000-8000-000000000019'::uuid, 7, 1800),
    ('c0000000-0000-4000-8000-000000000019'::uuid, 14, 2800),
    ('c0000000-0000-4000-8000-000000000019'::uuid, 21, 3500),
    ('c0000000-0000-4000-8000-000000000019'::uuid, 30, 4000),
    ('c0000000-0000-4000-8000-000000000020'::uuid, 1, 400),
    ('c0000000-0000-4000-8000-000000000020'::uuid, 7, 1900),
    ('c0000000-0000-4000-8000-000000000020'::uuid, 14, 2900),
    ('c0000000-0000-4000-8000-000000000020'::uuid, 21, 3700),
    ('c0000000-0000-4000-8000-000000000020'::uuid, 30, 4500),
    ('c0000000-0000-4000-8000-000000000021'::uuid, 1, 500),
    ('c0000000-0000-4000-8000-000000000021'::uuid, 7, 2200),
    ('c0000000-0000-4000-8000-000000000021'::uuid, 14, 3500),
    ('c0000000-0000-4000-8000-000000000021'::uuid, 21, 4500),
    ('c0000000-0000-4000-8000-000000000021'::uuid, 30, 5400),
    ('c0000000-0000-4000-8000-000000000022'::uuid, 1, 600),
    ('c0000000-0000-4000-8000-000000000022'::uuid, 7, 2500),
    ('c0000000-0000-4000-8000-000000000022'::uuid, 14, 3900),
    ('c0000000-0000-4000-8000-000000000022'::uuid, 21, 5000),
    ('c0000000-0000-4000-8000-000000000022'::uuid, 30, 5900),
    ('c0000000-0000-4000-8000-000000000023'::uuid, 1, 600),
    ('c0000000-0000-4000-8000-000000000023'::uuid, 7, 2500),
    ('c0000000-0000-4000-8000-000000000023'::uuid, 14, 3900),
    ('c0000000-0000-4000-8000-000000000023'::uuid, 21, 5000),
    ('c0000000-0000-4000-8000-000000000023'::uuid, 30, 5900),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 1, 650),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 7, 2800),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 14, 4200),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 21, 5400),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 30, 6200),
    ('c0000000-0000-4000-8000-000000000025'::uuid, 1, 650),
    ('c0000000-0000-4000-8000-000000000025'::uuid, 7, 3000),
    ('c0000000-0000-4000-8000-000000000025'::uuid, 14, 4400),
    ('c0000000-0000-4000-8000-000000000025'::uuid, 21, 5700),
    ('c0000000-0000-4000-8000-000000000025'::uuid, 30, 6500),
    ('c0000000-0000-4000-8000-000000000026'::uuid, 1, 2100),
    ('c0000000-0000-4000-8000-000000000026'::uuid, 7, 14000),
    ('c0000000-0000-4000-8000-000000000026'::uuid, 14, 22000),
    ('c0000000-0000-4000-8000-000000000026'::uuid, 21, 28000),
    ('c0000000-0000-4000-8000-000000000026'::uuid, 30, 34000),
    ('c0000000-0000-4000-8000-000000000027'::uuid, 1, 1800),
    ('c0000000-0000-4000-8000-000000000027'::uuid, 7, 12000),
    ('c0000000-0000-4000-8000-000000000027'::uuid, 14, 20000),
    ('c0000000-0000-4000-8000-000000000027'::uuid, 21, 26000),
    ('c0000000-0000-4000-8000-000000000027'::uuid, 30, 31000),
    ('c0000000-0000-4000-8000-000000000028'::uuid, 1, 1500),
    ('c0000000-0000-4000-8000-000000000028'::uuid, 7, 10000),
    ('c0000000-0000-4000-8000-000000000028'::uuid, 14, 18000),
    ('c0000000-0000-4000-8000-000000000028'::uuid, 21, 23000),
    ('c0000000-0000-4000-8000-000000000028'::uuid, 30, 28000),
    ('c0000000-0000-4000-8000-000000000029'::uuid, 1, 1200),
    ('c0000000-0000-4000-8000-000000000029'::uuid, 7, 8000),
    ('c0000000-0000-4000-8000-000000000029'::uuid, 14, 15000),
    ('c0000000-0000-4000-8000-000000000029'::uuid, 21, 21000),
    ('c0000000-0000-4000-8000-000000000029'::uuid, 30, 26000),
    ('c0000000-0000-4000-8000-000000000030'::uuid, 1, 1100),
    ('c0000000-0000-4000-8000-000000000030'::uuid, 7, 7000),
    ('c0000000-0000-4000-8000-000000000030'::uuid, 14, 13000),
    ('c0000000-0000-4000-8000-000000000030'::uuid, 21, 17000),
    ('c0000000-0000-4000-8000-000000000030'::uuid, 30, 21000),
    ('c0000000-0000-4000-8000-000000000031'::uuid, 1, 900),
    ('c0000000-0000-4000-8000-000000000031'::uuid, 7, 6000),
    ('c0000000-0000-4000-8000-000000000031'::uuid, 14, 10000),
    ('c0000000-0000-4000-8000-000000000031'::uuid, 21, 15000),
    ('c0000000-0000-4000-8000-000000000031'::uuid, 30, 19000),
    ('c0000000-0000-4000-8000-000000000032'::uuid, 1, 1100),
    ('c0000000-0000-4000-8000-000000000032'::uuid, 7, 7000),
    ('c0000000-0000-4000-8000-000000000032'::uuid, 14, 13000),
    ('c0000000-0000-4000-8000-000000000032'::uuid, 21, 18000),
    ('c0000000-0000-4000-8000-000000000032'::uuid, 30, 22000),
    ('c0000000-0000-4000-8000-000000000033'::uuid, 1, 700),
    ('c0000000-0000-4000-8000-000000000033'::uuid, 7, 4500),
    ('c0000000-0000-4000-8000-000000000033'::uuid, 14, 8000),
    ('c0000000-0000-4000-8000-000000000033'::uuid, 21, 11500),
    ('c0000000-0000-4000-8000-000000000033'::uuid, 30, 14000)
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

-- Price per day after 30 days. PLACEHOLDER for the owner to replace with BSR's
-- real rates: the 30-day price / 30, rounded to 10 baht.
update public.bike_models m
set price_after_30 = (round(p.total / 30.0 / 10) * 10)::int
from public.price_days p
where p.bike_model_id = m.id and p.day = 30;

-- Extras (paid at the shop) ------------------------------------------------
insert into public.shop_extras (
  id, shop_id, name, description, terms, price_kind, price_rental, price_1d, price_7d, price_30d, all_models, sort
) values  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Use outside Bangkok (110–125cc)', 'Ride outside Bangkok on a city bike.', null, 'time', null, 200, null, 4800, false, 1),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Use outside Bangkok (150cc and up)', 'Ride outside Bangkok on a city bike.', null, 'time', null, 250, null, 6000, false, 2),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Damage/theft cover (155–449cc)', 'Covers damage to and theft of the bike.', 'Deductible ฿10,000 per claim.', 'time', null, 200, 1000, 3000, false, 3),
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Damage/theft cover (450–699cc)', 'Covers damage to and theft of the bike.', 'Deductible ฿10,000 per claim.', 'time', null, 300, 1500, 4500, false, 4),
  ('f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'Bike passport (Laos, Cambodia, Malaysia)', 'Papers to ride the bike across the border.', 'Total deposit ฿30,000. Advance notice needed.', 'rental', 5000, null, null, null, false, 5);

insert into public.shop_extra_models (extra_id, bike_model_id) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000010'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000011'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000012'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000013'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000014'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000016'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000017'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000018'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000015'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000019'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000020'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000021'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000022'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000023'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000025'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000019'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000020'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000021'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000022'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000023'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000025'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000030'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000031'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000032'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000033'),
  ('f0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000026'),
  ('f0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000027'),
  ('f0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000028'),
  ('f0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000029'),
  ('f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000026'),
  ('f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000027'),
  ('f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000028'),
  ('f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000029'),
  ('f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000030'),
  ('f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000031'),
  ('f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000032'),
  ('f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000033');

-- A confirmed booking so the customer can see BSR's contacts.
-- Honda PCX 160, 14 days = ฿4,200; fee ฿420; ฿3,780 at the shop.
-- Pickup 3 Nov 2026 10:00, return 17 Nov 10:00 Bangkok (UTC+7).
insert into public.bookings (
  id, code, customer_id, shop_id, bike_model_id, qty, start_at, end_at, mode,
  rental_total, discount, rental_after_promo, fee, due_at_shop, status,
  payment_method, payment_due_at
) values (
  'd0000000-0000-4000-8000-000000000001', 'K7Q4ZP',
  'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002', 1,
  '2026-11-03 03:00:00+00', '2026-11-17 03:00:00+00', 'request',
  4200, 0, 4200, 420, 3780, 'confirmed_unpaid',
  'card', '2026-10-31 03:00:00+00'
);

insert into public.booking_events (booking_id, actor_type, actor_id, event, data)
values (
  'd0000000-0000-4000-8000-000000000001', 'customer',
  'a0000000-0000-4000-8000-000000000002', 'created',
  '{"status": "pending_vendor"}'
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

insert into public.shop_policies (shop_id) values ('b0000000-0000-4000-8000-000000000002');

insert into public.bike_models (id, shop_id, catalog_id, qty, booking_mode)
values (
  'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000012', 3, 'instant'
);

-- A pending catalog request from the draft shop, for the admin queue.
insert into public.bike_catalog (
  id, make, model, cc, type, transmission, status, requested_by_shop_id, request_note
) values (
  'e0000000-0000-4000-8000-000000000090', 'Vespa', 'Primavera 150', 150, 'city_scooter', 'automatic',
  'requested', 'b0000000-0000-4000-8000-000000000002', 'We have three of these; not in the catalog yet.'
);
