-- Platform Phase 1a review, fix 2: the audit helper checks who is calling.
--
-- platform_private.audit() runs with its owner's rights and signed-in users
-- may execute it (functions they call use it), so by itself it would write a
-- row for any tenant id it was handed. It now refuses unless the caller is
--   * the service role or a system job (no signed-in user), or
--   * a member of that tenant, or
--   * a platform admin (catalog reviews are recorded under the shop).

create or replace function platform_private.audit(
  p_tenant_id uuid,
  p_entity text,
  p_entity_id text,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.role() is null for a job inside the database (pg_cron, a migration).
  if coalesce((select auth.role()), 'service_role') <> 'service_role'
    and not platform_private.is_member(p_tenant_id)
    and not platform_private.is_platform_admin()
  then
    raise exception 'audit_not_allowed' using errcode = '42501';
  end if;

  insert into platform.audit_events (tenant_id, entity, entity_id, action, actor, before, after)
  values (p_tenant_id, p_entity, p_entity_id, p_action, (select auth.uid()), p_before, p_after);
end;
$$;
