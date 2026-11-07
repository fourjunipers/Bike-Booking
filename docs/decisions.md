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
- **LINE Login is a Supabase custom provider (`custom:line`) of type OAuth2, not OIDC** (2026-10-25). LINE signs web-login ID tokens with HS256 even though its discovery document advertises ES256, so the OIDC type failed every login ("unexpected signature algorithm HS256"). The OAuth2 type skips the ID token and reads `sub`/`name`/`picture` from LINE's userinfo endpoint, so `profiles.line_user_id` is still LINE's user ID. The dashboard only creates OIDC-type providers and a provider's type can't change, so `scripts/create-line-provider.mjs` creates it through the Auth admin API (Channel secret typed at a hidden prompt). Verified locally that Supabase forwards `bot_prompt=aggressive` and uses PKCE. Verified on the hosted project 2026-10-25: the owner signed in with LINE and the profile got `line_user_id` (= the identity's `sub`, `U` + 32 hex) and a name, no email. Lessons from setting it up: (1) the dashboard's edit form also demands an Issuer URL, so an OAuth2 provider can only be changed by re-running the script; (2) LINE's token endpoint answers `invalid_grant` "invalid authorization code" both for a bad code and for a wrong Channel secret, so a wrong secret looks like a code problem. The script now strips paste artefacts and requires 32 hex characters.
- **Magic links use a token hash verified at `/auth/confirm`** (custom email template), not the PKCE code flow, so a link opened in another browser or a mail app's in-app browser still works. The owner couldn't edit email templates on the hosted project with Supabase's built-in email, so `/auth/confirm` also accepts the default template's PKCE `code` (same browser only). Both paths are tested locally. Switch the hosted project to Resend SMTP plus our template before launch (Phase 6).
- **`proxy.ts` only runs on `/account`, `/vendor`, `/admin`.** Public pages stay static and skip the session refresh.
- **Access checks run in pages, not only layouts.** Next.js renders a page in parallel with its layout, so a layout gate doesn't stop the page's code from running. Every admin page and action calls `requireAdmin()`; every vendor page calls `requireVendorShop()`. Pages that read the session also need their own Suspense boundary (`loading.tsx`).
- **Social buttons are switched on by `NEXT_PUBLIC_AUTH_PROVIDERS`**, so a provider that isn't configured yet doesn't show a broken button.
- **RLS tests (`npm run test:db`) are separate from `npm test`** because they need Docker. They refuse to run against anything but `127.0.0.1`.
- **Added `zod`** (server-side form validation) **and `server-only`** (guards the service-role client), approved by the owner.
- **Seed uses placeholder BSR details**; the owner will supply the real address, hours, contacts and fleet.

## 2026-11-03 · Owner decisions before Phase 2

Recorded from `BSR_SEED.md` Part 1. SPEC.md and BUILD_PLAN.md updated to match.

1. **Deposit per bike model.** Shop default amount; each model can override it (`bike_models.deposit_amount`, null = shop default). Pages and checkout show the model's own amount. Phase 2.
2. **Shop-defined extras.** Name, description, price, unit (day / week / rental), all or chosen models, active. Ticked at checkout, shown in the breakdown and paid at the shop. The 10% fee applies to the rental only. Copied to `booking_extras` at booking so later edits don't change existing bookings. Vendor Extras screen in Phase 2; checkout, totals and notices in Phase 4.
3. **Date-based discounts** are the "date window" promotion kind and apply only to rental days inside the window. Phase 7. SPEC's data model and the Phase 1 enum lacked a `date_window` kind; Phase 7 adds it.
4. **Delivery minimum rental length**, optional per shop (`shops.delivery_min_days`, blank = any length). Phase 7.
5. **No 6- or 12-month rates.** Pricing stays as in SPEC.
6. **Master bike catalog and model-first browsing.** Admin-maintained `bike_catalog`; vendors pick an entry and add their own offer (`bike_models.catalog_id`); missing models go through a catalog request. Placeholder image until real stock photos exist; no unlicensed images. Catalog and model picker in Phase 2; model-first search, model page and shop listing page in Phase 3; model-per-city SEO pages with the other SEO pages in Phase 7 (the decision didn't name a phase for them).
7. **Structured "What's included".** Fixed fields replace free-text inclusions; each is a shop default any model can override. Phase 2.
8. **Referral program (customer referrals only).** Partners, invisible cookie attribution, lifetime first-partner-wins, `referral_rate` 50% of the fee stored per earning, earned when the fee is paid, reversed on refund, monthly manual payouts ≥ ฿500. Added as **Phase 5b** rather than renumbering Phases 6–8, so existing `TODO(phase-N)` comments stay correct.

## 2026-11-03 · Owner answers to the Phase 2 plan questions

- **Catalog specs:** no seat height, fuel tank or weight. Catalog keeps cc plus ABS, under-seat storage, USB charger and key type (keyless / keyed).
- **Bike photos:** every bike model needs at least 1 real photo.
- **Damage/theft cover is not an inclusion.** Listed prices are rental plus deposit information only. A shop that offers damage/theft cover adds it as an extra, with its own terms and conditions. Extras gain an optional terms field.
- **Medical cover** is included free on all BSR bikes.
- **Time-based extras are charged for the time rented**, never rounded up to whole weeks. Same rule as bike pricing: 1-day price required, 7- and 30-day prices optional, filled at equal steps (2026-11-04). Every extra has an on/off toggle.
- **BSR use outside Bangkok** (2026-11-04): 110–125cc ฿200/day, ฿4,800/30 days; 150cc+ ฿250/day, ฿6,000/30 days. Replaces the weekly prices in `BSR_SEED.md`.
- **Shop contacts** gain phone and email, shown only after a booking is confirmed, like WhatsApp and LINE.
- **BSR seed:** drop the generic "Base" model and the riding jacket extra. Scoopy (New Gen) has the same prices as the Giorno (as in `BSR_SEED.md`).
- **Google rating and reviews** on shop pages (owner request). Places API (New) returns the overall rating, the review count and at most 5 reviews. Google's Places policies allow showing them with Google Maps attribution and reviewer names, but only the place ID may be stored. So the content is fetched live, it stays out of the ranking score and rating filter, and it isn't shown on search cards. The vendor links the profile in Phase 2 (`shops.google_place_id`); display is built in Phase 3 with the shop pages.
- **BSR damage/theft cover 450–699cc** (NX500, CB500X): ฿300/day, ฿1,500/7 days, ฿4,500/30 days.

## 2026-11-04 · Desktop, AI search, analytics and apps (owner)

- **Desktop layouts required.** Still mobile-first, but every screen also gets a proper desktop layout (checked at 1280 px). CLAUDE.md's mobile-first rule updated.
- **AI search visibility and analytics/conversions added to Phase 7.** GA4 and a separate Google Ads account for the platform, Google tag behind cookie consent. Conversions: request sent, booking confirmed, fee paid (value = fee). Fee-paid is sent from the server because most fees are charged 3 days before pickup. Replaces Phase 8's "Plausible or Netlify analytics".
- **Installable app.** Phase 7 makes the whole site a PWA for customers and vendors, with an `/app` page and QR code to install it, and web push. New **Phase 9 (after launch)**: Google Play via a Trusted Web Activity, then an App Store wrapper (Apple rejects plain website wrappers, so it needs native extras). Same codebase throughout.

## 2026-11-04 · Phase 2 build

- **Catalog replaces vendor-typed specs.** `bike_models` lost make, model, type, transmission and cc; existing rows were backfilled into approved catalog entries. A shop can list its own pending catalog request straight away; the public sees a model only when its catalog entry is approved, it has at least one photo and the shop is live.
- **Inclusions are typed columns, not JSON.** `shop_policies` holds every field; `bike_model_policies` repeats them as nullable overrides. The model editor stores only fields that differ from the shop (`minimalOverrides`), so models keep following later shop changes. `km_limit` 0 = unlimited; `deposit_refund_days` 0 = at return (null = not stated, from 2026-11-04). The old `deposit_type` enum was dropped; "passport held or copy only" is its own field.
- **Extras: owners write, staff read** (same as promotions; extras are pricing). Time-based extras store 1/7/30-day prices and use `lib/pricing.ts`.
- **Onboarding is a checklist, not a wizard.** `create_shop` makes a draft with the caller as owner; the vendor home shows `shop_readiness` (about, shop photo, map pin, hours, a contact, a model, model photos, model prices) with links to fix each, then the terms and Submit. `submit_shop` only changes status when nothing is missing. A shop photo is required.
- **Staff invites are single-use links** (hashed token, 7 days) that the owner sends by LINE or email from the Team page; `/account/join?token=` accepts. No email sending in Phase 2.
- **Review flags:** live-shop edits by signed-in users set `bike_models.flagged_for_review` (new model, catalog, photos, deposit, prices, overrides) or the new `shops.flagged_for_review` (policies, extras). Operational toggles (qty, ready today, down time, visibility, booking mode, buffers) don't flag. Admin "Mark reviewed" clears both.
- **Photos are resized to WebP (1,600 px) in the browser** and uploaded straight to public Storage buckets with RLS by folder (`<shop_id>/…`, `<shop_id>/<model_id>/…`); removed photos are deleted on save. Admins upload catalog stock photos the same way (policy checks the admin role), so no Server Action needs a body limit above 1 MB. Seed photos are `/images/placeholder-*.svg`.
- **Map pin picker uses Google's current APIs** (dynamic `importLibrary`, `PlaceAutocompleteElement`, `Place.searchNearby` for the nearest station, advanced marker). Picking the shop's Google Business Profile stores only `google_place_id`. `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` added (blank = `DEMO_MAP_ID` for development). Without a key the form falls back to latitude/longitude fields. `shop_coordinates()` returns lat/lng for the editor.
- **Dashboard forms submit with startTransition** rather than the form `action` prop, so a failed save doesn't reset the fields; errors are message keys translated in Thai/English.
- **Dashboards use the desktop width** (`max-w-6xl`) with multi-column layouts from `md`/`lg` up, still checked at 375 px.
- **Testing limits this phase:** migrations, seed, RLS rules and RPCs were checked on a plain Postgres 16 + PostGIS with Supabase's auth/storage schemas stubbed; the Supabase-backed DB tests (`npm run test:db`) and Playwright specs need the local Supabase stack and have not been run yet.
- **Country and currency prepared** (owner decision, 2026-11-04): `shops.country` (default TH) and `shops.currency` (default THB), set by admin only; `bookings.currency` is copied from the shop on insert. Nothing reads them yet. Expansion plan: one site with country folders, not sister sites (BUILD_PLAN "Later: other countries").

## 2026-11-04 · Customer site languages and Supabase keep-alive (owner)

- **Customer site in 10 languages** (owner decision): English, Thai, Chinese (Simplified), Russian, German, French, Spanish, Italian, Japanese, Korean. Vendor dashboard stays Thai/English, admin stays English. Replaces the Phase 0 "customer site English only" rule.
- **Language in the URL, English unprefixed.** Customer pages live in `app/(customer)/[locale]` and are prerendered for every language. `proxy.ts` serves unprefixed paths from `en` and redirects `/en/…` to the unprefixed URL, so each page has one address per language. Written by hand in `proxy.ts` rather than next-intl's routing middleware, so it composes with the Supabase session refresh. Pages set canonical + hreflang links (`i18n/metadata.ts`); `metadataBase` comes from `NEXT_PUBLIC_SITE_URL`.
- **No automatic redirect by browser language.** On English pages a bar offers the visitor's browser language (`components/customer/language-suggestion.tsx`, client-only so pages stay static). The URL is the only source of the language; no cookie.
- **Only customer namespaces are translated** beyond Thai/English (`customerNamespaces` in `i18n/config.ts`); the layout sends only those to the browser. `i18n/messages.test.ts` checks every language has every key and placeholder.
- **Translations are Claude drafts.** zh, ru, de, fr, es, it, ja, ko and the new Thai customer text need a native speaker's review before launch (Thai first). Supabase sign-in emails stay English (one template per project).
- **Supabase keep-alive:** the free Supabase plan pauses projects after about a week of low activity. `netlify/functions/supabase-keep-alive.mts` reads one row from `shops` with the anon key daily at 00:00 UTC. Remove it once the project is on a paid plan.

## 2026-11-04 · Owner feedback on Phase 2

- **Yearly closures.** `shop_closures.repeats_yearly`: later years match the same month and day, including closures over New Year; a 29 February start falls on 1 March in other years. Lunar holidays stay one-off. `is_shop_closed_on()` (SQL) and `lib/closures.ts` share the rule and a DB test checks they agree; Phase 3 search and Phase 4 checkout use them.
- **Generic phone example.** Vendor settings showed BSR's real number as the format example; now `+66 81 234 5678` like the customer pages.
- **No catalog generation.** `bike_catalog.generation` dropped; entries are told apart by make, model and year range. New slugs come from make, model and years; existing slugs are kept.
- **Price per day after 30 days, required.** `bike_models.price_after_30`. Days 31+ cost that much each; each further 30 days is capped at the 30-day price. There is no fallback to the old rule for bikes; `shop_readiness` lists a model without it under `model_prices`. Time-based extras keep the old rule. Seed values (30-day price ÷ 30) are **placeholders** until the owner gives BSR's real rates.
- **Helmets.** "Helmets included (number)"; helmet sizes dropped; helmet type became `helmet_types` (any combination), overridable per model like deposit methods.
- **Deposit refund days optional.** `shop_policies.deposit_refund_days` null = not stated; customers see nothing for it.
- **Fleet page wording.** Columns renamed "Ready for walk-ins today" and "In repair / out of service", with a "What do these columns mean?" explainer (a `<details>`, so it works on phones without a tooltip).
- **Request reply window counts opening hours only** (owner, recommended answer). A request made while the shop is closed starts counting at the next opening, and the customer is told when the shop opens. Recorded in SPEC and BUILD_PLAN now; built with request expiry in Phases 4 and 6.

## 2026-11-05 · Fleet modes, repairs, minimums and settings tabs (owner)

- **Quantity split three ways.** `bike_models.instant_qty` and `request_qty`; the rest are walk-ins only. Replaces `booking_mode`. Ready for walk-ins stays a separate count on top and can use any unit. Lowering the quantity shrinks Request first, then Instant (`lib/fleet.ts shrinkSplit`).
- **Bikes are a pool, not numbered units.** No plates or unit numbers: for interval bookings on interchangeable bikes, "fewer booked than owned at the busiest moment" guarantees the bookings fit without mid-rental swaps, as long as bikes aren't promised in advance and are handed over in pickup order. A plate note at pickup may come in Phase 4 for damage disputes.
- **Repair entries.** `bike_model_downtime` (units, optional `back_on`, note) replaces `downtime_count`/`downtime_until`, so bikes can return on different days. `units_in_repair()` gives the count on a date; `repair_conflicts()` lists bookings that no longer fit (day granularity, buffers ignored) and the fleet page warns with their codes. Search reads repairs through security definer functions in Phase 3; the table itself is members-only.
- **Minimum rental length and notice.** Shop defaults `shops.min_days_walkin`, `min_days_booking` (days) and `notice_h` (hours, advance bookings only); nullable overrides on `bike_models`. Walk-ins skip the notice.
- **Walk-ins and future bookings.** A walk-in must end before the model's next booking needs the unit; the listing will show the longest rental possible. Built with Phase 3 search and Phase 4 booking.
- **Request bikes check platform bookings.** Dates already full from platform bookings can't be requested; the shop still confirms because outside rentals aren't in the system. Phase 4.
- **One listing per catalog model** (`unique (shop_id, catalog_id)`). Adding a bike already in the fleet opens the existing listing with a note.
- **Shop settings tabs:** Store information (profile, hours, closures, contacts) and Default settings (booking rules, What's included, deposit and documents). `/vendor/settings/included` redirects to the new tab.
- **Smaller changes:** "Riding usage restrictions" replaces "Where and how far"; "Quantity" replaces "Quantity owned"; `deposit_refund_days` dropped; the shop's own model years (`bike_models.year_from/year_to`) dropped; fleet rows not ready for walk-ins are shown lighter; −1/+1 buttons on the walk-in count.

## 2026-11-06 · Owner feedback: one Save, submit early, admin delete, look

- **One Save button per settings page.** Store information, Default settings and the bike editor are each one form; `ActionForm` gets `sticky` (Save bar stuck to the bottom of the screen) and `warnUnsaved` (asks before closing the tab or following an in-app link with unsaved edits; the browser Back button can't be stopped). The server action runs each section's existing save and `mergeStates` combines the results, so a section with field errors doesn't stop the others saving. Holiday closures are edited as a list and saved with the page (`saveClosures`: ids kept + new entries as JSON).
- **Submit before setup is finished.** `submit_shop` needs only the vendor terms; the shop becomes pending and the missing steps are returned. Approval still needs a complete shop (`approveShop` checks `shop_readiness`; the button is disabled while anything is missing). Button text is just "Submit".
- **Admin can delete a shop that isn't live** (with bikes, settings and photo folders). Live shops are suspended instead, so bookings and history stay.
- **Request reply window at most 4 hours** (240 minutes), enforced in the form and by a check constraint.
- **Photo uploads.** Safari can't encode WebP and silently produced oversized PNGs; the picker now falls back to JPEG. iPhone HEIC photos can't be decoded by Chrome, Edge or Firefox: the picker says so per file with how to fix it, as it does for non-images, files still over 5 MB and permission errors. In-browser HEIC conversion would need a new dependency (about 1 MB); not added.
- **Fleet rows coloured by status:** green = ready for walk-ins, yellow = shown but not ready, red = hidden (wins). The walk-in −1/+1 buttons sit side by side, update at once and save 0.5 s after the last tap.
- **Look:** deep teal accent with a faintly tinted page, white cards with tinted section headers, a teal top bar and highlighted current tab. Inputs are white with a visible border (`inputBase` has no width so small inputs can size themselves).
- **Wording:** "Booking cut off time", "Minimum rental period (walk-ins / advanced bookings)", notice hint "Does not apply to ready walk-ins.", split hint, "Edit accepted deposit payment methods", fleet "Out of service" / "Mark as available" / "Add", and the walk-in explanation under its column title.
- **Fleet page follow-up (same day):** the quantity is edited only in the bike editor, next to its Instant/Request/walk-ins split; the fleet row shows it as text. "Ready for walk-ins" and "Live on website" (was "Show to customers") are toggle switches (`components/switch.tsx`: a checkbox with `role="switch"`).

## 2026-11-07 · Phase 3 build: customer browsing and search

Owner answers to the plan: rental days are every started 24 hours with no grace on the price (the turnaround is the shop's buffer after return); "near you" is 15 km with a link to search further; Google reviews load when scrolled into view; a demo second shop in the local seed only; stations from OpenStreetMap in an admin-editable table; Lighthouse via `npx`, not a project dependency.

- **Rules in TypeScript and SQL, checked against each other.** `lib/rental-days.ts`, `lib/availability.ts` (pool model, Instant/Request split, out-of-service entries, buffers, longest walk-in) and `lib/ranking.ts` are pure and unit-tested; `rental_days()`, `model_offer()`, `longest_walkin()`, `rental_price()` and the score inside `search_offers()` follow them, and `tests/db/search.test.ts` compares the two on the same data. Bookings stay private: those functions are security definer and return numbers only.
- **Model-first search** is one RPC, `search_offers()`, returning one row per shop offer with price for the dates, distance, mode, free units, walk-in limit and score; the app groups rows into one card per catalog model (`lib/search.ts`). Filters are its parameters. A shop is hidden when it's closed (hours or holiday closures, incl. yearly) at the pickup or return time; advance bookings need the notice and minimum days; walk-ins need the bike ready, the shop open and before the cut off, and a rental that ends before the next booking needs the unit.
- **Weights in `ranking_settings`** (single row, admin screen at /admin/ranking). Rating, response and cancellation come from `shop_stats()` and are neutral until there's data.
- **Stations** (`stations`, 182 BTS/MRT/ARL/SRT Red rows from OpenStreetMap route relations, interchanges merged; admin screen at /admin/stations). The station picker credits "© OpenStreetMap contributors" (ODbL).
- **Caching.** Public data that doesn't depend on the visitor (catalog entry, shop, listing details, stations, featured shops) is cached with `"use cache"` + `cacheLife("minutes")` (stations: hours) through a cookie-free client (`lib/supabase/public.ts`), so vendor edits show within minutes. Search runs per request. Bike and shop pages read their params inside Suspense (no `generateStaticParams`), as Cache Components requires; the language picker and suggestion bar also stream inside Suspense because they read the address.
- **Thumbnails.** Uploads also save a 480 px copy (`<id>-thumb.<ext>`); search cards load it; deleting a photo removes both. Photos uploaded before this have no thumbnail and show the placeholder on cards until re-uploaded (the live site has none yet).
- **Google rating and reviews** come from a server route (`/api/google-reviews/[shopId]`) with `GOOGLE_PLACES_SERVER_KEY`, field mask `rating,userRatingCount,reviews,googleMapsUri` (Enterprise + Atmosphere SKU), never cached; the block fetches when scrolled into view and shows "Google Maps" text attribution, author names/photos/links, the sort notice and the not-verified notice. Without the key the block is hidden.
- **Catalog slugs** use one year when the range is one year (`honda-nx500-2025`); existing slugs of the doubled shape are rewritten.
- **Translations** in 9 more languages are Claude drafts like the rest; customer namespaces now include Search, Bikes, Bike, BikeInfo, Shop and Days.
- **Lighthouse (mobile, local production build):** home and search both 98 performance, 100 accessibility, 100 best practices, 100 SEO. `app/robots.ts` keeps dashboards out of search engines.
- **Not done here:** the walk-in path of `search_offers()` depends on the current time and has no automated test (checked by hand); maps and address search need the Google key and were not exercised in tests.

