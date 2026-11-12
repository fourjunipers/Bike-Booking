# Vehicle Rental SaaS — Spec & Build Plan

Nov 8, 2026 · @Mark

## Verdict

Yes, Claude Code can build this. It can match Booqable's core features and quality for vehicle rentals, and beat it in the areas that matter to a bike or car shop. It won't match all of Booqable on day one. Booqable has been refined across thousands of shops and has a long tail of features. The plan copies the \~80% that rental shops use, skips the generic-equipment extras, and adds vehicle features Booqable doesn't have.

**Where we can beat Booqable for vehicles**

- Every vehicle is a unique unit with a plate, VIN, tax and insurance log, odometer, service schedule, purchase/sale price and lifetime profit. Booqable treats vehicles as generic stock items.
- A guided check-out/check-in on a phone: photos, fuel, odometer, a tap-to-mark damage diagram and a signed contract.
- Customer KYC: passport, driving licence and IDP capture with expiry checks, plus deposit tracking.
- Long-term rentals as a first-class flow: monthly rates, extensions, recurring payments and renewal reminders.
- Thailand-ready: THB, Thai VAT, PromptPay, and LINE notifications next to email.

**What's hard (and how we handle it)**

| Risk | Why it's hard | Approach |
| --- | --- | --- |
| Double bookings | Buffers, downtime, partial pickups and two staff booking at once | Postgres exclusion constraint on unit time ranges, so the database rejects any overlap |
| Tenant data leaks | One database serves many shops | Row-level security on every table, plus automated tests that try cross-tenant reads |
| Payments breadth | Booqable supports 7 processors | Stripe only (cards + PromptPay), each shop connects its own account; Omise later if asked |
| Deposit holds | Card holds expire (typically 7 days) | Hold for short rentals; for long rentals, take the deposit and refund it |
| Native mobile app | Separate iOS/Android codebases | Installable PWA first; native wrapper later |
| Website builder | Booqable ships 80+ templates | 5 good templates, not 80+, built after the BSR pilot; booking page + widget first |
| Product quality | Edge cases only show up in real use | BSR runs on it in parallel with Booqable before any other shop signs up |

**Rough effort:** one build phase is about one to two weeks of steady Claude Code sessions. That puts BSR running on it in about 3–5 months (Phases 0–10), and a version you can sell to other shops 1–2 months after that. The ongoing costs are support, uptime and payments compliance, not the code.

## Booqable features mapped to our plan

This inventory comes from Booqable's [pricing and feature comparison](https://www.booqable.com/pricing), its [order workflow docs](https://help.booqable.com/en/articles/3845244-the-booqable-order-workflow) and its [July 2026 Bo AI release](https://booqable.com/whats-new/july_30_2026/). Booqable's plans are Start $29, Grow $69, Scale $149 and Custom from $349 per month (yearly billing), with paid add-ons for website builder, mobile POS, barcodes, deliveries and extra locations. Phase numbers refer to the build plan below.

| Booqable feature | Our plan | Phase |
| --- | --- | --- |
| Products, variations, services, sales items | Match. Vehicle models + units; extras (helmets, phone holders, insurance) as add-on products | 1 |
| Real-time stock, unique item tracking | Improve. Every vehicle is a unit with plate, VIN, docs and odometer | 1 |
| Buffer time | Match. Per model, before and after | 2 |
| Downtime scheduling | Improve. Linked to maintenance jobs and service-due alerts | 1 |
| Sub-rentals / temporary stock | Match. Borrowed units with an active-from/to window | 1 |
| Overbooking / shortage flags | Match, as a shop setting (off by default). Shortage warning on the order and dashboard | 3 |
| Multi-location | Match. Locations per tenant; transfers between shops | 11 |
| Barcode scanning | Improve. QR sticker per vehicle, scanned with the phone camera | 5 |
| Flexible pricing, seasonal/weekend rules | Improve. Day/week/month tiers + date-range rules + long-term rates | 2 |
| Taxes, coupons, recurring-customer discounts | Match. Thai VAT 7% default, inclusive or exclusive | 2 |
| Per-order and per-product deposits, waivers | Match. Per model, with waiver per customer | 2 |
| Order workflow: new, draft, reserved, picked up, returned, archived, canceled; partial (mixed) status; revert | Match | 3 |
| Availability calendar, planner, internal notes | Match. Timeline per unit (Gantt) + day list | 3 |
| Customer database, custom fields, tags | Improve. Adds passport, licence, IDP, nationality, hotel/condo address | 4 |
| Quotes, contracts, invoices, packing slips | Match, minus quotes and packing slips. Thai tax invoice format; rental agreement in EN/TH | 6 |
| E-signatures | Match. Signed on the phone at check-out, with audit trail | 5 |
| Automated + custom emails | Improve. Email plus LINE messages | 6 |
| Online payments, payment requests, pre-auth, down payments, refunds, offline payments | Match. Stripe Connect (cards, PromptPay) + cash/transfer recording | 7 |
| Tap to Pay / mobile POS | Match. Stripe Tap to Pay in the staff app (Phase 12) | 12 |
| Booking page, website integration, custom domain, checkout customization, minimum notice, away mode, QR confirmation emails, cross-sell | Match, except product collections and cross-sell (not needed). Adds pay-later with an automatic charge before pickup | 8 |
| Website builder (80+ templates) | Simplified. 5 good templates instead of 80+, plus the embed widget | 11 |
| Reports: availability, fulfilment, product performance, ROI, customers, coupons | Improve. Sales history with period compare, filters and daily cash close; profit per vehicle | 10 |
| User seats, permissions, enforced 2FA | Match. Roles: owner, manager, staff, mechanic | 0 / 11 |
| CSV/Excel import and export | Match. Includes a Booqable importer | 10 / 12 |
| API, Zapier, GA4, Google Ads, Meta Pixel, Xero, Mailchimp | Partly. API + webhooks, GA4, Google Ads conversions; others later | Later |
| Deliveries add-on with routing | Simplified. Delivery/collection address, fee, driver assignment | 8 |
| 10+ backend languages | English + Thai, built ready for more | 0 |
| Bo AI assistant (briefings, Q&A, account review) | Later. Claude-powered daily briefing + ask-your-data | Later |

## Product scope

This is a multi-tenant SaaS: each rental shop signs up, gets its own workspace, and runs its whole operation from it. BSR Bike Shop is tenant #1 and the pilot. Mango Works Co., Ltd. is the parent company. The platform's product name is still to be chosen ("the platform" until then). The marketplace is Moto Mangos, marketed separately as the platform's official marketplace partner.

**Who uses it**

- **Shop owner/manager:** fleet, pricing, reports, settings, team.
- **Front-desk staff:** bookings, check-out/check-in, payments, customer documents, on desktop or phone.
- **Mechanic:** maintenance jobs, downtime, odometer and service logs.
- **Driver:** today's deliveries and collections.
- **Renter (public):** browses, books and pays on the shop's booking page; signs the contract; gets email/LINE updates.
- **Platform admin (you):** tenants, subscriptions, feature flags, support access.

**Vehicle types:** motorbikes/scooters first, then cars. Per-model specs come from a vehicle-type template (bike: cc, ABS, keyless; car: seats, transmission, fuel type), so new types need no new code.

**Out of scope for v1:** native iOS/Android apps, processors other than Stripe, accounting sync, AI assistant. All are listed under Later in the build plan.

**How it connects to the Bike-Booking marketplace: one platform, two front doors.** Rather than syncing two separate systems, the marketplace becomes a customer-facing site that runs on this platform's data.

1. **One source of truth.** Every shop's fleet, prices, availability and bookings live here. A marketplace booking is just an order with channel = marketplace, so it lands on the shop's calendar and staff app like any other booking, with no double-booking.
2. **Shops opt in.** A setting per shop: "List my bikes on the marketplace". Only opted-in shops and models appear there.
3. **Shops without a subscription can still list.** They get a free "Marketplace" plan: fleet, calendar, bookings and the staff app, without sales history, maintenance or the other paid modules. This replaces the separate vendor backend in Bike-Booking, and it doubles as a way to sign up new paying shops.
4. **Marketplace rules stay marketplace-only.** The 10% booking fee (min ฿50), request-to-book, referrals and the shop ranking run in the marketplace front end. The booking fee is taken through Stripe Connect as a platform fee on marketplace orders only; direct bookings stay commission-free.
5. **Order of work.** Decided: one system in one monorepo on one database (see Repository and database). The Bike-Booking vendor backend stays paused; its customer site reads shop data through its adapter. After Phase 3 the adapter switches from its temporary tables to this platform's marketplace\_api functions, so Phase 8 needs no separate marketplace API. The contract is docs/INTEGRATION.md (its rules section is binding here). The marketplace can launch with BSR at Phase 8; the legacy Bike-Booking shop tables are dropped after the switch. Other shops join after Phase 11, when sign-up and the free Marketplace plan exist.

