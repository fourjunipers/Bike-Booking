# Products redesign: design review

13 Nov 2026. Design only: no code, no migration, nothing applied anywhere. Written from `main` at `771fa4f` (PR 13 merged).

**What this is.** Mark approved a brief to replace the separate "Make & model" and "Add to inventory" screens with one Products list, closer to Booqable's workflow, while keeping the vehicle records Booqable lacks. This document turns that brief into a database design, availability and pricing rules, a screen map, a build order and a list of questions. Where it says "recommended", that is my proposal, not a decision. Nothing here overrides `docs/platform/SPEC.md` until Mark works it into the spec (§8 lists the spec edits it needs).

## Summary

1. **One `products` table, renamed from `models`**, with a `type` (vehicle, gear, sale item, service) and a `tracking` mode. Vehicle-only fields stay on it, guarded by checks. The platform has no rows on live, so the rename costs no data work; it does mean re-creating about 15 database functions that name the old table.
2. **Rental gear counted by quantity is stored as real, nameless unit rows.** "20 helmets" is 20 rows in `units`. The existing exclusion constraint, per-unit locks and availability rule then cover gear with no second mechanism, and "track individual units" becomes giving those rows labels. Items for sale are different (they are used up, not lent) and get a stock ledger with orders in Phase 3. Services have no stock.
3. **Moto Mangos settings move to their own table, `product_listings`**, so a product is created with no marketplace fields and listed later from its tab. The existing instant and request counts become the "units to offer" cap.
4. **Pricing hangs off the product as a method plus an amount or a shared price template.** Tax profile and deposit are per product with a shop default. Extras are not a separate table: an extra is a gear or service product linked to a vehicle product. This is laid out now so Phase 2's one pricer (`quote()`) reads it without rework.
5. **PR 13's migration: keep it as it is.** Do not change it in place again; build forward with new migrations. Reasons in §1.6.
6. **The main risks in the brief:** "instant vs request" as a single choice loses today's split and breaks the marketplace contract; delivery as a priced service collides with the distance-band fee in the spec; dropping the catalog pick from the create form would cost motorbike shops typing and invite typos; items for sale need orders and payments, so they can only be half-built before Phase 3. Details in §6.
7. **Thirteen questions for Mark** in §7. Four of them block the first build stage.

## 1. Database design

### 1.1 Today's tables and where they go

