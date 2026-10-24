-- Bookings, their append-only event log, and reviews (SPEC "Data model").
-- Clients never write bookings directly: creation and every status change go
-- through server code and RPCs (Phase 4) via lib/booking-state.ts.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  -- 6 characters, no ambiguous 0/O/1/I. TODO(phase-4): generated in the create-booking RPC.
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  bike_model_id uuid not null references public.bike_models (id) on delete restrict,
  qty smallint not null default 1 check (qty > 0),
  start_at timestamptz not null,
  end_at timestamptz not null,
  mode public.booking_kind not null,
  delivery_address text,
  delivery_location extensions.geography(point, 4326),
  delivery_fee int not null default 0 check (delivery_fee >= 0),
  rental_total int not null check (rental_total >= 0),
  promo_id uuid references public.promotions (id) on delete set null,
  discount int not null default 0 check (discount >= 0),
  rental_after_promo int not null check (rental_after_promo >= 0),
  fee int not null check (fee >= 0),
  due_at_shop int not null check (due_at_shop >= 0),
  status public.booking_status not null,
  payment_method public.payment_method,
  payment_due_at timestamptz,
  stripe_customer_id text,
  stripe_payment_method_id text,
  paid_at timestamptz,
  request_expires_at timestamptz,
  cancelled_by public.booking_actor,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check (rental_after_promo = rental_total - discount),
  check (due_at_shop = rental_after_promo - fee)
);

create index bookings_model_dates_idx on public.bookings (bike_model_id, start_at, end_at);
create index bookings_customer_idx on public.bookings (customer_id, start_at);
create index bookings_shop_status_idx on public.bookings (shop_id, status);
create index bookings_request_expiry_idx on public.bookings (request_expires_at)
  where status = 'pending_vendor';
create index bookings_payment_due_idx on public.bookings (payment_due_at)
  where status = 'confirmed_unpaid';

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  at timestamptz not null default now(),
  actor_type public.booking_actor not null,
  actor_id uuid references public.profiles (id) on delete set null,
  event text not null,
  data jsonb not null default '{}'
);

create index booking_events_booking_idx on public.booking_events (booking_id, at);

-- Append-only, even for the service role (which bypasses RLS, not triggers).
create function public.reject_booking_event_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'booking_events is append-only';
end;
$$;

create trigger booking_events_append_only
before update or delete on public.booking_events
for each row execute function public.reject_booking_event_change();

create table public.reviews (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  -- Copied from the booking so reviews can be public without exposing bookings.
  shop_id uuid not null references public.shops (id) on delete cascade,
  bike_model_id uuid not null references public.bike_models (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  text text,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_shop_idx on public.reviews (shop_id) where not hidden;

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create function public.fill_review_from_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select b.shop_id, b.bike_model_id
  into new.shop_id, new.bike_model_id
  from public.bookings b
  where b.id = new.booking_id;
  return new;
end;
$$;

create trigger reviews_fill_from_booking
before insert on public.reviews
for each row execute function public.fill_review_from_booking();

-- RLS --------------------------------------------------------------------

alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.reviews enable row level security;

revoke insert, update, delete on public.bookings from anon, authenticated;
revoke insert, update, delete on public.booking_events from anon, authenticated;

create policy "Customers read their own bookings"
on public.bookings for select to authenticated
using (customer_id = (select auth.uid()));

create policy "Members read their shop's bookings"
on public.bookings for select to authenticated
using (public.is_shop_member(shop_id));

create policy "Customers read events of their own bookings"
on public.booking_events for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_id = (select auth.uid())
  )
);

create policy "Members read events of their shop's bookings"
on public.booking_events for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id and public.is_shop_member(b.shop_id)
  )
);

-- Reviews: customers write one per returned booking; hiding is admin-only.
revoke insert, update, delete on public.reviews from anon, authenticated;
grant insert (booking_id, rating, text) on public.reviews to authenticated;

create policy "Anyone reads visible reviews of live shops"
on public.reviews for select to anon, authenticated
using (not hidden and public.is_shop_live(shop_id));

create policy "Customers read their own reviews"
on public.reviews for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_id = (select auth.uid())
  )
);

create policy "Members read their shop's reviews"
on public.reviews for select to authenticated
using (public.is_shop_member(shop_id));

create policy "Customers review their own returned bookings"
on public.reviews for insert to authenticated
with check (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and b.customer_id = (select auth.uid())
      and b.status = 'returned'
  )
);

-- Policies on earlier tables that depend on bookings ---------------------

create policy "Customers read contacts once a booking is confirmed"
on public.shop_contacts for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.shop_id = shop_contacts.shop_id
      and b.customer_id = (select auth.uid())
      and b.status in ('confirmed_unpaid', 'paid', 'picked_up', 'returned')
  )
);

create policy "Members read profiles of their shop's customers"
on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.customer_id = profiles.id and public.is_shop_member(b.shop_id)
  )
);