## Tech stack and architecture

The stack keeps your existing tools (GitHub, Netlify, Tailwind, Resend, GA) and adds a real database, auth and payments. Your Decap CMS stack is built for static sites and can't run a SaaS.

| Layer | Choice | Why |
| --- | --- | --- |
| App framework | Next.js (App Router) + TypeScript, in a monorepo: platform app (admin, staff app, booking pages, API) and marketplace app, sharing packages | One repo, shared rules; server actions; works on Netlify or Vercel |
| Database | Supabase Postgres | Range types + exclusion constraints for availability; row-level security for tenants |
| Auth | Supabase Auth: email, Google, LINE (OIDC); 2FA for staff | Built in; LINE login matters for Thai staff |
| File storage | Supabase Storage, private buckets per tenant | Passports, licences, damage photos, signed PDFs |
| UI | Tailwind CSS + shadcn/ui, light/dark | Fast to build, consistent, accessible |
| Payments | Stripe Connect (Standard accounts) for shop payments; Stripe Billing for SaaS subscriptions | Money goes straight to each shop; you never hold their revenue |
| Email | Resend + React Email templates | Already in your stack |
| Messaging | LINE Messaging API (per-tenant channel) | Thai customers and staff |
| PDFs | Server-side render (react-pdf) | Contracts, invoices, quotes |
| Background jobs | Supabase cron + Edge Functions (or Inngest) | Reminders, expiry alerts, recurring charges |
| Hosting | Netlify (one site per app) + one shared Supabase project (Singapore region) | Low latency for Thailand |
| Monitoring | Sentry + Supabase logs; uptime check | Catch errors before shops do |
| Testing | Vitest (unit), Playwright (end-to-end), pgTAP or SQL tests for RLS | Availability and tenant isolation must be tested |
| i18n | next-intl; English + Thai | Admin and booking pages |

**Non-negotiable rules**

1. Every table has a `tenant_id`. RLS restricts every row to members of that tenant. No query runs with the service key from the browser.
2. Availability is enforced in the database, not only in app code (see Data model).
3. Money is stored as integer minor units (satang) with a currency code per tenant. No floats.
4. All times are stored in UTC and shown in the tenant's time zone (Asia/Bangkok for BSR).
5. Every state change on an order writes an audit event: who, when, from, to.

## Repository and database

Decided 8 Nov 2026: one monorepo with two apps, shared packages and one Supabase database. Step R does the restructure before Phase 0 and changes no behaviour.

**Why.** The platform and marketplace share pricing, availability and booking rules, so they live in one place and a contract change lands in one PR. With one database a marketplace booking is a plain order insert under the same overlap lock: no API or sync to build. Bike-Booking has no shops or bookings yet, so this is the cheapest moment.

**Layout**

```text
mango-works/              Bike-Booking repo, restructured in place, renamed after
├─ apps/
│  ├─ marketplace/        Moto Mangos (today's Bike-Booking site), moved as-is
│  └─ platform/           rental management platform, name TBD (README now, scaffolded in Phase 0)
├─ packages/
│  ├─ core/               pure rules: rental days, day-table pricing, availability maths, closures, money, time
│  ├─ db/                 Supabase client factories + generated database types
│  └─ config/             shared tsconfig, ESLint, Prettier
├─ supabase/              one migrations folder for the one database
├─ docs/
│  ├─ platform/SPEC.md    this doc
│  ├─ marketplace/        SPEC.md, BUILD_PLAN.md, decisions.md, BSR_SEED.md
│  ├─ INTEGRATION.md      the single platform ↔ marketplace contract
│  └─ PROGRESS.md
├─ .github/workflows/ci.yml
├─ CLAUDE.md              root rules (each app also has its own CLAUDE.md)
└─ package.json           npm workspaces
```

**Boundaries** (enforced by ESLint)

- An app never imports from the other app. Shared code goes in packages/.
- packages/core is pure TypeScript: no React, Next.js or Supabase.
- The marketplace reads shop data only through its lib/data adapter. After Phase 3 the adapter reads platform tables through SQL functions in a `marketplace_api` schema that return only shops with marketplace\_listed and marketplace\_approved. createBooking becomes one database function that inserts the order under the overlap lock.
- Table ownership follows docs/INTEGRATION.md §1. Migration names carry the owner: `…_platform_tenants.sql`, `…_marketplace_referrals.sql`.
- Branches carry the app: `platform/phase-N-name`, `marketplace/phase-N-name`.

**Database, auth and hosting**

| Environment | Supabase project | Gets migrations |
| --- | --- | --- |
| Local | Supabase CLI (Docker) | Every branch |
| Staging | mango-works-staging (Singapore, free; created 9 Nov 2026) | Branches under test, pushed by hand |
| Live | Today's Bike-Booking project | Only from main |

- One Supabase Auth user pool. Staff are users with a membership; customers are users with a marketplace profile; one person can be both.
- Two Netlify sites from one repo: the existing bike-booking-th site (apps/marketplace) and a platform site created in Phase 0. Each skips builds when nothing it depends on changed, so platform work doesn't spend marketplace deploy credits.
- Two brands on one database. Each app sends its own branded sign-in emails through Supabase's send-email hook and Resend. Google and LINE sign-in apps are registered under the parent company, Mango Works.

**Step R: restructure plan** (one Claude Code session, branch `restructure-monorepo`, one PR)

1. Move today's Bike-Booking code into apps/marketplace with git mv, so history is kept. Root package.json with npm workspaces and one lockfile.
2. Extract packages/core from the marketplace's lib/: rental-days, pricing, availability, closures, money, time, with their tests. Imports switch to `@mango/core`. No logic changes.
3. Create packages/db (Supabase clients, database.types.ts) and packages/config.
4. Move supabase/ to the root unchanged. No new migrations; the 27 applied ones keep their names and contents.
5. Add apps/platform with a README only.
6. Docs: this doc to docs/platform/SPEC.md; the two integration docs merged into docs/INTEGRATION.md (Bike-Booking's newer copy as the base); root, marketplace and platform CLAUDE.md files; PROGRESS.md started.
7. CI: GitHub Actions running typecheck, lint and unit tests per workspace on every PR.
8. Netlify: apps/marketplace netlify.toml with an ignore command, plus written steps for the site settings Mark changes.
9. Mark updates the Netlify settings, checks the deploy preview and merges. Then he renames the repo to mango-works, checks Netlify still points at it, and archives mango-works-platform.

**Accept (R):** typecheck, lint, unit tests and build pass in every workspace; `supabase db reset` applies all 27 migrations; Playwright customer and auth specs pass; the deploy preview matches bike-booking-th.netlify.app; nothing under supabase/migrations changed; `git log --follow` shows history for moved files.

**Booking-flow branch.** Not rebased. After R merges, a short follow-up branch copies fees.ts, fee-lifecycle.ts, flags.ts and their 23 tests into apps/marketplace/lib. The WIP marketplace\_bookings migration is dropped: with one database a marketplace booking is an order (channel = marketplace) plus a fee record, designed with Phase 3.

## Built for any country

The platform works for a shop in any country from day one; Moto Mangos goes live market by market. No code assumes Thailand, baht or Bangkok time.

**Platform: per-shop settings, never hard-coded**

| Setting | Where it lives | Rule |
| --- | --- | --- |
| Country, currency, time zone | tenants | Chosen at sign-up; every price, report and reminder uses them |
| Money | Integer minor units by ISO 4217 | THB ×100 (satang), JPY and VND ×1; shown with the browser's number formatting |
| Staff languages | next-intl message files | English and Thai first; a new language is a new file, not new code |
| Customer languages | Agreement and email templates per language | Each shop picks which it offers |
| Tax | tenants.vat\_rate, vat\_inclusive + a country tax profile | Thai tax invoice first; other countries added as profiles |
| Payments | Payment-provider interface (Phase 7) | Stripe first; a local provider where Stripe can't serve shops (it doesn't support businesses in Vietnam) |
| Privacy | Per-country consent text and retention | Thai PDPA first; each new country reviewed before launch |
| Phones, addresses, plates | International phone format; free-form address and plate | No Thai-only formats |

