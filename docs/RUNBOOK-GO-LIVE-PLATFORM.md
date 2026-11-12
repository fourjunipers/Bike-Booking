# Runbook: platform migrations to the live database

Applies the platform's 21 pending migrations to the live Supabase project
(**Bike-booking**, ref `mfaqydyoweerlqsgwnay`, free plan, no automatic backups).
The marketplace (Moto Mangos) runs on this database, so every step is written
to keep it working throughout.

- Prepared 12 Nov 2026 on branch `platform/phase-1a-fleet-core` (PR 8).
- Nothing in this runbook has been run against live. The owner gives the go.
- Companion files: [checks.sql](runbook-go-live-platform/checks.sql) (read-only
  checks with expected results) and
  [rollback.sql](runbook-go-live-platform/rollback.sql) (emergency undo).

## What this does and doesn't do

| | |
| --- | --- |
| Does | Adds the `platform` and `platform_private` schemas (15 tables, all empty), one reference table `public.vehicle_types`, three columns on `public.bike_catalog`, and an hourly job |
| Doesn't | Change, move or delete any marketplace row. Point the platform app at live (it stays on staging, see [Netlify](#netlify-environment-variables)). Create any shop or admin on live |

After this runbook live has the platform's tables but nobody can use them yet:
there are no shops and no platform admins on live, and the app has no screen
that creates either (today only the demo seed does, on local and staging).

## How migrations reach live

- **By hand, with the Supabase CLI, from your machine.** There is no GitHub
  Action and no Netlify step that touches the database.
- The repo is linked to live (`supabase/.temp/project-ref`), so **`--linked`
  means live**. The command is `npx supabase db push --linked`.
- **On merge to `main` nothing runs against the database.** CI
  (`.github/workflows/ci.yml`) runs typecheck, lint and tests against a
  throwaway local database. Netlify builds both sites: the marketplace
  (`bike-booking-th`) because `packages/db` changed, and the platform
  (`mango-works-platform`), which still reads staging.
- Repo rule: live gets migrations only from `main`. So: merge first, then push
  from a clean `main`.

The marketplace's code is the same before and after PR 8 (the PR changes only
generated types in `packages/db` for it), and its queries were checked against
both database states. It works with the merge deployed and the migrations not
yet applied, and the other way round.

## The 21 migrations, in order

Live has 27 (newest `20261108000100`). Pending: 3 from Phase 0 (already on
`main`) and 18 from PR 8.

| # | Migration | What it does |
| --- | --- | --- |
| 1 | `20261109000100_platform_tenants` | `platform_private` schema; `tenants` table (a shop on the platform) with RLS |
| 2 | `20261109000200_platform_memberships` | Roles, `memberships`, member-management functions, tenant policies |
| 3 | `20261109000300_platform_rls_report` | A report function the tests use to prove RLS is on |
| 4 | `20261110000100_platform_schema` | Creates the `platform` schema and moves 1 to 3 into it; `platform_admins` |
| 5 | `20261110000200_platform_audit` | `audit_events` and the audit triggers |
| 6 | `20261110000300_platform_locations` | `locations`, opening hours, closures; time zone moves to the location; `create_tenant()` |
| 7 | `20261110000400_platform_catalog_link` | **Touches the marketplace's catalog:** new `public.vehicle_types`; `bike_catalog` gains `vehicle_type`, `specs`, `requested_by_tenant_id` (all with defaults) and two read policies |
| 8 | `20261110000500_platform_fleet` | `models`, `units`, `unit_financials`, `unit_blocks`, fleet import; turns on `btree_gist` |
| 9 | `20261111000100_platform_grants_report` | Report functions proving the public can't reach platform tables |
| 10 | `20261111000200_platform_fleet_followups` | Year bands, renewals, notification outbox; turns on `pg_cron` and schedules the hourly reminder job |
| 11 | `20261111000300_platform_own_models` | Shops' own makes and models; adds ATV, boat, other to `vehicle_types` |
| 12 | `20261111000400_platform_unit_block_lock` | Per-bike lock so two downtimes can't overlap |
| 13 | `20261111000500_platform_required_specs` | Required specs on models |
| 14 | `20261111000600_platform_specs_motorbikes_only` | Engine size and transmission required for motorbikes only |
| 15 | `20261111000700_platform_catalog_private_fields` | **Touches the catalog:** the public reads 22 named columns instead of the whole row; request note, requesting shop and review note become private |
| 16 | `20261111000800_platform_audit_caller_check` | Only a shop's members can write its audit rows |
| 17 | `20261111000900_platform_owner_lock` | Two owners can't remove each other at the same moment |
| 18 | `20261111001000_platform_sold_units_blocks` | A sold or retired bike can't hold future downtime |
| 19 | `20261111001100_platform_review_gaps` | Catalog review: clears private fields on approval, always audits |
| 20 | `20261111001200_platform_clamp_booking_counts` | Booking counts shrink when a model loses bikes |
| 21 | `20261111001300_platform_cc_range` | **Touches the catalog:** engine size check widens from 50-2500 to 1-20000 cc |

