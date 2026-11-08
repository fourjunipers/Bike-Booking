# CLAUDE.md

Standing instructions for every session working on the marketplace (`apps/marketplace`). The root `CLAUDE.md` also applies. Read both, then `docs/marketplace/SPEC.md` (the product spec) and `docs/marketplace/BUILD_PLAN.md` (the phased build plan) before any feature work.

Paths in this file are relative to `apps/marketplace/`, except `docs/…`, `supabase/…` and `packages/…`, which are at the repo root.

Next.js rules for agents (kept up to date by `next dev`): @AGENTS.md

## What we are building

A web-based motorbike rental marketplace for Thailand (Bangkok first). Foreign customers search and book bikes from local rental shops. The platform collects only a booking fee (10% of the rental after promotions, minimum ฿50). The customer pays the rest to the shop at pickup. Vendor revenue never passes through the platform.

Three roles: **customer**, **vendor** (shop owner + staff), **admin** (platform owner). Vendors work in Mango Works, not here (see below).

## Architecture: a marketplace front end on Mango Works (decision 2026-11-07)

Bike-Booking is the **customer-facing marketplace**. It does **not** own shop data and has **no vendor backend**. Shops, bike models, units, prices, availability, bookings and payments to shops live in **Mango Works**, a separate rental-management platform (its own repo). A booking made here becomes a Mango Works order with `channel = "marketplace"`.

- **All shop data goes through `lib/data/`** (`import … from "@/lib/data"`). Pages, components and API routes never query a database client for shops, bikes, prices, availability or bookings; ESLint enforces this. `lib/data/current-db.ts` is a **temporary** implementation on this project's own database; it will be swapped for the Mango Works API without UI changes. `docs/INTEGRATION.md` lists every adapter function, the data it needs and the rules it must follow: keep it in step with `lib/data/types.ts`.
- **Mango Works owns** pricing and availability rules: the day table (over 30 days, the 30-day price ÷ 30 per day), "every started 24 hours is a day", buffers, the Instant / Request / walk-ins-only split, minimum notice and days, opening hours and closures. The marketplace displays what the adapter returns and never recalculates them.
- **The marketplace owns** customer accounts and login (LINE, Google, email), search and model-first browsing, shop ranking (boost levels and weights here; shop signals come from the adapter), the station list, the booking fee (10% of the rental after promotions, min ฿50, paid online 3 days before pickup, via Stripe Connect as an application fee on marketplace bookings only), request-to-book vs instant at checkout, the referral program, SEO and analytics. The customer pays the rest to the shop under the shop's own settings in Mango Works; `createBooking` already allows full online payment later.
- **Customer details** sent with each booking: name, email, phone, nationality, LINE ID (Mango Works keeps a customer record per shop). The privacy notice (`/privacy`) says booking details are shared with the shop.
- **Vendor screens are hidden, not deleted.** `/vendor`, admin approvals, shops and bike catalog, and shop staff invites redirect (`lib/hidden-areas.ts`). Don't build on them; their code and tables stay until Mango Works replaces them.

`docs/marketplace/SPEC.md` is the source of truth for behaviour. If code and spec disagree, the spec wins. If the spec is unclear or seems wrong, stop and ask. Do not guess.

## Working rules

- **Work only on the phase you are asked to build.** Do not start later phases, even partially. Leave clear `TODO(phase-N)` comments where a later phase will plug in.
- **Plan first.** For every phase or feature, write a plan (files, tables, routes, tests) and wait for approval before writing code.
- **Ask before adding a dependency** that is not listed in the stack below.
- **Never commit secrets.** All keys live in `.env.local` (git-ignored). Keep `.env.example` up to date with every variable name and a one-line comment.
- **Stripe is always in test mode** until the owner says otherwise. Never use live keys.
- **Small commits** with clear messages, one logical change each.
- At the end of each phase, give a short summary covering what was built, how to test it by hand, and anything left open.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js (latest stable, App Router), TypeScript `strict` |
| Styling / UI | Tailwind CSS + shadcn/ui |
| Database / auth / storage | Supabase (Postgres, Auth, Storage), with PostGIS for distance search |
| Migrations | Supabase CLI migrations in `supabase/migrations/` (repo root, shared with the platform), never edit the DB by hand |
| i18n | `next-intl`. Customer site: English, Thai, Chinese, Russian, German, French, Spanish, Italian, Japanese, Korean (English at `/`, others prefixed, e.g. `/ja/…`). Vendor dashboard is Thai + English. Admin is English |
| Payments | Stripe (cards, saved cards via SetupIntent, Apple Pay / Google Pay, PromptPay) |
| Vendor messaging | LINE Messaging API (Flex messages, postback buttons) |
| Customer messaging | Resend (email). WhatsApp Business API is added in Phase 7 |
| Maps | Google Maps JavaScript API + Places API |
| Scheduled jobs | Netlify Scheduled Functions (`netlify/functions/`) calling protected API routes (`Authorization: Bearer $CRON_SECRET`). Cron expressions run in UTC and functions time out after 30 s, so keep the real work in the API route |
| Tests | Vitest (unit), Playwright (end-to-end for core flows) |
| Hosting | Netlify (Next.js via its OpenNext adapter). Free plan: every production deploy costs credits, so work on branches and merge to `main` in batches |