**Moto Mangos: markets you switch on**

A market is a place Moto Mangos operates: a city or region, or a whole country. Only live markets appear in search.

| Field | Example |
| --- | --- |
| Name, URL slug | Bangkok, bangkok |
| Parent | Thailand |
| Status | Hidden, coming soon, live |
| Currency, time zone, languages | THB, Asia/Bangkok, en + th |
| Booking fee | 10%, minimum ฿50 (each currency sets its own minimum) |
| Referral program | On, 50% of the booking fee (Thailand); off until reviewed elsewhere |
| Area | Map boundary; a shop belongs to the market its address falls in |
| Stations | Bangkok's BTS/MRT list |

- Shops anywhere can join the platform at any time. Their bikes appear on Moto Mangos the day their market goes live.
- A coming-soon market gets a page that collects renter emails and shop sign-ups, so each launch starts with supply.
- Setting Thailand live switches on every Thai city at once.
- One domain with paths, not a site per country: /bangkok, /chiang-mai, /ja/bangkok. Language stays the URL prefix it is today; the market is the next part. Search ranking builds on one domain.
- Settings pass down: a city uses its country's setting unless it sets its own. Referrals are on or off per market from the start: off means no partner QR codes and no new earnings there, while earnings already made are still paid. A country's referrals go on only after a check of local rules on paying partners (tax withholding, payout method). Ranking and promotions use one global setup in v1, with per-market overrides later.
- Rollout order: Bangkok, Chiang Mai, all of Thailand, Vietnam, Japan. Each new country needs its currency, languages, a payment-provider check, a privacy review and a local landmark list.

**Moto Mangos search by transmission and engine size.** Renters filter by transmission (automatic, semi-automatic, manual) and engine size in cc bands (under 125, 125–160, 160–300, over 300), alongside vehicle type, price, area and dates. Both values come from the vehicle catalog entry each model links to. A model can't be saved without a catalog entry, so cc and transmission are always filled in; a missing catalog entry goes to the platform admin for approval.

**When it's built.** Markets arrive with the marketplace adapter switch after Phase 3, as a marketplace-owned table; until then the site is Bangkok-only. Bike-Booking stores whole baht today and moves to minor units at the same switch. packages/core's Bangkok-only time helpers take a time-zone argument in Phase 2.

## Data model

The core idea: renters book a **model** (e.g. Honda PCX 160). Staff assign a specific **unit** (plate 1กข-1234) before or at pickup. Each assigned unit holds a time block that the database won't let overlap.

| Table | Key fields | Notes |
| --- | --- | --- |
| tenants | name, slug, country, currency, timezone, vat\_rate, vat\_inclusive, locale, plan, stripe\_account\_id, line\_channel, storage\_provider, google\_drive\_folder, charge\_before\_days, overdue\_alert\_days, document\_retention\_months, track\_maintenance\_costs, allow\_overbooking, closures, min\_notice\_hours, booking\_cutoff\_minutes, min\_days\_advance, min\_days\_walkin, request\_reply\_hours, inclusions\_default, marketplace\_listed, marketplace\_approved, google\_place\_id, deposit\_methods | One per shop |
| memberships | tenant\_id, user\_id, role (owner, manager, staff, mechanic, driver) | Users can belong to several tenants |
| locations | name, address, geo, opening\_hours, is\_default | Multi-location later; one by default |
| vehicle\_types | name, spec\_schema (JSON schema). Platform-wide vehicle\_catalog table (no tenant\_id): make, model, year\_from, year\_to, cc, type, transmission, abs, underseat\_storage, usb\_charger, key\_type, stock photo, approved | Motorbike, car; drives spec fields |
| models | type\_id, catalog\_id, instant\_units, request\_units, walkin\_only\_units, ready\_now, ready\_updated\_at, inclusions\_override, make, model, year, cc, specs (JSON), photos, description, buffer\_before, buffer\_after, deposit, min\_age, licence\_class, bookable\_online | What renters see |
| units | model\_id, location\_id, plate, frame\_number (VIN), engine\_number, colour, first\_registered, keys (list: type, number, spares), current\_odometer, avg\_daily\_km, status (active, maintenance, retired, sold, borrowed), active\_from, active\_to, qr\_code, purchase\_date, purchase\_price, purchased\_from, sold\_at, sale\_price, sold\_to | Each real vehicle |
| unit\_renewals | unit\_id, kind (registration, compulsory\_insurance, voluntary\_insurance, road\_tax, inspection), provider, reference\_no, cost, starts\_at, expires\_at, file, recorded\_by | Full renewal history; latest per kind = current; drives reminders |
| maintenance\_jobs | unit\_id, tasks (from schedule or custom), odometer, opened\_at, closed\_at, parts\_cost, labour\_cost, done\_by (staff or garage), receipt\_file, notes, blocks\_availability | The maintenance log; can create a downtime block |
| service\_schedules | model\_id or unit\_id, task, every\_km, every\_days, warn\_km, warn\_days, blocks\_when\_overdue | Unit row overrides the model template; next due computed from the last job with that task |
| odometer\_readings | unit\_id, km, source (check\_out, check\_in, manual, service), recorded\_by, at | Feeds current\_odometer and avg\_daily\_km |
| gps\_trackers | unit\_id, brand\_model, device\_id (IMEI), sim\_number, install\_location, installed\_at, removed\_at, notes | Battery changes run through service\_schedules |
| extras | name, price\_rule, per (rental, day), stock\_tracked, quantity | Helmets, phone holder, insurance cover |
| price\_structures | model\_id, day\_totals (1–30, from anchors 1/7/14/21/30), hourly\_rate (optional); beyond 30 days derived from the 30-day total | Example: 30 days ฿5,500 → 45 days ฿8,250, 60 days ฿11,000, 90 days ฿16,500 |
| price\_rules | scope (model or all), date range or weekdays, adjustment (% or fixed), priority | Seasonal, weekend, holiday |
| coupons | code, kind, value, limits, valid range |  |
| customers | name, email, phone, line\_id, nationality, dob, local\_address, tags, custom\_fields, deposit\_waived, blacklisted, notes |  |
| customer\_documents | customer\_id, kind (passport, licence, IDP, visa), number, country, expires\_at, storage (platform or google\_drive), file\_front\_ref, file\_back\_ref, verified\_by, delete\_after | Stored privately; access logged |
| orders | number, code (6 characters), customer\_id, status, request\_status (pending, accepted, declined, expired), cancelled\_by, no\_show, marketplace\_fee\_status, starts\_at, ends\_at, location\_out, location\_in, delivery fields, rental\_kind (short, long\_term), subtotal, discount, tax, total, deposit\_amount, deposit\_status, paid\_amount, charge\_due\_at, saved\_payment\_method, channel (walk\_in, booking\_page, phone, marketplace, api), created\_by |  |
| order\_lines | order\_id, kind (model, extra, bundle, fee, discount), model\_id, quantity, price, line\_status |  |
| allocations | order\_line\_id, unit\_id, period (tstzrange incl. buffers), state (reserved, out, returned) | The availability lock |
| downtime | unit\_id, period, reason, maintenance\_job\_id |  |
| inspections | order\_id, unit\_id, kind (out, in), odometer, fuel\_level, photos, damage\_marks (JSON on diagram), notes, signed\_by\_customer, signature\_file, at | Check-out/in record |
| damage\_charges | inspection\_id, description, amount, status | Billed against the deposit |
| documents | order\_id, kind (contract, addendum, invoice, receipt, credit\_note), number, pdf, signed\_at, sent\_at | Numbered per tenant per kind |
| payments | order\_id, kind (charge, deposit\_hold, deposit\_capture, refund), method (card, promptpay, cash, transfer), amount, stripe\_ids, status |  |
| scheduled\_charges | order\_id, amount, due\_at, payment\_method\_id, status (scheduled, paid, failed, action\_needed), attempts, last\_error | Reserve now, charge N days before |
| cash\_expenses | location\_id, business\_date, amount, category, description, receipt\_file, paid\_by, at | Cash paid out; deducted in the daily close |
| agreement\_templates | name, language, body (with merge fields), initial\_clauses, version, active | Signed copies live in documents with signer, time, device and hash |
| traffic\_fines | unit\_id, occurred\_at, place, offence, amount, reference, notice\_file, order\_id (matched), admin\_fee, status, notified\_at, paid\_at | Matched to the allocation covering occurred\_at |
| cash\_closes | location\_id, business\_date, opening\_float, cash\_in, cash\_refunds, cash\_paid\_out, expected\_cash, counted\_cash, difference, note, closed\_by, at | Daily close |
| saved\_views | user\_id, page, name, filters (JSON), shared | Saved sales-history filters |
| subscriptions\_lt | order\_id, interval, next\_charge\_at, auto\_charge, renewal\_reminder\_days | Long-term rentals |
| notifications | channel (email, line), template, to, status |  |
| audit\_events | entity, entity\_id, action, actor, before, after, at |  |

