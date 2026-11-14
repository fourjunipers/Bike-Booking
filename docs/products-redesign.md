# Products redesign: design review

13 Nov 2026. Design only: no code, no migration, nothing applied anywhere. Written from `main` at `771fa4f` (PR 13 merged).

**What this is.** Mark approved a brief to replace the separate "Make & model" and "Add to inventory" screens with one Products list, closer to Booqable's workflow, while keeping the vehicle records Booqable lacks. This document turns that brief into a database design, availability and pricing rules, a screen map, a build order and a list of questions. Where it says "recommended", that is my proposal, not a decision. Nothing here overrides `docs/platform/SPEC.md` until Mark works it into the spec (§8 lists the spec edits it needs).

**Second version, same day.** Mark answered the review's questions and accepted its five disagreements with the brief. His decisions are listed next and worked into every section below; where a section still says "recommended", it is a point he has not ruled on.

## Decisions (Mark, 13 Nov 2026)

| # | Decision | Where |
| --- | --- | --- |
| 1 | Rename `models` to `products` | §1.2 |
| 2 | Moto Mangos listings keep today's split: two counts (instant, by request) with a simple control on top | §1.4, §2.6 |
| 3 | ~~The create form has one type-ahead of known models that fills make, model, engine size and transmission.~~ **Superseded by decision 17** after the click-through: it was built, tried and removed | §4.1 |
| 4 | Delivery: the computed distance fee stays for every shop. A shop may also add its own flat "Delivery" service product. Nothing is preset | §3.5 |
| 5 | **No preset products ship**, and product names are free text. No built-in damage cover, "tax and insurance" or delivery product | §1.2 |
| 6 | A vehicle's own tax and insurance are the legally required records on each unit (`unit_renewals`). A product a vendor calls "tax and insurance" or "full coverage" is that vendor's own optional add-on or side service (BSR helps customers with licences, tax and insurance for their own vehicles) | §1.3 |
| 7 | Service and Item for sale must handle any vendor's own general goods and services: stickers, shirts, hats | §1.2 |
| 8 | Thai for "product" is สินค้า, provisional, until Korn or BSR's admin reviews it | §4.1 |
| 9 | Items for sale: allowed in the database from stage A; owners enter them (name and stock) from stage B; prices come in stage D; selling comes with orders in Phase 3 | §2.5 |
| 10 | Sizes: separate products per size (Helmet S, M, L), each with its own quantity, until after the pilot; then real variations | §5.5 |
| 11 | The units-to-offer cap counts only Moto Mangos bookings | §2.6 |
| 12 | Only owners and managers switch Moto Mangos on and off or change gear quantities. Owners, managers and staff may mark a unit lost or damaged; mechanics may not mark one lost. Staff see prices but can't change them. Mechanics and drivers see no prices | §4.2 |
| 13 | Lead time is plain hours from now. The stricter of the shop's minimum notice and the listing's lead time applies | §2.6 |
| 14 | The deposit on an order is the sum of each vehicle's deposit (two bikes, two deposits), adjustable by staff | §3.3 |
| 15 | Tiered pricing is entered as anchor prices (daily, weekly, two weeks, three weeks, monthly); the system fills the days between; every filled-in price stays editable. The spec's stored "price per day" mode is dropped; a "same price every day" helper fills the anchor totals instead, all editable | §3.2 |
| 16 | Open, Mark answers later: whether BSR's 30 Booqable templates are multipliers or fixed amounts. It matters only to the importer (Phase 10) | §7 |
| 17 | **After the Stage A click-through (13 Nov 2026).** The create form is headed "Product details" and asks for the kind ("What kind of product is it?") and one line: the product name (placeholder "e.g. Honda PCX 160"). No type-ahead, no make, model, engine size or transmission on it. Names are unique in a shop ignoring case and all spacing. The four columns stay, nullable, for Moto Mangos matching. When a motorbike is sent for review, the Moto Mangos panel asks for all four at that moment (required), or the shop picks an approved model from the list. Off-road gains Dirt bike beside ATV and UTV | §1.2, §4.1 |
| 18 | **Stage B direction (13 Nov 2026).** The create page opens with two choices, Vehicle and General. Vehicle: kind chips and name, with licence class, minimum age, buffers and categories. General: a type (Rental gear, Item for sale, Service or extra), no licence class, minimum age or buffers, and a quantity where it applies. The Products list gets All, Vehicles and General tabs | §4.1, §5.7 |
| 19 | **No make or model on the platform (13 Nov 2026, second click-through). This supersedes every earlier make and model decision in this document** (decisions 3 and 17 where they speak of them, §4.1's vehicle form, §5.6's create form, and the unit and Fleet columns in §1.3 and §4.1). A product is known by its name on every platform screen: no make, model, engine size or transmission field, filter, column, grouping, count or label, including Add vehicle (one Product dropdown, A to Z), Fleet, Products, search, stickers and the CSV import (a product name per row). The database columns stay, nullable, for Moto Mangos matching. The only place the five details are asked is the Moto Mangos review form: make, model, engine size, transmission and "Year of your bike" (one year, required). The year range a list entry covers is set by the Moto Mangos admin at approval. The Moto Mangos panel reads top to bottom: logo; "List it on Moto Mangos"; "Select your make and model from the list"; "Don't see your bike above? Send us the details and we'll get it added", which opens the review form; then the listing switch and settings, usable once a model is selected or approved. Fleet is one line per product, A to Z, with vehicle and available counts and one search box. Buffers are entered in hours and stored in minutes. A product page has Duplicate, and Retire and Delete at its very bottom | §4.1, docs/PROGRESS.md |
| 20 | **After the third click-through (13 Nov 2026).** The Moto Mangos panel shows only for the Motorbike kind (any of its categories); hidden for Off-road (ATV, UTV, Dirt bike), Car, Boat and Other. The list picker is two dropdowns, Make then Model with its years, and its button reads "Select". Listing quantities are headed "Set bike quantities per booking type" with a line each for Instant units, Request units and Walk-ins. A product is deleted, not retired, from its page, and only when it has no vehicles of any status; the retired status stays in the database. Fleet lines carry the Products list's tags; an edit pencil beside the title opens the product on both lists. **This supersedes §1.2's "retire, restore and delete rules apply to every type" as far as the screens go.** Manual ordering of products (drag, Move up and Move down, Reset to A–Z, one shared order per shop) is asked for and not built yet: see docs/PROGRESS.md | §4.1, docs/PROGRESS.md |
| 21 | **Stage B confirmations (13 Nov 2026), built in PR 17.** General products hide and store no buffers (and no deposit). New product opens with Vehicle or General; General asks for a type (Rental gear, Item for sale, Service or extra), a name and a description, with a quantity per location for gear and items for sale and none for a service. The Products list has All, Vehicles and General tabs. A general product's page is Details, Stock and History: "Change quantity" is for owners and managers; "Mark damaged" and "Mark lost" for owners, managers and staff; a mechanic is refused on lost; only an owner or manager restores or removes a lost unit. **Tracked gear is one nameless row per unit with an optional label: this supersedes §1.3 and §2.4 where they say a tracked unit needs a label.** A product already on a Moto Mangos list entry has "Change model" and "Disconnect" (owners and managers, audited, bookings left untouched). Manual order, step one: one order per shop for Fleet and Products, Move up and Move down on each line, "Reset to A–Z"; dragging is a follow-up PR (§5.8) | §5.7, §5.8 |
| 22 | **After the PR 17 click-through (14 Nov 2026): the Stock tab's states.** A unit of gear is in one of three states, each under its own heading on the Stock tab with one line of help and its own actions: **In use** ("Mark damaged", "Mark lost"), **Damaged** ("Back in use": it returns to the available count) and **Lost** ("Found, back in use" restores it; "Write off" removes it permanently). "Write off" replaces "Remove for good" and "Found, back in use" replaces "Back in stock". "Write off" asks first, saying it cannot be undone, that the unit leaves the product's stock counts, and that History keeps a record. History uses the buttons' words. Who may do what is unchanged, and so is the database | §5.7 |

Decisions 9, 12 and 15 include Mark's second round of answers the same day (items for sale by stage, who may mark a unit lost, and the price-per-day mode).

## Summary

1. **One `products` table, renamed from `models`**, with a `type` (vehicle, gear, sale item, service) and a `tracking` mode. Vehicle-only fields stay on it, guarded by checks. The platform has no rows on live, so the rename costs no data work; it does mean re-creating about 15 database functions that name the old table.
2. **Rental gear counted by quantity is stored as real, nameless unit rows.** "20 helmets" is 20 rows in `units`. The existing exclusion constraint, per-unit locks and availability rule then cover gear with no second mechanism, and "track individual units" becomes giving those rows labels. Items for sale are different (they are used up, not lent) and get a stock ledger in stage B; selling them comes with orders in Phase 3. Services have no stock.
3. **Moto Mangos settings move to their own table, `product_listings`**, so a product is created with no marketplace fields and listed later from its tab. The existing instant and request counts become the "units to offer" cap.
4. **Pricing sits in its own table, `product_pricing`, one row per product**: a method plus an amount or a shared price template, a tax profile and a deposit. It is a separate table because mechanics and drivers must not see prices, and row-level security hides rows, not columns. Extras are not a separate table: an extra is a gear or service product linked to a vehicle product. This is laid out now so Phase 2's one pricer (`quote()`) reads it without rework.
5. **PR 13's migration: keep it as it is.** Do not change it in place again; build forward with new migrations. Reasons in §1.6.
6. **The review's five disagreements with the brief are accepted** (§5.4), and every question is answered except one that only the importer needs (§7).

## 1. Database design

### 1.1 Today's tables and where they go

