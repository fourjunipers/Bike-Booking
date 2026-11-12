-- Platform Phase 1a: which specs a model must have (owner, 11 Nov 2026), and
-- an audit record for every catalog review.
--
-- Required specs, for presets and a shop's own models alike:
--   vehicle type   always
--   transmission   motorbikes and cars (an electric car is "automatic")
--   engine size    motorbikes only
-- ATVs, boats and "other" need neither.

alter table platform.models drop constraint models_motorbike_specs_check;

-- NOT VALID: rows saved under the earlier rule (a car with no transmission,
-- possible for a few hours on staging) aren't checked now; every new row and
-- every later change to an old one is.
alter table platform.models
  add constraint models_required_specs_check
  check (
    (vehicle_type <> 'motorbike' or cc is not null)
    and (vehicle_type not in ('motorbike', 'car') or transmission is not null)
  ) not valid;

-- Catalog reviews leave an audit record under the shop that sent the entry:
-- who decided, what, and (for a merge) into which entry. The entry itself
-- keeps its status, review note and review time as before.
create or replace function platform.review_catalog_request(
  p_catalog_id uuid,
  p_approve boolean,
  p_notes text default null,
  p_merge_into uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
  v_target_slug text;
  v_decision text;
begin
  if not platform_private.is_platform_admin() then
    raise exception 'Only platform admins can review catalog entries'
      using errcode = '42501';
  end if;
  select id, make, model, requested_by_tenant_id into v_request
  from public.bike_catalog
  where id = p_catalog_id and status = 'requested';
  if not found then
    raise exception 'Catalog request not found' using errcode = 'P0002';
  end if;

  if p_merge_into is not null then
    select slug into v_target_slug
    from public.bike_catalog
    where id = p_merge_into and status = 'approved';
    if v_target_slug is null then
      raise exception 'merge_target_not_approved' using errcode = 'P0001';
    end if;
    v_decision := 'merge';
    update platform.models set catalog_id = p_merge_into where catalog_id = p_catalog_id;
    update public.bike_catalog
    set status = 'rejected',
        review_notes = concat_ws(' ', nullif(btrim(p_notes), ''), 'Merged into ' || v_target_slug || '.'),
        reviewed_at = now()
    where id = p_catalog_id;
  elsif p_approve then
    v_decision := 'approve';
    update public.bike_catalog
    set status = 'approved', review_notes = nullif(btrim(p_notes), ''), reviewed_at = now()
    where id = p_catalog_id;
  else
    v_decision := 'reject';
    update platform.models
    set catalog_id = null, marketplace_listed = false
    where catalog_id = p_catalog_id;
    update public.bike_catalog
    set status = 'rejected', review_notes = nullif(btrim(p_notes), ''), reviewed_at = now()
    where id = p_catalog_id;
  end if;

  if v_request.requested_by_tenant_id is not null then
    perform platform_private.audit(
      v_request.requested_by_tenant_id, 'bike_catalog', p_catalog_id::text, v_decision,
      jsonb_build_object('status', 'requested'),
      jsonb_strip_nulls(jsonb_build_object(
        'make', v_request.make,
        'model', v_request.model,
        'notes', nullif(btrim(p_notes), ''),
        'merged_into', v_target_slug
      ))
    );
  end if;
end;
$$;
