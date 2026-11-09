-- Platform Phase 0: tenants (docs/platform/SPEC.md › Data model, Built for any country).
-- One row per rental shop. Country, currency, time zone and locale are chosen per
-- tenant and have no defaults: nothing here assumes Thailand.
-- Columns for later phases (VAT, plan, Stripe, LINE, booking rules, marketplace
-- switches, distance unit...) are added by the phase that uses them.

-- Helpers for RLS live in a schema the Data API doesn't expose, so they can't be
-- called over REST; policies still run them as the signed-in user.
create schema if not exists platform_private;
grant usage on schema platform_private to authenticated;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  -- ISO 3166-1 alpha-2, e.g. TH, VN, JP.
  country text not null check (country ~ '^[A-Z]{2}$'),
  -- ISO 4217, e.g. THB, VND, JPY. Money is stored in its minor units.
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- IANA time zone, e.g. Asia/Bangkok. Checked by tenants_check_timezone.
  timezone text not null,
  -- BCP 47 locale for formatting, e.g. th-TH, en-GB.
  locale text not null check (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

-- A check constraint can't look up time zones, so a trigger does: "at time zone"
-- raises for a name Postgres doesn't know.
create function platform_private.check_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.timezone;
  return new;
exception
  when invalid_parameter_value then
    raise exception 'Unknown time zone: %', new.timezone
      using errcode = '22023';
end;
$$;

create trigger tenants_check_timezone
before insert or update of timezone on public.tenants
for each row execute function platform_private.check_timezone();

alter table public.tenants enable row level security;

-- Tenants are created by sign-up (Phase 11) or the seed script, with the
-- service role. Owners and managers may edit these settings only.
revoke insert, update, delete on public.tenants from anon, authenticated;
grant select on public.tenants to authenticated;
grant update (name, country, currency, timezone, locale) on public.tenants to authenticated;
