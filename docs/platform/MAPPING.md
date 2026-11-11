# Legacy mapping: marketplace tables → platform tables

Status: **approved by the owner, 10 Nov 2026**, with the decisions in §8. Required by docs/platform/SPEC.md › Review decisions › Legacy mapping, before any Phase 1a migration.

This maps every column of the marketplace's temporary shop tables (docs/INTEGRATION.md §7) to its home on the platform. Platform tables live in their own `platform` schema (owner, 10 Nov 2026); names below are in that schema unless they say `public`. Phase 1a builds the target tables for tenants, locations, models, units and unit blocks. **No legacy row is moved or dropped in Phase 1a**: the data moves at Phase 3M (marketplace switch), and the legacy tables are dropped after it. Until then the marketplace keeps reading its own tables and nothing here changes what customers see.

Legacy columns are as they stand after all 30 migrations (`packages/db/src/database.types.ts`).

## Rules that apply to every row

| Rule | Detail |
| --- | --- |
| IDs survive | A shop's tenant takes the shop's UUID and slug, so links, reviews and bookings keep pointing at the same thing. A `bike_models` row keeps its UUID as the model's ID, because it is the marketplace's `listingId` |
| Money | Legacy amounts are whole baht (`int`). Platform amounts are `bigint` minor units with the tenant's currency. At 3M each amount is multiplied by 10^exponent of the shop's currency (THB ×100) |
| Time | Legacy rules assume Asia/Bangkok. Platform rules use the location's time zone. At 3M each Thai shop's location gets `Asia/Bangkok` |
| Distance | Stored in km on both sides. Shown in the shop's unit (km or miles) |
| Phase | The phase that creates the target column. "1a" exists after this phase; later phases add theirs and this document is updated then |

## 1. `shops` → `tenants` + default `locations` row

One tenant per shop, plus one location flagged `is_default`.

| Legacy column | Target | Phase | Notes |
| --- | --- | --- | --- |
| `id` | `tenants.id` | 0 | Same UUID. The default location gets a new UUID |
| `slug` | `tenants.slug` | 0 | Same slug. The demo tenant `bsr` on staging is seed data, not a mapped shop |
| `name` | `tenants.name`; also `locations.name` for the default location | 0 / 1a | |
| `country` | `tenants.country` | 0 | |
| `currency` | `tenants.currency` | 0 | Locked once any money row exists (1a) |
| (Asia/Bangkok, hard-coded) | `locations.timezone` | 1a | Moves from `tenants.timezone` to the location in 1a |
| (none) | `tenants.locale` | 0 | Set at 3M from the country (`th-TH` for TH) |
| (none) | `tenants.distance_unit` | 1a | `km` at 3M |
| `location` (PostGIS point) | `locations.geo` | 1a | Same type |
| `maps_url` | `locations.maps_url` | 1a | |
| `nearest_station` | `locations.nearest_station` | 3M | Marketplace data (stations are marketplace-owned); column added with markets |
| (none) | `locations.address` | 1a | Free-form text. Legacy has no address; filled by the shop |
| (none) | `locations.market_id` | 1a (empty) | Nullable until the marketplace's `markets` table arrives at 3M; then set from the address |
| `google_place_id` | `locations.google_place_id` | 1a | A Google place is a physical shop, so it sits on the location |
| `about` | `tenants.about` | 3M | Marketplace profile text |
| `photos` | `locations.photos` | 3M | Shop-front photos |
| `status` (draft, pending, live, suspended) | `tenants.marketplace_listed`, `tenants.marketplace_approved`, `tenants.status` | 3M | live → both true; pending → listed, not approved; draft → neither. suspended → `tenants.status = 'suspended'`: the shop is hidden everywhere and its data is kept |
| `submitted_at`, `approved_at`, `terms_accepted_at`, `review_notes`, `flagged_for_review` | Marketplace-owned approval record keyed by tenant ID | 3M | Approval is the marketplace owner's decision (INTEGRATION §1) |
| `boost_level` | Marketplace-owned table keyed by tenant ID | 3M | Ranking is marketplace data |
| `cutoff_minutes` | `locations.booking_cutoff_minutes` | 2 | Booking rule; per location from Phase 2 |
| `notice_h` | `locations.min_notice_hours` | 2 | |
| `min_days_booking`, `min_days_walkin` | `locations.min_days_advance`, `min_days_walkin` | 2 | |
| `request_window_min` | `locations.request_reply_minutes` | 3 | Max 240, counted in opening hours |
| `buffer_before_h`, `buffer_after_h` | `tenants.buffer_before_minutes`, `buffer_after_minutes` (shop default) | 2 | ×60. The model's own value wins (see §4) |
| `delivery_enabled`, `delivery_radius_km` | Delivery settings + `delivery_bands` | 8 | The radius becomes the last band's upper limit |
| `created_at`, `updated_at` | Same names | 0 | Kept |

