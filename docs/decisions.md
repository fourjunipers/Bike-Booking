# Decisions

Running log of decisions made during the build: what, why, date.

## 2026-10-22 · Phase 0

- **Next.js 16 with Cache Components and Partial Prefetching on.** These are the `create-next-app` defaults for this version and become the only mode in the next major release. Consequence: any page that reads cookies, headers or uncached data must do it inside `<Suspense>`.
- **next-intl without locale routing.** URLs carry no `/en` or `/th` prefix. Customer site and admin are always English and stay static. The vendor dashboard reads its language from the `locale` cookie (`i18n/vendor.ts`) inside the vendor layout's Suspense boundary and passes it explicitly. `i18n/request.ts` never reads cookies, so it can't make other pages dynamic. The language toggle is Phase 2.
- **No date library.** `lib/time.ts` uses fixed UTC+7 arithmetic. Thailand has no daylight saving time, so this is exact. If the platform ever expands to a timezone with DST, revisit.
- **Money is whole baht.** `lib/money.ts` throws on fractional baht and on satang amounts that aren't whole baht, so rounding mistakes fail loudly.
- **Supabase clients added in Phase 0** (`lib/supabase/client.ts`, `server.ts`), unused until Phase 1. Session refresh in `proxy.ts` (Next 16's name for middleware) is Phase 1.
- **`@types/node` bumped to 24** to match the installed Node 24 and satisfy Vitest 5's peer range.
- **shadcn/ui `base-nova` style** (Base UI primitives, the current shadcn default). It uses shadcn's `cn` package instead of `clsx` + `tailwind-merge`.
- **Line endings normalised to LF** via `.gitattributes`, so Prettier checks pass on Windows.
- **Hosting on Netlify instead of Vercel** (owner's decision, 2026-10-23). Vercel's free Hobby plan is non-commercial only, so launch would need Pro at $20/month. Netlify's free plan costs $0 while building and Personal is $9/month at launch, and the owner already uses Netlify. Trade-offs: production deploys cost credits (15 each; the free plan has 300/month and pauses every site when they run out), so we work on branches and merge to `main` in batches. Scheduled jobs move from Vercel Cron to Netlify Scheduled Functions (UTC cron, 30 s timeout). CLAUDE.md, SPEC.md, BUILD_PLAN.md and `.env.example` updated to match.
- **Playwright runs at 375 px wide** against a production build on port 3100. Set `PLAYWRIGHT_BASE_URL` to run against a deployed preview instead.

## 2026-10-24 · Phase 1

Owner approved the plan with the recommended answers:

- **`profiles` instead of SPEC's `users`** (Supabase owns `auth.users`). `role` keeps SPEC's enum, but vendor permissions come only from `shop_members`; `vendor_staff` is a label, so one person can be both customer and vendor. `admin` is granted and removed on every sign-in from `ADMIN_EMAILS` (verified emails only).
- **Shop WhatsApp/LINE in a separate `shop_contacts` table.** SPEC shows them only after a confirmed booking; RLS can't hide columns of a publicly readable row.
- **Clients never write `bookings` or `booking_events`.** Only server code and (Phase 4) RPCs do. `booking_events` rejects UPDATE/DELETE with a trigger, so even the service role can't rewrite history.
- **Column-level grants** stop users changing their own `role`, a shop's `status`/`boost_level`/review fields, or a model's `flagged_for_review`.
- **Smaller schema choices:** `shops.location` is `geography(Point)` instead of lat/lng; `included_items` became explicit columns; a flat delivery fee is one `delivery_zones` row; `promotions.model_ids` became a `promotion_models` join table; `reviews` copies `shop_id`/`bike_model_id` from the booking (trigger) so public review reads don't need booking access.
- **LINE Login is a Supabase custom OIDC provider (`custom:line`).** Supabase's current docs support custom OAuth/OIDC providers (3 on the free plan), so no hand-built LINE flow. The local CLI has no config for custom providers, so LINE is set up and tested on the hosted project. `bot_prompt=aggressive` is sent as a sign-in query parameter; confirm on the hosted project that Supabase forwards it.
- **Magic links use a token hash verified at `/auth/confirm`** (custom email template), not the PKCE code flow, so a link opened in another browser or a mail app's in-app browser still works. The same template must be set on the hosted project.
- **`proxy.ts` only runs on `/account`, `/vendor`, `/admin`.** Public pages stay static and skip the session refresh.
- **Access checks run in pages, not only layouts.** Next.js renders a page in parallel with its layout, so a layout gate doesn't stop the page's code from running. Every admin page and action calls `requireAdmin()`; every vendor page calls `requireVendorShop()`. Pages that read the session also need their own Suspense boundary (`loading.tsx`).
- **Social buttons are switched on by `NEXT_PUBLIC_AUTH_PROVIDERS`**, so a provider that isn't configured yet doesn't show a broken button.
- **RLS tests (`npm run test:db`) are separate from `npm test`** because they need Docker. They refuse to run against anything but `127.0.0.1`.
- **Added `zod`** (server-side form validation) **and `server-only`** (guards the service-role client), approved by the owner.
- **Seed uses placeholder BSR details**; the owner will supply the real address, hours, contacts and fleet.