**The availability lock.** One unit can't be in two allocations or downtime blocks that overlap. Postgres enforces this:

```sql
create extension if not exists btree_gist;
alter table allocations add constraint no_unit_overlap
  exclude using gist (unit_id with =, period with &&)
  where (state <> 'returned');
```

Unassigned bookings (a model booked online, unit not chosen yet) are checked by a function: units of that model active in the window, minus overlapping allocations and downtime, minus other unassigned bookings. A booking that would push this below zero is rejected, unless the tenant allows overbooking. Then it is saved with a shortage flag.

## Module specs

Each module lists what it must do. Claude Code should treat each bullet as a requirement with a test.

### Staff app

A simple installable app for front-desk staff and mechanics, separate from the full admin. It's a PWA built from the same codebase: staff open a link once, tap "Add to home screen", and it works like an app on Android, iPhone or a tablet. It has four tabs. The tab bar can sit at the top or the bottom; Phase 0 builds both behind a setting so you can try each on real phones before choosing the default. Each role sees the tabs it needs, and a mechanic opens straight to Maintenance.

&#91;embedded content: staff app · 4 tabs, wireframe\]

1. **Dashboard: what's coming up.** Four tabs, each showing its items once: Today, Tomorrow, Upcoming (the next 7 days after tomorrow) and Late. Today, Tomorrow and Upcoming list pickups, returns, deliveries/collections, services due and tax/insurance renewals due. Late lists overdue bikes, missed pickups, deliveries and collections, overdue services and renewals, failed scheduled card charges and unpaid orders past their deadline. Each tab shows its item count, and Late is highlighted when it isn't empty. Each item opens the order or bike. A Refresh button reloads the list.
2. **Orders: find any order.** One search box for order number, customer name, phone, passport number or plate. Quick filters: today, upcoming, out now, overdue, unpaid. Opening an order shows its details and the actions for its status: check out, check in, extend, take payment, resend agreement, call or LINE the customer.
3. **New order: book and take payment.** Pick dates → see the bikes available → choose the customer (search, or add a new one and photograph passport and licence) → extras and delivery → price with any discount → sign the agreement on screen → take payment: PromptPay QR on screen, payment link by LINE/email, card saved for a later charge, or cash. Card tap-on-phone (Stripe Tap to Pay) is added in Phase 12, close to completion.
4. **Maintenance: bike lookup.** Search by plate or scan the bike's QR. The bike card shows key numbers, GPS tracker, tax and insurance status and the service tasks due. Actions: update odometer, log a service job, record a renewal, mark the bike in or out of maintenance. Below the search: a list of every task due or overdue across the fleet.

The full admin (settings, pricing, reports, fleet setup) stays in the desktop web app. Both use the same data, so anything done in one shows in the other at once.

**Desktop works for everything.** Every staff-app task also works fully in the desktop web app: check-out and check-in, damage marking, photos (webcam or file upload), signatures by mouse or trackpad, odometer and maintenance. A phone is optional, never required.

**Look.** Light grey page background; white sidebar, cards and panels; orange for the accent (selected tab and nav item, focus rings, primary buttons, selected text, highlighted boxes). Dark mode keeps the same structure with dark greys and the same orange. Pages show an instant loading state on every tap, so a slow server never looks like a dead button.

### Fleet

- Models with photos, buffers, deposit, minimum age, licence class, online-bookable toggle. Each model links to a platform-wide vehicle catalog entry (make, model, years, cc, type, transmission, ABS, under-seat storage, USB, key type, stock photo) that the platform admin approves; shops pick an entry and add their own photos. Booking modes per model: its quantity is split into Instant units, Request units and walk-in-only units, plus a "ready for walk-ins" count staff update from the app.
- Units with plate, frame (chassis/VIN) number, engine number, colour, first registration date, odometer, location and status (active, maintenance, retired, sold, borrowed). A QR sticker is generated per unit and printed from the unit page.
- Borrowed units (sub-rentals) with an active window. Retired and sold units keep their full history.

**Distance unit.** Each shop picks km or miles in settings. Odometer readings, service intervals and km allowances are stored in km and shown in the shop's unit. Every maintenance job records both the date and the odometer reading.

**Vehicle record (one page per unit)**

- **Ownership:** purchase date, price, seller and receipt; sale date, price, buyer and receipt. Marking a unit sold requires its future bookings to be moved first, then removes it from availability.
- **Profit per vehicle:** rental revenue + sale price − purchase price − maintenance − tax and insurance = lifetime profit. Also shows revenue per day owned, cost per km and days rented vs idle. Maintenance cost tracking is a shop setting. Switched off, the parts and labour cost fields on service jobs are hidden and profit is calculated without maintenance; purchase price, sale price, tax and insurance costs and the maintenance log itself stay. Optional middle ground: a standard cost per task (e.g. 120 THB per oil change) for consumables bought in bulk, so profit includes a fair estimate without tracking each litre.
- **Keys:** key numbers for ignition, side case left, side case right, rear top box and lock key, each with the number of spares held. Key types are a list per vehicle type, so a car can have different ones.
- **GPS tracker:** brand/model, device ID (IMEI), SIM number, where it is installed on the bike, install date and notes. Battery changes run as a service task (below).
- **Odometer log:** a reading is entered at every check-out and every return. Staff can also type in a reading at any time; no photo needed. A reading lower than the last one needs a manager override. Each reading is checked against the service schedule, so staff are told on the spot if a service is due.
- **Maintenance log:** each job records date, odometer, tasks done (oil, tyres front/rear, brakes, belt, battery, GPS battery, smart-key battery, other), parts and labour cost, who did it (in-house mechanic or outside garage), receipt photo and notes. An open job can block the unit from bookings.
- **Service schedule:** a template per model, overridable per unit. Each task has an interval in km and/or days, whichever comes first. Examples: oil every 3,000 km or 90 days; tyre check every 2,000 km or 60 days; brake check every 2,000 km or 60 days; GPS tracker battery every 12 months; smart-key battery every 12 months or 10,000 km. Intervals are set by the shop, not hard-coded.
- **Maintenance notifications:** due soon (e.g. 300 km or 7 days before), due, and overdue. Alerts go to the dashboard, the mechanic's to-do list and LINE. At check-out, staff see a warning such as "oil change due in 120 km". Overdue tasks can be set to block the unit.
- **Bikes out on long rentals:** km can't be read while the bike is away, so time-based tasks still run. When one comes due, staff get a follow-up task to contact the customer and arrange the service.
- **Tax and insurance log:** every renewal is a record: type (compulsory insurance (พ.ร.บ.), voluntary insurance, road tax, inspection), provider, policy or receipt number, cost, start date, expiry date and document photo. The full history is kept; the latest record of each type is the current one.
- **Renewal reminders:** to the owner/manager by LINE and on the dashboard at 45, 30, 14 and 7 days before expiry (editable), then daily once expired. Expired units are blocked from new pickups unless a manager overrides with a reason. The renewal task shows the steps in order: inspection where required, then compulsory insurance, then road tax.
- **Unit timeline:** every order, odometer reading, service job, renewal and cost on one scrolling history.

### Pricing

