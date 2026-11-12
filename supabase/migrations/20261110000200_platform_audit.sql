-- Platform Phase 1a: the audit table and helper (docs/platform/SPEC.md ›
-- Review decisions › Audit). Who changed what, when, from what, to what.
--
-- Rows are written only by the trigger and helper below (security definer);
-- no one updates or deletes them. Owners and managers read their shop's rows.
-- Before Phase 4: personal data is kept out of snapshots and rows get their
-- own retention (SPEC).

create table platform.audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references platform.tenants (id) on delete cascade,
  -- Table name, e.g. units; later also things that aren't one table (order status).
  entity text not null,
  entity_id text not null,
  -- insert, update, delete, or a named action such as import.
  action text not null,
  -- Null = the service role or a system job.
  actor uuid references auth.users (id) on delete set null,
  -- update: only the columns that changed. insert: after only. delete: before only.
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create index audit_events_tenant_at_idx on platform.audit_events (tenant_id, at desc);
create index audit_events_entity_idx on platform.audit_events (tenant_id, entity, entity_id);

alter table platform.audit_events enable row level security;
grant select on platform.audit_events to authenticated;

create policy "Owners and managers read their audit log"
on platform.audit_events for select
to authenticated
using (tenant_id = any ((select platform_private.my_tenant_ids('{owner,manager}'))::uuid[]));

-- The helper for actions that aren't a plain row change.
create function platform_private.audit(
  p_tenant_id uuid,
  p_entity text,
  p_entity_id text,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into platform.audit_events (tenant_id, entity, entity_id, action, actor, before, after)
  values (p_tenant_id, p_entity, p_entity_id, p_action, (select auth.uid()), p_before, p_after);
$$;

-- Row trigger: create trigger … after insert or update or delete … for each
-- row execute function platform_private.audit_row('<id column>'). The id
-- column defaults to id.
create function platform_private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_id_column text := coalesce(tg_argv[0], 'id');
  v_tenant uuid;
  v_before jsonb;
  v_after jsonb;
begin
  v_tenant := case
    when tg_table_name = 'tenants' then (v_row ->> 'id')::uuid
    else (v_row ->> 'tenant_id')::uuid
  end;
  -- The whole tenant is being deleted: its audit rows go with it.
  if not exists (select 1 from platform.tenants where id = v_tenant) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, n.value), jsonb_object_agg(n.key, v_old -> n.key)
    into v_after, v_before
    from jsonb_each(v_new) n
    where n.key <> 'updated_at' and n.value is distinct from v_old -> n.key;
    if v_after is null then
      return null;
    end if;
  else
    v_before := v_old;
    v_after := v_new;
  end if;

  insert into platform.audit_events (tenant_id, entity, entity_id, action, actor, before, after)
  values (v_tenant, tg_table_name, v_row ->> v_id_column, lower(tg_op), (select auth.uid()), v_before, v_after);
  return null;
end;
$$;

create trigger tenants_audit
after insert or update on platform.tenants
for each row execute function platform_private.audit_row();

create trigger memberships_audit
after insert or update or delete on platform.memberships
for each row execute function platform_private.audit_row();
