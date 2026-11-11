-- Platform Phase 1a review, fix 5 (and the approve half of fix 1): gaps in
-- review_catalog_request.
--
-- (a) It decided any waiting entry, including requests from marketplace
--     shops, which the marketplace's own admin pages handle. It now takes only
--     entries a platform shop submitted, and locks the entry while it decides:
--     a second admin deciding the same entry at the same instant waits, then
--     finds it already decided.
-- (b) Reject gives the shop's model back as its own. If the shop had, while
--     waiting, added the same make and model again as its own, that broke the
--     "one own model per make and model" index and the whole reject failed
--     with a raw error. Such a model now stays linked to the (rejected) entry,
--     unlisted, and the function says so in what it returns.
-- (c) Every approve, merge and reject writes an audit row under the shop.
-- Fix 1: approve clears the shop's note and which shop asked from the entry,
--     which becomes public. The audit row keeps both.
--
-- Returns {"decision": "approve" | "merge" | "reject",
--          "kept_linked": [{"model_id", "name"}]}  (kept_linked: reject only).

drop function platform.review_catalog_request(uuid, boolean, text, uuid);

create function platform.review_catalog_request(
  p_catalog_id uuid,
  p_approve boolean,
  p_notes text default null,
  p_merge_into uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
  v_model record;
  v_target_slug text;
  v_decision text;
  v_kept jsonb := '[]';
begin
  if not platform_private.is_platform_admin() then
    raise exception 'Only platform admins can review catalog entries'
      using errcode = '42501';
  end if;
  select id, make, model, request_note, requested_by_tenant_id into v_request
  from public.bike_catalog
  where id = p_catalog_id
    and status = 'requested'
    and requested_by_tenant_id is not null
  for update;
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
    set status = 'approved',
        review_notes = nullif(btrim(p_notes), ''),
        reviewed_at = now(),
        -- The entry is public from here on.
        request_note = null,
        requested_by_tenant_id = null
    where id = p_catalog_id;
  else
    v_decision := 'reject';
    for v_model in
      select m.id, m.tenant_id, m.name, m.make, m.model
      from platform.models m
      where m.catalog_id = p_catalog_id
      order by m.created_at, m.id
    loop
      if exists (
        select 1 from platform.models o
        where o.tenant_id = v_model.tenant_id
          and o.catalog_id is null
          and o.id <> v_model.id
          and platform_private.norm(o.make) = platform_private.norm(v_model.make)
          and platform_private.norm(o.model) = platform_private.norm(v_model.model)
      ) then
        -- The shop already has this make and model as its own: giving this
        -- one back too would make two. It stays linked, unlisted.
        v_kept := v_kept || jsonb_build_object('model_id', v_model.id, 'name', v_model.name);
      else
        update platform.models
        set catalog_id = null, marketplace_listed = false
        where id = v_model.id;
      end if;
    end loop;
    update public.bike_catalog
    set status = 'rejected', review_notes = nullif(btrim(p_notes), ''), reviewed_at = now()
    where id = p_catalog_id;
  end if;

  perform platform_private.audit(
    v_request.requested_by_tenant_id, 'bike_catalog', p_catalog_id::text, v_decision,
    jsonb_strip_nulls(jsonb_build_object(
      'status', 'requested',
      'request_note', v_request.request_note
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'make', v_request.make,
      'model', v_request.model,
      'notes', nullif(btrim(p_notes), ''),
      'merged_into', v_target_slug,
      'kept_linked', case when jsonb_array_length(v_kept) > 0 then v_kept end
    ))
  );

  return jsonb_build_object('decision', v_decision, 'kept_linked', v_kept);
end;
$$;

revoke all on function platform.review_catalog_request(uuid, boolean, text, uuid) from public, anon;
grant execute on function platform.review_catalog_request(uuid, boolean, text, uuid) to authenticated;
