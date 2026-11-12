-- No default grants to the Data API roles on new objects in `public`.
--
-- On live, "Automatically expose new tables" was turned off on 12 Nov 2026
-- (docs/RUNBOOK-GO-LIVE-PLATFORM.md, step 6). From then on a table a migration
-- creates in `public` is readable by nobody over the API until the migration
-- grants it. A local or CI database still granted everything by default, so a
-- migration that forgot its grant passed every test and would have failed on
-- live only.
--
-- This makes every database behave the same way: a new table, sequence or
-- function that `postgres` (the role migrations run as) creates in `public`
-- gets no privileges for anon, authenticated or service_role. Grant on
-- purpose, per table:
--
--   grant select on public.thing to anon, authenticated;
--   grant all on public.thing to service_role;
--
-- Nothing that exists changes: default privileges only apply to objects
-- created later. The `platform` schema never had defaults for anon or
-- authenticated, and keeps its own for service_role (20261110000100).
--
-- On live this also removes what the dashboard switch left behind for new
-- tables (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) and sequences (UPDATE).
--
-- Not covered here: Postgres itself lets PUBLIC execute every new function,
-- and that can only be changed for all schemas at once (which would also hit
-- extensions). So functions keep the rule they always had, now with a test
-- behind it: `revoke all on function ... from public, anon` and then grant
-- (apps/platform/tests/db/default-grants.test.ts).

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;
