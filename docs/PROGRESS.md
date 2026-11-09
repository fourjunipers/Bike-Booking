# Progress

What's done, open decisions and known issues, across both apps. Update this at the end of every session so the next one starts clean.

## Status (9 Nov 2026)

| Track | Where it stands |
| --- | --- |
| Repo | **Step R** merged to `main` (PR #5). GitHub repo renamed to `fourjunipers/mango-works`; Netlify site `bike-booking-th` relinked to it |
| Marketplace (Moto Mangos, `apps/marketplace`) | Customer search and pages live on the `lib/data` adapter (Phase 3). Booking fee, fee lifecycle and the `BOOKING_ENABLED` flag are on `marketplace/booking-fees` (PR open, not merged). Nothing uses them yet |
| Platform (`apps/platform`) | README only. Phase 0 (foundations) is next |
| Database | 27 migrations in `supabase/migrations`. Live = today's Bike-Booking project (migrations only from `main`). Staging = Supabase project `mango-works-staging` (Singapore), created; no migrations pushed yet |

## marketplace/booking-fees (9 Nov 2026)

- From `booking-flow` (commit `ec7de98`) only: `lib/fees.ts`, `lib/fee-lifecycle.ts`, `lib/flags.ts`, `lib/fees.test.ts`, `lib/fee-lifecycle.test.ts` (23 tests). The WIP `marketplace_bookings` migration and everything else stayed behind. `booking-flow` is kept on GitHub for now.
- `fees.ts` no longer hard-codes the ฿50 minimum: `bookingFee(rental, feeMinimum)` and `priceBreakdown(…, feeMinimum)` take the market's minimum (decisions 2026-11-08: each market has its own). Amounts are integers in one currency unit (whole baht today), checked locally rather than with `assertWholeBaht`. The caller (checkout, not built) supplies the minimum: ฿50 for Bangkok until markets arrive at the adapter switch.
- `fee-lifecycle.test.ts` uses UTC instants instead of `bangkokDateTime`; the rules themselves already work on instants.
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

1. Owner: review and merge the `marketplace/booking-fees` PR; then delete `booking-flow` (marketplace bookings are designed with platform Phase 3).
2. Owner: archive `mango-works-platform` if not done yet.
3. Platform Phase 0: `platform/phase-0-foundations`.

## Open

- Platform product name.
- Booking-fee rounding after the move to minor units: today the fee rounds to the nearest whole baht because amounts are whole baht. Once amounts are minor units, `bookingFee` rounds to the nearest minor unit (satang). Decide at the adapter switch whether the fee should still round to a whole major unit.
- "3 days before pickup" in `lib/fee-lifecycle.ts` is exactly 72 hours. In a market with daylight saving that can differ by an hour from 3 calendar days at the same wall-clock time. Decide which the SPEC means before such a market goes live.

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
| `lib/fee-lifecycle.ts:21-25` | Charge 3 days and cancel unpaid 2 days before pickup as fixed 72 h / 48 h, no daylight-saving check (see Open) | AS |
| `lib/fees.test.ts:5` | Test fixture uses the Bangkok fee minimum (50, whole baht); the code takes it as an argument | none |
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
