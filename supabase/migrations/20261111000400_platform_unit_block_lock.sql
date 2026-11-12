-- Platform Phase 1a: one writer at a time per unit's blocks.
--
-- The exclusion constraint on unit_blocks refuses overlaps, and stays the
-- rule. But when two or more people write overlapping blocks for the same
-- unit at the same instant, each insert sees the others' uncommitted rows and
-- waits for them: a circle. Postgres breaks it by cancelling one with
-- "deadlock detected", and the API layer retries that, so under a real race
-- the losers could spin for many seconds instead of being told "already
-- blocked" at once (found by the four-way race test, 11 Nov 2026).
--
-- So block writes for one unit queue behind each other: a transaction-level
-- advisory lock on the unit, taken before the row is written. The second
-- writer then sees the first one's committed block and gets the clean overlap
-- refusal (23P01). Writers for different units don't wait on each other.
-- Phase 2's booking function will take the same lock (the review decision's
-- "check + insert under an advisory lock").

create or replace function platform_private.unit_blocks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Namespace 1a01 keeps this apart from any other advisory lock.
  perform pg_advisory_xact_lock(x'1a01'::int, hashtext(new.unit_id::text));

  if tg_op = 'INSERT' and exists (
    select 1 from platform.units
    where id = new.unit_id and status in ('sold', 'retired')
  ) then
    raise exception 'unit_not_in_fleet' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Changing a block's times (ending it, moving it) queues the same way.
drop trigger unit_blocks_guard on platform.unit_blocks;
create trigger unit_blocks_guard
before insert or update of period, unit_id on platform.unit_blocks
for each row execute function platform_private.unit_blocks_guard();
