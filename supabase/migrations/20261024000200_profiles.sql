-- One profile per auth user (SPEC "users"). Created automatically on sign-up.
-- Vendor permissions come from shop_members, never from role; role is
-- 'vendor_staff' only as a label once someone joins a shop. 'admin' is
-- granted and revoked by the auth callback from ADMIN_EMAILS.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  name text,
  email text,
  whatsapp text,
  line_user_id text unique,
  language public.app_language not null default 'en',
  notify_channels public.notify_channel[] not null default '{email}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_notify_channels_has_email
    check ('email' = any (notify_channels))
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Users may edit only these columns of their own row; role, email and
-- line_user_id are maintained by triggers and server code.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name, whatsapp, language, notify_channels) on public.profiles to authenticated;

create policy "Users read their own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "Users update their own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Create the profile when an auth user is created.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep profiles.email in step with the auth email.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.handle_user_email_change();

-- Record the LINE user ID whenever a LINE identity is added (new sign-up or
-- linking LINE to an existing account). provider_id is LINE's `sub` claim.
create function public.handle_line_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider = 'custom:line' then
    update public.profiles
    set line_user_id = new.provider_id
    where id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger on_auth_identity_created
after insert on auth.identities
for each row execute function public.handle_line_identity();