Before relying on any third-party API behaviour (Supabase Auth providers, Stripe PromptPay, LINE Login), check the current official docs. Don't rely on memory.

## Conventions

- **Money:** store all amounts as **integers in the shop's currency** in the database (`int`). Every shop is Thai baht for now (`shops.currency` = THB; bookings copy it). Convert to satang (×100) only at the Stripe boundary, in one helper (`@mango/core/money`, `packages/core/src/money.ts`). Don't assume THB in new code where the currency is at hand: other countries may follow (see `docs/marketplace/decisions.md`). Whole baht and Bangkok-only code stays as it is until the adapter switch (listed in `docs/PROGRESS.md`); new code follows the worldwide rules in the root `CLAUDE.md`.
- **Time:** store `timestamptz` in UTC. All business logic (shop hours, cut-offs, "today", the 3-days-before payment date) runs in **Asia/Bangkok**. Use one date helper module (`@mango/core/time`, `packages/core/src/time.ts`) and never call `new Date()` for business rules outside it.
- **Pure logic in `lib/`, fully unit-tested:** fee calculation (`lib/fees.ts`), ranking (`lib/ranking.ts`, `lib/search.ts`), cancellation rules for the marketplace fee (`lib/cancellation.ts`). Pricing and availability (`@mango/core/pricing`, `@mango/core/availability`, `@mango/core/rental-days` in `packages/core`) now belong to Mango Works: they remain only as the reference for `docs/INTEGRATION.md` and the temporary adapter.
- **Booking status lives in Mango Works.** The marketplace reads it through `lib/data` (`getBooking`) and never writes booking rows directly.
- **Security:** Row Level Security on every table. Customers see only their own bookings. Vendor staff see only their shop's data. Admin uses the service role on server routes only. Never expose the service role key to the client.
- **Server-side checks:** prices, fees, availability and permissions are always recalculated on the server. Never trust amounts sent from the browser.
- **Double-booking protection** is Mango Works' job inside `createBooking`; the marketplace must handle "no longer available" answers gracefully.
- **Idempotency:** Stripe calls use idempotency keys. Webhook handlers (Stripe, LINE) must be safe to receive the same event twice.
- **Webhooks:** verify signatures (Stripe signing secret, LINE channel secret) before doing anything.
- **Folder layout:**
  - `app/(customer)/...`: public site
  - `app/vendor/...`: vendor dashboard (hidden; superseded by Mango Works)
  - `app/admin/...`: admin panel (marketplace screens: ranking, stations)
  - `lib/data/`: the data adapter, the only way to shop data
  - `app/api/...`: webhooks and cron routes
  - `lib/`: marketplace business logic (shared pure rules live in `packages/core`, Supabase clients in `packages/db`)
  - `components/`: shared UI
- **Mobile first, desktop too:** every screen must work well at 375 px wide and also have a proper desktop layout at 1280 px (e.g. search list and map side by side, wider galleries, multi-column forms), not a stretched phone layout.
- **Accessibility:** labelled form fields, buttons with text, colour never the only signal.

## Definition of done (every phase)

1. All acceptance criteria for the phase in `docs/marketplace/BUILD_PLAN.md` pass.
2. Unit tests for any new `lib/` logic pass (`npm test`).
3. `npm run build` and `npm run lint` pass with no errors.
4. Migrations apply cleanly to a fresh database (`supabase db reset`).
5. Seed data is updated so the feature can be tried immediately.
6. Short summary written for the owner: what to click to test it.
