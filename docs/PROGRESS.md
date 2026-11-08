# Progress

What's done, open decisions and known issues, across both apps. Update this at the end of every session so the next one starts clean.

## Status (8 Nov 2026)

| Track | Where it stands |
| --- | --- |
| Repo | **Step R** (monorepo restructure) on branch `restructure-monorepo`. Move-only: no behaviour or database change |
| Marketplace (Moto Mangos, `apps/marketplace`) | Customer search and pages live on the `lib/data` adapter (Phase 3). Booking fee and fee lifecycle are on the `booking-flow` branch, not merged (see below) |
| Platform (`apps/platform`) | README only. Phase 0 (foundations) is next after Step R |
| Database | One Supabase project, 27 migrations in `supabase/migrations`. Live = today's Bike-Booking project (migrations only from `main`); a staging project is still to be created |

## Step R: done in this branch

- `apps/marketplace`: the Bike-Booking app, moved with `git mv` so history is kept.
- `packages/core` (`@mango/core`): rental-days, pricing, availability, closures, money, time, with their tests. Logic unchanged.
- `packages/db` (`@mango/db`): Supabase client factories and `database.types.ts`; `npm run db:types` writes there.
- `packages/config` (`@mango/config`): tsconfig base, ESLint presets with the monorepo boundaries, Prettier base.
- Root npm workspaces with one lockfile; CI (`.github/workflows/ci.yml`); `apps/marketplace/netlify.toml` with an ignore command.
- Docs: `docs/platform/SPEC.md`, `docs/marketplace/*`, the merged `docs/INTEGRATION.md`, and CLAUDE.md files at the root, in the marketplace and in the platform.

## Next

1. Owner: update the Netlify site settings (steps in the Step R PR), compare the deploy preview with bike-booking-th.netlify.app, and merge.
2. Owner: rename the GitHub repo to `mango-works`, check Netlify still points at it, and archive `mango-works-platform`.
3. Marketplace follow-up branch: copy `fees.ts`, `fee-lifecycle.ts`, `flags.ts` and their 23 tests from `booking-flow` into `apps/marketplace/lib`. Drop the WIP `marketplace_bookings` migration; marketplace bookings are designed with platform Phase 3.
4. Platform Phase 0: `platform/phase-0-foundations`.

## Open

- Platform product name.
- Staging Supabase project: not created yet.

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