## 2. Shop child tables

| Legacy table.column | Target | Phase | Notes |
| --- | --- | --- | --- |
| `shop_hours.shop_id` | `location_hours.tenant_id`, `location_id` (the default location) | 1a | |
| `shop_hours.weekday`, `open`, `close` | Same names on `location_hours` | 1a | 0 = Sunday. Wall-clock times in the location's time zone |
| `shop_closures.id`, `start_date`, `end_date`, `note`, `repeats_yearly`, `created_at` | Same names on `location_closures` | 1a | Same yearly-repeat rule (`@mango/core` closures) |
| `shop_closures.shop_id` | `location_closures.tenant_id`, `location_id` | 1a | |
| `shop_contacts.phone`, `whatsapp`, `line_id`, `email` | `locations.phone`, `whatsapp`, `line_id`, `email` | 1a | International phone format. Still shown to a renter only after a confirmed booking: `marketplace_api` never returns them in shop reads |
| `shop_members.shop_id`, `user_id`, `created_at` | `memberships.tenant_id`, `user_id`, `created_at` | 0 | |
| `shop_members.role` (owner, staff) | `memberships.role` | 0 | owner → owner; staff → staff |
| `shop_invites.*` | Not mapped | — | Unused invites expire. Team invites are rebuilt before Gate A |
| `shop_policies.deposit_amount` | `tenants.default_deposit` (bigint minor units) | 2 | |
| `shop_policies.deposit_methods` | `tenants.deposit_methods` | 2 | |
| `shop_policies` (all other columns: helmets, helmet types, gloves, jacket, rain gear, phone holder, USB charger, top box, side panniers, usage area, km limit, medical cover, passport, licence, minimum age, experience, notes) | `tenants.inclusions_default` (JSON, same field names as `apps/marketplace/lib/inclusions.ts`) | 2 | `usage_area` values are Thailand-specific today; they become per-market options at 3M |
| `delivery_zones.max_km`, `fee` | `delivery_bands.max_km`, `price` | 8 | Fee ×100 for THB |
| `shop_extras.*`, `shop_extra_models.*` | `extras` and its model links | 2 | Prices to minor units; `price_kind` rental/time kept |
| `promotions.*`, `promotion_models.*` | `price_rules` / coupons | 2 | No promotions exist yet; mapped in detail when Phase 2 is prepared |

## 3. `bike_catalog` stays the one vehicle catalog

No second catalog. The table stays where it is, with its UUIDs and slugs, and platform models link to it. The marketplace keeps reading it unchanged.