- Price structure per model: a total price for every length from 1 to 30 days. The shop enters anchors (1 and 30 days required; 7, 14 and 21 optional), the days between fill at equal steps rounded to ฿10, and any single day can be edited. Hourly rates are optional. Beyond 30 days there is no separate rate: every day costs the 30-day total ÷ 30, so total = round(30-day total × days ÷ 30) to the nearest baht. Example with ฿5,500 for 30 days: 45 days = ฿8,250, 2 months = ฿11,000, 3 months = ฿16,500. A rental day is every started 24 hours from pickup time. This platform owns all pricing and availability rules; the marketplace only shows what the API returns.
- **Two pricing modes; each model uses one (price\_structures.mode).** *Total-price table*: as above, anchors at 1, 7, 14, 21 and 30 days with the days between filled in and editable. *Price per day*: the shop enters three daily rates: 1–6 days, 7+ days and 28+ days. The whole rental is charged at the rate for its length (10 days = 10 × the 7+ rate; 40 days = 40 × the 28+ rate). Hourly rates, season and weekday rules, extras and coupons work the same in both modes.
- Rules by date range or weekday (high season, Songkran, weekends) with priority; non-billable days.
- Extras priced per rental, or by time with per-day, per-7-days and per-30-days rates.
- Coupons (fixed/percent, limits, date range); automatic discount for returning customers.
- VAT inclusive or exclusive per tenant; deposits per model with per-customer waiver.
- Pricing is one pure function with unit tests: `quote(order) → lines, discounts, tax, total, deposit`. Admin, booking page and API all call it.

### Orders and calendar

- Statuses: new → draft → reserved → picked up → returned → archived, plus canceled. Partial pickup or return shows as mixed. Reverting is allowed and permission-controlled.
- Draft holds nothing; reserved creates allocations; pickup requires a unit on every vehicle line, a signed rental agreement and a completed check-out inspection.
- Rental length and charge are independent (manual price override with reason).
- Views: today board (pickups, returns, overdue, deliveries), unit timeline (Gantt, drag to reassign or extend), month calendar, filterable order list (status, payment status, shortage, overdue).
- Extend, swap unit mid-rental (breakdown) and early return with automatic re-pricing and a credit or charge.
- **End of rental:** an automatic email (and LINE, if linked) to the customer when the rental period ends, with return instructions and an extend link.
- **Overdue alerts:** a bike not returned on time is flagged on the today board at once. Staff alerts then repeat on a schedule the shop sets, e.g. 1, 3, 15 and 30 days overdue. Each alert lists the customer's phone, LINE and the bike's GPS tracker ID, and creates a follow-up task. Customer overdue reminders are a separate, optional schedule.

### Check-out and check-in (phone-first)

1. Scan the unit's QR, or pick the unit.
2. Confirm customer documents are on file and valid (licence class matches the vehicle, licence and passport not expired).
3. Record odometer and fuel level (fuel gauge slider).
4. Take guided photos: front, back, left, right, dash; extra photos optional.
5. Tap to mark existing damage on a vehicle diagram (scratch, dent, crack, missing), with a photo per mark.
6. Hand over extras (helmets counted out).
7. Customer reviews and signs the contract on screen. The PDF is generated, stored, then emailed or sent by LINE.
8. Take the deposit (hold or charge) and any balance due.

Check-in repeats steps 1, 3, 4, 5 and 6, then shows the out/in comparison side by side. New damage becomes a damage charge. km over any allowance and fuel difference are charged as configured. The deposit is released, partly captured, or refunded.

### Traffic fines

- Staff enter a fine: plate, date and time, place, offence, amount, fine reference and a photo of the notice.
- The system finds which order had that bike at that moment and shows the customer, their passport and licence numbers and the signed agreement.
- One tap emails (and LINEs) the customer the fine notice, adds the fine plus the shop's admin fee to the order, and takes it from the saved card or deposit if the agreement allows, or sends a payment link.
- Each fine is tracked: received, customer notified, paid by customer, paid to police, closed. Fines with no matching order (bike was in the shop) are flagged for staff.
- Fines appear on the bike's timeline and the customer's history.

### Customers and KYC

- Profile with nationality, phone, LINE, email, local address and tags; full order history and lifetime value.
- Documents: passport and driving licence (plus IDP or visa if needed), with number, expiry, front/back photos and who verified them. An expired document blocks pickup. Never hold the original passport.
- Online booking collects documents at checkout or by a pre-arrival link.
- Blacklist with reason (within the shop only, never shared across shops).

**Is storing passport and licence copies legal?** Yes, under Thailand's PDPA, if it's handled properly. The PDPA treats these copies as personal data. A shop can keep them when it has a clear purpose: identifying the renter, the rental contract, traffic fines, theft and accidents. The platform builds in what the law expects:

1. A privacy notice shown and accepted at booking or check-out, saying what is collected, why, and for how long.
2. Only the data needed: document number, expiry and photos. No other ID cards.
3. Access limited by role and logged: who viewed which document and when.
4. Automatic deletion of images a set time after the rental closes (default 12 months), unless a damage or fine case is open.
5. Customers can ask for a copy of their data or its deletion; the shop handles this from the customer page.
6. Encrypted storage, plus a breach checklist for the shop.

This is general information, not legal advice. Have a Thai lawyer review the privacy notice and retention period once before launch.

**Document storage: platform or the shop's Google Drive.** Each shop chooses in settings.

- **Platform storage (default):** files go in encrypted private storage. Space isn't a real concern: compressed photos cost very little to store, even for thousands of rentals a year.
- **The shop's Google Drive:** the shop connects its own Google account. Passport, licence, contract PDF and inspection photos are uploaded to a folder in that Drive, and the platform keeps only a link to each file. This keeps customer IDs out of your database, and the shop owns its files if it leaves.
- **Trade-offs to know:** the shop is still responsible under the PDPA wherever the files sit; anyone with access to that Drive folder sees every passport; if the shop disconnects Drive, the images disappear from its records; and the automatic deletion has to reach into Drive to work. The connection uses the narrowest Google permission, so the platform can see only files it created.

### Documents and messages

