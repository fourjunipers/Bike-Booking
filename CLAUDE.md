# CLAUDE.md

Standing instructions for every session in this repo. Read this file, then `SPEC.md` (the product spec) and `BUILD_PLAN.md` (the phased build plan) before any feature work.

## What we are building

A web-based motorbike rental marketplace for Thailand (Bangkok first). Foreign customers search and book bikes from local rental shops. The platform collects only a booking fee (10% of the rental after promotions, minimum ฿50). The customer pays the rest to the shop at pickup. Vendor revenue never passes through the platform.

Three roles: **customer**, **vendor** (shop owner + staff), **admin** (platform owner).

`SPEC.md` is the source of truth for behaviour. If code and spec disagree, the spec wins. If the spec is unclear or seems wrong, stop and ask. Do not guess.

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
| Migrations | Supabase CLI migrations in `supabase/migrations/`, never edit the DB by hand |
| i18n | `next-intl`. Customer site is English only. Vendor dashboard is Thai + English |
| Payments | Stripe (cards, saved cards via SetupIntent, Apple Pay / Google Pay, PromptPay) |
| Vendor messaging | LINE Messaging API (Flex messages, postback buttons) |
| Customer messaging | Resend (email). WhatsApp Business API is added in Phase 7 |
| Maps | Google Maps JavaScript API + Places API |
| Scheduled jobs | Vercel Cron calling protected API routes (`Authorization: Bearer $CRON_SECRET`) |
| Tests | Vitest (unit), Playwright (end-to-end for core flows) |
| Hosting | Vercel |

Before relying on any third-party API behaviour (Supabase Auth providers, Stripe PromptPay, LINE Login), check the current official docs. Don't rely on memory.

## Conventions

- **Money:** store all amounts as **integer Thai baht** in the database (`int`). Convert to satang (×100) only at the Stripe boundary, in one helper (`lib/money.ts`).
- **Time:** store `timestamptz` in UTC. All business logic (shop hours, cut-offs, "today", the 3-days-before payment date) runs in **Asia/Bangkok**. Use one date helper module (`lib/time.ts`) and never call `new Date()` for business rules outside it.
- **Pure logic in `lib/`, fully unit-tested:** pricing autofill (`lib/pricing.ts`), fee calculation (`lib/fees.ts`), availability rules (`lib/availability.ts`), cancellation rules (`lib/cancellation.ts`), booking state transitions (`lib/booking-state.ts`).
- **Booking status changes only through `lib/booking-state.ts`.** It validates the transition and writes a `booking_events` row. Nothing else updates `bookings.status` directly.
- **Security:** Row Level Security on every table. Customers see only their own bookings. Vendor staff see only their shop's data. Admin uses the service role on server routes only. Never expose the service role key to the client.
- **Server-side checks:** prices, fees, availability and permissions are always recalculated on the server. Never trust amounts sent from the browser.
- **Double-booking protection:** booking creation runs in a Postgres function (RPC) inside a transaction that locks the bike model row (`SELECT ... FOR UPDATE`) before checking availability.
- **Idempotency:** Stripe calls use idempotency keys. Webhook handlers (Stripe, LINE) must be safe to receive the same event twice.
- **Webhooks:** verify signatures (Stripe signing secret, LINE channel secret) before doing anything.
- **Folder layout:**
  - `app/(customer)/...`: public site
  - `app/vendor/...`: vendor dashboard
  - `app/admin/...`: admin panel
  - `app/api/...`: webhooks and cron routes
  - `lib/`: business logic
  - `components/`: shared UI
- **Mobile first:** every screen must work well at 375 px wide.
- **Accessibility:** labelled form fields, buttons with text, colour never the only signal.

## Definition of done (every phase)

1. All acceptance criteria for the phase in `BUILD_PLAN.md` pass.
2. Unit tests for any new `lib/` logic pass (`npm test`).
3. `npm run build` and `npm run lint` pass with no errors.
4. Migrations apply cleanly to a fresh database (`supabase db reset`).
5. Seed data is updated so the feature can be tried immediately.
6. Short summary written for the owner: what to click to test it.
