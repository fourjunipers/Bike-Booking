# Progress

What's done, open decisions and known issues, across both apps. Update this at the end of every session so the next one starts clean.

## Status (11 Nov 2026)

| Track | Where it stands |
| --- | --- |
| Repo | **Step R** merged to `main` (PR #5). GitHub repo renamed to `fourjunipers/mango-works`; Netlify site `bike-booking-th` relinked to it |
| Marketplace (Moto Mangos, `apps/marketplace`) | Customer search and pages live on the `lib/data` adapter (Phase 3). Booking fee, fee lifecycle and the `BOOKING_ENABLED` flag merged to `main` (step 2, PR #6). Nothing uses them yet |
| Platform (`apps/platform`) | **Phase 0** (foundations) merged to `main` (PR #7, 10 Nov 2026) and deployed on the Netlify site `mango-works-platform` (staging data): auth, tenants, memberships, roles, RLS, app shell, staff app with its 4 tabs (placeholders), demo seed, CI. **Phase 1a** (fleet core) is built on `platform/phase-1a-fleet-core`, PR open |
| Database | 37 migrations in `supabase/migrations` (27 + 3 platform on `main`, 7 more on the Phase 1a branch). Platform tables live in the `platform` schema from Phase 1a. Live = today's Bike-Booking project (migrations only from `main`). Staging = Supabase project `mango-works-staging` (Singapore), with all 37 and the demo seed |

Build order after the 10 Nov 2026 review (docs/platform/SPEC.md › Review decisions): 0 → 1a → 2 → 3 → 3M → 1b → 4 onward.

## Platform Phase 1a follow-ups (same branch and PR #8, 11 Nov 2026)

Ten requests from the owner after trying Phase 1a. Where they differ from the Phase 1a notes below, these are the current state. Migration `20261111000200_platform_fleet_followups.sql`.

**Decisions that change the spec** (owner, 11 Nov 2026; `docs/platform/SPEC.md` still has the old wording and needs the same edits at its next export)
- **Odometer:** a lower reading is no longer refused for anyone who may update the odometer. The app asks "Are you sure?" first; the audit log records who changed it, from what, to what. (Spec: "a reading lower than the last one needs a manager override".) Drivers still can't change a bike at all.
- **Borrowed units removed:** the `borrowed` status and the active-from / active-to window are gone. (Spec: "Borrowed units (sub-rentals) with an active window".) Nothing else depended on them: no query, rule or screen read them.
- **"First registered" removed** from the data model, screens and import. Before the column was dropped, its year was copied into the new `model_year` where a bike had one.
- **Tax and insurance pulled forward from Phase 1b:** the renewal log (minimum), reminder settings and dashboard items are built now. Service schedules, odometer alerts, keys, GPS, the unit timeline and profit stay in 1b.
- **Scheduled jobs:** the hourly reminder queue uses Supabase Cron (`pg_cron`), the scheduler the spec names. It is the repo's first scheduled job. The migration enables the extension where it is available and skips the schedule where it isn't.

**Built**
- **Bug fixed: the distance unit "reverted" after saving.** The save always worked. The form was left to the browser to submit, and React then reset it, so the dropdown showed the value the page first loaded with until a reload. The settings form is now submitted by script like the others. The same class of bug existed on the Fleet filter form ("Reset view" left old values on screen) and is fixed by redrawing the form when the view changes.
- **Fleet list, grouped.** By model (default), each split into the shop's own model-year bands, newest first; "Unknown year" for bikes with no year, "Other years" for a year outside every band, one group for all years when a model has no bands. Each group shows make, model, year band, bike count and a status breakdown, and opens with its arrow. Expand all, collapse all. Group by model, make, location, status or none. Filters: make and model (linked), engine size range, transmission, status, location, model year, plate or frame search. Sort: make and model, engine size, bike count, plate, odometer, purchase date (owners and managers only). The view lives in the address, so it can be bookmarked, and the last view is remembered per person per device (a cookie, like the other per-device choices). "Next service due" is not offered as a sort: that data arrives in Phase 1b.
- **Model-year bands:** `model_year_bands`, edited on each model's page by owners and managers; a year can sit in one band of a model only (database rule).
- **Make, then model, everywhere a model is chosen** (add bike, add model, Fleet filters, sticker filters): two linked dropdowns from the catalog. Choosing a catalog model the shop doesn't have yet creates the shop's model on save. "Add a make or model" covers what the catalog lacks: the shop uses it at once and a platform admin reviews it (the existing catalog-request path, renamed).
- **CSV import** now takes `make, model, model_year, name` instead of `model, catalog`. Where the catalog has several generations of a model, the model year picks the one whose years include it. `name` is optional: the shop's own model name.
- **Status:** one control per bike (active, maintenance, retired, sold), each with a line saying whether the bike can be rented. The duplicate beside the odometer is gone. Staff and mechanics are offered active and maintenance only.
- **Selling:** choosing Sold only changes the status (still refused while the bike has a block ending in the future), then lands on the one "Purchase and sale" section at the bottom, where every purchase and sale field is viewed, edited and saved. The separate "Mark as sold" panel with its own price fields is gone.
- **Tax and insurance:** `unit_renewals` (kind, provider, reference, start, expiry; everyone reads, staff and mechanics record, owners and managers delete) and `unit_renewal_costs` (owners and managers only, like purchase prices; a cost locks the currency too). The bike page shows "Road tax expires" and "Insurance expires" from the latest record of each kind, highlighted when due or expired. Reminder settings per shop: days before expiry (default 45, 30, 14, 7) and an optional monthly digest day (1 to 28). Dashboard: a renewal shows from the shop's first reminder day, under Upcoming with its date (Today and Tomorrow when it is that close), and under Late once expired. Only the current record of each kind counts; sold and retired bikes are left out.
- **Notification outbox:** `notification_outbox` plus `queue_renewal_notifications()`, run hourly. It queues one message per reminder day reached (only the nearest one for a record added late), one "expired", and one monthly digest, each exactly once, by the calendar date at the bike's location. **Nothing sends them yet** (see below).
- **Print stickers:** a button on the Fleet page opens a list with a checkbox per bike, select-all for what the filter shows, make and model filters, newest first or by plate. Printing shows only the ticked stickers. The bike page keeps "Print this sticker", which opens the list with that bike ticked.
- **Demo data:** BSR renewals in every state (insurance expiring 30 days after the seed runs, one in 5 days, road tax 3 days overdue), and a third shop, Big Fleet Demo (`/big-fleet`, `owner@big.demo.test`), with 150 bikes in 5 models, three year bands each, two locations and mixed statuses.

**What statuses and downtime do to availability today** (asked by the owner)
- Nothing computes availability yet: that is Phase 2, and there are no bookings until Phase 3. What exists today:
- **Active** is the only status counted as rentable stock: a model's Instant, Request and Ready-now counts can't exceed its active bikes.
- **Maintenance** therefore already takes the bike out of those counts, and the status text says it can't be rented. Phase 2's availability function must count active bikes only for this to hold for bookings; that is how the spec defines it.
- **Retired and Sold:** refused while the bike has a block ending in the future; afterwards no new block can be added; left off the sticker list and the dashboard.
- **Scheduled downtime** is a `unit_blocks` row. The database already refuses any other block on that bike for overlapping times, whatever its kind, so from Phase 2 a booking can't land on it.

**Sending by email or LINE: what the codebase can do**
- Nothing. There is no email sender, no LINE client, no outbox and no job runner anywhere in the repo, in either app. Sign-in emails are sent by Supabase itself. The spec puts jobs + outbox + email in Phase 3 and LINE in Phase 6.
- So reminders are queued, not sent, and no sender was built. The outbox rows hold facts (bike, kind, expiry, days before), not text, so the Phase 3 sender can word them per language and choose recipients. Until then the dashboard is the only place a reminder is seen.

**Tests** (all passing locally, 11 Nov 2026)
- Unit: 91 platform (new: fleet view incl. 150 bikes, import by make and model, renewals and reminder settings), 144 marketplace, 86 core.
- Database: 84. New: the four new tables in the isolation harness (fixtures, cross-tenant read/insert/update/delete), year bands, renewals and cost visibility by role, reminder settings, the queue (once each, nearest reminder only, location date, expired, digest, sold bikes skipped), lowered odometer with its audit row, removed columns and status.
- Playwright: 50 (25 at 375 px, 25 at 1280 px). New or rewritten: grouped fleet, the 150-bike shop, status and odometer confirmation, renewals to dashboard, bands, adding a make, sticker picker with print media, the settings bug.
- Tests updated because the rule changed: the two that expected a refusal on a lowered odometer; the Phase 0 dashboard test (tab counts are no longer zero).

**Not truly tested**
- The hourly schedule itself: the queue function is tested directly; that `pg_cron` fires it each hour is checked only by seeing the job listed on local and staging.
- Printing on paper and scanning a printed sticker (as before); the print layout is tested with the browser's print styles.
- 150 bikes on a real phone: tested at 375 px in a desktop browser, and the page loaded within the test's limit.
- Thai wording of the new text (key parity only).

**Surprises**
- The "reverted to kilometres" bug was a display bug: the database had the right value all along.
- Models with no bikes had dropped off the first version of the grouped list; the browser test for adding a make caught it.
- The catalog's entries are per generation (CB500X 2016–2018, 2019–2021, 2022–2023), so "make then model" can list the same model name more than once, told apart by years. Year bands are the shop's own and separate from those.

**Second round of owner feedback (11 Nov 2026, later the same day)**
- **Current fleet by default.** The Fleet list shows the working fleet: sold and retired bikes are kept, with all their records, but stay out of the list. A "Show" control switches between Current fleet, Sold and retired, and Everything; the header counts the working fleet and links to "N sold or retired". Choosing the Sold or Retired status in the filters finds them whatever "Show" says. The choice is remembered with the rest of the view.
- **Bike Details reordered:** the odometer sits where the location was (for owners and managers it is now part of the Details form, with the same lower-reading confirmation), and the location is the last field. Staff and mechanics keep their separate odometer box, since they can't edit the details.
- **"Group by location" and the location filter** are only offered to shops with more than one location.
- **A make and model already in the list can't be added again** for overlapping years (checked when adding a make or model). Found because three overlapping "Honda Test" entries were added during testing; that check previously existed only for a model's own year bands.
- **A note on bikes with sale details but a status other than Sold.** Saving sale details never changes the status (by design), so a bike could look sold on paper while still Active. The purchase and sale section now says so.
- Tests: 92 platform unit, 84 database, 50 Playwright.

**Open decision: how the shared catalog and shops' own vehicles fit together** (raised by the owner, 11 Nov 2026; not built)
- Today every model must link to a catalog entry, and the catalog only describes motorbikes (engine size and a bike type are required). A shop can add its own entry and use it at once, but each one lands in the platform admin's review list.
- The owner wants shops to add any vehicle (cars, boats, ATVs) with no approval, while Moto Mangos stays tidy: one Honda PCX, not three spellings.
- Recommended: a model's catalog link becomes optional. A shop's own make and model are stored on its model and need no approval. Moto Mangos lists only models linked to an approved catalog entry, so linking (or asking for a new entry) happens when a shop chooses to list a model there, not when it adds a bike. The catalog is pre-loaded with the popular bikes and year ranges so most shops just pick. This changes the spec rule "a model can't be saved without a catalog entry" and needs the owner's OK before any migration.

## Platform Phase 1a: fleet core (branch `platform/phase-1a-fleet-core`, 11 Nov 2026)

Mapping first: `docs/platform/MAPPING.md` (legacy marketplace tables → tenants, locations, models, units, unit blocks; column by column), approved by the owner on 10 Nov 2026 with the decisions in its §8.

**Built**
- **`platform` schema** (owner decision). Platform tables left `public`; `tenants` and `memberships` moved with their functions. Signed-out visitors have no access to the schema. The app's database client (`@mango/db/platform-server`) points at `platform` only and reads the shared catalog with `.schema("public")`. Nothing is granted by default; every function revokes public execute and checks its caller.
- **Migrations** `20261110000100`–`500` and `20261111000100` (all `_platform_`): schema move and set-form RLS helpers (`my_tenant_ids`, `my_role`), `platform_admins`; `audit_events` with a row trigger and a helper; `locations`, `location_hours`, `location_closures`, `create_tenant()`; the catalog link; `models`, `units`, `unit_financials`, `unit_blocks`, `import_fleet()`.
- **Locations.** Time zone, address, map pin, contacts, hours, closures and (empty until 3M) market sit on the location. `tenants.timezone` is gone. A tenant can only be created together with its default location (`create_tenant`, checked when the transaction ends); the default can't be deleted or unset. Only an owner changes a time zone, with a confirm.
- **Catalog.** `public.bike_catalog` stays the one catalog. Added: `vehicle_type` (new `public.vehicle_types`: motorbike, car with a spec schema), `specs`, `requested_by_tenant_id`. A shop can request an entry and use its own pending request; a platform admin approves at `/admin/catalog`. **Platform admin is defined in one place: `platform.platform_admins`.**
- **Models and units.** Several models per catalog entry, each with its own name. Units: plate (free-form, unique per shop, any letter case) or a "plate pending" flag, frame and engine numbers, colour, odometer in km, status, borrowed window, QR token.
- **`unit_blocks`**: one table (allocation, downtime, hold, transfer), one exclusion constraint on `[start, end)`. Phase 1a writes downtime only.
- **Money.** `bigint` minor units with a currency that must equal the tenant's (composite foreign key). `unit_financials` is owner and manager only. The currency locks once a deposit or a financial row exists (trigger; the settings form shows it locked).
- **Tenant keys.** Every child carries `tenant_id` and references its parent by `(tenant_id, id)`.
- **Audit.** Every insert, update and delete on tenants, memberships, locations, hours, closures, models, units, financials and blocks writes `audit_events` (actor, only the changed columns). Imports and catalog requests are logged too. Owners and managers read it; nobody signed in can write it.
- **Role limits** (owner, 10 Nov 2026): owners and managers edit everything. Staff and mechanics add or end downtime, update the odometer (never down: that needs a manager) and switch a unit between active and maintenance. Drivers read only. The database enforces all of it (`units_guard`, policies); the screens only hide what a role can't do.
- **Screens** (375 px and 1280 px, EN and TH): Fleet list with search, model, bike (details, odometer and status, downtime, purchase and sale, mark as sold, QR sticker), add model, add bike, CSV import with a problems table, QR sticker sheet (prints without the app shell), catalog request, locations (details, hours, closures), `/admin/catalog`. Shop settings: distance unit (km or miles) added, time zone moved out, currency shown locked. Maintenance tab: real search by plate or frame number, plus the bikes in maintenance. Fleet is in the sidebar; on a phone it is reached from Maintenance or "You and this device".
- **CSV import.** Hand-written reader (`lib/csv.ts`: quotes, line breaks in quotes, BOM, comma, semicolon or tab). `lib/fleet-import.ts` checks the whole file and reports every problem by line and column; `import_fleet()` saves it in one transaction. One row per bike; a new model is created from its catalog code.
- **QR stickers.** `qrcode` package (owner OK). A sticker is a link to `/q/<token>`; the token says nothing about the bike. A member of the bike's shop lands on the bike; anyone else gets "not found".
- **Distances** are stored in km and shown in the shop's unit (`lib/distance.ts`; a reading typed in miles comes back as the same miles).
- **Forms keep what was typed** when the server answers with an error (they are submitted by script, with the plain form action as the no-JavaScript fallback).
- **Demo seed**: BSR's address, contacts, hours and a yearly Songkran closure; a platform admin (`admin@mangoworks.demo.test`); 20 demo bikes in 11 models read from `apps/platform/scripts/demo/bsr-fleet.csv` through the real reader and checks. Plates and frame numbers are fake (`DEMO-…`); one bike has no plate. Safe to run again.

**Tests** (all passing locally, 11 Nov 2026)
- Unit: 76 in the platform (CSV, import checks, money, distance, times across daylight-saving changes, form rules), 144 marketplace, 86 core.
- Database: 74 (`npm run test:db -w @mango/platform`). The isolation test now needs a fixture row per tenant in every tenant table (it fails if one is missing, or if a new table has no payload), and tries cross-tenant read, insert, update, delete and "move my row into your shop" as every role and as an outsider, then compares every row of both tenants before and after. Parent keys are tested with the service role. Every function gets a cross-tenant call. No policy may be `using (true)`.
- Playwright: 42 (21 at 375 px, 21 at 1280 px), passing locally, in CI and against the PR #8 deploy preview on staging.
- The hardened test found one real gap while it was being written: `platform_rls_report` and `platform_open_policies` were callable by any signed-in user. Fixed before the migrations were pushed anywhere.
- **No platform table is readable without RLS** (owner's question, 11 Nov 2026). Checked in the database on local and staging: all 11 tables in the schema have RLS on with at least one policy, signed-out visitors have no access to the schema, and a new table gets no automatic grants (the schema's default privileges name the service role only). The check found leftover grants on `tenants` and `memberships` from their Phase 0 creation in `public` (signed-out `select`; `truncate`, `references`, `trigger`). They couldn't be used, and migration `20261111000100` removes them. Two tests now hold this on every run (`platform_exposure_report`, `platform_schema_access`), including for tables without a `tenant_id` and with no views allowed until one has its own test.

**Server response time per page** (median of 5, signed in as the BSR owner, 20 bikes; `TIMINGS=1 npx playwright test timings --project=desktop`)

| Page | Local production build | Deploy preview (US East → Singapore) |
| --- | --- | --- |
| Dashboard | 53 ms | 1.2 s |
| Maintenance | 51 ms | 1.4 s |
| Maintenance search | 56 ms | 1.5 s |
| Fleet | 60 ms | 1.3 s |
| Model | 57 ms | 1.5 s |
| Bike | 65 ms | 1.6 s |
| Add bike | 48 ms | 1.2 s |
| Import CSV | 42 ms | 1.3 s |
| QR stickers (all 20) | 65 ms | 1.7 s |
| Locations | 44 ms | 1.5 s |
| Location | 61 ms | 1.7 s |
| Shop settings | 46 ms | 1.0 s |
| Team | 39 ms | 0.9 s |

**Acceptance checks not truly tested**
- **Scanning a printed sticker with a phone camera.** Tested: the code's link opens the bike for its shop and "not found" for anyone else. Not tested: that a real camera reads the printed code at sticker size. Needs a phone and a printout.
- **Printing.** The sheet hides the app shell with print styles; no test prints a page or checks label alignment.
- **Legacy mapping.** MAPPING.md is a design. No legacy row has been moved; the mapping is exercised for the first time at 3M.
- **"Selling a unit with future bookings is refused"** is tested with a future block (allocation and downtime kinds), as the spec says for this phase. Real bookings arrive in Phase 3.
- **Two people blocking the same bike at once**: tested with four parallel requests on a local database (one wins). Not tested under load or against the hosted database.
- **Time-zone change warning**: the confirm dialog is not driven by a test (no test changes BSR's zone, because other tests read it). The owner-only rule itself is tested in the database.
- **Thai text**: key-for-key parity with English is tested; the wording has not been read by a Thai speaker.

**Staging (11 Nov 2026)**
- All six Phase 1a migrations are on `mango-works-staging` (`supabase db push --db-url`, dry run first; live untouched), `platform` is in its Exposed schemas (owner), and the demo seed has run there (11 catalog entries added, 20 demo bikes).
- **Live needs `platform` added to API › Exposed schemas when this merges.**
- Preview pages take 0.9-1.7 s on the server against 40-65 ms locally: the functions run in US East and each query crosses to Singapore. Pages make 3-6 queries (membership, fleet, catalog, locations, blocks, money), mostly in parallel. The move to Singapore functions is already planned before Phase 4.
- Because `tenants` moved schema on staging, the Phase 0 build on the platform site's production URL stops working against staging until this branch is merged.

**Deferred / known issues**
- Model photo upload (the column exists; upload comes with the online booking page, with its own storage policy and cross-tenant test).
- Booking-mode counts are checked when a model is saved, not when a bike later leaves the fleet; Phase 2's availability function takes the smaller number.
- Odometer history is one current value; the readings log is Phase 1b.
- The audit log has no viewer yet (before Gate A).
- A shop slug of `q`, `admin`, `login`, `auth` or `offline` would collide with a route; sign-up (Phase 11) must reserve them.
- `apps/platform/CLAUDE.md` still says "allocations/downtime"; the spec's handoff section is the source for that file and wasn't edited.
- Running the seed prints a harmless Node warning about module type.

## Platform Phase 0: foundations (merged in PR #7, 10 Nov 2026)

**Built**
- Migrations (`20261109000100`–`300`, all `_platform_`): `tenants` (name, slug, country, currency, timezone, locale; no defaults, time zone checked by a trigger), `memberships` (owner, manager, staff, mechanic, driver; one user can be in several tenants), RLS helpers in a `platform_private` schema the API doesn't expose, `tenant_members()` for the team list, `set_member_role()` / `remove_member()` (owners change anyone; managers only staff, mechanics and drivers; a tenant always keeps an owner), and `platform_rls_report()` (service role only) listing every table with a `tenant_id`.
- `apps/platform` (Next.js 16, same versions as the marketplace, plus `@sentry/nextjs`): sign-in by email + password, email link, Google and LINE (buttons from `NEXT_PUBLIC_AUTH_PROVIDERS`); shop picker for people in several shops; `/[tenant]/…` shell with a sidebar on wide screens and a tab bar on phones; the 4 staff tabs (Dashboard, Orders, New order, Maintenance) laid out with "Arrives in Phase N" placeholders; Team and Shop settings for owners and managers; "You and this device" page with language (EN/TH), appearance (match device/light/dark) and tab bar position (top/bottom), each a per-device cookie; installable PWA (manifest, icons, service worker with an offline page); Sentry, off when the DSN is blank.
- Roles: owners, managers and staff see all 4 tabs; mechanics Dashboard + Maintenance and open on Maintenance; drivers Dashboard + Orders. Team and Shop settings: owners and managers.
- Demo seed: `npm run seed -w @mango/platform` (local) and `npm run seed:staging` — BSR Bike Shop (TH/THB/Asia/Bangkok) with a user per role, Saigon Scooters (VN/VND/Asia/Ho_Chi_Minh), and `both@demo.test` in both. Password = `DEMO_PASSWORD` in `apps/platform/.env.local` (the repo is public, so never committed).
- Tests: 35 unit; 26 DB tests (`npm run test:db -w @mango/platform`), incl. the acceptance check that no member of one tenant, in any role, can read any row of the other, for every table the RLS report lists (new tables are covered automatically); 18 Playwright tests at 375 px and 1280 px.
- CI: platform added to the matrix; new job starts a local Supabase in CI and runs the RLS tests, the seed and Playwright.
- Netlify: `apps/platform/netlify.toml` + ignore script. Marketplace ignore script no longer rebuilds for `supabase/`-only commits.

**Staging and preview (10 Nov 2026)**
- `mango-works-staging` has all 30 migrations (pushed with `supabase db push --db-url`, never `--linked`) and the demo seed (`npm run seed:staging`).
- Netlify site `mango-works-platform` (package dir `apps/platform`, every context on staging). It didn't auto-detect Next.js, so `apps/platform/netlify.toml` names `@netlify/plugin-nextjs`. The Netlify Drawer is off for deploy previews (it covered the phone tab bar).
- Functions run in US East (the plan can't change the region), so each page waits on round trips to Singapore. Playwright against a preview (`PLAYWRIGHT_BASE_URL`) gets 15 s waits, 60 s per test and 2 workers; local and CI keep the defaults. All 18 pass against the PR #7 preview.

**Dashboard, look and speed (10 Nov 2026, change requests #43-44)**
- Dashboard: four tabs (Today, Tomorrow, Upcoming = the 7 days after tomorrow, Late) with a count each; Late is highlighted when it has items. `lib/dashboard.ts` puts each item in exactly one tab. No items yet: each phase feeds its own in. The open tab is kept in `?view=`.
- Decided (owner, 10 Nov 2026): a pickup, delivery or collection whose date has passed and isn't done shows under Late, in its own "Missed" section. The spec's Late sentence says so.
- Look: page `#f4f4f5`, panels white, orange `#c2410c`. Contrast (WCAG 2): white on orange 5.18:1; orange on white 5.18:1, on the grey page 4.71:1; grey text 7.03:1 or better. Dark mode keeps the same orange for fills (white on it 5.18:1) and uses a lighter orange `#fb923c` for text and focus rings, because `#c2410c` on dark grey is only 3.55:1. Ratios are recorded in `app/globals.css`.
- Speed: every route has a `loading.tsx` skeleton; nav links prefetch (Next.js default in production builds). `getUser` checks the access token locally (`getClaims`) instead of calling Supabase Auth, which removes one round trip per page.
- Preview timings, median of 5, signed in as the BSR owner, 1280 px, measured from Thailand against US East functions:
  - Tap to first response: 1.5-2.7 s before, 60-75 ms after (the skeleton).
  - Tap to page content: 1.5-2.7 s before, about 1.4 s after.
  - Full page load: 1.5-2.3 s before, 1.1-1.7 s after.
- Known: because pages now stream behind their loading state, a role opening an admin page it can't see (Team, Shop settings) gets the not-found page with HTTP status 200, not 404. No data is sent. A shop you're not in is still a real 404: the shop picker sits in the `(start)` route group so no loading state wraps the shop layout's membership check.
- Remaining per-page round trips: one memberships query (plus the Team list on Team). The rest of the wait is US East to Singapore.
- Tests: 46 unit, 26 DB, 22 Playwright (11 at 375 px, 11 at 1280 px), all passing locally, in CI and against the PR #7 preview.

**Decided (9 Nov 2026, owner)**
- Sentry added; DSN from env, no-op when unset.
- Staff language and tab bar position are per-device cookies; no `/th` URL prefix.
- Every platform Netlify context points at staging until Gate A.
- Branded sign-in emails deferred (Supabase default emails until then).
- The marketplace `profiles` trigger stays: every auth user, staff included, gets a marketplace profile.
- Desktop works fully for every staff-app screen: same pages, sidebar instead of the tab bar; forms are native inputs and selects, so mouse and keyboard work everywhere.

**Deferred / known issues**
- Inviting team members is Phase 11 (spec). Until then members are added by the seed script or by Mango Works with the service role. Owners and managers can change roles and remove members.
- Tenant columns for later phases (plan, VAT, Stripe, LINE channel, booking rules, marketplace switches) are added by those phases.
- Google and LINE sign-in need the OAuth apps registered under Mango Works and enabled in staging (steps in the PR). Not tested end to end yet; email sign-in is.
- Sentry source-map upload isn't set up (needs `withSentryConfig` and an auth token), so browser stack traces are minified.
- "Pull down to refresh" on the Dashboard is a Refresh button (installed apps have no browser pull-to-refresh). A gesture can come with Phase 3's data.
- The UI and manifest say "Mango Works" until the product name is chosen.
- 2FA, session list and audit log viewer: Phase 11.

## Step 2: marketplace/booking-fees, done (merged in PR #6, 9 Nov 2026)

- From `booking-flow` (commit `ec7de98`) only: `lib/fees.ts`, `lib/fee-lifecycle.ts`, `lib/flags.ts`, `lib/fees.test.ts`, `lib/fee-lifecycle.test.ts` (23 tests). The WIP `marketplace_bookings` migration and everything else stayed behind. `booking-flow` is kept on GitHub for now.
- `fees.ts` takes the market's fee settings: `bookingFee(rental, market)` and `priceBreakdown(…, market)` with `MarketFeeSettings = { currency, feeMinimum, feeRoundingUnit? }`. Amounts are integer minor units of `currency` (THB satang, JPY yen); the exponent comes from `Intl`. No ฿50 or THB in the code. The caller (checkout, not built) supplies the settings: THB, ฿50 minimum, rounding 1 for Bangkok until markets arrive at the adapter switch. Because the adapter still returns whole baht, checkout must convert to satang before calling.
- `fee-lifecycle.ts` takes the shop's IANA time zone on every function. `lib/zoned-time.ts` (`addCalendarDays`) does the DST-aware calendar arithmetic with `Intl` only, no new dependency.
- Tests: 8 fee, 20 lifecycle (the original 23, reworked, plus DST cases), 6 zoned-time.

### Decided (9 Nov 2026, owner)

- **Fee rounding:** the booking fee rounds to whole currency units, halves up, whatever the minor units of the rental. The rounding unit is a per-market setting (`feeRoundingUnit`, in whole units, default 1; e.g. 10 → nearest ฿10).
- **Fee deadlines:** "charged 3 days before pickup" and "unpaid 2 days before pickup → cancelled" are calendar days at the pickup's clock time in the shop's time zone, not 72/48 hours. Across a DST change the gap is 71 or 73 hours. A clock time skipped by a spring-forward change moves forward by the gap; a repeated one takes the earlier instant. `docs/marketplace/SPEC.md` (Failed card charge) updated from "48 hours" to match.
- `BOOKING_ENABLED` is off unless set to exactly `"true"`, and nothing imports `flags.ts` yet, so the site is unchanged whatever the value. Added to `.env.example`. `PLATFORM_EVENTS_SECRET` from `booking-flow`'s `.env.example` was not brought over (nothing uses it).
- The `marketplace` branch (fully merged into `main`) was deleted locally and on GitHub: git can't hold both `marketplace` and `marketplace/…` branches.
- Nothing moved to `packages/core`: the fee and its states are marketplace-owned (`docs/INTEGRATION.md`), not shared rules.

## Step R: done (merged in PR #5)

- `apps/marketplace`: the Bike-Booking app, moved with `git mv` so history is kept.
- `packages/core` (`@mango/core`): rental-days, pricing, availability, closures, money, time, with their tests. Logic unchanged.
- `packages/db` (`@mango/db`): Supabase client factories and `database.types.ts`; `npm run db:types` writes there.
- `packages/config` (`@mango/config`): tsconfig base, ESLint presets with the monorepo boundaries, Prettier base.
- Root npm workspaces with one lockfile; CI (`.github/workflows/ci.yml`); `apps/marketplace/netlify.toml` with an ignore command.
- Docs: `docs/platform/SPEC.md`, `docs/marketplace/*`, the merged `docs/INTEGRATION.md`, and CLAUDE.md files at the root, in the marketplace and in the platform.

## Next

1. Owner: try the Phase 1a click-through on the deploy preview (phone and desktop), review PR #8, and add `platform` to API › Exposed schemas on live when it merges.
2. Owner: register Google and LINE sign-in for staging (not tested end to end yet).
3. Owner: archive `mango-works-platform` (the old repo) if not done yet.
4. Then Phase 2 (pricing + availability), 3 (orders + calendar), 3M (marketplace switch), 1b (fleet care).

## Open

- Platform product name.
- Shared time-zone helper: `lib/zoned-time.ts` is generic (any IANA zone, DST-aware). It may belong in `@mango/core/time` when platform Phase 2 gives that module a time-zone argument; not moved without the owner's say.

## Hard-coded Thailand assumptions (inventory, not fixed)

Step R moved this code unchanged. Each item has a target:
- **P2:** platform Phase 2 (pricing + availability engine). `@mango/core` takes a currency and a time zone.
- **AS:** the marketplace adapter switch after platform Phase 3. Markets arrive, and money moves to minor units.

Marketplace paths are relative to `apps/marketplace/`. Line numbers are as of the Step R branch.

### packages/core

| File:line | What | Target |
| --- | --- | --- |
| `packages/core/src/time.ts:12` | `BANGKOK_TIME_ZONE = "Asia/Bangkok"` | P2 |
| `packages/core/src/time.ts:16` | `BANGKOK_OFFSET_MS = 7 h`: fixed UTC+7 arithmetic, no DST support | P2 |
| `packages/core/src/time.ts:35-83` | `toBangkok`, `bangkokDateString`, `bangkokWeekday`, `startOfBangkokDay`, `bangkokDateTime`: Bangkok-only, no time-zone argument | P2 |
| `packages/core/src/time.ts:86-93` | `addDays` / `addHours` assume no DST ("exact, since Bangkok has no DST") | P2 |
| `packages/core/src/time.ts:100-108` | `formatBangkok`: `en-GB` format in Asia/Bangkok, not the viewer's locale | P2 |
| `packages/core/src/availability.ts:57` | Repair back-on dates compared as Bangkok calendar days | P2 |
| `packages/core/src/availability.ts:75` | "Bangkok midnight = 17:00 UTC the day before" boundary | P2 |
| `packages/core/src/money.ts:7-22` | `SATANG_PER_BAHT = 100`, `bahtToSatang`, `satangToBaht`: THB only, not by ISO 4217 exponent | P2 |
| `packages/core/src/money.ts:25-32` | `formatBaht`: `฿` symbol and `en-US` grouping, not by currency and locale | P2 |
| `packages/core/src/money.ts:34-37` | `assertWholeBaht`: whole major units only | P2 |
| `packages/core/src/pricing.ts:13,42,159` | Day tables require whole baht (`assertWholeBaht`) | P2 |
| `packages/core/src/pricing.ts:61,79` | Autofill rounds to the nearest ฿10, a THB-sized step | P2 |

### apps/marketplace

| File:line | What | Target |
| --- | --- | --- |
| `lib/data/types.ts:233-234` | `NewBooking.payment.currency: "THB"` literal type | AS |
| `lib/fees.test.ts`, `lib/fee-lifecycle.test.ts` | Test fixtures use THB / ฿50 and `Asia/Bangkok`; the code takes currency, minimum and time zone as arguments | none |
| `lib/data/types.ts:235` | `referralCode` passes through; there are no per-market referral rules in code yet (the referral program isn't built) | AS |
| `i18n/request.ts:14` | next-intl `timeZone: "Asia/Bangkok"` | AS |
| `app/(customer)/[locale]/layout.tsx:39` | `timeZone="Asia/Bangkok"` on the customer intl provider | AS |
| `app/admin/layout.tsx:16` | `timeZone="Asia/Bangkok"` on the admin intl provider | AS |
| `app/vendor/layout.tsx:42` | `timeZone="Asia/Bangkok"` (hidden vendor area) | AS |
| `lib/search-params.ts:33,72-77` | Search dates read as Bangkok wall-clock time (`bangkokDateTime`) | AS |
| `app/vendor/actions/fleet.ts:54,316`, `app/vendor/fleet/page.tsx:20` | "Today" is the Bangkok date (hidden vendor area) | AS |
| `app/admin/page.tsx:77`, `app/admin/shops/page.tsx:43`, `app/admin/shops/[id]/page.tsx:85-86` | `formatBangkok` for admin timestamps | AS |
| `components/customer/cards.tsx:88,154,173,178` | `formatBaht` on search cards | AS |
| `components/customer/inclusions.tsx:65` | `formatBaht` for the deposit | AS |
| `app/(customer)/[locale]/bikes/[slug]/[shop]/page.tsx:168,171,217,222,259` | `formatBaht` on the listing page | AS |
| `app/admin/shops/[id]/page.tsx:243,281,289,308,310`, `app/vendor/extras/page.tsx:62-68`, `app/vendor/fleet/[id]/model-form.tsx:114`, `components/vendor/price-editor.tsx:128,173-174` | `formatBaht` in admin and the hidden vendor area | AS |
| `components/vendor/price-editor.tsx:48,138`, `lib/validation/vendor.ts:368` | Price input strips `฿` only | AS |
| `lib/google-maps.ts:44` | `BANGKOK` default map centre (used by `components/customer/map-view.tsx:56`, `components/vendor/map-picker.tsx:95`) | AS |
| `lib/validation/vendor.ts:106-114` | Shop coordinates limited to lat 5–21, lng 97–106 ("Thailand and its neighbours") | AS |
| `app/admin/actions.ts:312-314` | Station coordinates limited to "roughly Thailand" | AS |
| `app/admin/stations/station-form.tsx:44` | Stations have a Thai name only as the second language (`name_th`) | AS |
| `lib/inclusions.ts:59-64` | Riding-area options `bangkok` / `province` / `thailand` / `cross_border` (DB enum `usage_area`) | AS |
| `app/layout.tsx:21-22` | Root metadata "Motorbike Rental Bangkok" | AS |
| `messages/en.json:3,5,542,628,629,649,732` (and the same keys in the 9 other locale files) | "Bangkok" in titles and SEO text | AS |
| `messages/en.json:308,720` (and the other locale files) | "Bangkok only" riding-area label | AS |
| `messages/en.json:280,421,504-507,606` (and the other locale files) | `(฿)` in form labels | AS |
| `e2e/customer.spec.ts:24,40,53-59` | Expected prices in `฿` | AS |
| `e2e/areas.spec.ts:6`, `e2e/languages.spec.ts:70` | Expect the "Motorbike rental in Bangkok" heading | AS |
| `components/customer/shop-info.tsx:6`, `app/vendor/settings/forms.tsx:159` | Weeks start on Monday, "as calendars in Thailand show it" | AS |
| `netlify/functions/supabase-keep-alive.mts:21` | Comment only (07:00 Bangkok); the schedule is UTC | none |

Phone numbers are already international (`lib/validation/profile.ts:3` and `lib/validation/vendor.ts:85` normalise to `+<country><number>`; tests cover a UK number), so there's nothing to change there.

Outside the two folders inventoried: `supabase/migrations` hard-codes `Asia/Bangkok` in `20261105000100_fleet_modes.sql` (3) and `20261107000200_search.sql` (11), and defaults `currency` to `THB` in `20261104000900_country_currency.sql`. New migrations change these. Applied migrations are never edited.