| Today (`platform` schema) | Becomes | Change |
| --- | --- | --- |
| `models` | `products` | Renamed. New `type`, `tracking`. Vehicle-only columns become nullable, required for vehicles by a check. Marketplace columns move out (next row) |
| `models.marketplace_listed`, `instant_units`, `request_units`, `ready_now`, `ready_updated_at` | `product_listings` | Moved to a new table, one row per listed (or once-listed) vehicle product |
| `models.catalog_id`, `make`, `model`, `vehicle_type`, `cc`, `transmission`, `categories` | Stay on `products` | Vehicle description. `catalog_id` stays the link to the one catalog (`public.bike_catalog`) |
| `models.catalog_approved_at`, `catalog_rejected_at`, `catalog_reject_reason` | Stay on `products` | They describe the catalog request on this product. Moving them would mean rewriting the review function for no gain |
| `models.deposit`, `deposit_currency` | Stay; `deposit_currency` renamed `currency` | One currency column for every amount on the product (§3) |
| `models.buffer_before_minutes`, `buffer_after_minutes`, `min_age`, `licence_class`, `photos`, `description`, `bookable_online`, `retired_at` | Stay on `products` | Buffers and `retired_at` apply to every type; `min_age` and `licence_class` to vehicles only |
| `units` | `units` | Kept. `model_id` renamed `product_id`. New `product_type` (copied by a composite key), `label`. Vehicle-only columns guarded by a check |
| `unit_financials`, `unit_renewals`, `unit_renewal_costs` | Unchanged | Vehicle records. Tracked gear units may use `unit_financials` too |
| `unit_blocks` | Unchanged | Still the one availability lock, one exclusion constraint. Gains `order_line_id` in Phase 3, as already planned |
| `model_year_bands` | `product_year_bands` | Renamed with its `model_id` column. Vehicles only |
| `audit_events`, `notification_outbox`, locations, tenants, memberships | Unchanged | |
| `public.bike_catalog`, `public.vehicle_types` | Unchanged | Shared with the marketplace. Not touched |
| Extras (spec's `extras` table; never built on the platform) | Not built | Replaced by gear and service products plus `product_extras` (§3.5) |
| Spec's `price_structures` (not built) | `price_templates` + `price_template_tiers` | Same content, made shareable between products (§3.2) |

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
  -- pricing (§3)
  pricing_method, price_amount, price_period, price_template_id,
  deposit, tax_profile_id, currency
```

| Type | Tracking allowed | Stock lives in |
| --- | --- | --- |
| Vehicle | `unit` only | `units`, one row per vehicle, each with a plate (or plate pending) |
| Rental gear | `bulk` (default) or `unit` | `units`: nameless rows for bulk, labelled rows for tracked |
| Item for sale | `consumable` | `stock_movements` ledger (Phase 3) |
| Service or extra | `none` | Nothing. Always available while the product is active |

Rules, all as check constraints or the existing guard trigger:

- `type` and `tracking` must be one of the pairs above.
- A vehicle needs `vehicle_type`, `make` and `model`; a motorbike also needs `cc` and `transmission` (today's rule, unchanged). Every other type must leave all vehicle-only columns empty.
- `type` cannot change once the row exists. `tracking` can change only between `bulk` and `unit` on gear (§2.4).
- Names stay unique within a shop (`models_name_idx`, unchanged). The "no duplicate own make and model" index gains `and type = 'vehicle'`.
- `categories` keeps its shape check. The lists stay in code (`apps/platform/lib/vehicle-kinds.ts`, to be renamed) with new lists per type: gear (helmet, jacket, gloves, camera, phone holder, luggage, lock, other) and service (insurance cover, damage and theft cover, licence help, other). Required for motorbikes and cars as today; optional elsewhere.
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
- `unit_renewals` (tax and insurance) stays vehicle-only in the screens. No database rule is needed: a renewal on a helmet would be odd but harmless.

### 1.4 `product_listings` (Moto Mangos)

```text
product_listings
  tenant_id, product_id     primary key (product_id); foreign key (tenant_id, product_id, product_type) → products
  product_type              always 'vehicle' (check), so only vehicles can be listed
  enabled        boolean    the quick on/off switch (today's marketplace_listed)
  instant_units  int        units offered for instant booking
  request_units  int        units offered on request
  lead_time_minutes int     null = the location's minimum notice
  ready_now, ready_updated_at    walk-in count for "Ride today"
  created_at, updated_at
```

- A product with no row has never been listed. "List on Moto Mangos" creates the row; the switch flips `enabled`.
- Existing rules move with the columns: `enabled` only while the product is on an approved catalog entry (`not_listable`) and not retired; `instant_units + request_units` and `ready_now` never exceed the product's active units, and are clamped down when a unit leaves (`units_clamp_model_counts`).
- Policies: every member reads; owners and managers write; staff may change `ready_now` only (the spec has staff updating the walk-in count from the app), enforced by a column guard like `units_guard`.
- The marketplace's `listingId` stays the product's id (`MAPPING.md` §4), so nothing changes for 3M.

### 1.5 New tables at a glance

| Table | Stage | Purpose |
| --- | --- | --- |
| `product_listings` | C | §1.4 |
| `price_templates`, `price_template_tiers` | D (Phase 2) | Shared prices by rental length (§3.2) |
| `tax_profiles` | D (Phase 2) | Rate and inclusive or exclusive, per shop (§3.3) |
| `product_extras` | D (Phase 2) | Which gear and services are offered with which vehicle product (§3.5) |
| `stock_movements` | Phase 3 | Ledger for items for sale (§2.5) |

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
| 2 | `platform_gear_units` | `units.label`, the per-type unit checks, `set_stock_quantity()` and `set_quantity_out()` (§2.3), the product-level advisory lock | B |
| 3 | `platform_product_listings` | Create the table, copy the five columns across, drop them from `products`, re-point the guards and the review function | C |
| 4 | `platform_product_pricing` | Pricing columns, `price_templates`, `price_template_tiers`, `tax_profiles`, `product_extras`, the wider currency lock | D |

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
- **Gear out of use** ("2 helmets being cleaned until Friday") is downtime blocks on any 2 free nameless units, through `set_quantity_out(product, location, n, until)`. Staff and mechanics may do this, as they may for vehicle downtime today.
- **Booking 3 helmets** is 3 allocation blocks on 3 units. Staff never see which rows.
- **Why rows and not a counted pool.** The alternative is a `stock_blocks` table with a quantity per row and a "sum of overlapping quantities ≤ stock" check inside a function. That check can't be an exclusion constraint, so gear would have a second, weaker lock that only holds if every writer goes through the function. With rows, the database itself refuses the 21st helmet. The costs are more rows (60 helmets = 60 rows) and one audit row per unit when the quantity changes; `set_stock_quantity` also writes one summary audit event ("quantity 20 → 25") so the history reads cleanly. A limit of 1,000 bulk units per product per location keeps a typo from creating a million rows.
- **Nameless units can be re-packed.** Because they are interchangeable, the booking function may move not-yet-collected allocations between nameless units when no single unit is free for the whole window but the count says one should be. Build the simple best-fit pick first and add re-packing only if the race and fragmentation tests show a need.

### 2.4 Tracking individual units of gear

Switching a gear product from `bulk` to `unit` asks for a label per existing unit (pre-filled "Helmet 1…20") and from then on staff pick or scan a specific unit at check-out. Blocks, history and quantity are untouched because the rows were always there. Switching back to `bulk` clears the labels; allow it only while no unit has purchase details.

### 2.5 Items for sale and services

- **Services** have no stock: available whenever the product is active.
- **Items for sale** are used up. On-hand is the sum of a `stock_movements` ledger (received, sold, returned, adjusted; append-only, each row with who and when), minus quantities on open orders. They never enter `unit_blocks`. The ledger arrives with orders in Phase 3, because a sale needs an order line and a payment. Until then a sale item is a product with a name and price and no stock figure.

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

- The cap counts **Moto Mangos bookings only**. A walk-in or a direct booking uses up real availability (step 3) but not the cap. So "offer 3 of my 8 PCX on Moto Mangos" means at most 3 out through Moto Mangos at once, and fewer when the shop itself is nearly full.
- This is `docs/INTEGRATION.md` §4.4 unchanged: the contract already defines the instant and request split. The cap is not a new stored number.
- **Lead time**: the pickup must be at least `lead_time_minutes` after now; null means the location's minimum notice. It is a plain duration, so it needs no time zone. Opening hours, closures and minimum days (§4.6 of the contract) still apply in the location's time zone, which must not assume a fixed offset.
- A product that is retired, not `enabled`, off an approved catalog entry, or (per the contract) without a photo and a full price is never offered.
- The marketplace keeps showing only what `marketplace_api` returns. It never computes availability itself after 3M.

## 3. Pricing

Phase 2 builds the pricer. This section fixes where its inputs live so that work needs no schema change.

### 3.1 Method on the product

| `pricing_method` | Columns used | Charge for one line |
| --- | --- | --- |
| `per_period` | `price_amount`, `price_period` (`hour` or `day`) | amount × periods × quantity |
| `fixed` | `price_amount` | amount × quantity, once per order |
| `tiered` | `price_template_id` | the template's total for the rental length × quantity |
| `free` | none | 0 (shown on the order as included) |

- Any type can use any method. Typical: vehicle `tiered`; helmet `per_period` by day or `free`; chain lube `fixed`; damage cover `per_period`; licence help `fixed`.
- A product with `pricing_method` null has no price yet: it can be created and stocked but not put on an order or listed.
- Periods: a day is every started 24 hours from pickup (`@mango/core` `rental-days`, contract §4.1). An hour is every started 60 minutes. Days are counted in the location's wall-clock time (review decision).
- The method list is a check constraint, so a later method (for example "percent of the rental", common for damage waivers) is one small migration.

### 3.2 Price templates (tiered by rental length)

```text
price_templates        tenant_id, id, name, mode ('day_table' | 'day_rates'), currency, shared boolean
price_template_tiers   tenant_id, template_id, from_days, amount, is_anchor, is_manual
```

- This is the spec's `price_structures` with one change: a template can be used by many products. `day_table` holds a total for each length from 1 to 30 days (anchors and hand edits flagged, as `price_days` does today); `day_rates` holds the three daily rates (1–6, 7+, 28+). Over 30 days derives from the 30-day total, as decided.
- "Own prices" for one product is a template with `shared = false` that only that product points to. The product form offers "Use a shared price list" or "Set this product's own prices".
- Tiers hold **absolute amounts in minor units**, never multipliers. A multiplier needs a rounding rule every time it is applied, and two products on one template would round differently.
- Changing a shared template changes every product on it. The form must name them before saving. Past orders are unaffected because an order stores its quote snapshot (review decision).
- Legacy `price_days` maps to one unshared `day_table` template per listing at 3M.

### 3.3 Tax profiles and deposits

- `tax_profiles`: `name`, `rate_bp` (basis points, integer: 7% = 700), `inclusive`, `is_default`. One default per shop, created from the tenant's current `vat_rate` and `vat_inclusive`. `products.tax_profile_id` null means the default. A shop that sells an exempt insurance cover gives that product a 0% profile.
- Tax is computed and stored **per order line** with the rate and inclusive flag copied onto the line, so a later change to a profile never alters an old order.
- `products.deposit` (exists today) is the deposit per unit rented; null means the shop default. How the deposits of several lines combine into the order's deposit is a question for Mark (§7).
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

## 4. Screens, permissions and audit

### 4.1 How the screens fit together

| Screen | Address | What it shows |
| --- | --- | --- |
| **Products** | `/[tenant]/products` | Every product, one row each: photo or type icon, name, type, price, stock (units in use / total; "—" for services), Moto Mangos chip and switch (vehicles only). Filters: type, category, status, Moto Mangos state. "+ New product" |
| **New product** | `/[tenant]/products/new` | Step 1: pick the type (four cards). Step 2: the form for that type. Vehicle: today's kind, make and model, categories. Gear: name, category, quantity per location, "track individual units". Sale item and service: name, category. No marketplace fields anywhere on it |
| **Product page** | `/[tenant]/products/[id]` | Tabs: **Details**, **Units** (vehicle and tracked gear: rows with "+ Add unit"; bulk gear: quantity per location and "out of use"), **Pricing**, **Moto Mangos** (vehicles only), **History** |
| **Unit rows** | on the Units tab and in Fleet | Vehicle: plate, status, odometer, location; opens the unit page. Tracked gear: label, status, location |
| **Unit page** | `/[tenant]/fleet/units/[id]` | Unchanged: status, odometer, downtime, tax and insurance, purchase and sale, sticker, delete |
| **Fleet** | `/[tenant]/fleet` | Vehicle units only, for the mechanic: plate, product, status, odometer, service due (Phase 1b), insurance and tax expiry, current or next downtime. Today's grouping, filters and sort carry over |
| **Moto Mangos tab** | on the product page | Not listed: "List on Moto Mangos" → match an approved catalog model ("Did you mean…") or send a new one for review → instant, request and units to offer → lead time. Listed: the same settings plus the switch and the review state. Rejected: the reviewer's note and the two next steps from the fleet rework |

- Products and Fleet read the same rows. Fleet is `units` joined to `products` where the type is vehicle; Products is `products` with unit counts. A change in one shows in the other at once.
- Old addresses redirect: `/fleet/models/[id]` → `/products/[id]`, `/fleet/models/new` → `/products/new`, `/fleet/units/new?model=` → the product's Units tab. Printed QR stickers are unaffected (they hold a token, not a path).
- CSV import stays on Fleet for vehicles; a `type` column and a gear and services import can follow with the Booqable importer (Phase 10).
- Wording: "product" everywhere; "vehicle" only for a vehicle unit and the Fleet screen; "unit" for a tracked piece of gear. Thai strings for all of it need the owner's review, as before.

### 4.2 Permissions

| Action | Owner | Manager | Staff | Mechanic | Driver |
| --- | --- | --- | --- | --- | --- |
| See Products list and product pages | Yes | Yes | Yes | Read only | Read only |
| See Fleet | Yes | Yes | Yes | Yes (their home) | Read only |
| Create, edit, retire, restore, delete a product | Yes | Yes | No | No | No |
| Add or remove units; change gear quantity; switch tracking | Yes | Yes | No | No | No |
| Unit status active ↔ maintenance, odometer, downtime, gear "out of use" | Yes | Yes | Yes | Yes | No |
| Tax and insurance records: add and edit / delete | Yes / Yes | Yes / Yes | Yes / No | Yes / No | No |
| Purchase, sale and renewal costs | Yes | Yes | Hidden | Hidden | Hidden |
| Prices, templates, tax profiles, deposits: see / change | Yes / Yes | Yes / Yes | See | See | See |
| Moto Mangos: list, settings, on/off switch | Yes | Yes | No | No | No |
| Walk-in "ready now" count | Yes | Yes | Yes | No | No |
| History tab (audit) | Yes | Yes | No | No | No |

This is today's split carried over (owners and managers set up; staff and mechanics work on units), with one row to confirm with Mark: whether staff may see or change prices and the Moto Mangos switch (§7). Each row is enforced in the database by RLS and the guard triggers, and repeated in `lib/roles.ts` for the menus. The isolation tests cover each role limit.

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
| **A. Products core** | Rename; four types in the schema; Products list; type-first create page; product page with Details, Units and History tabs; Fleet becomes the vehicle-units view; redirects; wording. Vehicles behave exactly as today | 1 | The rename touches about 16 app files, every fleet test and the Playwright flows. A missed function body fails only when called, so the function list must come from the database. Thai wording |
| **B. Gear and services** | Bulk gear with quantity per location and "out of use"; tracked gear with labels; services and sale items as products without stock | 2 | Quantity changes racing with downtime or (later) bookings; audit noise from many unit rows |
| **C. Moto Mangos tab** | `product_listings`; the tab; the switch in the list; units to offer and lead time stored and validated. Still no effect on the marketplace until 3M | 3 | Moving columns the review function writes; keeping "approved means listed" and the clamp working |
| **D. Pricing fields** (opens Phase 2) | Method, amount, period; templates; tax profiles; deposit; `product_extras`; Pricing tab; price column in the list | 4 | Getting a shape Phase 2 then has to change. Mitigated by settling §5.3 first |
| **Phase 2 proper** | `quote()`, the availability function (§2), the booking function with both lock levels, `price_rules`, coupons | Phase 2's own | As the spec says: where bugs cost real money |
| **Phase 3** | Orders and order lines as in §3.5; `stock_movements` for sale items; `unit_blocks.order_line_id` | Phase 3's own | |

A, B and C are independent of pricing and can each be a PR. Stage A should merge alone first: it is the one with a wide, mechanical diff, and reviewing it mixed with new behaviour would hide mistakes. Push to live once, after C (§1.7).

### 5.2 Test plan

**Database (Vitest against local Supabase, in CI's RLS job)**

- Isolation harness: every new or renamed table has a fixture row per tenant and passes cross-tenant read, insert, update and delete; role limits from §4.2 (a mechanic can't change a product, staff can change only `ready_now` on a listing, nobody but owner and manager reads the History).
- `default-grants.test.ts` passes: every new table granted on purpose; no new function executable by everyone.
- Type rules: a service or sale item takes no unit; a gear unit takes no plate; a vehicle needs its specs; a tracked unit needs a unique label; `type` can't change; only a vehicle on an approved entry can be listed.
- Fleet rework rules re-run after the rename (`fleet-rework.test.ts`, `review-fixes.test.ts`, `recheck-followups.test.ts` unchanged in what they assert): categories, retire and restore, withdraw on delete, clamp, reject and resubmit.
- Quantity: raise and lower; lowering refused when units are blocked; "out of use" on n units; switching bulk ↔ tracked keeps blocks.
- Races, in the style of the existing twelve-writer test: twelve writers for the last helmet (one success, eleven clean refusals); two orders each wanting 2 of the same 3 helmets (no deadlock, one succeeds or both get a clear refusal); lowering the quantity while a unit is being blocked; listing switched on while the product is being retired.
- Migration test: build a database at PR 13's state with seeded shops, apply the new migrations, and compare product and unit counts, listing settings and categories per shop.

**Unit (`@mango/core` and `apps/platform/lib`)**

- Availability with bulk units, buffers, shortage demand, and the Moto Mangos cap and mode against the contract's §4.3–4.4 examples; one tenant in a daylight-saving time zone.
- Each pricing method; template monotonic check; tax inclusive and exclusive; a zero-decimal currency (JPY) and a two-decimal one; rounding half up at each of the three division points.
- Type and category lists, labels in both languages, list filters, the permission helpers.

**Playwright (375 px and 1280 px)**

- Create one product of each type; the Products list filters and the Moto Mangos switch; the product tabs; add a vehicle unit from the Units tab; set a helmet quantity and mark 2 out of use.
- Fleet as a mechanic (lands there, can't open pricing or create a product); a driver reads only.
- The Moto Mangos tab from "not listed" through match, send for review, approve (in `/admin/catalog`), switch off and on; the rejected flow.
- Old addresses redirect; the History tab shows who changed a price.

**Before the live push:** the runbook's dry run on a copy of live (36 public queries byte-identical, grants fingerprint unchanged, row counts unchanged, the hourly job's function runs).

**Not truly testable now:** anything that needs an order (blocks from bookings, the cap against real Moto Mangos bookings, sale-item stock). Those tests are written with Phases 2 and 3; stage tests use hand-made blocks, as Phase 1a did for "selling a unit with future bookings".

### 5.3 Decide before Phase 2

1. **Pool or assigned units.** The marketplace contract (§4.3) says bikes are a pool and `freeUnits = quantity − busiest moment`. The review decision gives every reserved booking a real unit at once. With assigned units, a product can have one free at every moment and still no single unit free for the whole rental. The availability function must report what the booking function can deliver. Options: accept the stricter answer, or re-pack not-yet-collected allocations automatically (safe for bulk gear; for vehicles it moves a customer to another plate before pickup, which is normally fine).
2. **Buffers between two rentals.** With blocks stored widened and requests widened too, the gap between rental A and rental B is A's "after" plus B's "before". Confirm that is intended, with a worked example in the spec.
3. **How line deposits combine** into the order deposit (§7, question 8).
4. **Tax rounding per line or per order**, to match the Thai tax invoice (ask Korn with the open invoice-format question).
5. **Hourly products on a daily order**: each line by its own period unit (recommended), with worked examples.
6. **Template amounts absolute** (recommended) and how Booqable's structures import into them (§7, question 3).
7. **Overbooking per product.** The spec has one shop-wide switch; Booqable has "allow shortage" with a limit per product. Recommended: shop-wide in Phase 3, a per-product override later; the design in §2.1 step 4 supports both.
8. **Lead time and closed hours** (§7, question 10).
9. **Which category Moto Mangos files a multi-category motorbike under** (open in PROGRESS already).
10. **Extras on Moto Mangos need stock.** The contract's `extras[]` has no availability. When helmets are counted, checkout must not sell a fourth helmet when three are left: a contract addition for 3M.

### 5.4 The approved brief: what looks wrong or risky

1. **"Set instant vs request" as one choice.** Today a product splits its units: some instant, some on request, the rest walk-in only, and the marketplace contract (§4.4) is written on that split. A single choice loses "first 3 instant, then 2 on request" and would change the contract. Recommended: keep the two stored counts; show a simple control ("All instant" / "All on request" + units to offer) with the split behind "Advanced".
2. **"Create the product first with no marketplace fields."** Agreed for the listing settings. But the approved catalog is also the pick-list that fills make, model, engine size and transmission. If the create form drops it, a motorbike shop types four fields the list would have filled, typos return ("Hodna"), and the Moto Mangos tab then has to match them after the fact. Recommended: keep the list on the create form as a plain "known models" picker with no Moto Mangos wording, and keep "Manually enter".
3. **Delivery as a priced service.** The spec prices delivery by distance bands (`delivery_bands`), computed per address. A fixed-price "Delivery" product would be a second, conflicting way to charge it. Recommended: delivery stays a computed fee line on the order and is not a product.
4. **"Tax and insurance" as a service name.** The same words already label each vehicle's own renewal log. A service sold to the customer should be named for what the customer buys ("Insurance cover"), or staff will confuse the two.
5. **Items for sale before orders exist.** A sale needs an order line, a payment and a stock ledger: Phase 3. Stage B can only create the product. If BSR sells little, consider leaving the type out of the screens until Phase 3 (the schema can still allow it).
6. **A third rework of the same screens before any booking exists.** Stages A to C are worthwhile because Phase 2 builds on products, but they delay Phase 2. Keeping A mechanical and B and C small matters more than polish here.
7. **"Product" for a rental vehicle** may read as "something for sale" to staff, and more so in Thai. A native check of the Thai word before stage A saves a second pass over every string.
8. **Shared templates** make one edit reprice many products. Safe with the confirmation in §3.2, risky without it.
9. **Only vehicles can be listed**, and Moto Mangos lists motorbikes only today. The tab should say so for a car or boat instead of offering a flow that ends in "not yet".

### 5.5 Missing from the brief

| Topic | Booqable has it | Recommendation |
| --- | --- | --- |
| **Variations** (helmet S / M / L, jacket sizes) | Yes | Not in this design. For now each size is its own product in the same category. Revisit after the BSR pilot; a `variant_of` link can be added without reshaping. Note the spec's feature table still says "variations: match" |
| **Bundles** | Yes | Removed by change request 15. `product_extras` with an included quantity covers the common case (bike + 2 helmets). Keep removed |
| **Collections** | Yes | Removed by change request 16. Categories and the type filter cover it |
| **Per-product buffers** | Yes | Already stored (`buffer_before_minutes`, `buffer_after_minutes`); unused until Phase 2. They apply to gear too (helmet cleaning time) |
| **Allow shortage** | Yes, per product with a limit | Shop-wide switch in Phase 3 as the spec says; per-product later (§5.3, item 7) |
| **Replacement value** of gear (what a lost helmet costs the customer) | Yes | Add a `replacement_price` column with stage D; used by damage charges in Phase 5 |
| **Quantity limits per order** | Partly | `product_extras.max_quantity` covers extras |
| **SKU or barcode** for sale items | Yes | A free-text `sku` column with Phase 3 |
| **Stock per location and transfers** | Add-on | Units already carry a location; transfers are a `unit_blocks` kind. Multi-location is Phase 11 |
| **Photos** for every type | Yes | The `photos` column exists; upload arrives with Phase 3 as already planned |
| **Lost or written-off gear** | Yes | Unit status `retired` with a note for tracked gear; lowering the quantity for bulk |
| **Minimum rental length or minimum charge per product** | Yes | Phase 2 decision; a column pair on `products` if wanted |
| **Booqable importer mapping** | — | Booqable's product types (rental, consumable, service) and tracking (trackable, bulk, none) map one-to-one onto `type` and `tracking`, which is a good sign for Phase 10 |

## 6. Summary of recommendations that differ from the brief

| Brief | This design |
| --- | --- |
| Instant vs request as a setting | Keep the stored instant and request counts; simple control on top |
| No marketplace fields at creation | No listing fields; keep the catalog as a neutral pick-list |
| Delivery is a service product | Delivery stays a computed fee |
| Gear counted by quantity | Counted on screen; stored as nameless unit rows so the database lock covers it |
| Four types built together | Sale items get stock only in Phase 3 |
| PR 13's migration may be reshaped | Keep it untouched; follow-up migrations |

## 7. Questions for Mark

Blocking stage A:

1. **Rename the table** `models` → `products` (and the columns that follow), or keep the old names in the database and change only the screens? Recommended: rename now.
2. **Catalog pick-list on the create form:** keep it as a neutral "known models" list (recommended), or remove it so make and model are always typed and the catalog appears only on the Moto Mangos tab?
3. **The Thai word for "product"** for things that are rented, not sold. Who checks it, and before or after stage A?
4. **Items for sale:** what does BSR sell today, and does it need to be on screen before orders exist (Phase 3)?

Before stage B or C:

5. **Sizes** (helmets, jackets): are separate products per size acceptable until after the pilot?
6. **Instant vs request:** one choice per product, or keep the split with a simple control on top (recommended)?
7. **Units to offer:** should the cap count only Moto Mangos bookings (recommended, and what the contract says), or all bookings of that product?
8. **Who may do what:** may staff switch Moto Mangos on and off or change a gear quantity? Should mechanics and drivers see prices at all?

Before stage D and Phase 2:

9. **Booqable's price structures at BSR:** are the 30 of them multipliers on a base price, or fixed amounts per length? An export or screenshots of two or three would settle how they import and whether "shared template" matches how you use them.
10. **Lead time:** plain hours from now (recommended), or counted in opening hours like the request reply window? Does it replace the shop's minimum notice for that product or add to it?
11. **Deposits on an order with several products** (2 bikes and a camera): the sum of each, the highest one, or one deposit per order set by staff?
12. **Damage and theft cover:** a flat price per day, or a percentage of the rental? Does buying it lower the deposit?
13. **"Tax and insurance" as a service:** what exactly does the customer buy? And do you agree delivery stays a distance fee and is not a product?

## 8. Spec and doc edits this design needs (owner keeps the spec)

- `docs/platform/SPEC.md` › Data model: `models` → `products` with type and tracking; `extras` row removed in favour of products and `product_extras`; `price_structures` → `price_templates` and tiers; `order_lines.kind` → a product line with `parent_line_id`; new `product_listings`, `tax_profiles`, `stock_movements`. › Fleet and Pricing module text to match. › Booqable table: variations marked as deferred.
- `docs/platform/MAPPING.md`: target names in §4 and §6; `shop_extras` → service or gear products plus `product_extras`.
- `docs/INTEGRATION.md`: no change now. At 3M: extras availability (§5.3, item 10) and, if question 6 goes the other way, §4.4.
- Root `CLAUDE.md`: the two-level lock order (§2.2) once Phase 2 builds it.
- `apps/platform/CLAUDE.md` still says the exclusion constraint is "on allocations/downtime"; it is on `unit_blocks`.
