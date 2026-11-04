-- Master bike catalog (SPEC "Fleet management"). Admin maintains one entry
-- per make / model / generation. Shops pick an entry and add their own offer
-- (bike_models). A missing model is requested by a shop and approved or
-- rejected by admin; the requesting shop can use its own request meanwhile.

create table public.bike_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  make text not null check (length(trim(make)) between 1 and 40),
  model text not null check (length(trim(model)) between 1 and 60),
  -- e.g. "New Gen", "2nd Gen". Optional.
  generation text check (length(generation) <= 40),
  year_from smallint check (year_from between 1950 and 2100),
  year_to smallint check (year_to between 1950 and 2100),
  type public.bike_type not null,
  transmission public.transmission not null,
  cc smallint not null check (cc between 50 and 2500),
  -- Features. Null = not known yet.
  abs boolean,
  underseat_storage boolean,
  usb_charger boolean,
  key_type public.key_type,
  description text check (length(description) <= 1000),
  -- Path in the catalog-photos bucket. Null = neutral placeholder image.
  stock_photo text,
  status public.catalog_status not null default 'requested',
  requested_by_shop_id uuid references public.shops (id) on delete set null,
  request_note text check (length(request_note) <= 500),
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (year_to is null or year_from is null or year_to >= year_from)
);

create index bike_catalog_status_idx on public.bike_catalog (status);
create index bike_catalog_requested_by_idx on public.bike_catalog (requested_by_shop_id)
  where requested_by_shop_id is not null;

create trigger bike_catalog_set_updated_at
before update on public.bike_catalog
for each row execute function public.set_updated_at();

-- Slug from make, model, generation and years, made unique with -2, -3, …
create function public.bike_catalog_set_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;
  base := public.slugify(concat_ws(' ', new.make, new.model, new.generation,
    case when new.year_from is not null then concat_ws(' ', new.year_from, new.year_to) end));
  if base = '' then
    base := 'bike';
  end if;
  candidate := base;
  while exists (select 1 from public.bike_catalog where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

create trigger bike_catalog_set_slug
before insert on public.bike_catalog
for each row execute function public.bike_catalog_set_slug();

create function public.is_catalog_approved(p_catalog_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bike_catalog where id = p_catalog_id and status = 'approved'
  );
$$;

-- A shop can list an approved entry, or its own pending request.
create function public.can_use_catalog(p_catalog_id uuid, p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bike_catalog
    where id = p_catalog_id
      and (status = 'approved' or (status = 'requested' and requested_by_shop_id = p_shop_id))
  );
$$;

-- RLS --------------------------------------------------------------------

alter table public.bike_catalog enable row level security;

-- Vendors may only submit requests; admin edits through the service role.
revoke insert, update, delete on public.bike_catalog from anon, authenticated;
grant insert (
  make, model, generation, year_from, year_to, type, transmission, cc,
  abs, underseat_storage, usb_charger, key_type, request_note, requested_by_shop_id
) on public.bike_catalog to authenticated;

create policy "Anyone reads approved catalog entries"
on public.bike_catalog for select to anon, authenticated
using (status = 'approved');

create policy "Members read their shop's catalog requests"
on public.bike_catalog for select to authenticated
using (requested_by_shop_id is not null and public.is_shop_member(requested_by_shop_id));

create policy "Members request catalog entries for their shop"
on public.bike_catalog for insert to authenticated
with check (
  status = 'requested'
  and requested_by_shop_id is not null
  and public.is_shop_member(requested_by_shop_id)
);

-- bike_models: specs move to the catalog ---------------------------------

alter table public.bike_models
  add column catalog_id uuid references public.bike_catalog (id) on delete restrict,
  -- Null = the shop's default deposit (shop_policies.deposit_amount).
  add column deposit_amount int check (deposit_amount > 0);

-- Existing models become approved catalog entries, one per distinct spec.
insert into public.bike_catalog (
  make, model, year_from, year_to, type, transmission, cc, status, reviewed_at
)
select distinct make, model, year_from, year_to, type, transmission, cc, 'approved'::public.catalog_status, now()
from public.bike_models;

update public.bike_models m
set catalog_id = c.id
from public.bike_catalog c
where c.make = m.make
  and c.model = m.model
  and c.year_from is not distinct from m.year_from
  and c.year_to is not distinct from m.year_to
  and c.type = m.type
  and c.transmission = m.transmission
  and c.cc = m.cc;

alter table public.bike_models
  alter column catalog_id set not null,
  drop column make,
  drop column model,
  drop column type,
  drop column transmission,
  drop column cc;

create index bike_models_catalog_id_idx on public.bike_models (catalog_id);

grant insert (catalog_id, deposit_amount) on public.bike_models to authenticated;
grant update (catalog_id, deposit_amount) on public.bike_models to authenticated;

-- Public only with an approved catalog entry and at least one real photo.
create or replace function public.is_bike_model_public(p_bike_model_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bike_models m
    join public.shops s on s.id = m.shop_id
    join public.bike_catalog c on c.id = m.catalog_id
    where m.id = p_bike_model_id
      and m.visible
      and cardinality(m.photos) > 0
      and s.status = 'live'
      and c.status = 'approved'
  );
$$;

drop policy "Anyone reads visible models of live shops" on public.bike_models;
create policy "Anyone reads public models"
on public.bike_models for select to anon, authenticated
using (
  visible
  and cardinality(photos) > 0
  and public.is_shop_live(shop_id)
  and public.is_catalog_approved(catalog_id)
);

drop policy "Members add models to their shop" on public.bike_models;
create policy "Members add models to their shop"
on public.bike_models for insert to authenticated
with check (public.is_shop_member(shop_id) and public.can_use_catalog(catalog_id, shop_id));

drop policy "Members update their shop's models" on public.bike_models;
create policy "Members update their shop's models"
on public.bike_models for update to authenticated
using (public.is_shop_member(shop_id))
with check (public.is_shop_member(shop_id) and public.can_use_catalog(catalog_id, shop_id));
