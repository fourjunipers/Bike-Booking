-- Shops and everything configured per shop (SPEC "Vendor onboarding and shop setup").

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  about text,
  photos text[] not null default '{}' check (cardinality(photos) <= 12),
  location extensions.geography(point, 4326),
  maps_url text,
  nearest_station text,
  status public.shop_status not null default 'draft',
  boost_level public.boost_level not null default 'normal',
  cutoff_minutes int not null default 120 check (cutoff_minutes >= 0),
  buffer_before_h int not null default 0 check (buffer_before_h >= 0),
  buffer_after_h int not null default 0 check (buffer_after_h >= 0),
  request_window_min int not null default 120 check (request_window_min > 0),
  delivery_enabled boolean not null default false,
  delivery_radius_km numeric(5, 1) check (delivery_radius_km > 0),
  review_notes text,
  submitted_at timestamptz,
  approved_at timestamptz,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shops_location_idx on public.shops using gist (location);
create index shops_status_idx on public.shops (status);

create trigger shops_set_updated_at
before update on public.shops
for each row execute function public.set_updated_at();

create table public.shop_members (
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.shop_member_role not null,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create index shop_members_user_id_idx on public.shop_members (user_id);

-- Membership checks used by RLS policies. SECURITY DEFINER so policies on
-- shop_members itself don't recurse.
create function public.is_shop_member(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = p_shop_id and user_id = (select auth.uid())
  );
$$;

create function public.is_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = p_shop_id and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- Readable by the public only while the shop is live.
create function public.is_shop_live(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.shops where id = p_shop_id and status = 'live');
$$;

-- Shop WhatsApp/LINE are shown to a customer only after their booking is
-- confirmed (SPEC), so they live apart from the publicly readable shops row.
create table public.shop_contacts (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  whatsapp text,
  line_id text,
  updated_at timestamptz not null default now()
);

create trigger shop_contacts_set_updated_at
before update on public.shop_contacts
for each row execute function public.set_updated_at();

create table public.shop_hours (
  shop_id uuid not null references public.shops (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  open time not null,
  close time not null,
  primary key (shop_id, weekday),
  check (close > open)
);

create table public.shop_closures (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index shop_closures_shop_id_idx on public.shop_closures (shop_id, start_date);

create table public.shop_policies (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  deposit_type public.deposit_type not null,
  deposit_amount int check (deposit_amount > 0),
  licence_required public.licence_type not null default 'none',
  helmets smallint not null default 1 check (helmets between 0 and 2),
  insurance_type text,
  phone_holder boolean not null default false,
  rain_gear boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  check ((deposit_type = 'cash_deposit') = (deposit_amount is not null))
);

create trigger shop_policies_set_updated_at
before update on public.shop_policies
for each row execute function public.set_updated_at();

-- A flat delivery fee is a single zone at the shop's delivery radius.
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  max_km numeric(5, 1) not null check (max_km > 0),
  fee int not null check (fee >= 0),
  unique (shop_id, max_km)
);

-- RLS --------------------------------------------------------------------

alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.shop_contacts enable row level security;
alter table public.shop_hours enable row level security;
alter table public.shop_closures enable row level security;
alter table public.shop_policies enable row level security;
alter table public.delivery_zones enable row level security;

-- shops: creation, submission, approval and boost go through server code.
-- TODO(phase-2): create_shop() RPC that inserts the shop and owner membership.
revoke insert, update, delete on public.shops from anon, authenticated;
grant update (
  name, slug, about, photos, location, maps_url, nearest_station,
  cutoff_minutes, buffer_before_h, buffer_after_h, request_window_min,
  delivery_enabled, delivery_radius_km
) on public.shops to authenticated;

create policy "Anyone reads live shops"
on public.shops for select
to anon, authenticated
using (status = 'live');

create policy "Members read their shop"
on public.shops for select
to authenticated
using (public.is_shop_member(id));

create policy "Owners update their shop profile"
on public.shops for update
to authenticated
using (public.is_shop_owner(id))
with check (public.is_shop_owner(id));

-- shop_members: owners manage the team; members see their teammates.
revoke update on public.shop_members from anon, authenticated;

create policy "Members read their shop's team"
on public.shop_members for select
to authenticated
using (public.is_shop_member(shop_id));

create policy "Owners add team members"
on public.shop_members for insert
to authenticated
with check (public.is_shop_owner(shop_id));

-- TODO(phase-2): stop an owner removing the last owner.
create policy "Owners remove team members"
on public.shop_members for delete
to authenticated
using (public.is_shop_owner(shop_id));

-- shop_contacts: members read, owners write. Customers with a confirmed
-- booking get a read policy in the bookings migration.
create policy "Members read their shop contacts"
on public.shop_contacts for select
to authenticated
using (public.is_shop_member(shop_id));

create policy "Owners write their shop contacts"
on public.shop_contacts for all
to authenticated
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

-- Hours, closures, policies, delivery zones: public while live, members
-- read, owners write.
create policy "Anyone reads hours of live shops"
on public.shop_hours for select to anon, authenticated
using (public.is_shop_live(shop_id));
create policy "Members read their shop hours"
on public.shop_hours for select to authenticated
using (public.is_shop_member(shop_id));
create policy "Owners write their shop hours"
on public.shop_hours for all to authenticated
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

create policy "Anyone reads closures of live shops"
on public.shop_closures for select to anon, authenticated
using (public.is_shop_live(shop_id));
create policy "Members read their shop closures"
on public.shop_closures for select to authenticated
using (public.is_shop_member(shop_id));
create policy "Owners write their shop closures"
on public.shop_closures for all to authenticated
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

create policy "Anyone reads policies of live shops"
on public.shop_policies for select to anon, authenticated
using (public.is_shop_live(shop_id));
create policy "Members read their shop policies"
on public.shop_policies for select to authenticated
using (public.is_shop_member(shop_id));
create policy "Owners write their shop policies"
on public.shop_policies for all to authenticated
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

create policy "Anyone reads delivery zones of live shops"
on public.delivery_zones for select to anon, authenticated
using (public.is_shop_live(shop_id));
create policy "Members read their delivery zones"
on public.delivery_zones for select to authenticated
using (public.is_shop_member(shop_id));
create policy "Owners write their delivery zones"
on public.delivery_zones for all to authenticated
using (public.is_shop_owner(shop_id))
with check (public.is_shop_owner(shop_id));

-- Teammates can see each other's names on the Team page.
create policy "Members read their teammates' profiles"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.shop_members mine
    join public.shop_members theirs on theirs.shop_id = mine.shop_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
  )
);
