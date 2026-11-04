-- Structured "What's included", deposit and documents (SPEC "Vendor
-- onboarding and shop setup"). shop_policies holds the shop defaults;
-- bike_model_policies holds per-model overrides where null = shop default.
-- The deposit amount override lives on bike_models.deposit_amount.
-- Damage/theft cover is not an inclusion: shops offer it as an extra.

alter table public.shop_policies
  drop constraint shop_policies_check,
  drop constraint shop_policies_helmets_check,
  drop column deposit_type,
  drop column insurance_type;

drop type public.deposit_type;

alter table public.shop_policies
  alter column rain_gear drop default,
  alter column rain_gear type public.gear_option
    using (case when rain_gear then 'included' else 'not_offered' end)::public.gear_option,
  alter column rain_gear set default 'not_offered',
  alter column helmets set default 2,
  add constraint shop_policies_helmets_check check (helmets between 0 and 4),
  add column helmet_type public.helmet_type,
  add column helmet_sizes text[] not null default '{}'
    check (helmet_sizes <@ array['XS', 'S', 'M', 'L', 'XL', 'XXL']),
  add column gloves public.gear_option not null default 'not_offered',
  add column jacket public.gear_option not null default 'not_offered',
  add column usb_charger boolean not null default false,
  add column top_box boolean not null default false,
  add column side_panniers boolean not null default false,
  add column usage_area public.usage_area not null default 'bangkok',
  -- km per rental; 0 = unlimited.
  add column km_limit int not null default 0 check (km_limit >= 0),
  -- Compulsory third-party insurance is always included (Thai law).
  add column medical_cover boolean not null default false,
  add column deposit_methods public.deposit_method[] not null default '{cash}',
  add column passport public.passport_policy not null default 'copy_only',
  -- Days after return; 0 = refunded at return.
  add column deposit_refund_days smallint not null default 0
    check (deposit_refund_days between 0 and 30),
  add column min_age smallint check (min_age between 15 and 99),
  add column experience_required boolean not null default false,
  add constraint shop_policies_notes_length check (length(notes) <= 1000);

comment on column public.shop_policies.deposit_amount is
  'Shop default deposit in baht; null = no money deposit. Models override with bike_models.deposit_amount.';

create table public.bike_model_policies (
  bike_model_id uuid primary key references public.bike_models (id) on delete cascade,
  helmets smallint check (helmets between 0 and 4),
  helmet_type public.helmet_type,
  helmet_sizes text[] check (helmet_sizes <@ array['XS', 'S', 'M', 'L', 'XL', 'XXL']),
  gloves public.gear_option,
  jacket public.gear_option,
  rain_gear public.gear_option,
  phone_holder boolean,
  usb_charger boolean,
  top_box boolean,
  side_panniers boolean,
  usage_area public.usage_area,
  km_limit int check (km_limit >= 0),
  medical_cover boolean,
  deposit_methods public.deposit_method[],
  passport public.passport_policy,
  deposit_refund_days smallint check (deposit_refund_days between 0 and 30),
  licence_required public.licence_type,
  min_age smallint check (min_age between 15 and 99),
  experience_required boolean,
  notes text check (length(notes) <= 1000),
  updated_at timestamptz not null default now()
);

create trigger bike_model_policies_set_updated_at
before update on public.bike_model_policies
for each row execute function public.set_updated_at();

alter table public.bike_model_policies enable row level security;

create policy "Anyone reads overrides of public models"
on public.bike_model_policies for select to anon, authenticated
using (public.is_bike_model_public(bike_model_id));

create policy "Members read their shop's model overrides"
on public.bike_model_policies for select to authenticated
using (public.is_shop_member(public.bike_model_shop_id(bike_model_id)));

-- Staff manage the fleet, so they can edit model overrides too.
create policy "Members write their shop's model overrides"
on public.bike_model_policies for all to authenticated
using (public.is_shop_member(public.bike_model_shop_id(bike_model_id)))
with check (public.is_shop_member(public.bike_model_shop_id(bike_model_id)));
