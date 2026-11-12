-- Platform Phase 1a review, fix 1: the catalog's private fields.
--
-- An approved catalog entry is public (anyone reads it), but three columns on
-- it are not for the public: the note a shop wrote with its request, which
-- shop asked, and the admin's review note. Until now anon and every signed-in
-- user could select them on any row a policy showed them.
--
-- * Table-wide SELECT is replaced by a column list that leaves those three
--   out, for anon and for signed-in users alike. NOTE: a column added to
--   bike_catalog later is not readable by the public until it is granted here
--   on purpose.
-- * Platform admins read the waiting requests, with the private fields,
--   through platform.catalog_requests() below. The marketplace's own admin
--   pages use the service role and are unaffected; its public and vendor
--   queries name their columns and use none of the three.
-- * Approving a platform shop's request now clears request_note and
--   requested_by_tenant_id on the entry (migration 20261111001100; the audit
--   row keeps them). Entries approved before that are cleared here.

revoke select on public.bike_catalog from anon, authenticated;
grant select (
  id, slug, make, model, year_from, year_to, type, transmission, cc,
  abs, underseat_storage, usb_charger, key_type, description, stock_photo,
  status, requested_by_shop_id, reviewed_at, created_at, updated_at,
  vehicle_type, specs
) on public.bike_catalog to anon, authenticated;

update public.bike_catalog
set request_note = null, requested_by_tenant_id = null
where status = 'approved' and requested_by_tenant_id is not null;

-- The admin path: requests waiting for review, oldest first, with the fields
-- only an admin sees. Anyone else gets no rows.
create function platform.catalog_requests()
returns table (
  id uuid,
  slug text,
  make text,
  model text,
  year_from smallint,
  year_to smallint,
  cc smallint,
  type public.bike_type,
  transmission public.transmission,
  status public.catalog_status,
  request_note text,
  requested_by_tenant_id uuid,
  requested_by_tenant_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.slug, c.make, c.model, c.year_from, c.year_to, c.cc, c.type,
         c.transmission, c.status, c.request_note, c.requested_by_tenant_id,
         t.name, c.created_at
  from public.bike_catalog c
  join platform.tenants t on t.id = c.requested_by_tenant_id
  where c.status = 'requested'
    and (select platform_private.is_platform_admin())
  order by c.created_at;
$$;

revoke all on function platform.catalog_requests() from public, anon;
grant execute on function platform.catalog_requests() to authenticated;