| Column | What happens | Phase |
| --- | --- | --- |
| `id`, `slug`, `make`, `model`, `year_from`, `year_to`, `cc`, `type`, `transmission`, `abs`, `underseat_storage`, `usb_charger`, `key_type`, `description`, `stock_photo`, `status`, `review_notes`, `reviewed_at`, `created_at`, `updated_at` | Unchanged | — |
| `requested_by_shop_id`, `request_note` | Unchanged. Because tenant ID = shop ID after 3M, the same column then names the requesting tenant | — |
| (new) `requested_by_tenant_id` | Added, nullable, references `platform.tenants`. A platform shop requests a missing entry and can use its own pending request; a platform admin (`platform.platform_admins`, the one place that role is defined) approves or rejects it. Merged with `requested_by_shop_id` at 3M | 1a |
| (new) `vehicle_type` | Added, `not null default 'motorbike'`, references the new platform-wide `vehicle_types` (motorbike, car; each with a spec schema) | 1a |
| (new) `specs` | Added, JSON, `not null default '{}'`. Holds specs that aren't bike columns (car: seats, fuel type, doors) | 1a |

**Path for cars.** A car is a catalog row with `vehicle_type = 'car'` and its specs in `specs`, validated against the car's spec schema. `cc` and `type` (the bike-style enum) are required today; when the first car entry is needed, one migration makes them required for motorbikes only. The table is renamed `vehicle_catalog` at 3M, when the marketplace's SQL functions that name it are retired. Phase 1a adds the three columns and the `vehicle_types` table, and nothing else.

## 4. `bike_models` → `models` (and `units`)

A legacy row is a shop's listing of one catalog entry with a quantity. On the platform it becomes one model plus one unit per vehicle.