| Today (`platform` schema) | Becomes | Change |
| --- | --- | --- |
| `models` | `products` | Renamed. New `type`, `tracking`. Vehicle-only columns become nullable, required for vehicles by a check. Marketplace columns move out (next row) |
| `models.marketplace_listed`, `instant_units`, `request_units`, `ready_now`, `ready_updated_at` | `product_listings` | Moved to a new table, one row per listed (or once-listed) vehicle product |
| `models.catalog_id`, `make`, `model`, `vehicle_type`, `cc`, `transmission`, `categories` | Stay on `products` | Vehicle description. `catalog_id` stays the link to the one catalog (`public.bike_catalog`) |
| `models.catalog_approved_at`, `catalog_rejected_at`, `catalog_reject_reason` | Stay on `products` | They describe the catalog request on this product. Moving them would mean rewriting the review function for no gain |
| `models.deposit`, `deposit_currency` | `product_pricing.deposit`, `currency` | Moved in stage D with the other prices, so mechanics and drivers can't read it (§3). Until then it stays where it is, readable by every member as today |
| `models.buffer_before_minutes`, `buffer_after_minutes`, `min_age`, `licence_class`, `photos`, `description`, `bookable_online`, `retired_at` | Stay on `products` | Buffers and `retired_at` apply to every type; `min_age` and `licence_class` to vehicles only |
| `units` | `units` | Kept. `model_id` renamed `product_id`. New `product_type` (copied by a composite key), `label`. Vehicle-only columns guarded by a check |
| `unit_financials`, `unit_renewals`, `unit_renewal_costs` | Unchanged | Vehicle records. Tracked gear units may use `unit_financials` too |
| `unit_blocks` | Unchanged | Still the one availability lock, one exclusion constraint. Gains `order_line_id` in Phase 3, as already planned |
| `model_year_bands` | `product_year_bands` | Renamed with its `model_id` column. Vehicles only |
| `audit_events`, `notification_outbox`, locations, tenants, memberships | Unchanged | |
| `public.bike_catalog`, `public.vehicle_types` | Unchanged | Shared with the marketplace. Not touched |
| Extras (spec's `extras` table; never built on the platform) | Not built | Replaced by gear and service products plus `product_extras` (§3.5) |
| Spec's `price_structures` (not built) | `price_templates` + `price_template_days` | Same content (anchors, filled days, hand edits), made shareable between products (§3.2) |

Nothing is dropped outright. Legacy marketplace tables (`bike_models`, `shop_extras`, `price_days` and the rest) stay as they are until 3M; `docs/platform/MAPPING.md` needs its target names updated (§8).

### 1.2 `products`

```text
products
  id, tenant_id                      unique (tenant_id, id) and unique (tenant_id, id, type)
  type        text not null          'vehicle' | 'gear' | 'sale_item' | 'service'   (fixed after creation)
  tracking    text not null          'unit' | 'bulk' | 'consumable' | 'none'
  name, description, photos, categories, retired_at, bookable_online
  buffer_before_minutes, buffer_after_minutes
  -- vehicles only (null for the rest)
  vehicle_type, make, model, cc, transmission, catalog_id,
  catalog_approved_at, catalog_rejected_at, catalog_reject_reason,
  min_age, licence_class
```

Prices are not on this table: see `product_pricing` (§3.1).

| Type | Tracking allowed | Stock lives in |
| --- | --- | --- |
| Vehicle | `unit` only | `units`, one row per vehicle, each with a plate (or plate pending) |
| Rental gear | `bulk` (default) or `unit` | `units`: nameless rows for bulk, labelled rows for tracked |
| Item for sale | `consumable` | `stock_movements` ledger (stage B) |
| Service or extra | `none` | Nothing. Always available while the product is active |

Rules, all as check constraints or the existing guard trigger:

- `type` and `tracking` must be one of the pairs above.
- A vehicle needs its kind (`vehicle_type`). Its `make`, `model`, `cc` and `transmission` are optional (decision 17): the create form asks for a name only, and they are filled in when a motorbike is sent to Moto Mangos (all four required then) or copied from the approved list entry it is put on. A make and a model come together or not at all. Every other type must leave all vehicle-only columns empty. The old rule "a motorbike can't be saved without engine size and transmission" (`models_required_specs_check`) is dropped by the Stage A migration.
- `type` cannot change once the row exists. `tracking` can change only between `bulk` and `unit` on gear (§2.4).
- Names are unique within a shop ignoring case and all spacing (`products_name_idx` on the name with spaces removed and in lower case; it was lower-case and trimmed only). The "no duplicate own make and model" index covers vehicles that have a make and model.
- **No product is preset and names are free text** (decisions 5 and 7). A new shop starts with an empty Products list. A service can be "Full coverage", "Licence help" or "Tax and insurance for your own bike"; an item for sale can be a sticker, a shirt or a hat. Nothing in the database or the code knows what a particular service or item is, so no behaviour hangs on its name.
- `categories` keeps its shape check. The lists stay in code (`apps/platform/lib/vehicle-kinds.ts`, to be renamed). Vehicles keep today's lists, required for motorbikes and cars. Gear gets a short optional list for filtering (helmet, jacket, gloves, camera, phone holder, luggage, lock, other). Services and items for sale get no list at first: each vendor's are too different to guess.
- Retire, restore and delete rules from the fleet rework apply to every type through the same triggers: a product is retired only when none of its units is in use; a retired product takes no new units and comes off Moto Mangos.

**Why one table and not `products` plus a `vehicle_details` side table.** Every guard written so far (`models_guard`, the catalog review, retire rules, the CSV import) reads vehicle fields and the row together. Splitting them means rewriting each one against a join and adds a second audit row to every save. The cost of one table is a dozen nullable columns on helmets and services, which the checks keep empty.

**Why rename the table instead of only changing the screen text.** A table called `models` holding helmets and insurance cover will mislead every later session, and the rename gets harder with every phase that adds a foreign key to it. Live has no platform rows and no code outside `apps/platform` reads these tables (checked: the marketplace has no reference to `platform.models`, `platform.units` or the catalog functions).

### 1.3 `units`

```text
units  (existing columns kept)
  product_id       was model_id
  product_type     new; foreign key (tenant_id, product_id, product_type) → products (tenant_id, id, type)
  label            new; text, for tracked gear ("GoPro 3", a serial number)
```

- The composite key means a unit's `product_type` can never disagree with its product, so plain check constraints can use it. This is the same trick as the tenant keys.
- Check: a vehicle unit keeps today's rule (`plate is not null or plate_pending`). A gear unit has no plate, frame number, engine number, model year or odometer. A tracked gear unit needs a `label`, unique within its product. A bulk unit has neither plate nor label.
- Sale items and services have no unit rows (enforced by the type pair: the foreign key only matches vehicle and gear products).
- `status` (active, maintenance, retired, sold), `location_id`, `qr_token`, the role guard (`units_guard`), the sold and retired rules and `units_clear_downtime` all carry over unchanged. A tracked camera gets a QR sticker for free.
- **New status `lost`** (decision 12), added in stage B. Owners, managers and staff may set it; mechanics may not (they still set maintenance). It takes the unit out of stock at once. Only an owner or manager can bring a lost unit back, retire it or delete it. "Damaged" is the existing `maintenance` status (or a downtime block with an end date), which staff can already set.
- `unit_renewals` is the vehicle's own legally required tax and insurance record (decision 6) and has nothing to do with any product a vendor names "tax and insurance". It stays vehicle-only in the screens. No database rule is needed: a renewal on a helmet would be odd but harmless.

### 1.4 `product_listings` (Moto Mangos)

```text
product_listings
  tenant_id, product_id     primary key (product_id); foreign key (tenant_id, product_id, product_type) → products
  product_type              always 'vehicle' (check), so only vehicles can be listed
  enabled        boolean    the quick on/off switch (today's marketplace_listed)
  instant_units  int        units offered for instant booking
  request_units  int        units offered by request
  lead_time_hours   int     null = none of its own; the shop's minimum notice still applies (§2.6)
  ready_now, ready_updated_at    walk-in count for "Ride today"
  created_at, updated_at
```

- A product with no row has never been listed. "List on Moto Mangos" creates the row; the switch flips `enabled`.
- Existing rules move with the columns: `enabled` only while the product is on an approved catalog entry (`not_listable`) and not retired; `instant_units + request_units` and `ready_now` never exceed the product's active units, and are clamped down when a unit leaves (`units_clamp_model_counts`).
- The two counts stay as they are today (decision 2). The tab shows a simple control on top: "Units to offer" and "All instant / All by request"; "Split them" opens the two numbers.
- Policies: every member reads; only owners and managers write, including the on/off switch (decision 12). Staff may change `ready_now` only (the spec has staff updating the walk-in count from the app; it is a count of bikes standing ready, not the listing switch), enforced by a column guard like `units_guard`.
- The marketplace's `listingId` stays the product's id (`MAPPING.md` §4), so nothing changes for 3M.

### 1.5 New tables at a glance

| Table | Stage | Purpose |
| --- | --- | --- |
| `product_listings` | C | §1.4 |
| `product_pricing` | D (Phase 2) | One row per priced product: method, amount, template, tax profile, deposit. Owners, managers and staff read; mechanics and drivers don't (§3.1) |
| `price_templates`, `price_template_days` | D (Phase 2) | Prices by rental length from anchors, shareable between products (§3.2) |
| `tax_profiles` | D (Phase 2) | Rate and inclusive or exclusive, per shop (§3.3) |
| `product_extras` | D (Phase 2) | Which gear and services are offered with which vehicle product (§3.5) |
| `stock_movements` | B | Ledger for items for sale: stock in and adjustments from stage B, sales from Phase 3 (§2.5) |

Every new table follows the repo rules: `tenant_id` and a parent reference by `(tenant_id, id)`; RLS in the set form `tenant_id = any((select my_tenant_ids()))`, no `using (true)`; an explicit `grant` to `authenticated` in the migration (`default-grants.test.ts`); new functions start with `revoke all ... from public, anon`; amounts are `bigint` minor units with a `currency` column keyed to `tenants (id, currency)`; `set_updated_at` and `audit_row` triggers; a fixture row per tenant in the isolation tests. Columns that record who did something are set in the database from `auth.uid()`, not sent by the client (this closes the open item in PROGRESS, "Before Phase 2").

The currency lock (`tenants_lock_currency`, `currency_locked`) is extended to every new amount: a price, a template tier or a deposit on any product locks the shop's currency.

### 1.6 PR 13's migration (`20261113000100_platform_fleet_rework`): keep, don't reshape

Recommended: leave the file exactly as merged and put every change in new migrations after it.

- Everything in it survives the redesign: categories, the review outcome dates, approved-means-listed, retire and restore, withdrawing a request on delete, clearing downtime on delete. The new migrations rename and move these; they don't undo them.
- It is on `main`, on staging, in CI and in every local database. The file was changed in place four times on its branch, and each time staging had to be taken back by hand. Doing it again from `main` breaks the repo rule ("never edit an applied migration") for every checkout, and buys nothing: a follow-up migration reaches the same end state.
- "Not on live" only means live gets it and the follow-ups in one push. On live it adds columns and triggers to empty tables and replaces functions; it touches nothing the marketplace reads.

### 1.7 Migration order

Each migration is one logical change. All of them act on platform tables that are empty on live.

| # | Migration (name after the timestamp) | What it does | Stage |
| --- | --- | --- | --- |
| 1 | `platform_products` | Rename `models` → `products`, `units.model_id` → `product_id`, `model_year_bands` → `product_year_bands`. Add `type` (existing rows: `vehicle`), `tracking` (`unit`), `units.product_type`, the composite key and the type checks. Rename policies, indexes and triggers to match. Re-create every function that names the old table or column, in the same file | A |
| 2 | `platform_products_stage_b` (`20261113000300`; planned as `platform_gear_units`) | `units.label`, the `lost` status, the per-type unit rules, `set_stock_quantity()`, `mark_units_damaged()` and `mark_units_repaired()` (planned as `set_quantity_out()`), `mark_units_lost()`, `resolve_lost_units()` (§2.3), the product-level advisory lock, `stock_movements` for items for sale; and, added by decision 21, `products.sort_position` with `move_product()` and `reset_product_order()`, and `change_listing_entry()` and `disconnect_listing()` | B |
| 3 | `platform_product_listings` | Create the table, copy the five columns across, drop them from `products`, add `lead_time_hours`, re-point the guards and the review function | C |
| 4 | `platform_product_pricing` | `product_pricing` (the deposit moves into it), `price_templates`, `price_template_days`, `tax_profiles`, `product_extras`, the wider currency lock | D |

Functions to re-create in migration 1 (they hold the old names in their bodies, which Postgres does not rewrite on rename): `models_guard`, `units_guard`, `unit_blocks_guard`, `units_clamp_model_counts`, `models_default_category`, `models_keep_catalog_outcome`, `models_retire_guard`, `units_model_not_retired`, `models_withdraw_request`, `review_catalog_request`, `submit_model_to_catalog`, `catalog_requests`, `import_fleet`, `tenants_lock_currency`, `currency_locked`, and `queue_renewal_notifications` if it reads the model name. The build session must find the full list by searching function bodies in the database (`pg_get_functiondef`), not by reading migrations.

Keeping live safe:

1. **Nothing reaches live before it is on `main`**, and live is pushed by hand with the runbook steps used on 12 Nov: fresh backup, dry run listing exactly the expected files, grants fingerprint (C6) and row counts before and after, the 36 public read queries byte-identical.
2. **Push PR 13's migration and migrations 1 to 3 together**, once stages A to C are merged and clicked through on staging. There is no reason to push earlier: the platform app does not point at live yet. One push means one backup and one check run.
3. **The hourly job is the one thing running on live that reads these tables** (`platform-renewal-notifications`). The rename and the re-created function must be in the same migration file so the job never meets a half-renamed schema. Confirm on the dry-run copy that the job's function runs after the push. (Whether the CLI wraps each file in one transaction should be checked in the dry run, not assumed.)
4. **`public.bike_catalog` and `public.vehicle_types` are not altered.** No column is added to the catalog, so its column grant is unchanged.
5. **Staging holds demo shops with models and units.** Migration 1 must carry them across unchanged; the check is unit and product counts per shop before and after, and the fleet Playwright tests on the migrated data.
6. `rollback.sql` in the runbook covers only the first 21 platform migrations. The way back from a bad push is the backup or a forward fix, as it was for the last four.

## 2. Availability

### 2.1 One rule for vehicles and gear

Availability is always computed from `units` and `unit_blocks`. No count is stored anywhere. The "quantity" a screen shows is `count(units)`.

For a product P at location L and a rental from `start` to `end`:

1. **Window.** Widen the rental by the product's buffers: `[start − buffer_before, end + buffer_after)`. Blocks are stored already widened (review decision: "period incl. buffers"), so the unit is truly busy for the whole stored period.
2. **Stock.** Units of P at L with `status = 'active'`. A unit in maintenance, retired or sold is not stock, for any dates.
3. **Free.** Stock units with no `unit_blocks` row overlapping the window, of any kind (allocation, downtime, hold, transfer).
4. **Shortage demand.** If the shop allows overbooking (spec: off by default), reserved order lines that have fewer unit blocks than their quantity count against the product: subtract the largest such unassigned quantity at any moment in the window.
5. `available = max(0, free − shortage demand)`.

A vehicle and a bulk helmet go through the same five steps. The only difference is on screen: a vehicle's units are listed by plate, a bulk product's units are shown as a number.

### 2.2 Booking and locks

The booking function (Phase 2) for an order with several lines:

1. Take a **product-level advisory lock** for every (product, location) on the order, in sorted order. This is the review decision's "per-location-and-model advisory lock". It makes two people booking the same product queue instead of both picking the same free units.
2. For each line, pick the units: staff's choice for a vehicle if given, else the best-fitting free unit (the one whose previous block ends closest before this rental, which keeps long gaps whole).
3. Insert the blocks in sorted unit order. The existing trigger takes each **per-unit advisory lock** (namespace `1a01`) as the row is written, and the exclusion constraint has the final say.

Lock order, to be written into the root rules: product locks first (sorted), then unit locks (sorted). Downtime writers take a single unit lock and can't form a cycle. One detail for the build: the unit lock key is `hashtext(unit_id)`, so "sorted" must mean sorted by that key, not by the UUID; otherwise two rare hash collisions could still cross. Postgres would detect and cancel such a deadlock, but the rule should be exact.

### 2.3 Gear counted by quantity

- **Setting the quantity** is one function, `set_stock_quantity(product, location, n)`, owners and managers only. Raising it inserts nameless active units. Lowering it removes units that have no block now or in the future; if too few are free it refuses and says how many are booked. This is the same question "retire" asks of a vehicle, so the rule is already familiar.
- **Damaged gear** ("2 helmets being cleaned or repaired until Friday") is downtime blocks on any 2 free nameless units, through `set_quantity_out(product, location, n, until)`. Staff and mechanics may do this, as they may for vehicle downtime today.
- **Lost gear** (decision 12): an owner, manager or staff member (not a mechanic) calls `mark_units_lost(product, location, n)`, which sets `lost` on n free nameless units. The product then reads "18 in stock, 2 lost". An owner or manager later confirms (the units are removed, which is a quantity change) or brings them back. Staff never change the quantity itself.
- **Booking 3 helmets** is 3 allocation blocks on 3 units. Staff never see which rows.
- **Why rows and not a counted pool.** The alternative is a `stock_blocks` table with a quantity per row and a "sum of overlapping quantities ≤ stock" check inside a function. That check can't be an exclusion constraint, so gear would have a second, weaker lock that only holds if every writer goes through the function. With rows, the database itself refuses the 21st helmet. The costs are more rows (60 helmets = 60 rows) and one audit row per unit when the quantity changes; `set_stock_quantity` also writes one summary audit event ("quantity 20 → 25") so the history reads cleanly. A limit of 1,000 bulk units per product per location keeps a typo from creating a million rows.
- **Nameless units can be re-packed.** Because they are interchangeable, the booking function may move not-yet-collected allocations between nameless units when no single unit is free for the whole window but the count says one should be. Build the simple best-fit pick first and add re-packing only if the race and fragmentation tests show a need.

### 2.4 Tracking individual units of gear

Switching a gear product from `bulk` to `unit` asks for a label per existing unit (pre-filled "Helmet 1…20") and from then on staff pick or scan a specific unit at check-out. Blocks, history and quantity are untouched because the rows were always there. Switching back to `bulk` clears the labels; allow it only while no unit has purchase details.

### 2.5 Items for sale and services

- **Services** have no stock: available whenever the product is active.
- **Items for sale** (stickers, shirts, hats: any vendor's own goods) are used up. On-hand is the sum of a `stock_movements` ledger (received, sold, returned, adjusted; append-only, each row with who and when), minus quantities on open orders. They never enter `unit_blocks`.
- **By stage** (decision 9). Stage A: the type check allows `sale_item`; nothing on screen. Stage B: owners and managers create items for sale with a name and a stock count per location; the ledger exists and takes "received" and "adjusted" rows, so the count has a history from the first day. Stage D: a price. Phase 3: order lines, payments and the "sold" and "returned" rows. Until Phase 3 an item for sale can be counted but not sold through the platform.

### 2.6 Moto Mangos: units to offer and lead time

On top of §2.1, for a listed vehicle product:

```text
cap            = instant_units + request_units
mm_held        = most Moto Mangos bookings holding a unit at any moment in the window
offered        = min(available, cap − mm_held)

mode = instant   if offered > 0 and instant-mode Moto Mangos bookings in the window < instant_units
     = request   else if offered > 0 and request-mode ones < request_units
     = none      otherwise
```

- The cap counts **Moto Mangos bookings only** (decision 11). A walk-in or a direct booking uses up real availability (step 3) but not the cap. So "offer 3 of my 8 PCX on Moto Mangos" means at most 3 out through Moto Mangos at once, and fewer when the shop itself is nearly full.
- This is `docs/INTEGRATION.md` §4.4 unchanged (decision 2): the contract already defines the instant and request split. The cap is not a new stored number.
- **Lead time** (decision 13): plain hours from now. The pickup must be at least `max(the location's minimum notice, the listing's lead_time_hours)` after now: whichever is stricter. A listing with no lead time of its own uses the shop's notice. It is a duration, so it needs no time zone and is not counted in opening hours. Opening hours, closures and minimum days (§4.6 of the contract) still apply in the location's time zone, which must not assume a fixed offset. Walk-ins ("Ride today") skip both, as the contract says.
- A product that is retired, not `enabled`, off an approved catalog entry, or (per the contract) without a photo and a full price is never offered.
- The marketplace keeps showing only what `marketplace_api` returns. It never computes availability itself after 3M.

## 3. Pricing

Phase 2 builds the pricer. This section fixes where its inputs live so that work needs no schema change.

### 3.1 `product_pricing`: one row per priced product

```text
product_pricing
  tenant_id, product_id      primary key (product_id); foreign key (tenant_id, product_id) → products
  pricing_method             'per_period' | 'fixed' | 'tiered' | 'free'
  price_amount   bigint      minor units; per period or once
  price_period               'hour' | 'day'
  price_template_id          for 'tiered'
  deposit        bigint      per unit rented; vehicles only for now (§3.3)
  tax_profile_id             null = the shop's default
  currency                   foreign key (tenant_id, currency) → tenants
```

It is a separate table for one reason: **mechanics and drivers see no prices** (decision 12). Row-level security hides rows, not columns, so prices can't sit on `products`, which every member reads. The policies: owners, managers and staff read; owners and managers write. `price_templates`, their days and `tax_profiles` get the same read rule. It is the pattern `unit_financials` already uses for purchase prices. The deposit that sits on `models` today moves here in stage D.

| `pricing_method` | Columns used | Charge for one line |
| --- | --- | --- |
| `per_period` | `price_amount`, `price_period` (`hour` or `day`) | amount × periods × quantity |
| `fixed` | `price_amount` | amount × quantity, once per order |
| `tiered` | `price_template_id` | the template's total for the rental length × quantity |
| `free` | none | 0 (shown on the order as included) |

- Any type can use any method. Typical: vehicle `tiered`; helmet `per_period` by day or `free`; a shirt or a sticker `fixed`; a vendor's "full coverage" `per_period`; licence help `fixed`; a vendor's own flat "Delivery" `fixed`.
- A product with no `product_pricing` row has no price yet: it can be created and stocked but not put on an order or listed.
- Periods: a day is every started 24 hours from pickup (`@mango/core` `rental-days`, contract §4.1). An hour is every started 60 minutes. Days are counted in the location's wall-clock time (review decision).
- The method list is a check constraint, so a later method (for example "percent of the rental", common for damage waivers) is one small migration.

### 3.2 Price templates (tiered by rental length)

Built around decision 15: the owner types anchor prices, the system fills the days between, and every filled-in price stays editable.

```text
price_templates       tenant_id, id, name, currency, shared boolean
price_template_days   tenant_id, template_id, day (1..30), total bigint, source ('anchor' | 'filled' | 'manual')
                      primary key (template_id, day); a complete template has all 30 rows
```

- **Anchors** are the totals for 1, 7, 14, 21 and 30 days: daily, weekly, two weeks, three weeks, monthly. 1 and 30 are required; 7, 14 and 21 are optional, as the spec has it. Each is the total for that many days, not a rate per day.
- **Filling.** Between two neighbouring anchors the days rise in equal steps, each rounded to the shop's rounding step (the currency's default: ฿10 for THB; set per shop, never a constant in code). With no 7, 14 or 21 anchor the fill runs straight between the anchors that exist.
- **Editing.** Any filled day can be overwritten; it becomes `manual` and is kept. Changing an anchor refills only the `filled` days between it and its neighbours and leaves `manual` ones alone. "Reset to filled" turns a manual day back.
- **Never more for fewer days** (review decision): a template is refused on save if any day's total is lower than the day before it. A refill that would break this against a manual day is shown to the owner to resolve, not silently changed.
- **Over 30 days** derives from the 30-day total, as decided: `round(total(30) × days ÷ 30)`.
- **One stored shape.** Every template is the same 30 totals, so `quote()` has one lookup. The spec's second stored mode, "price per day" (change request 41), is dropped (decision 15).
- **"Same price every day" helper.** The owner types one daily price; the helper sets the anchors to that price times 1, 7, 14, 21 and 30, and the fill does the rest. The result is an ordinary template: every anchor and every day stays editable, so a shop can start flat and then lower the weekly and monthly totals by hand.
- **Sharing.** A template can be used by many products ("Scooters 125 cc"). "Own prices" for one product is a template with `shared = false` that only it points to. The Pricing tab offers "Use a shared price list" or "Set this product's own prices"; either way the owner sees the same five anchor boxes and the 30-day grid.
- Changing a shared template changes every product on it. The form names them before saving. Past orders are unaffected because an order stores its quote snapshot (review decision).
- Amounts are **absolute, in minor units**, never multipliers. Whether BSR's Booqable templates are multipliers or fixed amounts only decides how the importer turns them into these rows (decision 16).
- This is the spec's `price_structures` and the legacy `price_days` (`day`, `total`, `is_anchor`, `is_manual`) in one shape; a legacy listing maps to one unshared template at 3M with its flags kept.

### 3.3 Tax profiles and deposits

- `tax_profiles`: `name`, `rate_bp` (basis points, integer: 7% = 700), `inclusive`, `is_default`. One default per shop, created from the tenant's current `vat_rate` and `vat_inclusive`. `product_pricing.tax_profile_id` null means the default. A shop that sells an exempt insurance cover gives that product a 0% profile.
- Tax is computed and stored **per order line** with the rate and inclusive flag copied onto the line, so a later change to a profile never alters an old order.
- **Deposits** (decision 14). `product_pricing.deposit` is the deposit for one vehicle; null means the shop default. The order's deposit is the **sum over every vehicle on it**: two bikes, two deposits; three of the same scooter, three times its deposit. Gear, services and items for sale add nothing to it. Staff can change the order's deposit; the order keeps both the computed and the charged amount, and the change is in the audit trail with who made it. A per-customer waiver (spec) sets it to zero the same way.
- Season and date rules (`price_rules`, Phase 2) point at a scope: one product, one template, one product type, or all. Nothing in this design needs to change for them.

### 3.4 Money and rounding

1. Every amount is `bigint` minor units of the shop's currency, by the ISO 4217 exponent. No floats anywhere; a rate is basis points.
2. All arithmetic is integer. Division happens in three places only, each rounding half up to one minor unit: the over-30-days total, a percentage rule, and tax.
3. The **rounding step** (review decision: a setting with a default per currency) applies to prices a shop generates, such as the filled-in days of a table, not to tax.
4. Tax per line: exclusive `tax = round(net × rate_bp / 10000)`; inclusive `tax = gross − round(gross × 10000 / (10000 + rate_bp))`. Order tax is the sum of line taxes.
5. The total never falls as days rise (review decision), checked when a template is saved and again in `quote()`.
6. Display uses `Intl.NumberFormat` with the viewer's locale and the shop's currency. No currency symbol in code.

### 3.5 Extras and services on an order

- `product_extras`: `tenant_id`, `product_id` (the vehicle product, or null for "every vehicle"), `extra_product_id` (a gear or service product), `included_quantity`, `max_quantity`, `sort`. This replaces the spec's `extras` table and the legacy `shop_extras` + `shop_extra_models`.
- `included_quantity` covers "2 helmets come with the scooter": the first 2 are free on the line, a third is charged by the helmet's own method. This is better than a `free` method on the helmet itself, which could not charge for the third.
- On an order (Phase 3) every chosen product is its own `order_lines` row: `product_id`, `quantity`, `parent_line_id` (the vehicle line an extra belongs to), its own start and end (an extra defaults to its parent's), and the price, tax and deposit snapshot. A service line has no blocks; a gear line has one block per unit; a sale line writes a stock movement.
- `quote(order)` in `@mango/core` stays the only pricer. It takes plain data: for each line the product's method, amount, period and template tiers, the tax profile, any rules, and the quantity and dates. One database function returns all of that for a list of products, so admin, booking page and `marketplace_api` price the same way.
- The marketplace contract's extras shape (`{kind: "rental", amount}` or `{kind: "time", perDay, per7Days, per30Days}`, contract §3.7) is derived: `fixed` → rental; `per_period` by day → time with the same daily rate; `tiered` → time from the template's 1, 7 and 30-day totals. Hourly extras are not offered on Moto Mangos until the contract has a shape for them.
- **Delivery** (decision 4). The distance fee from the spec (`delivery_bands`: straight-line distance, the first enabled band that covers it) stays for every shop and is a computed fee line on the order, not a product. A shop that wants a flat charge can also create its own service product and call it "Delivery"; it is priced and added like any other service and the system gives it no special meaning. The two don't interact: if a shop uses both, both lines can appear on an order, and that is the shop's choice.

## 4. Screens, permissions and audit

### 4.1 How the screens fit together

| Screen | Address | What it shows |
| --- | --- | --- |
| **Products** | `/[tenant]/products` | Every product, one row each: photo or type icon, name, type, price, stock (units in use / total; "—" for services), Moto Mangos chip and switch (vehicles only). Filters: type, category, status, Moto Mangos state. "+ New product" |
| **New product** | `/[tenant]/products/new` | Headed "Product details". Stage A: the kind ("What kind of product is it?"), the product name on one line, categories, then description, buffers, deposit, minimum age and licence class. No make, model, engine size or transmission and no marketplace fields. From stage B it opens with two choices, Vehicle and General (decision 18, §5.7) |
| **Product page** | `/[tenant]/products/[id]` | Tabs: **Details**, **Units** (vehicle and tracked gear: rows with "+ Add unit"; bulk gear: quantity per location, with "damaged" and "lost" counts), **Pricing**, **Moto Mangos** (vehicles only), **History** |
| **Unit rows** | on the Units tab and in Fleet | Vehicle: plate, status, odometer, location; opens the unit page. Tracked gear: label, status, location |
| **Unit page** | `/[tenant]/fleet/units/[id]` | Unchanged: status, odometer, downtime, tax and insurance, purchase and sale, sticker, delete |
| **Fleet** | `/[tenant]/fleet` | Vehicle units only, for the mechanic: plate, product, status, odometer, service due (Phase 1b), insurance and tax expiry, current or next downtime. Today's grouping, filters and sort carry over |
| **Moto Mangos tab** | on the product page | Not listed: "List on Moto Mangos" → match an approved catalog model ("Did you mean…") or send a new one for review → instant, request and units to offer → lead time. Listed: the same settings plus the switch and the review state. Rejected: the reviewer's note and the two next steps from the fleet rework |

- **Superseded in part by decision 19:** wherever the paragraphs and the table in this section speak of make, model, engine size or transmission on a platform screen, or of "Did you mean" suggestions, read decision 19 instead. The Moto Mangos tab of stage C keeps the order decision 19 gives the panel.
- **No type-ahead (decision 17).** Stage A first shipped one make-and-model field that suggested known models and filled in the details. Mark's click-through removed it: the create form is the kind and a name. The known-models list is used in one place only, the Moto Mangos panel on the product page: it suggests close matches from the product's name ("Did you mean…"), offers the whole approved list to choose from, and otherwise shows the send-for-review form, which asks for make, model, engine size and transmission (required for a motorbike; the make and model start from the name) with the model years and a note. A rejected product's "Edit and send again" opens that same form with what was sent before.
- On the create form this leaves nothing from the fleet rework's two paths: no dropdowns, no "Manually enter", no list picker. The Moto Mangos tip stays for motorbikes and now says the model is chosen or sent for review from the product page.
- Products and Fleet read the same rows. Fleet is `units` joined to `products` where the type is vehicle; Products is `products` with unit counts. A change in one shows in the other at once.
- Old addresses redirect: `/fleet/models/[id]` → `/products/[id]`, `/fleet/models/new` → `/products/new`, `/fleet/units/new?model=` → the product's Units tab. Printed QR stickers are unaffected (they hold a token, not a path).
- CSV import stays on Fleet for vehicles; a `type` column and a gear and services import can follow with the Booqable importer (Phase 10).
- Wording: "product" everywhere; "vehicle" only for a vehicle unit and the Fleet screen; "unit" for a tracked piece of gear. In Thai, "product" is สินค้า (decision 8), provisional: every new Thai line goes in a review list for Korn or BSR's admin, like `docs/platform/thai-review-fleet-rework.md`, and one find-and-replace changes the word if they pick another.

### 4.2 Permissions

| Action | Owner | Manager | Staff | Mechanic | Driver |
| --- | --- | --- | --- | --- | --- |
| See Products list and product pages | Yes | Yes | Yes | Read only | Read only |
| See Fleet | Yes | Yes | Yes | Yes (their home) | Read only |
| Create, edit, retire, restore, delete a product | Yes | Yes | No | No | No |
| Add or remove units; change gear quantity; switch tracking | Yes | Yes | No | No | No |
| Unit status active ↔ maintenance, odometer, downtime | Yes | Yes | Yes | Yes | No |
| Gear: mark in repair, back in use, edit a repair's line (§5.9) | Yes | Yes | Yes | Yes | No |
| Mark a unit or gear lost; edit a lost unit's line | Yes | Yes | Yes | No | No |
| Mark a lost unit found, back in use | Yes | Yes | No | No | No |
| Write off gear for good, as damaged or as lost (§5.9) | Yes | Yes | No | No | No |
| Tax and insurance records: add and edit / delete | Yes / Yes | Yes / Yes | Yes / No | Yes / No | No |
| Purchase, sale and renewal costs | Yes | Yes | Hidden | Hidden | Hidden |
| Prices, templates, tax profiles, deposits: see / change | Yes / Yes | Yes / Yes | See | Hidden | Hidden |
| Moto Mangos: list, settings, on/off switch | Yes | Yes | No | No | No |
| Walk-in "ready now" count | Yes | Yes | Yes | No | No |
| History tab (audit) | Yes | Yes | No | No | No |

This is today's split carried over (owners and managers set up; staff and mechanics work on units) with Mark's rulings (decision 12): only owners and managers switch Moto Mangos or change a gear quantity; owners, managers and staff may mark a unit lost, mechanics may not; staff see prices but can't change them; mechanics and drivers see no prices.

Each row is enforced in the database by RLS and the guard triggers, and repeated in `lib/roles.ts` for the menus. "Hidden" means the database returns no row to that role, not that the screen leaves a column out: for a mechanic the Products list has no price column and the product page has no Pricing tab. The isolation tests cover each role limit. Until stage D moves it, the one price that exists today (the deposit on a model) stays readable by every member.

### 4.3 Audit: who changed what

- Every table above gets the `audit_row` trigger, so each insert, update and delete is recorded with the signed-in person, the time, and before and after values of the changed columns only.
- Named events through `platform_private.audit()` for actions that are more than one row: `stock_adjust` (quantity from → to, location), `tracking_change`, `listing_on` / `listing_off`, `template_change` (with the products affected), plus the existing `import`, `approve`, `merge`, `reject`, `clamp_booking_counts`.
- The **History tab** on a product and on a unit page is the first screen that shows this to the shop: a dated list reading "Mark changed the price from … to …", built from `audit_events` for that product, its units, its listing and its template. Owners and managers only, as the table's RLS already says. Per-unit rows from a quantity change are folded under their summary event.
- Price history does not need to explain old orders: each order keeps its quote snapshot.
- No personal data enters these snapshots (products hold none), so the Phase 4 rule on audit snapshots is not affected.

## 5. Build order, risks and tests

### 5.1 Stages

| Stage | Scope | Migrations | Main risks |
| --- | --- | --- | --- |
| **A. Products core** | Rename; four types in the schema; Products list; create page with the one type-ahead; product page with Details, Units and History tabs; Fleet becomes the vehicle-units view; redirects; wording (สินค้า). Only vehicles on screen, and they behave exactly as today | 1 | The rename touches about 40 app files, every fleet test and the Playwright flows. A missed function body fails only when called, so the function list must come from the database. Thai wording |
| **B. Gear and services** | Bulk gear with quantity per location, damaged and lost; tracked gear with labels; services as products without stock; one product per size; items for sale with a name and a stock count (no price, no selling yet) | 2 | Quantity changes racing with downtime or (later) bookings; audit noise from many unit rows |
| **C. Moto Mangos tab** | `product_listings`; the tab; the switch in the list; units to offer and lead time stored and validated. Still no effect on the marketplace until 3M | 3 | Moving columns the review function writes; keeping "approved means listed" and the clamp working |
| **D. Pricing fields** (opens Phase 2) | Method, amount, period; templates; tax profiles; deposit; `product_extras`; Pricing tab; price column in the list | 4 | Getting a shape Phase 2 then has to change. Mitigated by settling §5.3 first |
| **Phase 2 proper** | `quote()`, the availability function (§2), the booking function with both lock levels, `price_rules`, coupons | Phase 2's own | As the spec says: where bugs cost real money |
| **Phase 3** | Orders and order lines as in §3.5; selling items for sale ("sold" and "returned" stock rows); `unit_blocks.order_line_id` | Phase 3's own | |

A, B and C are independent of pricing and can each be a PR. Stage A should merge alone first: it is the one with a wide, mechanical diff, and reviewing it mixed with new behaviour would hide mistakes. Push to live once, after C (§1.7).

### 5.2 Test plan

**Database (Vitest against local Supabase, in CI's RLS job)**

- Isolation harness: every new or renamed table has a fixture row per tenant and passes cross-tenant read, insert, update and delete; role limits from §4.2 (a mechanic can't change a product, staff can change only `ready_now` on a listing, nobody but owner and manager reads the History).
- `default-grants.test.ts` passes: every new table granted on purpose; no new function executable by everyone.
- Type rules: a service or sale item takes no unit; a gear unit takes no plate; a vehicle needs its specs; a tracked unit needs a unique label; `type` can't change; only a vehicle on an approved entry can be listed.
- Fleet rework rules re-run after the rename (`fleet-rework.test.ts`, `review-fixes.test.ts`, `recheck-followups.test.ts` unchanged in what they assert): categories, retire and restore, withdraw on delete, clamp, reject and resubmit.
- Quantity: raise and lower; lowering refused when units are blocked; n units marked damaged, then lost, by staff; staff refused a quantity change and refused bringing a lost unit back; switching bulk ↔ tracked keeps blocks.
- Prices: a mechanic and a driver read no row of `product_pricing`, `price_templates`, `price_template_days` or `tax_profiles`; staff read and can't write. Template fill: anchors only at 1 and 30; all five; a manual day survives an anchor change; a falling total is refused; a zero-decimal currency.
- Lead time: the stricter of shop notice and listing lead time, both ways round; a listing with none.
- Races, in the style of the existing twelve-writer test: twelve writers for the last helmet (one success, eleven clean refusals); two orders each wanting 2 of the same 3 helmets (no deadlock, one succeeds or both get a clear refusal); lowering the quantity while a unit is being blocked; listing switched on while the product is being retired.
- Migration test: build a database at PR 13's state with seeded shops, apply the new migrations, and compare product and unit counts, listing settings and categories per shop.

**Unit (`@mango/core` and `apps/platform/lib`)**

- Availability with bulk units, buffers, shortage demand, and the Moto Mangos cap and mode against the contract's §4.3–4.4 examples; one tenant in a daylight-saving time zone.
- Each pricing method; template monotonic check; tax inclusive and exclusive; a zero-decimal currency (JPY) and a two-decimal one; rounding half up at each of the three division points.
- Type and category lists, labels in both languages, list filters, the permission helpers.

**Playwright (375 px and 1280 px)**

- Create one product of each type; the Products list filters and the Moto Mangos switch; the product tabs; add a vehicle unit from the Units tab; set a helmet quantity; as staff, mark 2 damaged and 1 lost.
- Fleet as a mechanic (lands there, can't open pricing or create a product); a driver reads only.
- The Moto Mangos tab from "not listed" through match, send for review, approve (in `/admin/catalog`), switch off and on; the rejected flow.
- Old addresses redirect; the History tab shows who changed a price.

**Before the live push:** the runbook's dry run on a copy of live (36 public queries byte-identical, grants fingerprint unchanged, row counts unchanged, the hourly job's function runs).

**Not truly testable now:** anything that needs an order (blocks from bookings, the cap against real Moto Mangos bookings, selling an item for sale). Those tests are written with Phases 2 and 3; stage tests use hand-made blocks, as Phase 1a did for "selling a unit with future bookings".

### 5.3 Decide before Phase 2

1. **Pool or assigned units.** The marketplace contract (§4.3) says bikes are a pool and `freeUnits = quantity − busiest moment`. The review decision gives every reserved booking a real unit at once. With assigned units, a product can have one free at every moment and still no single unit free for the whole rental. The availability function must report what the booking function can deliver. Options: accept the stricter answer, or re-pack not-yet-collected allocations automatically (safe for bulk gear; for vehicles it moves a customer to another plate before pickup, which is normally fine).
2. **Buffers between two rentals.** With blocks stored widened and requests widened too, the gap between rental A and rental B is A's "after" plus B's "before". Confirm that is intended, with a worked example in the spec.
3. **Tax rounding per line or per order**, to match the Thai tax invoice (ask Korn with the open invoice-format question).
4. **Hourly products on a daily order**: each line by its own period unit (recommended), with worked examples.
5. **Overbooking per product.** The spec has one shop-wide switch; Booqable has "allow shortage" with a limit per product. Recommended: shop-wide in Phase 3, a per-product override later; the design in §2.1 step 4 supports both.
6. **Which category Moto Mangos files a multi-category motorbike under** (open in PROGRESS already).
7. **Extras on Moto Mangos need stock.** The contract's `extras[]` has no availability. When helmets are counted, checkout must not sell a fourth helmet when three are left: a contract addition for 3M.

Settled on 13 Nov and no longer open: how deposits combine (sum per vehicle, staff can adjust), template amounts (absolute, from anchors), lead time (plain hours, the stricter of the two), the "price per day" mode (dropped; a fill helper instead).

### 5.4 The approved brief: what looked wrong or risky, and how it was settled

Mark accepted all five disagreements on 13 Nov 2026.

| # | The review said | Settled as |
| --- | --- | --- |
| 1 | "Instant vs request" as one choice loses today's split and changes the marketplace contract | Keep the two counts; a simple control on top (decision 2) |
| 2 | Dropping the catalog from the create form costs typing and invites typos | First settled as one type-ahead (decision 3), then overruled after the click-through: the create form has no catalog at all, and the details are asked for when a motorbike is sent to Moto Mangos (decision 17). The typo risk is now carried by the review step |
| 3 | Delivery as a priced service collides with the distance fee | The distance fee stays for every shop; a shop may add its own flat "Delivery" service; nothing preset (decision 4) |
| 4 | "Tax and insurance" as a service name clashes with the vehicle's own record | No preset products at all, and names are free text. The unit's record is the legal one; a product by that name is the vendor's own add-on (decisions 5 and 6) |
| 5 | Items for sale need orders | In the database from stage A; name and stock from stage B; price in stage D; selling in Phase 3 (decision 9) |

Still worth keeping in view:

1. **A third rework of the same screens before any booking exists.** Stages A to C are worthwhile because Phase 2 builds on products, but they delay Phase 2. Keeping A mechanical and B and C small matters more than polish here.
2. **"Product" for a rental vehicle** may read as "something for sale" to staff. สินค้า leans the same way in Thai, which is why it is provisional.
3. **Shared templates** make one edit reprice many products. Safe with the confirmation in §3.2, risky without it.
4. **Only vehicles can be listed**, and Moto Mangos lists motorbikes only today. The tab should say so for a car or boat instead of offering a flow that ends in "not yet".
5. **A flat "Delivery" product and the distance fee on one order** double-charge if a shop switches on both without meaning to. The order editor should make both lines plain to see; nothing more.
6. **One product per size** means a renter can't be asked "which size?" on one helmet line; staff pick the right product. Fine for the pilot, and the reason variations come after it.

### 5.5 Missing from the brief

| Topic | Booqable has it | Recommendation |
| --- | --- | --- |
| **Variations** (helmet S / M / L, jacket sizes) | Yes | Decided: one product per size, each with its own quantity, until after the pilot; then real variations (decision 10). A `variant_of` link can be added then without reshaping. The spec's feature table still says "variations: match" |
| **Bundles** | Yes | Removed by change request 15. `product_extras` with an included quantity covers the common case (bike + 2 helmets). Keep removed |
| **Collections** | Yes | Removed by change request 16. Categories and the type filter cover it |
| **Per-product buffers** | Yes | Already stored (`buffer_before_minutes`, `buffer_after_minutes`); unused until Phase 2. They apply to gear too (helmet cleaning time) |
| **Allow shortage** | Yes, per product with a limit | Shop-wide switch in Phase 3 as the spec says; per-product later (§5.3) |
| **Replacement value** of gear (what a lost helmet costs the customer) | Yes | Add a `replacement_price` to `product_pricing` in stage D; used by damage charges in Phase 5 and when staff mark gear lost on an order |
| **Quantity limits per order** | Partly | `product_extras.max_quantity` covers extras |
| **SKU or barcode** for sale items | Yes | A free-text `sku` column with stage B |
| **Stock per location and transfers** | Add-on | Units already carry a location; transfers are a `unit_blocks` kind. Multi-location is Phase 11 |
| **Photos** for every type | Yes | The `photos` column exists; upload arrives with Phase 3 as already planned |
| **Lost or damaged gear** | Yes | Decided: staff mark it (decision 12). `lost` status and downtime, §1.3 and §2.3 |
| **Minimum rental length or minimum charge per product** | Yes | Phase 2 decision; a column pair on `product_pricing` if wanted |
| **Booqable importer mapping** | — | Booqable's product types (rental, consumable, service) and tracking (trackable, bulk, none) map one-to-one onto `type` and `tracking`, which is a good sign for Phase 10 |

### 5.6 Stage A in detail

Stage A is the rename and the new screens for vehicles only. No new behaviour: a shop can do exactly what it can do today, under new names and in a new layout.

**What it touches**

| Area | Size today | Change |
| --- | --- | --- |
| Migration | 1 new file | Migration 1 of §1.7: the renames, `type`, `tracking`, `units.product_type` and its composite key, the type checks (all four types allowed), about 15 functions re-created. No table created, so no new grants |
| `packages/db` | generated types | Regenerated (`models` → `products`) |
| `apps/platform/app/[tenant]/fleet/**` | 22 files, about 4,500 lines | Split: product screens move to `/products` (list, new, `[id]` with Details, Units, History tabs); Fleet keeps the vehicle-unit list, unit page, stickers and import. Redirects from the old addresses |
| Create form | part of the above | The linked dropdowns, "Manually enter" and the separate list picker are gone. First replaced by one type-ahead; after the click-through, by the kind and one name line (decision 17) |
| `apps/platform/lib` | 12 of 29 files name models | Renamed types and queries (`fleet-data`, `fleet`, `fleet-view`, `fleet-import`, `model-options`, `catalog-match`, `vehicle-kinds`, `dashboard`, `roles`); a new products-list view beside the fleet view |
| Menu and roles | `lib/roles.ts`, the shell | "Products" joins "Fleet" in the menu; mechanics still land on Maintenance and see Fleet |
| Messages | `en.json` and `th.json`, about 130 lines in each mention model, vehicle or inventory | Reworded to "product"; Thai with สินค้า and a review list for Korn |
| Tests | 153 database, 15 fleet Playwright, about 70 unit tests touch these tables or screens | Updated for the new names and routes; new ones below |
| Seeds | `supabase/seed.sql`, `apps/platform/scripts/seed.mts`, demo data | Table and column names |
| Docs | `PROGRESS.md`, `MAPPING.md` target names | `SPEC.md` stays the owner's |

Not in stage A: gear, services, quantities, the `lost` status (B); `product_listings` and the Moto Mangos tab (C; in A the existing Moto Mangos panel sits on the product's Details tab unchanged); prices (D). Nothing in `apps/marketplace`. Nothing on live or staging until asked.

**How long.** An estimate, not a measurement: two to three working sessions, about a day and a half to two days including the owner's click-through and one round of fixes. The migration with its function re-creations and the database tests are roughly a third; the screens and the type-ahead a third; wording, Playwright and the History tab a third. The fleet rework, a smaller change, took five rounds over a day and a half, most of them wording and layout after click-throughs; the same is likely here.

**What would be tested**

1. *Nothing broke.* Every existing database test passes with only names changed (categories, retire and restore, withdraw on delete, clamp, review approve, merge and reject, sold units, the twelve-writer race, tenant isolation, default grants). Any test that needs its assertion changed, not just a name, is listed in the PR.
2. *The migration carries data.* A database built at today's `main` with the three demo shops (including the 150-bike one) is migrated; products, units, categories, listing switches, year bands and audit rows are counted per shop before and after.
3. *Every re-created function runs*: one call each, including the hourly reminder queue and the CSV import, so a body still naming `models` can't hide until someone clicks it.
4. *New rules*: `type` can't change; only the four type and tracking pairs are accepted; a unit's `product_type` always matches its product; a vehicle still needs its specs.
5. *Type-ahead* (unit and Playwright): a known model fills the four fields; an unknown one saves as the shop's own after asking for what is missing; a motorbike without engine size or transmission is refused; an exact duplicate of a known model is pointed at it; keyboard-only use and a 375 px screen.
6. *Screens* (Playwright, 375 px and 1280 px): Products list with filters; create a vehicle product; add a unit from the Units tab; Fleet shows the same unit; old addresses redirect; a mechanic sees Fleet and can't create a product; History shows who renamed a product; the existing Moto Mangos send-for-review flow still works from the product page.
7. *Wording*: English and Thai key parity; no "make & model" or "inventory" left in the product screens.
8. `npm run typecheck && npm run lint && npm test` from the root, and CI's RLS and Playwright job.

Not testable in stage A: anything with a non-vehicle product on screen (stage B), and the live push (done once, after stage C, by the runbook).

### 5.7 Stage B: general products (built 13 Nov 2026, PR 17)

Mark's direction (decision 18), confirmed point by point on 13 Nov 2026 (decision 21) and built on `platform/products-stage-b`. The plan as it was written follows; "As built" after it says where the build differs.

**What the owner sees**

- **New product opens with two choices: Vehicle and General.** Vehicle is today's form: kind chips, name, categories, description, buffers, deposit, minimum age, licence class. General asks for a type (Rental gear, Item for sale, Service or extra), a name and a description; no licence class, minimum age or buffers; and a quantity per location for gear (default: counted; "track individual units" as an option) and for items for sale. A service has no quantity.
- **The Products list gets three tabs: All, Vehicles, General.** General rows show the type and the stock ("18 in stock, 2 lost", "—" for a service) in place of vehicle facts. The kind and Moto Mangos filters apply to Vehicles only.
- **A general product's page** has Details, Stock (gear and items for sale) and History. Stock: the quantity per location with "Change quantity" (owners and managers), "Mark damaged" and "Mark lost" (owners, managers and staff; not mechanics), and, for tracked gear, one row per unit with its label. No Moto Mangos panel and no year bands.
- One product per size (Helmet S, M, L), no prices and no selling yet, as decided.

**What it touches**

| Area | Change |
| --- | --- |
| Migration (one new file, `platform_gear_units`) | `units.label`; unit status `lost` with who may set it; per-type unit checks (a gear unit has no plate or odometer; a tracked one needs a label unique in its product; a bulk one has neither); `set_stock_quantity()`, `set_quantity_out()`, `mark_units_lost()`; the product-and-location advisory lock; `stock_movements` for items for sale (received and adjusted rows; sold rows come with orders) with RLS, grants and a fixture row per tenant. The Stage A migration is not touched |
| Decision to confirm | The brief says "no buffers" on a general product. The design had buffers apply to gear too (cleaning time between rentals). Stage B would hide them and store none; they can return with Phase 2 if wanted |
| Screens | The two-choice start of New product and the General form; list tabs; the general product page with its Stock tab; quantity, damaged and lost dialogs; tracked-gear unit rows. Fleet stays vehicles only |
| App code | Product readers stop assuming a vehicle (`getFleet` and `getModel` filter to vehicles today); a products reader for every type; stock counts from unit rows and the ledger; role helpers for "may mark lost" |
| Wording | New English and Thai texts for the types, stock and dialogs, on the Thai review list |
| Tests | Below |

**Estimate.** Two to three working sessions, about two days with a click-through and one round of fixes. It is new behaviour, not a rename, so more of the time goes to the database functions and their race tests than in Stage A.

**Tests**

1. Database: type rules for units (no plate on gear, label rules, no units on a service or an item for sale); quantity up and down, with a refusal when units are blocked; damaged and lost by role (staff yes, mechanic no for lost; nobody but owners and managers changes a quantity or brings a lost unit back); switching counted and tracked keeps blocks; the stock ledger is append-only and sums to the count; isolation and default-grants for the new table; twelve writers lowering a quantity while units are being blocked.
2. Unit: list tabs and filters, stock wording, the General form's rules, key parity.
3. Browser, phone and desktop: create one of each general type; the three list tabs; set a helmet quantity, mark 2 damaged and 1 lost as staff, confirm the loss as owner; a tracked camera with labels; a mechanic can't mark lost; vehicles behave exactly as before (the Stage A suite unchanged).
4. The Stage A demo data carried again, counts before and after.

**As built** (migration `20261113000300_platform_products_stage_b`; the Stage A migration is untouched)

- **Unit rules per type.** A vehicle unit keeps its rule (a plate, or "plate pending") as the check `units_check`, now for vehicles only, and takes no label. The gear half (no plate, plate pending, frame or engine number, year or odometer) is a trigger, `units_gear_fields`, not a check: it runs after the row's foreign keys, so a unit that claims a type its product doesn't have is still refused by the key first, which Stage A's tests assert. A label is optional, unique in its product ignoring case and spacing (`units_label_idx`), and only on a product tracked unit by unit (`units_label_guard`). Switching gear back to counted clears its labels and is refused while a unit has purchase details.
- **Lost.** `units_guard` is re-created with the status: staff may set it from active or maintenance; a mechanic or driver is refused (`role_not_allowed`); every way out of lost is for owners and managers. A unit can't be marked lost while a booking, hold or transfer on it has not ended; its downtime ends at that moment. `unit_blocks_guard` is re-created so a lost unit takes no new block. The status is in the database for every unit; **the screens offer it for gear only in this stage** (a vehicle's status control is unchanged).
- **A general product stores no buffers and no deposit** (`products_general_fields_check`).
- **Stock functions**, all run as the caller, so RLS and the guards stay the real rule: `set_stock_quantity(product, location, n)` (owners and managers; gear up to 1,000 in one place, an item for sale up to 100,000); `mark_units_damaged(product, location, n, until)` and `mark_units_repaired(product, location, n)` (owners, managers, staff and mechanics); `mark_units_lost(product, location, n)` (owners, managers, staff); `resolve_lost_units(product, location, n, 'restore' | 'remove')` (owners and managers); `create_general_product(...)` (the product and its first quantities in one transaction); `product_stock(tenant)` (counts per product and location, so a shop with 600 helmets doesn't send 600 rows to the screen). Each writes one named audit event on the product (`stock_adjust`, `units_damaged`, `units_repaired`, `units_lost`, `lost_restored`, `lost_removed`).
- **Lowering a quantity** removes only units that no block holds now or later, unlabelled ones first. With too few free it refuses (`units_blocked`) and names the lowest quantity that could be set. A unit with bookings on record is retired, not deleted, so its history stays (nothing has bookings until Phase 3; tested with a hand-made block).
- **Locks.** Product-and-location locks first (advisory namespace `1a02`, sorted by key), then the per-unit locks (`1a01`, the one `unit_blocks_guard` takes, sorted by key): `lock_product_stock()` and `lock_units()`. Every stock function takes them in that order. The manual order has its own lock per shop (`1a03`).
- **Items for sale: `stock_movements`.** Signed quantities; `received`, `adjusted`, and from Phase 3 `sold` and `returned`. Members read; owners and managers add `received` and `adjusted`; nobody updates or deletes (no grant, no policy). Who did it is set in the database from `auth.uid()`. What is on hand can't go below zero. An item for sale with stock on hand can't be deleted (`product_has_stock`); at zero it goes, and its ledger with it.
- **Screens.** As decision 21. Counted gear has "Change quantity", "Mark damaged" (with an optional "back in use on"), "Back in use", "Mark lost" and, for lost units, "Found, back in use" and "Write off" (decision 22; first built as "Back in stock" and "Remove for good"). Tracked gear has "Change quantity" and one line per unit with its label and the same actions as buttons on the line. An item for sale has its count on hand and its stock history. A service has Details and History only.

**The Stock tab's three states** (decision 22, 14 Nov 2026; wording and layout only, no database change)

| State | What it means | Actions | Who |
| --- | --- | --- | --- |
| **In use** | Available to rent | "Mark damaged" (with an optional "back in use on") | Owner, manager, staff, mechanic |
| | | "Mark lost" | Owner, manager, staff |
| **Damaged** | Not available to rent; still counted in stock | "Back in use": it returns to the available count | Owner, manager, staff, mechanic |
| | | "Mark lost" (tracked gear: on the unit's line; counted gear: "Mark lost" takes a damaged unit when no other is free) | Owner, manager, staff |
| **Lost** | Not available to rent; not counted in stock | "Found, back in use": restores it | Owner, manager |
| | | "Write off": removes it permanently, after a confirmation | Owner, manager |

- "Change quantity" (owners and managers) sits above the three states: it adds units in use, or removes units in use that are free.
- Each state is a headed part of the Stock tab with its count ("Damaged (2)") and one line of help. Damaged and Lost appear once something is in them. Counted gear asks "how many" under each heading; tracked gear lists its units under the heading of the state each is in.
- "Write off" asks: "Write off? This cannot be undone. The unit leaves this product's stock counts for good and can't be marked found again. The History keeps a record."
- **History in the buttons' words.** Counted gear: "marked 2 damaged", "put 2 back in use", "marked 1 lost", "marked 1 found, back in use", "wrote off 1". Tracked gear, one line per unit: "marked unit GoPro 3 damaged", "put unit GoPro 3 back in use", "marked unit GoPro 3 lost", "marked unit GoPro 3 found, back in use", "wrote off unit GoPro 3". A written-off unit's row is deleted, but its lines stay in History with its label: they are read from the audit trail by the product the unit belonged to (`lib/history.ts` `gearUnitHistory`), not from the unit rows that are left.
- The database is as it was. The functions keep their names (`resolve_lost_units(..., 'restore' | 'remove')`) and the audit actions theirs (`lost_restored`, `lost_removed`); only the words on screen changed.

**Moto Mangos: "Change model" and "Disconnect"** (decision 21)

- Shown on the panel of a product that is on an approved list entry; owners and managers only (the panel itself is theirs). "Change model" opens the same Make, then Model dropdowns with a Select button; "Disconnect" asks first.
- `change_listing_entry(product, entry)` moves the product to another approved entry; the listing switch and its quantities stay. `disconnect_listing(product)` switches the listing off, sets its quantities to zero and clears the entry with the make, model, engine size and transmission copied from it. It is refused while a request for the product is still waiting for review. Each writes a named audit event (`listing_change_model`, `listing_disconnect`) beside the row's own, and both show in the product's History.
- **Existing bookings made through Moto Mangos: left exactly as they are.** Neither function touches a unit or a block, so every booked vehicle stays booked for its dates and stays in the fleet. Each answers with the number of bookings on the product's vehicles that have not ended; the panel shows that number above the two actions, and the confirmation says "Bookings already made stay as they are." The other choice, refusing while bookings exist, would leave a shop unable to come off Moto Mangos for as long as one booking was outstanding. Tested with hand-made booking blocks (orders arrive in Phase 3). **For Phase 3:** an order must keep its own copy of what the customer booked (the list entry's make, model and years), because the product may point at another entry, or none, by pickup day.

**Manual order, step one** (decision 21)

- `products.sort_position`, per shop. No position on any product means A to Z (the default). `move_product(product, target, 'before' | 'after', current_order)` puts one product just before or after another of the same shop; `reset_product_order(tenant)` clears every position. Owners and managers only; everyone else reads the saved order.
- A shop still on A to Z has nothing saved to move within, so the first move saves the order on screen (the server works it out; the browser doesn't send it) with the one change. From then on a new product goes to the bottom (`products_sort_bottom`).
- Fleet and the Products list read the one order; general products take part in it. On Fleet, which shows vehicles only, "Move up" puts a product before the line above it, passing over any general product that sits between them.
- "Move up" and "Move down" are plain buttons on each line (44 px), "Reset to A–Z" sits above the list while the shop has its own order, and all three are gone while a search or filter is on (a line says why). The All, Vehicles and General tabs count as views, like Fleet, not as filters.
- `move_product` already takes "before or after any product", which is what a drop needs: dragging (§5.8) adds no database work.


**Superseded in part (14 Nov 2026):** the Stock tab's damaged and lost forms described above were replaced by the stock rework, §5.9. Items for sale, the manual order and the Moto Mangos functions are as built here.

### 5.8 Dragging to reorder: proposal for a follow-up PR (not built)

Not built in PR 17, by instruction. This is the proposal; the library needs Mark's approval first (root `CLAUDE.md`: ask before adding a dependency).

**Library: dnd-kit.** Checked on 13 Nov 2026 against the npm registry, GitHub and Bundlephobia.

| | |
| --- | --- |
| Packages | `@dnd-kit/core` 6.3.1 and `@dnd-kit/sortable` 10.0.0 (they bring `@dnd-kit/utilities` 3.2.2 and `@dnd-kit/accessibility` 3.1.1; these four depend on nothing else but `tslib`) |
| Licence | MIT, all of them |
| Size | `core` 14.2 kB and `sortable` 3.7 kB, minified and gzipped (Bundlephobia): about 18 kB. Loaded only on Fleet and the Products list, only for owners and managers, and it can be fetched when a drag is first started |
| Maintenance | The repository (`clauderic/dnd-kit`) is active: last push 31 Oct 2026, not archived, about 17,800 stars, 152 open issues. **But the two packages above were last released on 4 and 5 Dec 2024.** The author's work since then goes into a rewrite, `@dnd-kit/react` (0.5.3, 31 Oct 2026), which is still 0.x |
| React 19 | The classic packages ask for `react >= 16.8`, which our 19.3 satisfies on paper. Not installed or run here: to confirm in the PR's first hour |

**Recommended:** the classic packages (`core` + `sortable`). Their API has been stable for two years and they include a keyboard sensor and screen-reader announcements. The risk is that they get no more fixes; it is small here because the use is one sortable list and the Move up and Move down buttons stay as the fallback. The rewrite is the better choice once it reaches 1.0; choosing it today means building on an API that may still change.

**How long-press sits beside the taps and links on a line**

- **A drag handle, and only the handle.** Each line gets a grip button (44 px) at its start. Dragging starts from the handle and nowhere else, so everything a line already does is untouched: a tap on a Fleet line still opens and closes it, the title and the pencil still open the product, "+ Vehicle" and the arrows still work.
- **Phone:** press and hold the handle for a quarter of a second, then drag (dnd-kit's touch sensor with a 250 ms delay and 5 px tolerance). A quick tap on the handle does nothing. A finger that moves before the quarter second is a scroll, as anywhere else on the page. The handle switches off text selection and the long-press menu for itself only.
- **Desktop:** no long-press. Press the handle and move 8 px to start; a plain click does nothing.
- **Keyboard and screen reader:** focus the handle, Space to pick up, arrows to move, Space to drop, Escape to cancel, with spoken announcements (built into the library). Move up and Move down stay for anyone who prefers them and for a browser without JavaScript.
- **A Fleet line is a `<summary>`.** A button inside it doesn't toggle the line: PR 17's arrows sit there already and its browser test checks the line stays as it was.
- **On drop:** one call to `move_product(product, target, before | after)`, which exists. The list shows the new order at once and goes back if the server refuses.
- **Same rules as the buttons:** owners and managers only; off while a search or filter is on.

**Tests.** Mouse drag at desktop width; keyboard drag (the dependable one); one touch long-press drag at phone width, which is the test most likely to be flaky and is why this was split out; and that a tap on a line, the pencil and "+ Vehicle" still do what they did.

**Size of the work.** About one session, most of it the touch test.

### 5.9 Rental gear: the stock rework (built 14 Nov 2026)

Mark's testing of the Stock tab found it confusing: three state sections, each with its own "how many" forms, up to six full-width buttons in one card. Reworked on `platform/gear-stock-rework` to his eleven points. Rental gear only; items for sale are untouched.

**The three states of a unit**

| State | In stock | Available | How it is stored |
| --- | --- | --- | --- |
| In use | Yes | Yes, unless a booking holds it | `status = 'active'`, no downtime running |
| In repair | Yes | No | An open-ended downtime block (as before, so the availability rule is unchanged) |
| Lost | No | No | `status = 'lost'` |

Stock = in use + in repair. Available = in use, minus bookings. A unit written off (damaged for good, or a loss confirmed) is permanent: its row is deleted, or retired when bookings on record need it, and the History keeps the event with its day and notes. "Out of service" holds only units that can still come back: in repair and lost.

**Details tab, top to bottom** (everyone who can open the product; one set of stock cards per location when the shop has more than one):

1. **Product details** (owners and managers): name, description, "Track each unit on its own". First on the page since the owner's click-through of 14 Nov 2026.
2. **Stock:** large tiles for In stock, Available now and In repair; Lost only when above zero.
3. **Change quantity** (owners and managers): − and + beside a number field. "Save quantity" appears only when the number differs from what is saved.
4. **Report a problem:** one button, one dialog (a bottom sheet on a phone). What happened (In repair, Lost, Damaged for good; a role sees only what it may report); How many, or Which unit for tracked gear; Date it happened (today by default, never later); Expected back (In repair only, optional); Notes (optional, 500 characters). Under each date: "For information only. It does not affect stock quantities."
5. **Out of service:** one line per unit, tracked or not, with its status chip, day, expected-back day and notes. In repair: Back in use, Edit, Remove from stock. Lost: Found, back in use, Edit, Remove from stock.
6. Delete (owners and managers), last.

**"Remove from stock", not "Write off"** (owner, 14 Nov 2026, after the click-through). Every button that removes a unit for good says "Remove from stock": on a line in repair, on a lost line, and in the dialog for "Damaged for good". The confirmation opens "Remove from stock? This cannot be undone. …" and the History says "removed 1 from stock as damaged" or "as lost". The database keeps its names (`write_off`, `units_written_off`); only the words shown changed.

Each card has its title above a divider and at most one filled button; every action on a line is outlined.

**Stock tab:** one row per unit with its name or label and a status chip. Owners and managers label tracked units there. Counted gear shows a hint that "Track each unit on its own" is under Product details on the Details tab, with a link to it for owners and managers. Nothing on this tab changes a unit's state.

**Each unit has its own record.** Three columns on `platform.units`: `problem_on` (the day it happened, a calendar day at the unit's location), `expected_back` and `problem_notes`. Reporting three units writes three records, each edited and resolved on its own afterwards. `units_problem_check` keeps them to gear, requires the day, keeps expected back on or after it and off a lost unit. The record is cleared when the unit is back in use.

**"Expected back" is information.** Stage B's "until" time ended the downtime by itself. A repair now runs until someone presses "Back in use"; the expected day is shown on the line and in the History.

**Only units in use and free are reported.** A unit that a booking holds now or later is never put out of service from under its booking; the dialog says how many are free. (Moving a booking to another unit comes with orders, Phase 3.)

**Who may do what: one place.** `platform_private.gear_roles(action)` in the database and `lib/gear-permissions.ts` in the app hold the same table, and a database test compares them. Every function and every screen asks it, so owner-set permissions can later replace the table without touching the callers. Not built now.

| Action | Roles |
| --- | --- |
| `set_quantity` | owner, manager |
| `mark_repair` (and edit a repair's line), `back_in_use` | owner, manager, staff, mechanic |
| `mark_lost` (and edit a lost unit's line) | owner, manager, staff |
| `found` | owner, manager |
| `write_off` (as damaged or as lost) | owner, manager |

New: writing off as damaged is for owners and managers only. Everything else is as it was. RLS and `units_guard` remain the real rule underneath: a mechanic who writes `status = 'lost'` by hand is refused, as is anyone but an owner or manager deleting or retiring a unit.

**Database: `20261114000100_platform_gear_stock_rework`**, on top of Stage B's migration, which is untouched. No new table.

- `report_gear_problem()`, `update_unit_problem()` and `resolve_unit_problem()` replace `mark_units_damaged()`, `mark_units_repaired()`, `mark_units_lost()` and `resolve_lost_units()`, which are dropped. They run as the caller, take the product-and-location lock then the unit locks (Stage B's order), and write one audit event each.
- `product_stock()` answers `in_repair` where it said `damaged`.
- `units_guard` lets staff and mechanics write the three record columns on gear, and clears the record when a unit stops being lost.
- Lowering a quantity still removes only free units: `set_stock_quantity()` is unchanged, and a test holds that units in repair and lost keep their records.
- **Existing data:** a gear unit damaged at the moment of migration becomes In repair. Its day is the day the downtime started, the downtime's end (if it had one) becomes Expected back, its note becomes the notes, and the downtime is made open-ended unless a later block on that unit is in the way. A lost unit stays Lost, with the day it was last changed. Nothing is deleted.

**History, in the buttons' words.** One line per event from the functions themselves: "marked 2 in repair", "marked 1 lost", "marked 1 back in use", "marked 1 found, back in use", "removed 1 from stock as damaged", "removed 1 from stock as lost", "changed the details of a unit in repair". Under each: the unit's label (tracked gear), the day it happened, expected back and notes. Events from before the rework read in the same words ("marked 2 damaged" now reads "marked 2 in repair").

**Tests.** Database (`tests/db/gear-stock-rework.test.ts`): every action by every role, by the function and by hand; each unit's own record; what is refused; written off as damaged and as lost, with the audit event; tracked gear by unit; booked units never taken; the quantity rule; six races (the last free unit, three kinds of report at once, back in use against write off, found against write off, lowering the quantity against reports, two edits); another shop's five roles and a signed-out visitor. Browser (`e2e/gear-stock.spec.ts`, phone and desktop): the whole click-through by owner, staff, mechanic and driver, the bottom sheet's position, tracked gear, and the History.

## 6. The brief and this design side by side

| Brief | This design, as decided |
| --- | --- |
| Instant vs request as a setting | The two stored counts stay; simple control on top |
| No marketplace fields at creation | No listing fields, and no catalog on the create form either: a kind and a name. Make, model, engine size and transmission are asked for at Moto Mangos review |
| Delivery is a service product | The distance fee stays for every shop; a shop's own flat "Delivery" product is allowed; nothing preset |
| Services such as tax and insurance, damage cover | No preset products; free-text names; any vendor's own goods and services |
| Gear counted by quantity | Counted on screen; stored as nameless unit rows so the database lock covers it. One product per size until after the pilot |
| Four types built together | Sale items: database in stage A, name and stock in B, price in D, selling in Phase 3 |
| PR 13's migration may be reshaped | Kept untouched; follow-up migrations |

## 7. Questions for Mark

Answered on 13 Nov 2026 and worked in above: the rename, the type-ahead, the Thai word, items for sale, sizes, the instant and request split, what the cap counts, who may do what, lead time, deposits, and what "tax and insurance" and delivery are.

Answered in a second round the same day: items for sale by stage, the "price per day" mode, and who may mark a unit lost.

Still open:

1. **BSR's Booqable price templates:** multipliers on a base price, or fixed amounts per length? Only the importer needs this (Phase 10).

## 8. Spec and doc edits this design needs (owner keeps the spec)

- `docs/platform/SPEC.md` › Data model: `models` → `products` with type and tracking; `extras` row removed in favour of products and `product_extras`; `price_structures` → `price_templates` and `price_template_days`, built from anchors; the stored "price per day" mode (change request 41) dropped, with a "same price every day" fill helper in its place; new `product_pricing` (the model's deposit moves into it); `order_lines.kind` → a product line with `parent_line_id`; new `product_listings`, `tax_profiles`, `stock_movements`. › Fleet and Pricing module text to match, including: the order deposit is the sum of each vehicle's deposit; lead time; unit status `lost`; no preset products. › Booqable table: variations marked as after the pilot.
- `docs/platform/MAPPING.md`: target names in §4 and §6; `shop_extras` → service or gear products plus `product_extras`.
- `docs/INTEGRATION.md`: no change now. At 3M: extras availability (§5.3) and the lead-time rule (the stricter of shop notice and listing lead time) in §4.6.
- Root `CLAUDE.md`: the two-level lock order (§2.2) once Phase 2 builds it.
- `apps/platform/CLAUDE.md` still says the exclusion constraint is "on allocations/downtime"; it is on `unit_blocks`.
