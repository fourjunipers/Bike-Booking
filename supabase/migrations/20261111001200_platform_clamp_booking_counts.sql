-- Platform Phase 1a review, fix 6: booking-mode counts follow the active bikes.
--
-- A model's instant_units, request_units and ready_now were checked against
-- its active bikes only when the model was saved. A bike then going to
-- maintenance, being sold, moved to another model or deleted left the counts
-- higher than the bikes there are.
--
-- Whenever a bike leaves a model's active set, the model's counts are clamped
-- down (never up) to its active bikes:
--   ready_now                    <= active
--   instant_units + request_units <= active (request_units gives way first)
-- and an audit row (action "clamp_booking_counts") says what changed and why.
--
-- These counts are a shop's setting, not availability. Phase 2 must compute
-- availability from units and unit_blocks, never from the stored counts alone.

create function platform_private.units_clamp_model_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_model record;
  v_active int;
  v_instant int;
  v_request int;
  v_ready int;
begin
  -- Only when a bike stops counting for old.model_id.
  if tg_op = 'UPDATE' and not (
    old.status = 'active' and (new.status <> 'active' or new.model_id <> old.model_id)
  ) then
    return null;
  end if;
  if tg_op = 'DELETE' and old.status <> 'active' then
    return null;
  end if;

  -- Lock the model first, so two bikes leaving at once count one after the
  -- other and a model being saved right now is seen (or sees this).
  select id, tenant_id, instant_units, request_units, ready_now into v_model
  from platform.models
  where id = old.model_id
  for update;
  -- Gone already: the model or the whole tenant is being deleted.
  if not found or not exists (select 1 from platform.tenants where id = v_model.tenant_id) then
    return null;
  end if;

  select count(*) into v_active
  from platform.units
  where tenant_id = v_model.tenant_id and model_id = v_model.id and status = 'active';

  v_instant := least(v_model.instant_units, v_active);
  v_request := least(v_model.request_units, v_active - v_instant);
  v_ready := least(v_model.ready_now, v_active);
  if v_instant = v_model.instant_units
    and v_request = v_model.request_units
    and v_ready = v_model.ready_now
  then
    return null;
  end if;

  update platform.models
  set instant_units = v_instant, request_units = v_request, ready_now = v_ready
  where id = v_model.id;

  insert into platform.audit_events (tenant_id, entity, entity_id, action, actor, before, after)
  values (
    v_model.tenant_id, 'models', v_model.id::text, 'clamp_booking_counts', (select auth.uid()),
    jsonb_build_object(
      'instant_units', v_model.instant_units,
      'request_units', v_model.request_units,
      'ready_now', v_model.ready_now
    ),
    jsonb_build_object(
      'instant_units', v_instant,
      'request_units', v_request,
      'ready_now', v_ready,
      'active_units', v_active,
      'because_unit', old.id,
      'unit_change', case
        when tg_op = 'DELETE' then 'deleted'
        when new.model_id <> old.model_id then 'moved to another model'
        else 'status ' || old.status || ' -> ' || new.status
      end
    )
  );
  return null;
end;
$$;

create trigger units_clamp_model_counts
after update of status, model_id or delete on platform.units
for each row execute function platform_private.units_clamp_model_counts();
