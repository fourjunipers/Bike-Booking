# Progress

What's done, open decisions and known issues, across both apps. Update this at the end of every session so the next one starts clean.

## Status (12 Nov 2026)

| Track | Where it stands |
| --- | --- |
| Repo | **Step R** merged to `main` (PR #5). GitHub repo renamed to `fourjunipers/mango-works`; Netlify site `bike-booking-th` relinked to it |
| Marketplace (Moto Mangos, `apps/marketplace`) | Customer search and pages live on the `lib/data` adapter (Phase 3). Booking fee, fee lifecycle and the `BOOKING_ENABLED` flag merged to `main` (step 2, PR #6). Nothing uses them yet |
| Platform (`apps/platform`) | **Phase 0** (foundations) merged to `main` (PR #7, 10 Nov 2026) and deployed on the Netlify site `mango-works-platform` (staging data): auth, tenants, memberships, roles, RLS, app shell, staff app with its 4 tabs (placeholders), demo seed, CI. **Phase 1a** (fleet core) is built on `platform/phase-1a-fleet-core`, PR open |
| Database | 53 migrations on `main`, **all 53 on live since 12 Nov 2026** (see below). Platform tables live in the `platform` schema from Phase 1a. Live = today's Bike-Booking project (migrations only from `main`). Staging = Supabase project `mango-works-staging` (Singapore), with all 48 and the demo seed |

Build order after the 10 Nov 2026 review (docs/platform/SPEC.md › Review decisions): 0 → 1a → 2 → 3 → 3M → 1b → 4 onward.

## Products, stage A (branch `platform/products-stage-a`, 13 Nov 2026)

The first build stage of the products redesign. The design and the owner's decisions are in `docs/products-redesign.md` (PR #15, docs only). Platform only: nothing in `apps/marketplace`, nothing pushed to staging or live. `docs/platform/SPEC.md` does not have this yet (the owner maintains it).

**What changed**

- **`platform.models` is `platform.products`** (migration `20261113000200_platform_products`), with `units.model_id` → `product_id` and `model_year_bands` → `product_year_bands`, and their constraints, indexes, triggers, policies and trigger functions renamed to match. PR 13's migration (`20261113000100`) is untouched.
- **A product has a `type`** (vehicle, gear, sale_item, service) **and a `tracking` mode** (unit, bulk, consumable, none). Only the pairs that make sense are accepted, the type can never change, and every existing row is a vehicle tracked by unit. Make, model and kind are required for a vehicle and must be empty for anything else (`products_vehicle_fields_check`), so those three columns are no longer NOT NULL.
- **A unit carries its product's type** (`units.product_type`), kept equal by a composite foreign key. Only vehicles and gear can have units.
- **Functions re-created: ten, not the fifteen the design guessed.** Read from the database, these name the old table or column in their bodies: `products_guard`, `products_retire_guard`, `products_withdraw_request`, `units_clamp_product_counts`, `units_product_not_retired`, `tenants_lock_currency`, `currency_locked`, `import_fleet`, `review_catalog_request`, `submit_product_to_catalog`. Two more were only renamed (`products_keep_catalog_outcome`, `products_default_category`). `units_guard`, `unit_blocks_guard`, `catalog_requests` and the reminder queue never named the table and are unchanged.
- **`submit_model_to_catalog(p_model_id)` is `submit_product_to_catalog(p_product_id)`**: dropped and created again (a parameter name can't be changed in place), with its grant restated. `import_fleet()` reads `product_id` from each unit and answers `{"products": n, "units": n}`.
- **Audit rows written before today were relabelled** from entity `models` to `products` (and `model_year_bands` to `product_year_bands`), so a product's history is found in one place. Nothing else in those rows changed. Say if the old label should have been kept.
- **Grants:** no new table. The renamed tables keep their grants; the migration restates them under the new names, because `default-grants.test.ts` looks for each reachable table's grant by name.
- **Screens.** New **Products** list (`/[tenant]/products`: one row per product with type, kind, categories, vehicles in the fleet and the Moto Mangos chip; search and filters in the address). The product page has three tabs: **Details** (the form, the Moto Mangos panel, retire and delete), **Units** (its vehicles, "Add vehicle", year bands) and **History**. **Fleet** keeps the vehicle-unit list, the unit page, stickers and import. "Products" is in the menu before "Fleet", for every role.
- **One type-ahead on the create form** (`lib/known-models.ts`, `products/what-fields.tsx`): typing suggests known models, picking one fills make, model, engine size and transmission; an unknown model is typed in the same field and the form then asks for the rest. The linked dropdowns, the "Manually enter" button and "Choose from the list instead" are gone from this form. Keyboard: arrows, Enter picks (without sending the form), Escape closes.
- **History tab** (owners and managers): who changed what on the product, its vehicles and its year bands, newest first, the latest 100. It is the first screen that shows the audit trail to a shop.
- **Old addresses redirect:** `/fleet/models/[id]` and `/fleet/models/new`; `/fleet/units/new?model=` still works beside `?product=`.
- **Wording:** "product" in place of "make & model" and "model"; "Add vehicle" in place of "Add to inventory" and "Add product to inventory" (the owner chose those two names on 13 Nov, before the redesign: say if "Add vehicle" should go back). Thai uses สินค้า, provisional; every new or changed Thai line is in `docs/platform/thai-review-products.md` for Korn or BSR's admin.
- **Kept from the fleet rework:** categories (several per product, required for motorbikes and cars), retire and restore, the delete rules, the rejected-model flow with its two next steps, the Moto Mangos tip on the create form and the panel on the product page.

**Demo data carried across.** A database built at `main` (54 migrations) was seeded with the three demo shops, given two listed products and three downtime blocks, and migrated. Per shop, before and after: products 5 / 11 / 0, vehicles 150 / 20 / 0, year bands 15, listed 2, blocks 3, renewals 8, purchase records 20, audit rows 174 / 89 / 5, and checksums over every product's id, name, make, model, list entry, categories and listing, and every vehicle's id, product, plate and status: identical. All 16 products came out as vehicle / unit and all 170 units as vehicle units.

**Decisions and notes**

- The database test for a missing make or kind now expects the new check (`products_vehicle_fields_check`) where it expected NOT NULL. It is the one existing test whose assertion changed, not just a name.
- TypeScript names inside the app (`getModel`, `saveModel`, `FleetModel` and the like) were left: they are internal, and renaming them would have doubled the diff with no change a user or the database sees. The `Fleet.model.*` message keys kept their key names for the same reason; their texts say "product".
- The Moto Mangos listing fields (instant, request and ready-now counts, the switch) are still on the product and on the Details tab. They move to `product_listings` and their own tab in stage C.
- The deposit is still on the product and readable by every member, as before. It moves to `product_pricing` in stage D, where mechanics and drivers stop seeing prices.
- This worktree runs its own local Supabase (`Bike_Booking_products_a`, ports 563xx) so it does not disturb the other two. Its `supabase/config.toml` change is local only (`git update-index --skip-worktree`).

**Tests (all passing locally, 13 Nov 2026)**

- Database: 172 (153 existing with names changed, 19 new in `tests/db/products.test.ts`: nothing left named after models, grants and RLS kept, the type and tracking rules, a unit's product type, each re-created function run once including the reminder queue and the CSV import, the History rows and who may read them). Run on a database rebuilt from scratch with all 55 migrations.
- Unit: platform 146 (21 new in `lib/products.test.ts`: the type-ahead's matching and splitting, the Products list filters, history lines, the menu, key parity in both languages, no "make & model", "inventory" or "Manually enter" left in the texts), marketplace 202, core 86.
- Playwright: 70 passed at 375 px and 1280 px, 2 skipped (the timing measurement, which runs only on request). New `e2e/products.spec.ts` (list, filters, tabs, History, old addresses, a mechanic, driver and staff member reading without changing, another shop's product); `e2e/fleet.spec.ts` follows the type-ahead, with a keyboard-only pass.
- `npm run typecheck && npm run lint && npm test` from the root: clean.

**On staging, not on live (13 Nov 2026).** PR 13's migration (`20261113000100_platform_fleet_rework`) and PR 16's (`20261113000200_platform_products`) are both on staging: staging records 55 of 55. **Neither is on live**, which stays at 53 of 53; live gets them only from `main`, by the runbook, after stage C.

- Pushed from this branch on the owner's instruction with `supabase db push --db-url` after a dry run that listed exactly one pending migration (`20261113000200`); staging already had PR 13's.
- Staging's data came through unchanged: per shop, the same counts and checksums before and after (big-fleet 9 products and 150 vehicles, bsr 18 and 26, saigon-scooters none; year bands, listings, blocks, renewals, purchase records and audit rows the same). All 27 products are vehicle / unit and all 176 units vehicle units; no function is left naming `models`; the reminder queue function runs.
- The demo seed was re-run on staging (`npm run seed:staging`): everything was already there, nothing added.
- PR 16's Netlify preview (`deploy-preview-16--mango-works-platform.netlify.app`) was opened signed in as the BSR demo owner at phone and desktop width: the Products list, the new-product form with its suggestions, a product's Details, Units and History tabs, and Fleet all load. That pass only read; it saved nothing.
- Until PR 16 merges, the platform site's main deploy and any other branch's preview still run the old code against staging and will fail on the fleet pages, because the table they read was renamed.

**Not truly tested**

- The full browser suite was not run against the Netlify preview, only the read-only pass above. The suite ran on a local production build with a local database, and in CI.
- A real phone: phone width in a desktop browser only. Thai wording: key parity only.
- The live push: not done, by instruction. It follows the runbook after stage C.

**Found on the way**

- A product address that isn't an id (`/products/abc`) gave "Something went wrong"; it is "Page not found" now. The old model page had the same fault.
- Port 3300, which the browser tests use, was held by a server from the `Bike Booking-ui-refresh` checkout. A first test run was pointed at it for about two minutes before this was noticed and stopped; it may have left a few test rows in that checkout's local demo database (local only). The tests were then run against this worktree's own server on port 3310.

**Not built here (later stages):** gear, services and items for sale on screen, quantities, the `lost` status (B); the Moto Mangos tab and `product_listings` (C); prices (D).

## Fleet rework: Make & model, Add to inventory, kinds and categories (branch `platform/fleet-rework`, 12 Nov 2026)

Owner's request after the click-through: "Add model" and "Add bike" did the same job and read alike. Built to the owner's instruction in chat; `docs/platform/SPEC.md` in the repo does not have this text yet (the owner maintains it).

- **Two buttons, one job each.** "+ Make & model" (top of Fleet) adds a kind of vehicle. "+ Add to inventory" (just above the list) adds one vehicle of a make & model the shop already has, and **never creates a make & model**: its dropdowns list the shop's own only, with a link to "+ Make & model" that comes back afterwards. Each model row has a labelled, outlined “+ Vehicle” button (44 px tall) left of the arrow that opens the inventory form with that model chosen.
- **The old "Add my own" page is gone** (`/fleet/own-model`): typing a make and model in is part of the Make & model form.
- **Kind first.** The form starts with Motorbike, Car, Off-road, Boat or jet ski, Other, and reshapes: a motorbike is picked from the Moto Mangos list or typed in; everything else is typed in; engine size and transmission are required for motorbikes only (unchanged rule). The kinds are the database's vehicle types (`atv` reads "Off-road", `boat` reads "Boat or jet ski"). Dirt bikes are motorbikes, category off-road.
- **Categories: one list in the code**, `apps/platform/lib/vehicle-kinds.ts`, changeable with no migration (the database only checks the key's shape). First guesses: motorbike scooter, touring, adventure, sport, classic, off-road; car sedan, SUV, pickup, van, hatchback, convertible; off-road ATV, UTV; boat jet ski, speedboat, pontoon. Required for motorbikes and cars, optional for the rest, none for Other. Labels are in the messages; a key with no label shows as the key made readable.
- **Categories are stored on the model** (`platform.models.categories`, a list: a model can have several, e.g. Adventure and Touring). Motorbike keys are the types Moto Mangos files a bike under, so "Send to Moto Mangos" no longer asks for the type. A model on a list entry takes the entry's type unless the shop picks its own; existing models were filled that way. A typed-in motorbike with no category is asked for one before it can be sent.
- **Helpful tip** on the add form, motorbikes only, right under the make and model: a lightly tinted box with a lightbulb. One text for a model picked from the Moto Mangos list, another for one typed in (the owner's wording). No toggle there: listing stays on the model page, and does nothing until Moto Mangos reads from the platform (after Phase 3). The Moto Mangos mark (inline SVG copied from the marketplace refresh) is still used for the review markers.
- **Review results reach the shop.** New `platform.models.catalog_approved_at`, set by `review_catalog_request()` on approve and merge (the shop can't write it). The dashboard shows a "Moto Mangos reviews" block for owners and managers, the Fleet list a marker beside the model, and the model page a line: "not added" for as long as the rejection stands, "added" for 14 days (`reviewNewsDays`). No email or LINE yet (Phases 3 and 6).
- **"Bike" is "vehicle"** in every platform text except the Moto Mangos panel and the catalog admin (Moto Mangos lists motorbikes). Thai already used the general word (รถ), so only new lines changed there: `docs/platform/thai-review-fleet-rework.md` lists them for the owner's approval.
- **CSV import:** new optional `category` column (required for a new motorbike or car that isn't on the list; several are separated by a semicolon, `adventure; touring`); `vehicle_type` also accepts "Off-road", "jet ski" and the like; the page lists each kind's categories from the code. The import still creates makes & models: it is the bulk path.
- **Fleet list:** a "Kind of vehicle" filter and a "Category" filter (a model matches on any of its categories); each model's heading line shows all its categories. A make & model with no vehicles yet still shows when only those filters are on. Model titles have no underline at rest (underline on hover, ring on focus).
- **Pencil** beside a model's name: a plain 44 px icon button, no box, soft tint on hover, focus ring.
- **Migration `20261113000100_platform_fleet_rework`:** the two columns, a trigger that defaults the categories from the list entry, the review function and `import_fleet()` replaced in place. No new table or API-reachable function, so no new grants; `default-grants.test.ts` passes. On local and staging; **not on live**.
- **Tests:** `lib/vehicle-kinds.test.ts` (kinds, categories, labels in both languages, CSV category, kind filter, review news); `tests/db/fleet-rework.test.ts` (9); the fleet Playwright tests follow the new flow, plus a new one for the two buttons, the row +, and the kind filter.
- **Test helper:** database tests now pick this checkout's own database container (by `project_id`), because a second checkout of the repo can run its own beside it.

Second round, after the owner's click-through (12 Nov 2026, evening):

- **Several categories per model.** The form's category field is a row of checkbox chips (44 px, real checkboxes); "required" for motorbikes and cars means at least one, checked on the server. Stored in the list's own order, without repeats.
- **The migration was changed in place** (`category text` became `categories text[]`), on the owner's instruction, because it was not on live or `main`. Local was rebuilt. **Staging had the first version applied**, so it was taken back there by hand (the old trigger, trigger function and two columns dropped; the migration marked as not applied) and the new version pushed, together with `20261112100000_marketplace_station_osm_refresh` from `main`, which staging did not have yet.
- "Not in the list?" and "Choose from the list instead" are outlined buttons, 44 px tall.
- The Moto Mangos card became the helpful tip; the row + became "+ Vehicle"; model titles lost their underline; a category filter was added to the Fleet list (the owner's note mentioned the filter; there was none for categories before).
- The branch has `main` merged in (PRs #12 and #14); `docs/PROGRESS.md` was the only conflict.

Third round (owner's second click-through, 12 Nov 2026, late):

- **Bug: a model could be saved with no category.** Cause: `saveModel` skipped the category check for a model picked from the Moto Mangos list when no chip was ticked ("as Moto Mangos files it") and let the database fill in the list's type, so the form never refused it. A typed-in motorbike or car was already refused. The exception is removed: a motorbike or a car needs at least one category, list model or not, with the message under the chips. `e2e/fleet.spec.ts` unticks a list model's chip and expects the refusal (it saved before the fix). The database default stays for the CSV import, where a list model with no `category` cell takes the list's.
- **Leaf green buttons.** New tokens `--leaf` and `--leaf-soft` in `app/globals.css` (text and outline #336600: 6.89:1 on white, 6.22:1 on the hover tint; dark theme #a3d977). "Manually enter" (was "Not in the list?") sits beside the line "Don't see your bike in the list?"; "Choose from the list instead" has the same look. The "Pick from the Moto Mangos list" label is gone.
- **Rejected models: what to do next.** Beside the reviewer's note: one line and two buttons. "Edit and send again" goes to the details form; the send button then reads "Send for review again". "Choose a model from the list instead" goes to a new picker of the whole approved list ("Use this model"), which is there for every own motorbike.
- **Resubmitting needed no migration.** A rejected model goes back to being the shop's own; `submit_model_to_catalog()` makes a new request, and the trigger from `20261112000400` clears the rejection on the model once it is on that request. The old reason is kept on the old request (`bike_catalog.review_notes`, status rejected) and in the audit log, not on the model; `tests/db/fleet-rework.test.ts` checks this. The shop has no screen for that history yet.
- **Approved means listed.** The owner's text says "switch it on and we'll review it first... It goes live once approved", so `review_catalog_request()` now sets `marketplace_listed = true` when it approves or merges a request (in the fleet-rework migration, changed in place again; nothing from `20261112000400` was touched). The shop can switch it off. The control is still the send form (first and last model year, a note), with the button "Switch on and send for review".
- **Moto Mangos panel** on the model page is headed by the logo (`apps/platform/public/moto-mangos-logo.png`, copied from the marketplace), on a white plate so it reads on the dark theme.
- **Fleet list look.** Each make & model is one card: a header row in the light mango tint (dark text, AA) with a kind icon in a fixed 44 px box (a photo instead when the model has one with a web address; none do until Phase 3 uploads them), the title and pencil, then chips: Moto Mangos status for owners and managers (green Listed on Moto Mangos, amber In review, red Needs changes, grey Not listed; motorbikes only), the categories, and a dark count badge. Rows under it alternate with a very light cream. The old "Added / Not added to Moto Mangos" markers are replaced by the chips; the dashboard block is unchanged.
- Staging: the first second-round version of the migration was taken back by hand again and the new one pushed (see the report).

Fourth round, deleting and retiring (owner, 12 Nov 2026, night):

- **What was already there:** a vehicle can be deleted by an owner or manager unless anything on its calendar points at it (downtime now, bookings from Phase 3); sold and retired vehicles leave the default list ("Show: Sold and retired" brings them back); a make & model can be deleted when it has no vehicles; every insert, update and delete is in the audit trail with who did it.
- **Retire instead.** When deleting a vehicle is refused, the message says why and shows a "Retire instead" button (not for one that is already sold or retired). It is refused in turn while the vehicle has a block still to come.
- **Restore.** A retired vehicle has a plain "Restore" button (back to active).
- **Confirmations.** Choosing Retired or Sold in the status form asks first and says what will happen. Deleting already asked.
- **Retiring a make & model.** New `platform.models.retired_at`. "Retire make & model" shows on its page once none of its vehicles is in the fleet (all sold or retired, or it has none); it asks first. A retired model leaves the fleet list (it is under "Show: Sold and retired", with a "Retired" chip) and the "Add to inventory" form, comes off Moto Mangos (`marketplace_listed` goes off and can't be switched on), and takes no vehicle that is in the fleet, new or restored, until "Restore make & model". The database enforces all of it (`models_retire_guard`, `units_model_not_retired`).
- **Deleting a model that waits for review withdraws the request** (owner's decision): the request is closed as rejected with the note "Withdrawn: the shop deleted the model." (`models_withdraw_request`). A model on an approved list entry leaves the entry alone.
- All of this is in `20261113000100_platform_fleet_rework`, changed in place again (not on `main` or live); nothing from `20261112000400` was touched. No new table or API-reachable function, so no new grants.
- Found on the way: the status choices on a vehicle's page kept showing the old status after a button changed it; they now redraw.
- Tests: `tests/db/fleet-rework.test.ts` (retire rules, listing off, no vehicles on a retired model, who may and the audit row, refused delete, withdrawn request); a Playwright test for the whole flow; the fleet-view unit test covers where a retired model shows.

Fifth round (owner's click-through, 13 Nov 2026):

- **Deleting a vehicle clears its downtime records.** The owner could not delete DEMO-004 on staging: it had five downtime records that ended days before (left by test runs), and any block, however old, stopped the delete. A `units_clear_downtime` trigger now deletes a vehicle's downtime with it (in the fleet-rework migration, changed in place). Bookings still stop it: an allocation, hold or transfer keeps the foreign key, and the app then offers "Retire instead". Until Phase 3 there are no bookings, so today every vehicle can be deleted.
- **This supersedes the fourth-round line** "a vehicle can be deleted unless anything on its calendar points at it".
- **Delete vehicle** is the last thing on the vehicle's page, under Purchase and sale, a solid red button; "Retire instead" appears to its right when a delete is refused. The warning says it is permanent and what is erased (purchase and sale details, tax and insurance, downtime, odometer history).
- **Buttons renamed:** "+ Make & model" is "+ New Product"; the row's "+ Vehicle" is "+ Add product to inventory"; the separate "+ Add to inventory" button above the Fleet list is gone (the form is still reached from each row and from a model's page). Page titles and other texts still say "make & model" and "Add to inventory".
- The grey chip reads "Not on Moto Mangos" (was "Not listed", which did not say of what).
- Text for a model not on the list now ends "Or select the model if already in the list below."

Open, for the owner:

- **Deleting a vehicle that has bookings (from Phase 3).** The owner wants vendors to be able to remove any vehicle for good while past sales history stays. A real delete can't do both: it erases the vehicle's own records and would leave past orders pointing at nothing. Proposed for Phase 3: "Remove for good" marks the vehicle as removed (never shown again, not restorable from the app, plate free to reuse) and keeps the row for past orders and reports. Needs a column and every vehicle query to leave removed ones out.
- **"Edit" button beside Save on the make & model page:** not built; the page is already an edit form. Waiting for the owner to say what could not be changed.

Known limits and open points:

- **A retired make & model still counts** in the "N makes & models" line at the top of Fleet and still appears in the fleet filters' model dropdown.
- **Sold vehicles have no Restore button** (only retired ones, as asked); the status form can still set one back to active.
- **Moto Mangos files a motorbike under one type.** A model with several categories is sent with the first one in the list's order (Scooter, Touring, Adventure, Sport, Classic, Off-road), so "Adventure and Touring" goes as Touring. Phase 3 (or the owner) should decide whether the shop picks the main one or Moto Mangos takes several.
- A motorbike on a list entry can be given a category different from the list's. Nothing uses the difference yet; Phase 3 should decide which one Moto Mangos search reads.
- Removing a category from the list leaves models that have it unchanged; the form then asks for a new one on the next save.
- The review block has no "dismiss": a rejection shows until the model is sent again or put on a list entry.
- The local dev server (`next dev`) is too slow for the long Playwright tests; they were run against a local production build, as CI does.

## Marketplace UI batch (branch `marketplace/ui-refresh`, 12 Nov 2026, not merged)

Done (items 1 to 5 of the owner's batch):

- **Moto Mangos look.** Tokens in `app/globals.css` (hex, so `lib/design-tokens.test.ts` checks WCAG contrast): mango primary with **near-black text** (white on mango fails AA), leaf green accents, cream background (palette updated to the logo, see below), `--link` (dark mango) for mango-coloured text. Nunito 800 headings (Thai falls back to the system font). Mango badge drawn in `components/brand/logo.tsx` and `app/icon.svg` (the favicon; `favicon.ico` removed); speed-line and leaf accents. The shared header is restyled for admin and vendor too; they show their area name as a pill.
- **Page titles and descriptions, Thailand-wide** (owner approved, 12 Nov 2026), English and Thai: "Motorbike rental in Thailand", "Rent a {name} in Thailand", "{shop} – motorbike rental", root title "Moto Mangos – Motorbike rental in Thailand". The Thai is listed for native review in `i18n/machine-translated.ts` (`thaiNeedsNativeReview`).
- **Bike types** are multi-select toggles; none = any type. URL: repeated `type=` (old one-type links still work). Adapter: `SearchQuery.types` (docs/INTEGRATION.md updated); `current-db.ts` passes one type to `search_offers` and filters several in code, so no migration.
- **Book ahead / Ride today.** "Search bikes" → "Check availability & prices". The home form has two paths: Book ahead (dates) and Ride today (`now=1`, only bikes ready now; no dates). "Get your bike now" text is gone from the customer site and the vendor help text. docs/marketplace/SPEC.md (Home, Filters rows) updated.
- **24-hour times**: a 00:00–23:30 list in 30-minute steps (`TIME_OPTIONS`), default 10:00 for pickup and return; picking a pickup date sets the return to the next day.
- **Place search (item 2).** The station dropdown is replaced by a place search with suggestions (city, area, landmark, airport; any country), "Use my location", and an optional "Near a train station" list. Google Places API (New) through our own routes (`/api/places/autocomplete`, `/api/places/[placeId]`, `lib/places.ts`) with the server-only `GOOGLE_PLACES_SERVER_KEY`: one session token per search, 3 characters and a 300 ms pause before a request, Place Details asks for `location` only (Essentials SKU; `displayName` would be Pro), chosen places cached per server instance for 6 hours (Google allows 30 days), 60 requests a minute per caller. If Places fails or answers 429, the form shows the station list and "Use my location" instead (`e2e/place-search.spec.ts`).
- **Station refresh from OpenStreetMap.** Migration `20261112100000_marketplace_station_osm_refresh` adds `osm_id`, `osm_last_seen_at`, `osm_missing_since` to `public.stations` (no new table or function; grants restated; `default-grants.test.ts` passes). Netlify scheduled function `refresh-stations` (03:00 UTC on the 1st) → `POST /api/cron/stations` (Bearer `CRON_SECRET`) → Overpass → merge by OSM id (`lib/stations/osm.ts`, `merge.ts`, `refresh.ts`). Seeded stations link by name within 400 m; a same-name station within 400 m of one we have is an interchange platform and isn't added; vanished stations are switched off, never deleted, and switched back on if they return; stations an admin switched off stay off; nothing is switched off if Overpass returns under half of the linked stations. Dry run on real OpenStreetMap data (12 Nov 2026): 181 of 182 seeded stations linked ("Sena Ruam" not found, left as is), 60 new (mostly SRT commuter and Maeklong line halts).
- **Seed dates relative to today**: the seeded booking K7Q4ZP now runs from 2 days ago to 12 days on (Bangkok), so `e2e/customer.spec.ts` "dates show the total…" and the two DB tests that use it no longer fall into the past (`tests/db/helpers.ts` → `bangkokDay()`).
- New keys in all 10 customer languages. The other eight are unreviewed machine translations, and the Thai awaits a native speaker's check; both lists are in `apps/marketplace/i18n/machine-translated.ts`.
- **Sort**: "Recommended" (ranking score, 20% distance) stays the default when a place is chosen (owner, 12 Nov 2026); "Distance" is in Sort.
- **Logo palette, logo, hero, search tabs** (owner, 12 Nov 2026, second pass):
  - Navy is gone. Tokens now follow the logo: `--mango` #f8920a (sampled from the wordmark), `--ink` #0b1220 near-black for text and headings, `--leaf` #3f7f00 accent (`--leaf-bright` #68a800 is the logo's leaf, decorative only), white cards on warm cream. The header is white, and the footer is near-black. The favicon was recoloured to match. AA is checked in `lib/design-tokens.test.ts`, which now also covers the tab colours and tints. That test's token regex had lost its `\s` escape and only matched by luck; fixed.
  - Logo: `public/logo.png` is the owner's "04 Helmet Mango" PNG (710×290), shown in the top bar on the left. It links to the language's home (`/`, `/th`, …) with the alt text "Moto Mangos – motorbike rental in Thailand". The drawn SVG logo component was removed.
  - Hero: the H1 stays real text. A subline under it replaces the old intro line: "Compare bikes, prices and deposits from local shops. Get the best bike at the best price." (`Customer.subline`). Thai is flagged for native review; the other eight languages are machine-translated and listed. `<title>` and the meta description are unchanged.
  - Book ahead / Ride today are now two large tabs at the top of the search box (the ARIA tabs pattern: arrows, Home, End, roving focus; at least 56 px tall). Each tab swaps a tinted card: leaf-soft for Book ahead, mango-soft for Ride today. The active tab is filled in its colour and has a notch pointing at the card; the inactive one is outlined. The URL and state are unchanged (`now=1`, `from`/`to` only for Book ahead).

Open:

- **Vendor opening hours still use the old time input** (`<input type="time">` in `app/vendor/settings/forms.tsx`), not the 24-hour list: the vendor screens are hidden and not built on. Mango Works replaces them.
- **Station refresh not run against real Overpass end to end yet**: on 12 Nov 2026 overpass-api.de answered 502 and the mirror timed out (twice). The write path is tested (`tests/db/stations-refresh.test.ts`) and the merge was dry-run on real data. First real run: after deploy, or by hand with `curl -X POST -H "Authorization: Bearer $CRON_SECRET" <site>/api/cron/stations`.
- **Check the station refresh after its first monthly run** (1st of the month, 03:00 UTC): open Netlify → Logs → Functions and look for the route's "Station refresh {…}" line (counts added, linked, switched off) or "Station refresh failed". The scheduled function waits only 25 s (its limit is 30 s; the route's is 60 s and Overpass often needs 30-40 s) and assumes the route keeps running after it stops waiting. **If the route times out**, split the work by region: one Overpass request per area in `STATION_AREAS` (`lib/stations/osm.ts`), one area per run or per call, instead of one large area at once.
- **Migration only on local**: not on staging or live. Live gets it only from `main`.
- **Titles in the other eight languages** still say Bangkok (only English and Thai were changed, as asked).
- **Google keys are set in Netlify** (owner, 12 Nov 2026): place search works on deploy preview 12 (real suggestions checked). Quotas and the budget alert (checklist steps 4 and 5) are the owner's to confirm.

Later, Moto Mangos (owner, 12 Nov 2026; not built):

- **Suggest our own shop locations first, Google second.** As the customer types, match the text against our shops' names, areas and towns (free, from the shop list we already have). Call Google Places only when nothing of ours matches, to cut Places cost. Keep the 3-character, 300 ms and session-token rules for the Google calls.

Google Cloud checklist (owner; keys set in Netlify on 12 Nov 2026, kept for reference):

1. APIs enabled: Places API (New) and Maps JavaScript API only.
2. Server key (`GOOGLE_PLACES_SERVER_KEY`): API restriction = Places API (New) only. Application restriction: none (Netlify has no fixed IP); it never reaches the browser.
3. Browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, map only): API restriction = Maps JavaScript API; website restriction = the site and deploy-preview domains.
4. Quotas (Google Maps Platform → Quotas, Places API (New)): per-day caps on Autocomplete and Place Details/Get Place. Google's free-tier sizing is 10,000 ÷ 31 ≈ 322 a day each; raise when traffic grows. Also lower the per-minute caps if offered.
5. Budget with alerts at e.g. 50%, 90%, 100% of a small monthly amount. Budgets only alert; the daily quotas are what stop spending.
6. Put the key in Netlify → Site configuration → Environment variables only (scopes: Builds and Functions; the home page is built ahead, so redeploy after setting it). Never in the repo or chat.

## Live at 53 of 53 migrations (12 Nov 2026, evening)

Asked: push PR #12's one migration (`20261112100000_marketplace_station_osm_refresh`) to live. The dry run listed four, because **PR #11's three migrations had merged to `main` but had never been pushed to live**. Stopped, reported, and on the owner's go pushed all four together, in order.

| Migration | On live it |
| --- | --- |
| `20261112000200_platform_lock_strength` | Replaces three platform functions (no data) |
| `20261112000300_marketplace_catalog_requester_private` | Makes `requested_by_shop_id` unreadable to the public: 21 readable catalog columns, was 22 |
| `20261112000400_platform_reject_reason` | Adds two columns and a trigger on `platform.models` (no rows) |
| `20261112100000_marketplace_station_osm_refresh` | Adds `osm_id`, `osm_last_seen_at`, `osm_missing_since` to `public.stations` and a unique index on `osm_id` |

- **From** `main` at `f0f7f19`, with `npx supabase db push --linked`, after a fresh backup (`C:\Users\markw\mango-live-backups\2026-11-12_1738`: roles, schema, data) and a dry run listing exactly these four. No errors.
- **Live records 53 of 53.**
- **Runbook checks (read-only):** row counts of all 24 `public` tables identical before and after (A1/B2); catalog defaults 25 of 25 (B3); private catalog columns readable by the public 0, now checking all four (B4); readable catalog columns **21** for anon and for authenticated (B5); platform still empty (B6); vehicle types and the hourly job unchanged (B7, B8); C1 to C5 identical to the earlier runs; grants fingerprint (C6) identical before and after.
- **No-default-grants expectations on live:** defaults for new `public` tables, sequences and functions are still empty for anon, authenticated and service_role; 39 tables reachable by anon or authenticated, the same set as before (no new table); no function in `public` or `platform` is executable by everyone beyond the closed list; no table without RLS.
- **Through live's API as the public (anon key, reads only):** 37 of 38 queries answer 200 and the private-column probe is refused, as before. 35 of the 36 dry-run queries are byte-identical to the dry-run answers. The one that differs is `stations` read with every column: the same 182 rows, now with the three new columns (all empty until the first refresh runs).
- **Station list:** `station_list()` returns the same answer as before, byte for byte (182 stations). The marketplace home page and `/search` return 200.
- **New station columns exist:** `osm_id text`, `osm_last_seen_at timestamptz`, `osm_missing_since timestamptz`, all nullable; 0 of 182 rows have an `osm_id` yet.
- Not done here: nothing on Netlify or Google was touched, and whether the scheduled station refresh runs was not checked. PR #13's migration (`20261113000100`) is not on `main` and not on live.
- `checks.sql` still says "22" for B5 with a note that it is 21 once `20261112000300` is applied; that is now the case on live.
- The runbook's `rollback.sql` undoes the first 21 platform migrations only. It would not have been the way back for these four; a failure here would have needed a forward fix or the backup.

## Re-check follow-ups (branch `platform/recheck-followups`, 12 Nov 2026)

Four follow-ups from the second look at the Phase 1a review. Three migrations. They merged with PR #11 but **were not on live until the push of 12 Nov 2026 recorded below** (live stayed at 49 in between).

| # | What | Migration | Test |
| --- | --- | --- | --- |
| 1 | **Lock strength.** `set_member_role`, `remove_member` and the counts trigger took a full row lock (`FOR UPDATE`), which also waits for every foreign-key check on that row. A team change waited behind any open insert in the shop (3.6 s behind a 4 s downtime insert), and two bikes swapping models deadlocked. Now `FOR NO KEY UPDATE`: still one at a time, no longer in the way of foreign keys | `20261112000200_platform_lock_strength` | `recheck-followups.test.ts` › 1 (4 tests; the first and third failed before) |
| 2 | **Marketplace admin queue** lists only requests from marketplace shops (`requested_by_shop_id is not null`). A platform shop's request is decided in the platform's `/admin/catalog`, which also unlinks or relinks the shop's models. The query moved to `apps/marketplace/lib/admin-queue.ts` so it can be tested | none | `apps/marketplace/tests/db/admin-queue.test.ts` (3 tests; 2 fail without the filter) |
| 3 | **`requested_by_shop_id` is private.** Taken out of the catalog columns anon and signed-in users may select: 21 readable now, 4 private (`request_note`, `requested_by_tenant_id`, `review_notes`, `requested_by_shop_id`). No marketplace or platform query selected it with those roles: vendors only insert it, the "Shops read their own requests" policy uses it inside the database, and the admin pages use the service role | `20261112000300_marketplace_catalog_requester_private` | `recheck-followups.test.ts` › 3 |
| 4 | **A rejected request says why.** New on `platform.models`: `catalog_rejected_at`, `catalog_reject_reason`, set by `review_catalog_request()` on reject, shown on the model page ("Moto Mangos reviewed this model on … and didn't add it", with the reviewer's note). Cleared when the model is sent again or put on a catalog entry. A trigger stops the shop writing them. `bike_catalog.review_notes` stays private. The admin's note field now says the shop will see it | `20261112000400_platform_reject_reason` | `recheck-followups.test.ts` › 4 (5 tests), and a step in the own-model Playwright test |

Decisions and notes:

- **Why a column on the model, not the audit row:** after a reject the model is unlinked from the catalog entry, and the audit row names the entry, not the model, so there was nothing to join on. The audit log is also owners and managers only. The audit row still records the note.
- **No new grants were needed** under the no-default-grants rule: no new table, the two new columns sit on `platform.models` (granted on purpose in `20261110000500`), functions were replaced in place and keep their grants, and the one new function is a trigger function in `platform_private` with everything revoked. `default-grants.test.ts` passes.
- **The 36 public read queries** were run again on a copy of live's data (from the 12 Nov backup) with all 52 migrations applied: answers byte-identical to the dry run's.
- `review_catalog_request` still takes `FOR UPDATE` on the catalog entry. Not changed: the re-check named the three above, and nothing takes a foreign-key lock on a waiting request in a way that matters. Say if it should follow.
- The marketplace admin can still open a platform shop's request by its direct address (`/admin/catalog/<id>`); only the queue hides it. Left as is.
- Thai texts for the new lines are mine and need a native check, like the others.
- Not covered by a test: that a real API call never waits behind other kinds of open inserts (bikes, models); the test uses a downtime insert, and the lock is the same one.

## Platform migrations on live (12 Nov 2026)

Done by `docs/RUNBOOK-GO-LIVE-PLATFORM.md`, from `main` at `02f5a26` (PR #8 merged).

- **Pre-flight (read-only):** 27 migrations on live, `pg_cron` 1.6.4 and `btree_gist` 1.7 available and not installed, nothing in the way, row counts as on the dry-run copy.
- **Backup:** `C:\Users\markw\mango-live-backups\2026-11-12_1112` (`roles.sql`, `schema.sql`, `data.sql`), outside the repo. The schema file is identical to the copy the dry run used. Owner: keep a second private copy.
- **Applied:** `npx supabase db push --linked`, 21 migrations, no errors. Live records 48 of 48.
- **Verified (B1 to B8, C1 to C5):** all as expected. Every marketplace table has the row count it had before; the 25 catalog entries got the defaults; the public reads 22 catalog columns and none of the 3 private ones; the platform is empty (0 shops, 0 members, 0 admins); the hourly job `platform-renewal-notifications` is scheduled and active; RLS is on for every `public` and `platform` table and no platform policy is open.
- **Dashboard (owner):** `platform` added to Exposed schemas (`platform_private` is not); "Automatically expose new tables" turned off.
- **After the dashboard change:** the grants fingerprint (C6) is unchanged (anon/public 135, authenticated/platform 45, authenticated/public 135, same hashes), so the switch altered no existing grant. C1 to C5 again: identical.
- **Through live's API as the public (anon key, reads only):** the dry run's 36 public queries (22 tables, the catalog as each page asks for it, stations, search, shop and model functions) returned answers byte-identical to the dry-run copy; a private catalog column is refused. Every `platform` table and function answers "permission denied for schema platform" (the schema is exposed and the public has no way in; no rows), and `platform_private` answers "Only the following schemas are exposed: public, graphql_public, platform".
- **How live was read:** the CLI has no SQL command, so checks ran through the CLI's own temporary login in a session set to read-only (a write was tried first and refused).
- Not done: the signed-in marketplace click-through (vendor fleet, admin catalog) is the owner's. The dry run's 21 service-role queries were not repeated on live (public key only).
- Still open before the platform app can point at live: a way to create the first shop and first platform admin there, and the platform URL in live's Auth redirect list. Netlify still points every platform context at staging.

## No default grants on new tables (branch `platform/no-default-grants`, 12 Nov 2026)

Live no longer exposes new tables automatically, but local and CI databases still granted everything by default, so a migration that forgot its grant would have passed every test and failed on live.

- **What the dashboard switch did on live** (read from `pg_default_acl`): for objects `postgres` creates in `public`, anon, authenticated **and service_role** lost SELECT, INSERT, UPDATE, DELETE on tables, USAGE and SELECT on sequences, and EXECUTE on functions. It left TRUNCATE, REFERENCES, TRIGGER, MAINTAIN on tables and UPDATE on sequences.
- **Migration `20261112000100_platform_no_default_grants`:** removes every default for those three roles on new tables, sequences and functions in `public`. Local and CI now behave like live; on live it only removes the leftovers above. Nothing that exists changes. `platform` keeps its own defaults for service_role and never had any for anon or authenticated.
- **Rule from now on:** a migration that creates a table in `public` grants on purpose, to service_role too (`grant select on public.thing to anon, authenticated; grant all on public.thing to service_role;`). In root `CLAUDE.md`.
- **Test** `apps/platform/tests/db/default-grants.test.ts` (runs in CI's "RLS + Playwright" job): the defaults give the API roles nothing; a new table or sequence is closed until granted; every table in `public` or `platform` that anon or authenticated can reach has a `grant` statement in a migration (the 23 marketplace tables from before the switch are a closed list); no function in `public` or `platform` is executable by everyone (the 35 marketplace functions from before the switch are a closed list). Shown to fail on a table granted outside a migration and on an open function, and to pass again when they are removed.
- **Functions, known limit:** Postgres lets PUBLIC execute every new function, on live too, and that default can only be removed for all schemas at once, which would also hit extensions. So functions keep the existing rule (`revoke all on function ... from public, anon`, then grant), now enforced by the test above instead of by a default.
- **On live since 12 Nov 2026** (PR #9 merged; pushed from `main` at `b6fc97c` with `npx supabase db push --linked`, the dry run listing only this migration). Live records 49 of 49.
  - Grants fingerprint (C6) before and after the push: identical (anon/public 135, authenticated/platform 45, authenticated/public 135, same hashes). No existing grant changed.
  - C1 to C5 again: identical to the earlier runs.
  - Live's defaults for what `postgres` creates in `public` are now empty for anon, authenticated and service_role on tables, sequences and functions (only `postgres` itself is listed). `platform` keeps its defaults for service_role only.

## Go-live runbook for the platform migrations (12 Nov 2026)

Prepared and dry-run before the go-live above: `docs/RUNBOOK-GO-LIVE-PLATFORM.md`, with `docs/runbook-go-live-platform/checks.sql` (read-only checks and expected results) and `rollback.sql` (emergency undo). Live was only read (migration list and a `pg_dump` copy through the CLI); the copy of its data was deleted after the dry run.

- Live has 27 migrations; 21 are pending (3 from Phase 0, 18 from PR #8). Migrations reach live only by hand, `npx supabase db push --linked` from `main`. Nothing touches the database on merge.
- Live's schema is identical to a local database built from the first 27 migrations (no drift).
- Dry run on a copy of live's schema and data: all 21 applied; every marketplace table, `auth.users` and `storage.objects` kept the same rows and checksums; 57 marketplace read queries returned identical answers before and after, with `platform` exposed and not.
- The marketplace's own tests need the seed's fixed IDs and accounts, and the seed would not load on top of the copy of live's data, so they ran on the seeded local database built by the same 48 migrations: 81 passed (platform 115, unit 144 + 102 + 86).
- `rollback.sql` was tested on the copy from three states; each time the schema and data came back identical to live's. It refuses to run once the platform holds a shop.
- **Order matters on the dashboard:** exposing `platform` before the schema exists makes the API return 503 for every request, the marketplace's too. Expose it only after the migrations are applied and checked.
- After "Automatically expose new tables" is turned off on live, a migration adding a table to `public` must grant access on purpose; local and CI still grant by default, so a missing grant would pass tests and fail on live.
- Netlify's variables were not read (no access from the repo).
- Open before the platform app can point at live: a way to create the first shop and first platform admin there (only the demo seed does it today), and the platform URL in live's Auth redirect list.

## Platform Phase 1a: independent review fixes (same branch and PR #8, 11 Nov 2026)

An independent review of Phase 1a found six things that had to be fixed and three small ones. All nine are fixed. Each has a database test in `apps/platform/tests/db/review-fixes.test.ts` that was run against the database before the fix (it failed, including the real races: a shop left with no owner, a sold bike with a future block, two admins both deciding one request) and after (it passes).

| # | Finding | Fix | Migration |
| --- | --- | --- | --- |
| 1 | An approved catalog entry is public, but a shop's request note, which shop asked, and the admin's review note could be read on it by anyone | Signed-out visitors and signed-in users may select a list of columns that leaves those three out. Approving clears the note and the shop from the entry (the audit row keeps them). Platform admins read waiting requests, with the note and the shop's name, through `platform.catalog_requests()` | `20261111000700_platform_catalog_private_fields`, `20261111001100_platform_review_gaps` |
| 2 | `platform_private.audit()` wrote a row for any tenant it was handed | It refuses unless the caller is the service role or a database job, a member of that tenant, or a platform admin | `20261111000800_platform_audit_caller_check` |
| 3 | Two owners demoting or removing each other at the same instant left a shop with no owner | Team changes for one shop queue behind a lock on the tenant's row; the membership is read again after the lock | `20261111000900_platform_owner_lock` |
| 4 | A bike could be sold at the same instant someone added a block to it; a block could be moved onto a sold bike or stretched into the future on one | Selling or retiring takes the same per-bike lock as block writes, then checks. The "bike is in the fleet" check runs when a block is changed too: on a sold or retired bike a block may only be shortened | `20261111001000_platform_sold_units_blocks` |
| 5 | `review_catalog_request` also decided marketplace shops' requests; two admins could both decide one request; a reject failed with a raw error when the shop had re-added the same make and model | It takes only a platform shop's request and locks it while deciding. On reject, a model whose return would make a duplicate stays linked (unlisted) and the function says so; the admin page shows a notice. Approve, merge and reject each write one audit row. It now returns `{decision, kept_linked}` | `20261111001100_platform_review_gaps` |
| 6 | A model's instant / request / ready-now counts could stay higher than its active bikes after a bike left | A trigger on bikes clamps the counts down (never up) when a bike leaves a model's active set (status change, model change, delete), and writes an audit row (`clamp_booking_counts`) with before, after and which bike. Request units give way before instant units | `20261111001200_platform_clamp_booking_counts` |
| 7 | "End downtime" from a stale page could re-extend a block someone had already ended | The update only matches a block that is running right now; otherwise the page says it was already ended | none (app) |
| 8 | An old bike form could overwrite a newer odometer reading | The details form carries the bike's `updated_at`; a save is refused with "changed by someone else, reload" when it has moved on | none (app) |
| 9 | A shop's own model accepted 1 to 20000 cc, the catalog 50 to 2500: a 49 cc moped saved, then failed with a raw error when submitted | Both accept 1 to 20000 cc. Out of range gives "Enter an engine size from 1 to 20000 cc." under the field; the database's refusal maps to the same message | `20261111001300_platform_cc_range` |

**After the owner's click-through (12 Nov 2026): downtime on the bike page**
- "End now" from a stale tab did refuse to write, but its message sat inside the row that then disappeared, so nothing was shown. The bike page now reloads with a notice: "That downtime was already ended or removed by someone else."
- A new downtime couldn't be added after ending one without a reload. "From" was filled with the time the page was opened, which by then lay inside the block just ended. "From" now starts blank, and blank means now, taken from the server when it is saved.
- Even after a reload it could be refused within the same minute: the old block ended at, say, 10:30:45 and the new one was typed as 10:30. Ending a downtime, and starting one "now", both use the start of the current minute. A downtime started and ended within one minute is removed, not kept.

**Rules for later phases that come out of this**
- **Phase 2 must compute availability from `units` and `unit_blocks`, never from the stored counts alone.** `instant_units`, `request_units` and `ready_now` are a shop's setting. They are kept within the active bikes, but a bike in a block is still "active".
- **Lock order:** code that needs the lock of more than one bike in one transaction takes the per-bike advisory locks in sorted `unit_id` order. The block guard does (a block moved from one bike to another).
- **A column added to `public.bike_catalog` is not readable by the public** until it is added to the column grant on purpose.

**Changed for the marketplace: nothing it uses.** Its public and vendor queries name their columns and use none of the three private ones; its admin pages use the service role. All 81 marketplace database tests pass with the new grant. The catalog's engine-size limit is wider (1 to 20000); the marketplace's own vendor form still checks 50 to 2500.

**Known limits**
- A model kept linked to a rejected entry (fix 5) can't be listed and can't be sent again from the screen. It is rare (the shop re-added the same make and model while waiting); the model page says why. Tidying it up means deleting one of the two.
- Fix 2 is tested through direct SQL as a signed-in user (the `platform_private` schema is not reachable through the API, so it could not be reached that way before either).
- The race tests (3, 4, 5) fire the two calls at the same instant several rounds each. They failed every run before the fixes and pass every run after, but a race test can only show a race is closed for the timings it hit.
- Not built, by decision: see "Before Phase 2" below.

### Before Phase 2

Review findings deferred, to do before or with Phase 2:
- **Non-atomic pairs:** a renewal and its cost, and opening hours (delete then upsert), are two writes. Make each one RPC or transaction.
- **`unit_blocks.created_by` and `unit_renewals.recorded_by` are client-settable.** Set them in the database from `auth.uid()`.
- **Preset copies drift:** a model's copy of its catalog entry's make, model and specs isn't updated when an approved entry is edited or un-approved.
- **Audit gaps:** log changes to `platform_admins`; keep audit rows when a tenant is deleted (or block hard tenant delete).
- **Phase 2 multi-bike bookings must take per-bike locks in sorted order** (the rule above).
- **pg_cron on live:** the migrations enable the hourly reminder job where `pg_cron` is available, so it will start on live when Phase 1a's migrations are applied there. Expected; put it on the go-live checklist.

Tests after these fixes: 102 platform unit, 115 platform database, 81 marketplace database, 58 Playwright (29 at 375 px, 29 at 1280 px).

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

**Scan QR on the Maintenance tab (owner request, 11 Nov 2026; QR scanning was planned for Phase 5)**
- A camera button sits beside the plate search. It opens the camera, reads a bike's sticker and opens that bike. Only the sticker's token is used, so a sticker printed with another address (a preview, an old domain) still opens the bike on the site the person is signed in to, and a code that isn't a sticker is never followed.
- It reads codes on Android, iPhone and laptops with a camera. Chrome on Android has a code reader built in. Safari on iPhone and Firefox don't, so there each camera frame is decoded on the device by the `jsqr` library (owner OK, 11 Nov 2026; Apache-2.0, no dependencies of its own), which is downloaded only on those browsers and only when the scanner is opened. Nothing is uploaded.
- Tests: the token rule (unit). In Playwright the stand-in camera plays a file showing a QR sticker (`e2e/fake-camera.ts`): one test reads that code for real from the camera frames with `jsqr`, as an iPhone would; others cover the right bike opening, a foreign code refused, the camera turned off on close, and the message when a browser has no camera access. Not tested: a real phone camera reading a real printed sticker, and Safari itself (the tests run in Chromium with its own reader removed).
- Stickers hold the address of the site they were printed from. Print the real ones from the final domain, not from a deploy preview: the in-app scanner copes either way, but a phone's own camera app follows the printed address.
- Playwright: 58 (29 at 375 px, 29 at 1280 px).
- CI (11 Nov 2026): for some hours GitHub's runners could not look up Ubuntu's package servers, so installing Chromium's system packages (mostly fonts) failed before any test ran. The install step now falls back to Chromium without them (`.github/workflows/ci.yml`); all 58 Playwright tests pass that way. Known issue: while such an outage lasts the step spends about 10 minutes timing out first.

**Spec rules that changed** (`docs/platform/SPEC.md` is not edited here: the owner keeps the spec in a separate document and re-exports it after merge)

From the catalog and listing decision (11 Nov 2026):
- **(a) A model no longer needs a catalog entry.** The spec says "a model can't be saved without a catalog entry, so cc and transmission are always filled in". Now a model is either on a preset (an approved catalog entry) or is the shop's own, with its make, model and specs stored on the model.
- **(b) Required specs.** Vehicle type: always. Engine size (cc) and transmission: required for motorbikes only; optional for cars, ATVs, boats and "other" (a shop may add them). An earlier version the same day also required a transmission for cars; the owner withdrew that.
- **(c) Moto Mangos listing and approval.** Approval appears only when a shop wants a model on Moto Mangos. A model on an approved entry can be switched on directly. One of the shop's own is matched to a suggested entry ("Did you mean…") or sent to the platform admin, who approves it (it becomes a preset for every shop), merges it into an existing entry, or rejects it. Only a model on an approved entry can be listed. The spec's "a missing catalog entry goes to the platform admin for approval" now applies at listing, not when a bike is added.
- **(d) Writes to one bike's `unit_blocks` queue behind each other** (a transaction-level advisory lock per bike), on top of the exclusion constraint. The spec's review decision asks for "check + insert inside one function under a per-location-and-model advisory lock" before Phase 2; the per-bike lock is in place now and Phase 2's booking function takes the same one.

From the earlier follow-ups the same day (details further down): a lowered odometer is confirmed, not refused; borrowed units and "first registered" are removed; the tax and insurance log, reminder settings and dashboard items were built ahead of Phase 1b; the hourly reminder queue uses Supabase Cron.

**Shops' own vehicles and one list for Moto Mangos (owner decision, 11 Nov 2026; built)**

This replaces the spec rule "a model can't be saved without a catalog entry" and the open decision recorded just below. Migrations `20261111000300_platform_own_models.sql` and `20261111000400_platform_unit_block_lock.sql`.

- **One list, two uses.** The approved entries of the vehicle catalog are the presets in the management system's make and model dropdowns, and they are the list Moto Mangos uses. There is no second list to keep in step: approving an entry makes it a preset for every shop at once.
- **Presets first.** Make, then model, from the presets is the default path everywhere. "Not in the list? Add my own" is the link underneath.
- **A shop's own make and model** is saved straight away with no approval, for any vehicle (motorbike, car, ATV, boat, other). A model now carries its own make, model, vehicle type, engine size and transmission; a model on a preset takes them from the preset (the database copies them, so they can't drift).
- **Required specs** (owner, 11 Nov 2026, final): vehicle type always; engine size and transmission for motorbikes only. For cars, ATVs, boats and "other" both are optional. The same rule holds in the Add my own form, the model edit form, CSV import and the database (`models_required_specs_check`; migrations `20261111000500` and `20261111000600`, the second withdrawing a short-lived rule that cars need a transmission).
- **No duplicates within a shop:** the same make and model of the shop's own can't be added twice, ignoring case and spacing (database rule). Adding something that is exactly a preset is refused with a link to the preset. Models on presets are not affected: the catalog has one entry per generation, and a shop may keep two models on one entry (owner, 10 Nov).
- **Listing on Moto Mangos is the only place approval comes up.** Each model page has a Moto Mangos box:
  - on a preset: "On the Moto Mangos list as …" and a "List this model on Moto Mangos" switch;
  - the shop's own: close matches are suggested ("Did you mean: Use Honda PCX 160 (2026)"), which links the model to the preset in one click; or "Send to Moto Mangos", which puts it in the platform admin's list;
  - waiting: the shop keeps using the model meanwhile;
  - not a motorbike: Moto Mangos lists motorbikes only for now.
- **The admin's list** (`/admin/catalog`) now offers Approve (it becomes a preset for everyone), Merge into an existing entry (every model waiting on it moves to that entry, closest matches listed first), or Reject (the model goes back to being the shop's own, unlisted).
- **Only a model on an approved preset can be switched on for Moto Mangos** (database rule). The switch is stored now and takes effect when the marketplace reads the platform (Phase 3M).
- **CSV import:** a make and model that matches a preset goes on it; one that doesn't becomes the shop's own, with new optional columns `vehicle_type`, `cc` and `transmission` (required for a motorbike). The old "this make isn't in the catalog" errors are gone.
- **Risk to know:** a shop that types "Hodna PCX 160" as its own gets its own model. Nothing blocks a typo at entry; it is caught when the shop goes to list it, by "Did you mean". Exact matches (any case or spacing) are blocked at entry.

**The availability lock under a real race (found and fixed, 11 Nov 2026)**
- While rerunning the tests, the four-way "who gets the bike" race sometimes hung for 20 seconds. Cause: with the exclusion constraint alone, simultaneous overlapping writes for one bike wait on each other in a circle; Postgres cancels one with "deadlock detected" and the API layer retries it, so losers could spin instead of being refused. Earlier runs passed because the requests happened not to overlap closely enough.
- Fix: writes to one bike's blocks queue behind each other (a transaction-level advisory lock on the bike, taken in the trigger). The exclusion constraint is still the rule. Phase 2's booking function takes the same lock, as the review decision asks.
- The test is now twelve simultaneous writers, five rounds, exact outcome every time (one success, eleven clean overlap refusals, within 5 seconds), plus "different bikes don't wait on each other" and "ending a block while another is added".

- **Platform admins land on their page.** Signing in as a platform admin with no shop used to show "You're not in a shop yet" (found by the owner). They now go straight to the catalog requests; an admin who also works in a shop gets a link beside the shop list.

- **Catalog reviews are audited.** Approve, merge and reject each write an audit record under the shop that sent the entry (who decided, the entry, the note, and for a merge the entry it went into). Before, only the entry's own status, note and review time recorded the decision.

Tests: 95 platform unit, 93 database, 50 Playwright, passing locally and against the PR #8 deploy preview.

**Second round of owner feedback (11 Nov 2026, later the same day)**
- **Current fleet by default.** The Fleet list shows the working fleet: sold and retired bikes are kept, with all their records, but stay out of the list. A "Show" control switches between Current fleet, Sold and retired, and Everything; the header counts the working fleet and links to "N sold or retired". Choosing the Sold or Retired status in the filters finds them whatever "Show" says. The choice is remembered with the rest of the view.
- **Bike Details reordered:** the odometer sits where the location was (for owners and managers it is now part of the Details form, with the same lower-reading confirmation), and the location is the last field. Staff and mechanics keep their separate odometer box, since they can't edit the details.
- **"Group by location" and the location filter** are only offered to shops with more than one location.
- **A make and model already in the list can't be added again** for overlapping years (checked when adding a make or model). Found because three overlapping "Honda Test" entries were added during testing; that check previously existed only for a model's own year bands.
- **A note on bikes with sale details but a status other than Sold.** Saving sale details never changes the status (by design), so a bike could look sold on paper while still Active. The purchase and sale section now says so.
- Tests: 92 platform unit, 84 database, 50 Playwright.

**Closed (11 Nov 2026): how the shared catalog and shops' own vehicles fit together.** Decided and built as described above: the catalog link is optional, and approval happens only when a model is listed on Moto Mangos. The notes below are the question as it was first put.
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

1. Owner: try the Phase 1a click-through on the deploy preview (phone and desktop), review PR #8, then follow `docs/RUNBOOK-GO-LIVE-PLATFORM.md` after it merges (it covers exposing `platform` on live, in the right order).
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