| Legacy column | Target | Phase | Notes |
| --- | --- | --- | --- |
| `id` | `models.id` | 1a | Same UUID (the marketplace's `listingId`) |
| `shop_id` | `models.tenant_id` | 1a | |
| `catalog_id` | `models.catalog_id` | 1a | Required. A shop may have several models on one catalog entry, each with its own display name |
| (none) | `models.name` | 1a | Display name, unique within the shop. At 3M: the catalog entry's make, model and years |
| `photos` | `models.photos` | 1a | Same storage paths |
| `visible` | `models.bookable_online` | 1a | |
| `qty` | Count of the model's `units` rows | 1a | No quantity column. At 3M, `qty` units are created per model at the default location, status active, with no plate and `plate_pending` set; the shop fills in plates afterwards |
| `instant_qty`, `request_qty` | `models.instant_units`, `request_units` | 1a | Walk-in-only = active units − instant − request. Checked on save (can't exceed active units) |
| `ready_today_count` | `models.ready_now` | 1a | |
| `ready_today_on` | Dropped | — | `ready_now > 0` means the same |
| `ready_today_updated_at` | `models.ready_updated_at` | 1a | |
| `buffer_before_h`, `buffer_after_h` | `models.buffer_before_minutes`, `buffer_after_minutes` | 1a | ×60. Null = shop default |
| `deposit_amount` | `models.deposit` (bigint minor units) | 1a | ×100 for THB. Null = shop default |
| `min_days_booking`, `min_days_walkin`, `notice_h` | `models.min_days_advance`, `min_days_walkin`, `min_notice_hours` | 2 | Null = location default |
| `flagged_for_review` | Marketplace-owned approval record | 3M | |
| `created_at`, `updated_at` | Same names | 1a | |
| (none) | `models.description`, `min_age`, `licence_class` | 1a | New on the platform; `min_age` and licence also arrive from the policy override below |

`bike_model_policies` (per-model overrides of "What's included"):

| Legacy column | Target | Phase |
| --- | --- | --- |
| `bike_model_id` | `models.id` | 1a |
| `min_age` | `models.min_age` | 1a |
| `licence_required` | `models.licence_class` | 1a |
| `deposit_methods` and every other column | `models.inclusions_override` (JSON; only the overridden fields) | 2 |

`units` has no legacy source beyond the count above. New in 1a: `tenant_id`, `model_id`, `location_id`, `plate`, `plate_pending`, `frame_number`, `engine_number`, `colour`, `model_year`, `current_odometer_km`, `status` (active, maintenance, retired, sold), `qr_token`, `notes`. (`first_registered`, the `borrowed` status and its `active_from` / `active_to` window were removed on 11 Nov 2026, owner decision.) Purchase and sale details live in `unit_financials` (owner and manager only). Tax and insurance renewals (`unit_renewals`, costs in `unit_renewal_costs`) and each shop's model-year bands (`model_year_bands`) were added on 11 Nov 2026; none has a legacy source. Keys, GPS and service data arrive in Phase 1b.

## 5. `bike_model_downtime` → `unit_blocks`

Legacy says "N units of this model are out until a date". The platform blocks specific units.

| Legacy column | Target | Phase | Notes |
| --- | --- | --- | --- |
| `id` | Not kept | — | One legacy row becomes `units` rows' worth of blocks |
| `bike_model_id` | Picks the units: the model's first `units` active units without a block | 3M | |
| `units` | Number of `unit_blocks` rows created, `kind = 'downtime'` | 3M | |
| `created_at` | Start of `unit_blocks.period` | 3M | |
| `back_on` (date) | End of `period`: midnight at the start of that date in the location's time zone. Null = open-ended | 3M | Matches today's rule: out on every local date before `back_on` |
| `note` | `unit_blocks.note` | 3M | |

`unit_blocks` (1a): `tenant_id`, `unit_id`, `kind` (allocation, downtime, hold, transfer), `period` (`tstzrange`, start included, end excluded), `note`, `created_by`. One exclusion constraint: no two blocks of the same unit may overlap. Phase 1a writes only downtime blocks; Phases 2 and 3 add allocations and holds on the same table and the same constraint.

## 6. Later phases (listed so nothing is lost)

| Legacy table | Target | Phase |
| --- | --- | --- |
| `price_days` (`bike_model_id`, `day`, `total`, `is_anchor`, `is_manual`) | `price_structures` in total-price-table mode: 30 totals in minor units, anchor and manual flags kept | 2 |
| `bookings`, `booking_events` | `orders` (channel = marketplace) + order lines + unit blocks; events → `audit_events` | 3M |
| `reviews` | Stays marketplace-owned. `shop_id` already equals the tenant ID; `bike_model_id` already equals the model ID | — |
| `profiles`, `stations`, `ranking_settings` | Stay marketplace-owned, unchanged | — |

## 7. Legacy functions

Retired at 3M, replaced by `marketplace_api` functions and `@mango/core`: `search_offers`, `model_offer`, `longest_walkin`, `rental_days`, `rental_price`, `shop_stats`, `shop_coordinates`, `units_in_repair`, `repair_conflicts`, `is_shop_closed_on`, `shop_open_at`, `shop_readiness`, `submit_shop`, `create_shop`, `create_shop_invite`, `accept_shop_invite`, `is_shop_member`, `is_shop_owner`, `is_shop_live`, `is_bike_model_public`, `bike_model_shop_id`, `can_use_catalog`, `is_catalog_approved`, `shop_extra_shop_id`, `promotion_shop_id`. `station_list`, `is_admin`, `slugify` and `try_uuid` stay.

## 8. Decisions (owner, 10 Nov 2026)

1. **Suspended shops** become a tenant status: hidden everywhere, data kept. The column arrives at 3M.
2. **Units without a plate** are allowed with a "plate pending" flag. Check-out warns about it (Phase 5). A plate is unique within a shop when filled in.
3. **Several models per catalog entry** are allowed, each with its own display name. The legacy one-listing-per-entry rule is not carried over.
4. **Time zone** lives on the location only; changing it is owner-only.
5. **Market** stays empty on locations until 3M.
6. **Platform admin** is defined in one place, `platform.platform_admins`, not by `profiles.role` on the marketplace side. At 3M the marketplace's admin checks for shared data (catalog approval, shop approval) move to it.