## Safety findings (12 Nov 2026)

Checked read-only against live (migration list and a schema-and-data copy
taken with the CLI's `pg_dump`) and by a dry run on that copy.

| Question | Answer |
| --- | --- |
| Does live match the repo's first 27 migrations? | Yes. Live's schema and a local database built from those 27 are identical, line for line |
| Does any migration drop, rename or rewrite a marketplace table or row? | No. The only drops and renames are on the platform's own tables. After all 21 ran on the copy, every one of the 23 marketplace tables, `auth.users` and `storage.objects` had the same row count and the same checksum as before |
| Do the `bike_catalog` changes break a marketplace query? | No. Every marketplace query on the catalog names its columns, and every column it names is in the 22 the public may still read. The admin pages that read every column use the service role, which is unaffected. 57 read queries (every table as the public and as the service role, the catalog exactly as each page asks for it, search, stations, shop and model functions) returned byte-identical answers before and after |
| Do existing catalog rows keep working? | Yes. All 25 got `vehicle_type = 'motorbike'`, `specs = {}`, no requesting shop. Engine sizes run 110 to 471 cc, inside both the old and the new range |
| Can a signed-in marketplace user still read the catalog? | Yes: each of live's 3 users reads the same 24 approved entries, and is refused the private columns |
| Is `pg_cron` available on the free plan? | Supabase offers it on every plan and the staging project (also free) runs the job. Not confirmed on live itself: check A3 in `checks.sql` confirms it in one query. If it were missing, the migration skips the job and still applies |

Live today is small: 3 users, 2 shops, 2 bike models, 25 catalog entries, 182
stations, no bookings.

**One real risk found: the order of the dashboard step.** If `platform` is
added to the API's exposed schemas *before* the schema exists, the API fails
for every request, marketplace tables included (seen locally: every call
returned 503 "Could not query the database for the schema cache"). Expose the
schema only after step 4 passes.

## Steps

Run from the repo root in Git Bash. Docker Desktop must be running (the CLI
uses it for `pg_dump`). Stop at the first step that doesn't match and go to
[Rollback](#rollback).

### 1. Merge and get a clean `main`

Merge PR 8 on GitHub, wait for CI on `main`, then:

```bash
git checkout main && git pull && git status --short
```

Expected: no output from `git status` apart from untracked local folders.

### 2. Pre-flight (read-only)

```bash
npx supabase migration list --linked
```

Expected: 27 rows with a remote version, then 21 with none
(`20261109000100` to `20261111001300`).

Then run blocks **A1 to A5** of `checks.sql` in the Supabase SQL editor and
save A1's output.

### 3. Backup

Live has no automatic backups, so this is the only copy. Three files: roles,
schema, and data (every `public` table plus the `auth` and `storage` rows they
point at, including the users).

```bash
B=~/mango-live-backups/$(date +%Y-%m-%d_%H%M) && mkdir -p "$B" && echo "$B"
```

```bash
npx supabase db dump --linked --role-only -f "$B/roles.sql"
```

```bash
npx supabase db dump --linked -f "$B/schema.sql"
```

```bash
npx supabase db dump --linked --data-only --use-copy -f "$B/data.sql"
```

```bash
ls -la "$B" && grep -c '^COPY ' "$B/data.sql"
```

Expected: three files that aren't empty (about 120 KB of schema and 95 KB of
data on 12 Nov 2026) and a `COPY` count of about 58.

Where to keep it:

- `~/mango-live-backups` is outside the repo on purpose. **Never put these
  files in the repo**: it is public, and `data.sql` holds users' emails and
  sign-in tokens.
- Copy the folder to one more private place (an encrypted drive or a private
  cloud folder only you can open). Keep it until the platform has run on live
  for a while.
- The dump doesn't hold the photo files themselves (14 in Storage), only their
  records. No migration touches Storage. For a copy anyway, download the
  buckets from Dashboard › Storage.

### 4. Apply

```bash
npx supabase db push --linked --dry-run
```

Expected: exactly the 21 migrations in the table above, in that order. If the
list is different, stop.

```bash
npx supabase db push --linked
```

Answer `Y`. It takes well under a minute; the catalog table is locked for an
instant while it gains its columns. Expected: 21 "Applying migration" lines
and no error. If one fails, the ones before it stay applied: go to
[Rollback](#rollback).

### 5. Verify

1. `npx supabase migration list --linked`: all 48 have a remote version.
2. `checks.sql` blocks **B1 to B8**. B2 (row counts) must equal what you saved
   in step 2.
3. `checks.sql` blocks **C1 to C5**.
4. Open the marketplace and click through: the home page, a search, a shop
   page, a bike page, `/vendor/fleet` and "add a bike" as a shop, and
   `/admin/catalog` as admin (open one entry). All read the catalog.

### 6. Dashboard (owner)

Only after step 5 passes.

1. **Project Settings › Data API › Exposed schemas: add `platform`.** Not
   `platform_private`. Save.
2. Reload the marketplace home page and run a search straight away: this is
   the change that can take the API down if the schema were missing.
3. Run block **C6** of `checks.sql` and keep the output.
4. **Turn off "Automatically expose new tables".**
5. Run **C6** again: the two outputs must match. The switch should only
   affect tables created from now on.

Rule from then on: a migration that adds a table to `public` must grant access
on purpose (`grant select ... to anon, authenticated`). Local and CI databases
still grant by default, so a missing grant would pass tests and fail on live.
Platform tables already grant on purpose.

### 7. RLS checks again

Run blocks **C1 to C5** once more (the exposed schema is now reachable over
the API, so this is the state that matters), then reload the marketplace.

### 8. Record it

Add a line to `docs/PROGRESS.md`: date, 48 migrations on live, `platform`
exposed, auto-expose off, where the backup is.

## Rollback

| What went wrong | What to do |
| --- | --- |
| Step 2 or 3 doesn't match | Nothing has changed. Stop and ask |
| `db push` fails part-way (step 4) | Run `rollback.sql` in the SQL editor. It undoes whichever of the 21 were applied, in one transaction, and removes them from the migration history. Then run A1, A2 and A4 again: same as before |
| A check in step 5 fails, or the marketplace misbehaves | Same: `rollback.sql`, then re-check |
| The API errors after exposing `platform` (step 6) | Remove `platform` from Exposed schemas and save. The migrations can stay |
| C6 differs after the auto-expose switch | Turn the switch back on, run C6 again, and stop |
| Data is damaged (not expected: no migration writes to a marketplace row) | Restore the affected tables from `data.sql`. Worst case, a new Supabase project restored from `roles.sql`, `schema.sql`, `data.sql`, and the marketplace's Netlify variables pointed at it |

About `rollback.sql`:

- Tested on the copy of live in three states (after all 21, after only the
  first 3, and after a broken half-applied state). Each time the schema came
  back identical to live's and every marketplace row was unchanged, and the 21
  migrations applied again cleanly afterwards.
- It **refuses to run once the platform holds a shop**. From then on a problem
  is fixed with a new migration, never by rolling back.
- It is the one sanctioned exception to "never change the database by hand",
  for an emergency during this runbook only.

## Netlify environment variables

Site `mango-works-platform`. The app needs:

| Variable | Needed | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Today: the staging project, in every context |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Today: staging's key |
| `NEXT_PUBLIC_AUTH_PROVIDERS` | Optional | `line`, `google` or both; only providers turned on in that Supabase project |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry stays off when blank |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Optional | e.g. `production` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never on Netlify** | The app doesn't use it; tests and the seed only |

Which are set: the site builds and signs in against staging, so the two
required ones are set with staging's values (`docs/PROGRESS.md`: "every
platform Netlify context points at staging until Gate A"). This was not
checked in Netlify itself (no Netlify access from the repo); confirm under
Site configuration › Environment variables.

**This runbook changes none of them.** Pointing the app at live is a separate
decision, and it needs more than two variables:

1. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set to
   live's values for the **Production** context only (previews stay on
   staging), then a redeploy.
2. Supabase › Authentication › URL configuration on live: add the platform
   site's URL to the redirect allow list. Platform and marketplace would share
   one set of users.
3. A way to create the first shop and the first platform admin on live. None
   exists outside the demo seed, and the seed must never run on live.