- **Rental agreement:** the shop's own template, in English and Thai, with fields filled in automatically (customer, passport and licence numbers, bike, plate, frame number, dates, price, deposit, fuel and km at check-out, existing damage). Optional initials on key clauses.
- **Signing:** with a finger on a phone or tablet, a stylus, or a mouse/trackpad on a laptop, on the same signature pad. Staff countersign. The customer can also sign remotely through a pre-arrival link.
- **Signed record:** the signed PDF is locked and stored with time, signer name, device and a tamper-check fingerprint, then emailed (and sent by LINE) to the customer. Extensions and unit swaps produce a signed addendum.
- Invoice, tax invoice/receipt and credit note, numbered per tenant (e.g. INV-2026-00042). Templates per tenant: logo, colours, terms, custom fields.
- Automated messages by event: booking received, confirmed, payment taken or failed, pickup reminder (24h), rental period ended, overdue (shop's schedule), deposit released, renewal due. Each event can go by email, LINE or both; templates are editable.

### Payments

- Stripe Connect: each shop connects its own Stripe account; money settles to the shop.
- Methods: card and PromptPay online; cash and bank transfer recorded by staff with a receipt photo.
- **Reserve now, charge later:** at booking, the customer's card is saved (verified with 3-D Secure). The platform charges it automatically a set time before the rental starts; the shop sets this time, e.g. 3 days. If the booking is made inside that window, it's charged straight away. If the charge fails or the bank asks for extra verification, the customer gets a payment link and staff get an alert; the shop decides whether an unpaid booking is released after X hours.
- Payment requests by link; down payment (% at booking, rest at pickup or on schedule); full refunds and partial refunds.
- Deposits: each shop picks which methods it accepts: card hold (short rentals only, as holds expire), card charge refunded at return, or cash. Captures are linked to damage charges.
- Long-term: saved card with auto-charge each period, or manual payment request; a failed charge alerts staff.
- Platform fee: none by default (flat SaaS subscription, like Booqable's no commission). A per-booking application fee is possible through Connect if you change the model later.

### Online booking

- Hosted booking page per tenant (`a subdomain of the platform` or a custom domain) and an embeddable widget/script for the shop's site.
- **Shop website templates:** 5 well-made templates (home, fleet, prices, FAQ, contact + booking), with the shop's logo, colours, photos and text. Section-level editing only, not a free-form page builder.
- Browse by vehicle type; filter by cc, transmission and price; live availability; "from" prices.
- Shop booking rules: opening hours, closures (including ones that repeat yearly), minimum notice, booking cut-off before closing, minimum days (advance and walk-in), Request reply window (at most 4 hours, counted in opening hours), away mode. "What's included" defaults per shop with per-model overrides (helmets, gloves, rain gear, km limit, riding area, passport policy, licence, minimum age, deposit methods).
- Checkout: extras, delivery address + fee, coupon, documents upload, terms, pay now / pay later (charged before pickup) / pay at pickup. Confirmation email with QR.
- **Delivery fee by distance (optional per shop, table delivery\_bands).** The shop sets distance bands, each an upper limit in km with a price, and switches each band on or off. Distance is straight-line (no paid map service) from the pickup location to the delivery address, rounded up to 0.1 km. The fee is the price of the first enabled band that covers the distance; the last band can be open-ended ("over 5 km"). Past the last enabled band, delivery isn't offered for that address. Examples: up to 1 km ฿100, up to 3 km ฿200, up to 5 km ฿300, over 5 km ฿400; or a single band, up to 2 km ฿200. Used by the booking page, Moto Mangos and New order in the staff app.
- Instant confirmation or request-to-book per model.
- SEO basics, GA4 and Google Ads conversion events.

### Long-term rentals

- Monthly (and weekly) rate tiers; open-ended or fixed-term rentals.
- Recurring billing schedule with auto-charge or payment request; prorated first period.
- Extension in one tap; renewal reminders N days before the end of the period to both the customer and staff.
- Time-based service tasks create staff follow-ups to bring the bike in (see Fleet); service visits are logged against the order with the odometer reading taken then.

### Sales history, reports and dashboard

- **Dashboard:** today's pickups/returns, overdue, revenue today and this month, utilisation %, units in maintenance, services due, documents expiring.
- **Sales history page:** one screen to look up sales for any period. All figures are by payment date.
  - Quick periods: today, yesterday, this week, last week, this month, last month, this year, last year, custom range.
  - Compare: previous period, or same period last year, shown as change % on every total.
  - Totals at the top: revenue, number of orders, rental days sold, average order value, average daily rate, deposits held, refunds, discounts given.
  - A chart of revenue over the period, by day, week or month.
  - Breakdowns: by vehicle type, model, unit, extra, channel, payment method, staff member, customer nationality, location.
  - Order list underneath; click any total or bar to see the orders behind it.
- **Filters:** vehicle type, model, unit, rental type (short or long term), channel (walk-in, booking page, phone, marketplace, API), payment method (card, PromptPay, cash, transfer), payment status (paid, part-paid, unpaid), order status, staff member, customer (new or returning, nationality), coupon used, location. Filters can be saved as named views (e.g. "Cash this week").
- **Cash paid out:** staff record cash spent from the till during the day (amount, category such as fuel, parts or supplies, description, receipt photo, who paid).
- **Daily close:** at closing, staff count the cash. The system shows expected cash (opening float + cash received − cash refunds − cash paid out), the counted amount, the difference and who closed. The owner gets a LINE summary each evening: takings by method, cash paid out with receipt photos, and any difference.
- **Other reports:** utilisation by model, profit per vehicle, upcoming income from booked orders, outstanding balances, coupon use, customer repeat rate, cash paid out by category.
- **Export:** CSV/Excel of any filtered view, plus a monthly summary for bookkeeping.

### Team, settings and platform

- Roles with permissions (who can revert statuses, override prices, see document images, refund).
- Enforced 2FA option; session list; audit log viewer.
- CSV import for models, units and customers. A Booqable importer migrates BSR's data.
- Platform admin: tenants, plans, usage, impersonate-with-consent for support, feature flags.
- SaaS billing: plans and trials via Stripe Billing; limits per plan (vehicles, seats, locations).

## Review decisions (10 Nov 2026)

These came from an independent review of the plan after Phase 0. They are binding and override anything earlier in this spec that disagrees. Items marked for a later phase are settled when that phase is prepared.

**Build order.** 0 → 1a → 2 → 3 → 3M → 1b → 4 onward. Phase 1 is split in two:

- **1a Fleet core:** locations, catalog link, models, units, CSV import, QR stickers, unit blocks (downtime), the audit table, and the legacy-table mapping.
- **1b Fleet care:** maintenance log, service schedules, odometer alerts, tax and insurance renewals, keys, GPS, unit timeline, profit per vehicle. It runs after Phase 3, because profit needs orders and payments.
- **3M Marketplace switch:** a named phase for the adapter switch (marketplace\_api functions, createBooking, markets table, baht to minor units, dropping legacy tables). Accept: search results identical before and after on a seeded dataset; two parallel marketplace bookings for the last bike give one success.
- **Phase 3 also gets** the basic customer record, the payments ledger with cash and transfer recording, and the jobs + outbox + email plumbing. Phase 4 keeps KYC, Phase 6 templates and LINE, Phase 7 card payments.
- **Before Gate A** (pulled forward from Phase 11): team invites, enforced 2FA for owners, managers and anyone with document access, and a session list. Website templates and the public API move past Gate B.

**Data model and isolation (Phase 1a onward).**

- **One unit\_blocks table** (kind = allocation, downtime, hold, transfer) with one exclusion constraint on tstzrange \[start, end). No separate downtime table. Before Phase 2: every reserved booking gets a real unit block at once (auto-picked, swappable by staff); a bike still out past its end keeps blocking; a 10–15 minute hold while a renter pays; check + insert inside one function under a per-location-and-model advisory lock.
- **Locations.** Time zone, opening hours, closures, market, address and cash drawer belong to a location, not the tenant. Every tenant gets a default location at creation. Availability, ready-now counts and search filter by location from Phase 2.
- **Legacy mapping.** Phase 1a writes docs/platform/MAPPING.md, column by column, and gets owner approval before its migrations: marketplace shop → tenant + location (keep UUID and slug so links and reviews survive); shop\_members → memberships; bike\_models → models; bike\_catalog stays the one vehicle catalog (no second catalog; add a path for cars); bike\_model\_downtime → unit\_blocks; price\_days → price structures (Phase 2); bookings → orders (3M).
- **Names.** Platform tables must not collide with marketplace tables in the shared database; Phase 1a proposes a platform schema or a name prefix in its summary.
- **Tenant keys.** Every child table carries tenant\_id and references its parent by (tenant\_id, id), so a row can't point at another shop's parent. No policy grants the authenticated role 'using (true)': that role includes every Moto Mangos sign-up. Security-definer functions, views and storage policies each get their own cross-tenant test. RLS uses the set form tenant\_id = any((select my\_tenant\_ids())).
- **Isolation tests.** Every tenant-scoped table ships with a fixture row per tenant (the test fails if one is missing) and is tested for cross-tenant read, insert, update and delete, plus role limits (e.g. a mechanic can't read purchase prices).
- **Money.** Amounts are bigint in minor units. A tenant's currency is locked once any money row exists; changing time zone is owner-only, with a warning. Purchase and sale prices and costs live in unit\_financials, readable by owner and manager only.
- **Audit.** The audit table and helper are created in Phase 1a. Before Phase 4: passport numbers, addresses and phone numbers are never copied into audit snapshots (record 'changed' only), and audit rows get their own retention.

**Pricing (settle before Phase 2).** Never charge more for fewer days: in price-per-day mode each total is capped at the next tier's lowest total, and in table mode totals never fall as days rise. Days count in the shop's local wall-clock time. TypeScript quote() is the only pricer; the marketplace's SQL pricing copy is retired at 3M. Orders store a quote snapshot. Tax is stored per order line; rounding step is a setting with a default per currency. Worked examples for season rules, extensions, early returns and rentals past 30 days go in the spec before Phase 2 and become its tests.

**Payments.** Provider-neutral from the start of the schema (before Phase 3): payment\_accounts (tenant, provider, external id, capabilities) and payments.provider + provider\_ref, an append-only payments ledger, and a webhook\_events table unique on provider + event id. Features switch on capabilities (hold, save card, partial refund, platform fee). Goal: support the major payment providers in each country; Stripe and PromptPay first for Thailand. The Moto Mangos booking fee is charged fee-only on Moto Mangos' own account (as in INTEGRATION), not as a Connect platform fee. Stripe's written answers on Thai Connect limits come before Phase 2. Tap to Pay moves to Later (needs a native app; Stripe Terminal doesn't serve Thailand).

**Hosting and data.**

- Functions stay on Netlify Personal (US East) while building; tests allow for the slower preview. Move functions to Singapore (Netlify Pro) before Phase 4 stores real passports, or before Gate A if that comes first.
- Before Gate A or the first real marketplace booking on the platform: live Supabase on a paid plan with backups and point-in-time recovery, and a restore drill.
- The repo is private (10 Nov 2026).
- The shop Google Drive document option is deferred until after Gate B. A 'download all my files' export covers data ownership instead.

**Kickoff prompt additions.** Each phase lists any acceptance check it could not truly test, ships a fixture row per tenant for every new table, and records server response time per page in PROGRESS.

## Build plan

There are 13 phases, each ending in something you can click through. Gate A (after Phase 10): BSR runs on it alongside Booqable. Gate B (after Phase 12): BSR leaves Booqable and other shops can sign up. Each phase is a branch and a PR. A phase is done when its acceptance checks pass in CI and you have tried it on your phone.

&#91;embedded content: build roadmap · 13 phases, 2 gates\]

Read the phases left to right, band by band. Nothing reaches other shops until BSR has run on it for real.

**Step R (before Phase 0): monorepo restructure.** Moves Bike-Booking into apps/marketplace and extracts the shared packages, with no behaviour or database change. Plan and checks are in Repository and database.

0. **Foundations.** apps/platform scaffold (Next.js) on the shared Supabase project and its own Netlify site, auth (email, Google, LINE), tenants, memberships, roles, RLS on every table, app shell (sidebar, EN/TH switch, light/dark), installable staff app with its 4 tabs (each later phase fills in its tab), CI with tests, Sentry, seed script with a demo shop.
   - Accept: two demo tenants; a user of one cannot read or change any row of the other (automated test); deploy preview on every PR.
1. **Fleet.** Vehicle types, models, units, QR stickers, the vehicle record (ownership, profit, odometer log, maintenance log, service schedules, tax and insurance log), due/expiry alerts on the dashboard (LINE alerts added in Phase 6), downtime, unit timeline.
   - Accept: create 20 BSR bikes from CSV; insurance expiring in 30 days shows on the dashboard; an odometer reading that crosses the oil interval raises a service-due alert; a maintenance job blocks the unit; selling a unit with future bookings is refused (tested here with a future block on the unit, and again with real bookings in Phase 3).
2. **Pricing + availability engine.** Price structures, rules, extras, coupons, VAT, deposits; `quote()` function; availability function; exclusion constraint.
   - Accept: 50+ unit tests on pricing (tiers, season, weekend, VAT inclusive/exclusive); a concurrency test where two parallel bookings for the last unit results in one success, through the staff path and the online model-level path; a booking that overlaps a downtime block is refused; in both pricing modes the total never falls as days rise; the tests include one tenant in a daylight-saving time zone and one in a zero-decimal currency.
3. **Orders + calendar.** Order editor, status workflow with revert, allocations, shortage flag, today board, unit timeline (drag to reassign/extend), order list with filters, end-of-rental email, overdue alert schedule, audit events.
   - Accept: full new → returned lifecycle in Playwright; drag-extend re-prices; an overlap is refused with a clear message.
4. **Customers + KYC.** Customer profiles, documents with expiry, blacklist, privacy notice, document storage on the platform or the shop's Google Drive, access logging, retention purge job.
   - Accept: pickup blocked when licence expired; document image views appear in the audit log.
5. **Check-out / check-in.** The phone and desktop flow (phone optional): QR scan, odometer, fuel, guided photos, damage diagram, extras, rental agreement template + signature pad (finger, stylus, mouse/trackpad) with signed PDF record, comparison at return, damage charges.
   - Accept: whole check-out in under 3 minutes on a mid-range Android; works on poor signal (photos queue and upload); the same check-out and check-in complete in a desktop browser.
6. **Documents + messages.** PDF templates (contract, invoice, tax invoice/receipt, credit note), numbering, email (Resend) and LINE, event-based automations, template editor.
   - Accept: signed contract PDF arrives by email and LINE within 1 minute of signing.
7. **Payments.** Stripe Connect onboarding, card + PromptPay, saved cards charged automatically N days before pickup, payment links, down payments, deposits (hold or charge), refunds, offline payments, payment status on orders, webhooks.
   - Accept: Stripe test-mode suite covering pay, scheduled charge (incl. 3-D Secure failure), hold, partial capture, refund; webhook replay is safe (idempotent).
8. **Online booking.** Hosted page, embed widget, custom domain, checkout with extras, delivery, coupons and documents, instant vs request booking, confirmation with QR, GA4 + Ads events.
   - Accept: a renter books and pays on a phone in under 2 minutes; Lighthouse mobile score 90+.
9. **Long-term rentals.** Monthly tiers, recurring schedule, auto-charge, proration, one-tap extension, renewal reminders. Traffic fine lookup and charging.
   - Accept: a 3-month rental auto-charges each month in test clock; a failed charge alerts staff.
10. **Sales history, reports + import.** Dashboard KPIs, sales history page (periods, compare, filters, saved views, drill-down), revenue basis switch, cash paid out + daily cash close + evening LINE summary, other reports, CSV/Excel export, Booqable importer (products, stock items, customers, future orders).
    - Accept: import of BSR's Booqable export reconciles counts exactly. **Gate A:** BSR runs in parallel for 2 weeks.
11. **SaaS layer.** Marketing site with pricing page; self-serve signup, payment and automatic shop setup (country sets currency, timezone, language and tax; no manual step by Mango Works) + onboarding wizard, 5 shop website templates, plans and trials (Stripe Billing), plan limits, multi-location, platform admin, enforced 2FA, public API + webhooks.
    - Accept: a new shop goes from signup to first online booking in under 30 minutes without help.
12. **BSR cutover + hardening.** Fix pilot issues, Stripe Tap to Pay in the staff app, backups and restore drill, load test, security review, terms/privacy pages, help docs.
    - Accept: restore from backup works; no open P1 bugs for 2 weeks. **Gate B:** cancel Booqable, open signups.

**Later (not in v1):** native app wrapper, Claude-powered assistant (daily briefing, ask-your-data), Xero, Zapier, Meta Pixel, route planning for deliveries, more languages and currencies.

## Claude Code handoff

After step R the repo is the monorepo. Export this doc to Markdown as `docs/platform/SPEC.md` whenever it changes; the rules below are `apps/platform/CLAUDE.md`, under the root `CLAUDE.md`. Run one phase per session with the kickoff prompt.

**CLAUDE.md**

```markdown
# Rental management platform — project rules

Source of truth: docs/platform/SPEC.md. Read the relevant section before every task.
The root CLAUDE.md also applies. Work only in apps/platform, packages/ and supabase/; never import from apps/marketplace.

## Stack
Next.js (App Router) + TypeScript strict, Supabase (Postgres, Auth, Storage, RLS),
Tailwind + shadcn/ui, Stripe Connect + Billing, Resend, LINE Messaging API, next-intl (en, th).

## Rules
- Every table has tenant_id and an RLS policy. Add an RLS test for every new table.
- Availability is enforced by the DB exclusion constraint on allocations/downtime. Never bypass it.
- Money = integer minor units + currency. Times = UTC in DB, tenant timezone in UI.
- All pricing goes through packages/core (quote). All availability through packages/core and the DB lock.
- Every order status change writes audit_events.
- Migrations only via supabase/migrations; never edit an applied migration.
- No service-role key in client code.
- Mobile-first: every staff screen must work at 375px wide.
- Strings via next-intl; add en and th keys together.

## Workflow
- One phase = one branch (platform/phase-N-name) = one PR.
- Before coding: write a short plan in the PR description; list the acceptance checks from SPEC.md.
- Done = typecheck, lint, unit, RLS and Playwright tests green in CI.
- Output complete files, not diffs or partial snippets.
```

**Kickoff prompt (per phase)**

```text
Read CLAUDE.md, apps/platform/CLAUDE.md and docs/platform/SPEC.md. We are building Phase <N>: <name>.
1. Summarise the phase requirements and acceptance checks back to me in under 15 lines,
   and list any questions. Wait for my OK.
2. Create branch platform/phase-<N>-<slug>. Write migrations, then server logic with tests, then UI.
3. Run all tests. Fix until green.
4. Seed demo data that shows off this phase, and give me a click-through checklist
   I can try on my phone.
5. Open a PR with the plan, what changed, and anything deferred.
```

**Tips**

- Keep sessions to one phase. At the end, ask Claude Code to update `docs/PROGRESS.md` (what's done, decisions, known issues) so the next session starts clean.
- Use Stripe test mode and the staging Supabase project until Gate A. The live project also runs the marketplace, so migrations reach it only from main.
- Phase 2 (pricing + availability) is where bugs cost real money. Don't move on until its tests are thorough.

## Change requests

This log tracks your additions and removals. Each one is already worked into the sections listed.

| # | Request | Type | Where in the spec | Phase |
| --- | --- | --- | --- | --- |
| 45 | Review decisions after Phase 0: split Phase 1 (1a/1b), new order 1a → 2 → 3 → 3M → 1b, unit\_blocks, locations, legacy mapping, tenant keys, bigint money, provider-neutral payments, private repo, Drive option deferred | Decision | Review decisions (10 Nov 2026) | 1a onward |
| 44 | Look: light grey background, white sidebar and cards, orange accent; instant loading state on every tap | Change | Staff app | 0 |
| 43 | Dashboard tabs: Today, Tomorrow, Upcoming, Late; each item shown once | Change | Staff app | 0, then each phase |
| 42 | Moto Mangos search by transmission and cc; both required on every model through its catalog entry | Add | Built for any country › Moto Mangos; Fleet | 1, marketplace |
| 41 | Second pricing mode, price per day: 1–6 days, 7+ days, 28+ days | Add | Pricing | 2 |
| 40 | Delivery fee by distance bands the shop sets, each switched on or off | Add | Online booking | 8, marketplace |
| 39 | Subscription tiers (draft): staff app in all tiers; Tier 1 management, Tier 2 adds online booking, Tier 3 adds multi-store; possibly priced by fleet size (under 100 / 100+ vehicles) | Decision | Open decisions | 11 |
| 38 | Shops find the product on our website, sign up, pay and start using it with no manual setup | Add | Build plan (Phase 11) | 11 |
| 37 | Maintenance records date and odometer; each shop chooses km or miles | Add | Fleet | 1 |
| 36 | Check-out and check-in fully usable on desktop; a phone is optional | Change | Staff app; Build plan (Phase 5) | 0, 5 |
| 35 | Built for worldwide use: platform usable in any country from day one; Moto Mangos launches market by market (Bangkok, Chiang Mai, Thailand, Vietnam, Japan) | Decision | Built for any country | R, 2, 3, 7 |
| 34 | Names: Mango Works is the parent company; the marketplace is Moto Mangos, marketed separately as the official partner; platform name TBD | Change | Product scope; Repository and database; CLAUDE.md; Open decisions | R |
| 33 | Combine the platform and Bike-Booking into one monorepo with one Supabase database | Decision | Repository and database; Product scope; Tech stack; Build plan; Claude Code handoff | R |
| 32 | Integrate the Bike-Booking marketplace | Decision | Product scope › One platform, two front doors | After 11 |
| 31 | Deposits: charge-and-refund and cash; each shop chooses what it accepts | Decision | Payments; Data model (tenants.deposit\_methods) | 7 |
| 30 | Working name "Mango Works" | Change | Product scope; CLAUDE.md | — |
| 28 | Quotes | Remove | Documents; Data model; Phase 6 | — |
| 27 | Overbooking stays, as an optional setting | Change | Booqable mapping; Data model (tenants.allow\_overbooking) | 2 / 3 |
| 26 | Pricing: hourly optional; rates from 1 day to 1 month; beyond 30 days every day costs the 30-day total ÷ 30 (2 months = 2 × monthly) | Change | Pricing; Data model (price\_structures) | 2 |
| 25 | Tap to Pay near completion | Change | Staff app; Phase 12 | 12 |
| 24 | Try the tab bar at top and bottom before choosing | Change | Staff app | 0 |
| 23 | Basic staff app with four tabs: Dashboard, Orders (with search), New order (book + take payment), Maintenance (lookup, odometer). Try tabs top and bottom before choosing; Tap to Pay near completion (Phase 12) | Add | Module specs › Staff app | 0, then each phase |
| 22 | Traffic fine lookup | Add | Module specs › Traffic fines; Data model (traffic\_fines) | 9 |
| 21 | Odometer entered manually, no photo needed | Change | Fleet; Data model (odometer\_readings) | 1 |
| 20 | Maintenance costs (parts, labour) can be switched on/off; purchase/sale price, renewals and the maintenance log always stay | Change | Fleet › Profit per vehicle; Data model (tenants.track\_maintenance\_costs) | 1 |
| 19 | Packing slips | Remove | Booqable mapping | — |
| 18 | Cross-sell | Remove | Online booking; Booqable mapping | — |
| 17 | Website builder: 5 good templates, not 80 | Change | Online booking; Phase 11 | 11 |
| 16 | Product collections | Remove | Online booking (vehicle-type browsing covers it) | — |
| 15 | Bundles | Remove | Pricing; Data model | — |
| 14 | Frame and engine number on each bike | Add | Fleet; Data model (units) | 1 |
| 13 | Key numbers (ignition, side cases L/R, top box, lock); GPS tracker details and battery reminders; smart-key battery reminder by time/km | Add | Fleet › Vehicle record; Data model (units.keys, gps\_trackers) | 1 |
| 12 | Overdue alerts to staff at shop-set intervals (e.g. 3, 15, 30 days) | Add | Orders and calendar | 3 |
| 11 | Reserve now, card charged automatically N days before (e.g. 3) | Add | Payments; Data model (scheduled\_charges) | 7 |
| 10 | Store large files in the shop's Google Drive | Add (option) | Customers › Document storage | 4 |
| 9 | Passport/licence storage, and is it legal | Add | Customers › PDPA notes | 4 |
| 8 | Rental agreement signed by finger, stylus or laptop pad | Add | Documents and messages | 5 |
| 7 | Automatic email when the rental period ends | Add | Orders; Documents and messages | 3 / 6 |
| 6 | Tyres and brakes checked on a time or km basis | Add | Fleet › Service schedule | 1 |
| 5 | Odometer at check-out and return triggers service alerts; time-based staff follow-up for long rentals (no LINE request to customers) | Change | Fleet; Long-term rentals | 1 / 9 |
| 4 | Sales figures by payment date only | Change | Sales history | 10 |
| 3 | Daily cash close, with cash paid out (receipts) deducted | Add | Sales history; Data model (cash\_closes, cash\_expenses) | 10 |
| 2 | Vehicle tracking: purchase/sale price, maintenance log, time/km service reminders, tax and insurance log with renewal reminders | Add | Fleet; Data model | 1 |
| 1 | Sales history: today, this week, this year, with filters | Add | Sales history; Data model | 10 |

## Open decisions

Phases 0–1 can start without these. Each one is needed by the phase noted.

- [ ] Platform product name and domain, and the Moto Mangos domain (before Phase 8).
- [ ] SaaS pricing (draft, confirm before Phase 11): staff app in every tier. Tier 1 = management system; Tier 2 adds online booking; Tier 3 adds multi-store. Possibly also priced by fleet size: under 100 vehicles one price, 100+ another. Moto Mangos stays separate and free to join (Marketplace plan), and links with Tiers 1 and 2.
- [ ] Thai tax invoice format: confirm with Korn which fields the platform needs on invoices and receipts (before Phase 6).
- [ ] Damage diagram artwork: generic scooter, big bike and car outlines, or per model (before Phase 5).
- [ ] Thai lawyer review of the privacy notice and document retention period (before Phase 4 goes live).
- [x] Supabase region: confirmed. The live project is in Singapore (ap-southeast-1), checked 9 Nov 2026.

## Sources

- [Booqable pricing and plan comparison](https://www.booqable.com/pricing)
- [Booqable order workflow (help center)](https://help.booqable.com/en/articles/3845244-the-booqable-order-workflow)
- [What's New: Bo AI Assistant, July 30, 2026](https://booqable.com/whats-new/july_30_2026/)
- [Booqable add-on and plan tracking, PricingSaaS](https://pricingsaas.com/companies/booqable)
