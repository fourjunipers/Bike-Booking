-- Re-check of the Phase 1a review, follow-up 4: a rejected request says why.
--
-- When a platform admin rejected a shop's submission to Moto Mangos, the
-- shop's model quietly went back to being its own and the reviewer's note
-- was kept only on the catalog entry (review_notes, private) and in the audit
-- log (owners and managers only, and not tied to the model once it is
-- unlinked). The shop had no way to learn why.
--
-- The outcome now sits on the shop's own model: when it was rejected and the
-- reviewer's note. Every member of the shop can read it, like the rest of the
-- model. review_notes stays private.
--
-- * Set by review_catalog_request() on reject, on every model that was
--   waiting on the entry (unlinked or, rarely, kept linked).
-- * Cleared when the model is sent again, and when it is put on a catalog
--   entry (an approved preset, or a merge).
-- * Never writable by the shop: a trigger keeps the stored values for any
--   change that doesn't come from the functions here.
--
-- No new table and no new function reachable over the API, so no new grants:
-- platform.models already grants select to authenticated on purpose
-- (20261110000500), and both functions are replaced in place.

alter table platform.models
  add column catalog_rejected_at timestamptz,
  add column catalog_reject_reason text,
  add constraint models_reject_reason_needs_date
    check (catalog_reject_reason is null or catalog_rejected_at is not null);

-- Runs as whoever makes the change (not security definer): through the API
-- that is `authenticated`; inside the review and submit functions it is the
-- functions' owner.
create function platform_private.models_keep_catalog_outcome()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.catalog_id is not null
    and new.catalog_id is distinct from old.catalog_id
  then
    -- On a catalog entry now: the old outcome no longer applies.
    new.catalog_rejected_at := null;
    new.catalog_reject_reason := null;
  elsif current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.catalog_rejected_at := null;
      new.catalog_reject_reason := null;
    else
      new.catalog_rejected_at := old.catalog_rejected_at;
      new.catalog_reject_reason := old.catalog_reject_reason;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function platform_private.models_keep_catalog_outcome() from public, anon, authenticated;

create trigger models_keep_catalog_outcome
before insert or update on platform.models
for each row execute function platform_private.models_keep_catalog_outcome();

-- submit_model_to_catalog() needs no change: sending a model again links it
-- to the new request, and that link clears the old outcome through the
-- trigger above.
--
-- The review function, as in 20261111001100, plus the outcome on reject.

create or replace function platform.review_catalog_request(
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
  v_notes text := nullif(btrim(p_notes), '');
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
        review_notes = concat_ws(' ', v_notes, 'Merged into ' || v_target_slug || '.'),
        reviewed_at = now()
    where id = p_catalog_id;
  elsif p_approve then
    v_decision := 'approve';
    update public.bike_catalog
    set status = 'approved',
        review_notes = v_notes,
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
        update platform.models
        set catalog_rejected_at = now(), catalog_reject_reason = v_notes
        where id = v_model.id;
      else
        update platform.models
        set catalog_id = null, marketplace_listed = false,
            -- What the shop is told, on its own model.
            catalog_rejected_at = now(), catalog_reject_reason = v_notes
        where id = v_model.id;
      end if;
    end loop;
    update public.bike_catalog
    set status = 'rejected', review_notes = v_notes, reviewed_at = now()
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
      'notes', v_notes,
      'merged_into', v_target_slug,
      'kept_linked', case when jsonb_array_length(v_kept) > 0 then v_kept end
    ))
  );

  return jsonb_build_object('decision', v_decision, 'kept_linked', v_kept);
end;
$$;
