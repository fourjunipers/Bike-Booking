-- Shop creation, submission for review, staff invites and review flags
-- (SPEC "Vendor onboarding and shop setup", BUILD_PLAN Phase 2).

-- New columns ---------------------------------------------------------------

alter table public.shops
  -- Google Business Profile. Only the place ID may be stored (Google Places
  -- policies); rating and reviews are fetched live (Phase 3).
  add column google_place_id text check (length(google_place_id) <= 300),
  -- Shop-level edits (policies, extras) made while live, for admin review.
  add column flagged_for_review boolean not null default false;

grant update (google_place_id) on public.shops to authenticated;

alter table public.shop_contacts
  add column phone text check (length(phone) <= 30),
  add column email text check (length(email) <= 200);

-- Creating a shop ------------------------------------------------------------

-- Creates a draft shop with the caller as owner, plus empty policies and
-- contacts rows. Returns the new shop's ID.
create function public.create_shop(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean_name text := trim(coalesce(p_name, ''));
  base text;
  candidate text;
  n int := 1;
  new_id uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if length(clean_name) not between 2 and 80 then
    raise exception 'shop name must be 2–80 characters' using errcode = '22023';
  end if;

  base := public.slugify(clean_name);
  if base = '' then
    base := 'shop';
  end if;
  candidate := base;
  while exists (select 1 from public.shops where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;

  insert into public.shops (name, slug) values (clean_name, candidate)
  returning id into new_id;
  insert into public.shop_members (shop_id, user_id, role) values (new_id, uid, 'owner');
  insert into public.shop_policies (shop_id) values (new_id);
  insert into public.shop_contacts (shop_id) values (new_id);
  update public.profiles set role = 'vendor_staff' where id = uid and role = 'customer';
  return new_id;
end;
$$;

revoke execute on function public.create_shop(text) from public, anon;
grant execute on function public.create_shop(text) to authenticated;

-- Readiness and submission ---------------------------------------------------

-- What a shop still needs before it can be submitted, as codes the vendor
-- dashboard translates. Empty array = ready.
create function public.shop_readiness(p_shop_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  missing text[] := '{}';
  s public.shops;
begin
  if (select auth.uid()) is not null and not public.is_shop_member(p_shop_id) then
    raise exception 'not a member of this shop' using errcode = '42501';
  end if;
  select * into s from public.shops where id = p_shop_id;
  if not found then
    raise exception 'shop not found' using errcode = 'P0002';
  end if;

  if s.about is null or length(trim(s.about)) < 20 then
    missing := missing || 'about'::text;
  end if;
  if cardinality(s.photos) = 0 then
    missing := missing || 'shop_photo'::text;
  end if;
  if s.location is null then
    missing := missing || 'location'::text;
  end if;
  if not exists (select 1 from public.shop_hours where shop_id = p_shop_id) then
    missing := missing || 'hours'::text;
  end if;
  if not exists (
    select 1 from public.shop_contacts
    where shop_id = p_shop_id
      and coalesce(whatsapp, line_id, phone) is not null
  ) then
    missing := missing || 'contact'::text;
  end if;
  if not exists (
    select 1 from public.bike_models where shop_id = p_shop_id and visible
  ) then
    missing := missing || 'model'::text;
  end if;
  if exists (
    select 1 from public.bike_models
    where shop_id = p_shop_id and visible and cardinality(photos) = 0
  ) then
    missing := missing || 'model_photo'::text;
  end if;
  if exists (
    select 1 from public.bike_models m
    where m.shop_id = p_shop_id and m.visible
      and (select count(*) from public.price_days p where p.bike_model_id = m.id) < 30
  ) then
    missing := missing || 'model_prices'::text;
  end if;
  return missing;
end;
$$;

revoke execute on function public.shop_readiness(uuid) from public, anon;
grant execute on function public.shop_readiness(uuid) to authenticated;

-- Owner submits a draft (or returned) shop for review. Returns what is still
-- missing; the status changes only when nothing is.
create function public.submit_shop(p_shop_id uuid, p_accept_terms boolean)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  missing text[];
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'only the shop owner can submit' using errcode = '42501';
  end if;
  if (select status from public.shops where id = p_shop_id) <> 'draft' then
    raise exception 'shop is not a draft' using errcode = '22023';
  end if;

  missing := public.shop_readiness(p_shop_id);
  if not coalesce(p_accept_terms, false) then
    missing := missing || 'terms'::text;
  end if;
  if cardinality(missing) = 0 then
    update public.shops
    set status = 'pending', submitted_at = now(), terms_accepted_at = now()
    where id = p_shop_id;
  end if;
  return missing;
end;
$$;

revoke execute on function public.submit_shop(uuid, boolean) from public, anon;
grant execute on function public.submit_shop(uuid, boolean) to authenticated;

-- Staff invites ---------------------------------------------------------------

-- A link the owner shares by email or LINE. Only the SHA-256 of the token is
-- stored. Single use, valid 7 days.
create table public.shop_invites (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null
);

create index shop_invites_shop_id_idx on public.shop_invites (shop_id, created_at);

alter table public.shop_invites enable row level security;
revoke insert, update on public.shop_invites from anon, authenticated;

create policy "Owners read their shop's invites"
on public.shop_invites for select to authenticated
using (public.is_shop_owner(shop_id));

create policy "Owners cancel their shop's invites"
on public.shop_invites for delete to authenticated
using (public.is_shop_owner(shop_id));

-- Returns the raw token once; it can't be recovered later.
create function public.create_shop_invite(p_shop_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  if not public.is_shop_owner(p_shop_id) then
    raise exception 'only the shop owner can invite' using errcode = '42501';
  end if;
  token := rtrim(translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'), '=');
  insert into public.shop_invites (shop_id, token_hash, created_by)
  values (p_shop_id, extensions.digest(token, 'sha256'), (select auth.uid()));
  return token;
end;
$$;

revoke execute on function public.create_shop_invite(uuid) from public, anon;
grant execute on function public.create_shop_invite(uuid) to authenticated;

-- The signed-in user joins the invite's shop as staff. Returns the shop ID.
create function public.accept_shop_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  invite public.shop_invites;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into invite from public.shop_invites
  where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
    and used_at is null
    and expires_at > now()
  for update;
  if not found then
    raise exception 'invalid or expired invite' using errcode = 'P0002';
  end if;

  insert into public.shop_members (shop_id, user_id, role)
  values (invite.shop_id, uid, 'staff')
  on conflict (shop_id, user_id) do nothing;
  update public.shop_invites set used_at = now(), used_by = uid where id = invite.id;
  update public.profiles set role = 'vendor_staff' where id = uid and role = 'customer';
  return invite.shop_id;
end;
$$;

revoke execute on function public.accept_shop_invite(text) from public, anon;
grant execute on function public.accept_shop_invite(text) to authenticated;

-- Never remove a shop's last owner (deleting the whole shop still cascades).
create function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
    and exists (select 1 from public.shops where id = old.shop_id)
    and not exists (
      select 1 from public.shop_members
      where shop_id = old.shop_id and role = 'owner' and user_id <> old.user_id
    )
  then
    raise exception 'a shop must keep at least one owner' using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger shop_members_protect_last_owner
before delete on public.shop_members
for each row execute function public.protect_last_owner();

-- Review flags ----------------------------------------------------------------
-- After approval, edits go live immediately but are flagged for admin review
-- (SPEC). Only edits by signed-in users flag; admin (service role) and seeds
-- don't. Operational changes (qty, ready today, down time, visibility,
-- booking mode, buffers) are not flagged.

create function public.flag_bike_model_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and public.is_shop_live(new.shop_id)
    and (
      tg_op = 'INSERT'
      or new.catalog_id is distinct from old.catalog_id
      or new.photos is distinct from old.photos
      or new.deposit_amount is distinct from old.deposit_amount
    )
  then
    new.flagged_for_review := true;
  end if;
  return new;
end;
$$;

create trigger bike_models_flag_edit
before insert or update on public.bike_models
for each row execute function public.flag_bike_model_edit();

-- Price and override changes flag their model.
create function public.flag_model_child_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  model_id uuid := coalesce(new.bike_model_id, old.bike_model_id);
begin
  if (select auth.uid()) is not null then
    update public.bike_models m
    set flagged_for_review = true
    where m.id = model_id
      and not m.flagged_for_review
      and public.is_shop_live(m.shop_id);
  end if;
  return null;
end;
$$;

create trigger price_days_flag_edit
after insert or update or delete on public.price_days
for each row execute function public.flag_model_child_edit();

create trigger bike_model_policies_flag_edit
after insert or update or delete on public.bike_model_policies
for each row execute function public.flag_model_child_edit();

-- Policy and extras changes flag the shop.
create function public.flag_shop_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if (select auth.uid()) is null then
    return null;
  end if;
  if tg_table_name = 'shop_extra_models' then
    target := public.shop_extra_shop_id(coalesce(new.extra_id, old.extra_id));
  else
    target := coalesce(new.shop_id, old.shop_id);
  end if;
  update public.shops
  set flagged_for_review = true
  where id = target and status = 'live' and not flagged_for_review;
  return null;
end;
$$;

create trigger shop_policies_flag_edit
after insert or update or delete on public.shop_policies
for each row execute function public.flag_shop_edit();

create trigger shop_extras_flag_edit
after insert or update or delete on public.shop_extras
for each row execute function public.flag_shop_edit();

create trigger shop_extra_models_flag_edit
after insert or update or delete on public.shop_extra_models
for each row execute function public.flag_shop_edit();
