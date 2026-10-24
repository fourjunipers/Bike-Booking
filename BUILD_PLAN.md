# BUILD_PLAN.md

Phased build plan for the motorbike rental marketplace. Product behaviour is defined in `SPEC.md`; standing rules are in `CLAUDE.md`. Build **one phase at a time**. Plan, get approval, build, test, then stop and summarise.

---

## How to use this file (for the owner)

1. Create the accounts in **Before you start** and fill in `.env.local`.
2. Put `SPEC.md`, `CLAUDE.md` and `BUILD_PLAN.md` in the root of an empty repo.
3. Open Claude Code in the repo and paste the **Prompt** for Phase 0.
4. Review the plan it proposes, approve it, and let it build.
5. Test the phase yourself using its **Acceptance criteria**, then paste the next phase's prompt.
6. If something is wrong, describe what you saw and ask for a fix before moving on.

---

## Before you start (owner)

| Service | What to set up | Env vars |
| --- | --- | --- |
| GitHub | New private repo | — |
| Netlify | Project imported from the GitHub repo (production branch `main`) | Same variables as `.env.local`, entered in the Netlify UI |
| Supabase | New project (Singapore region). Enable Google, Apple and email (magic link) auth providers | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Google Cloud | OAuth client for Google login. Maps JavaScript API + Places API key, restricted to your domains | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Apple | Sign in with Apple service ID (can be added later) | (configured in Supabase) |
| LINE Developers | **One provider** for the platform. Inside it: a **LINE Login** channel and a **Messaging API** channel (new LINE Official Account for the platform, not BSR's). Both channels must be under the same provider so vendor user IDs match. Link the OA to the Login channel | `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`, `LINE_MESSAGING_CHANNEL_SECRET`, `LINE_MESSAGING_ACCESS_TOKEN` |
| Stripe | Account for the platform company, **test mode**. Enable PromptPay, Apple Pay, Google Pay | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Resend | Account + verified sending domain | `RESEND_API_KEY`, `EMAIL_FROM` |
| Meta (later, Phase 7) | WhatsApp Business account + approved templates | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| Other | — | `CRON_SECRET` (random string), `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAILS` (comma-separated) |

---

## Phase 0: Project setup

**Goal:** an empty, deployable app with the stack wired up.

**Tasks**
- Create the Next.js app (TypeScript strict, App Router, Tailwind, shadcn/ui, ESLint, Prettier).
- Add Supabase CLI with local development (`supabase start`) and the migrations folder. Enable PostGIS.
- Add `next-intl` with `en` and `th` message files (vendor area only uses `th`).
- Add Vitest and Playwright with one passing example test each.
- Create `lib/money.ts` and `lib/time.ts` (Asia/Bangkok helpers) with unit tests.
- Create `.env.example` with every variable from **Before you start**.
- Basic layouts for the three areas: `/` (customer), `/vendor`, `/admin`, each a placeholder page.
- Deploy to Netlify and confirm it builds.

**Acceptance criteria**
- `npm run dev`, `npm run build`, `npm run lint`, `npm test` all succeed.
- `supabase db reset` runs cleanly.
- The Netlify URL shows the three placeholder areas.

**Prompt**
> Read CLAUDE.md, SPEC.md and BUILD_PLAN.md. We are starting Phase 0: Project setup. Propose a plan for Phase 0 only, then wait for my approval.

---

## Phase 1: Data model, auth and roles

**Goal:** all core tables exist with security rules, and the three roles can log in.

**Tasks**
- Migrations for every table in the SPEC **Data model** section: users/profiles, shops, shop_members, shop_hours, shop_closures, shop_policies, delivery_zones, bike_models, price_days, promotions, bookings, booking_events, reviews.
  - Use Postgres enums for fixed sets: role, shop status, bike type, transmission, booking mode, booking status, deposit type, licence type, promotion kind.
  - `shops.location` as PostGIS `geography(Point)`.
  - Sensible indexes: bookings by (bike_model_id, start_at, end_at), shops by location (GIST), shops by status.
- Row Level Security policies for every table:
  - Public can read live shops, visible models, prices, policies, hours and non-hidden reviews.
  - Customers read and write only their own bookings and reviews.
  - Vendor staff read and write only their own shop's rows. Owners can also manage shop_members.
  - Admin access through server routes using the service role.
- Auth:
  - Customers: Google, Apple, email magic link (Supabase Auth). LINE also allowed.
  - Vendors: LINE or Google.
  - LINE Login: check current Supabase docs for custom OIDC/OAuth provider support. If supported, use it. If not, implement the LINE OAuth flow in a server route and create/sign in the Supabase user server-side. Store `line_user_id` on the profile either way. Request the `bot_prompt=aggressive` option so vendors are asked to add the platform's LINE OA as a friend.
  - Admin: any user whose email is in `ADMIN_EMAILS` gets the admin role.
- Profile page for customers (name, email, WhatsApp number, notification choice).
- Route protection: `/vendor` needs shop membership (or shows "create your shop"), `/admin` needs admin role.
- Seed script: one admin user, the BSR Bike Shop as a live shop with its real address and 3 bike models, one test customer.

**Acceptance criteria**
- You can log in as customer (Google and email), as vendor (LINE and Google) and as admin.
- A customer cannot read another customer's booking, and a vendor cannot read another shop's data. Prove this with automated tests against RLS.
- `supabase db reset` loads the seed data.

**Prompt**
> Phase 0 is done. Read CLAUDE.md, SPEC.md and BUILD_PLAN.md. Plan Phase 1: Data model, auth and roles. Include the full table list with columns, enums, indexes and RLS policies in your plan. Wait for approval.

---

## Phase 2: Vendor side and admin approval

**Goal:** a vendor can create a shop, add their fleet with prices, and submit it. Admin can approve it.

**Tasks**
- **Onboarding:** create shop → profile → policies → at least one bike model → submit for review (status `pending`).
- **Shop settings:**
  - Profile: name, about, photos (Supabase Storage, resized), Google Maps pin picker + Maps link, nearest BTS/MRT (auto-suggested, editable).
  - Opening hours per weekday, holiday closures.
  - Contacts: WhatsApp number, LINE ID.
  - Same-day cut-off (minutes before closing), default buffers before/after (hours), request response window (minutes, default 120).
  - Deposit and document policy: deposit type and amount, licence required, included items, notes.
  - Delivery settings form can exist but is hidden behind a flag until Phase 7.
- **Fleet page:** the one-screen table from SPEC (Qty, Ready today toggle + count, Down time toggle + count + back-on date) with inline editing that saves instantly. The Ready-today count can never exceed qty − down time − bikes currently on rent (on-rent count is 0 until Phase 4).
- **Bike model editor:** specs, photos, booking mode (Instant/Request), buffer overrides, visible toggle, pricing.
- **Pricing autofill** (`lib/pricing.ts`, pure functions + unit tests):
  - Anchors: day 1 and day 30 required; days 7, 14, 21 optional.
  - Fill rule: linear between consecutive set anchors, rounded to nearest ฿10. Manual day edits are flagged `is_manual` and never overwritten when anchors change.
  - Over 30 days: `floor(d/30) × price(30) + min(price(d mod 30), price(30))`.
  - Validation warnings: a longer rental cheaper than a shorter one, or any day below the day-1 price.
  - **Tests must include the SPEC example:** anchors 300 / 1,800 / 3,200 / 4,400 / 5,500 produce exactly the table in SPEC, and 45 days = 8,870.
  - UI: anchors at top, 30-day grid below, edited cells highlighted, "reset to autofill" per cell.
- **Staff:** owner can invite staff by email or LINE. Staff can manage bookings and fleet but not shop ownership or team.
- **Vendor dashboard language toggle** Thai/English. All vendor UI strings go through `next-intl`.
- **Admin:**
  - Approval queue: approve (→ live) or return with notes.
  - After approval, edits to models, prices or policies go live but set `flagged_for_review`. Admin can clear the flag.
  - Shops list with status, boost level (Featured / Preferred / Normal) and suspend.
- **Vendor terms** acceptance checkbox at submission, with the four terms from SPEC.

**Acceptance criteria**
- BSR's real fleet can be entered in under 15 minutes on a phone.
- The pricing grid matches the SPEC example exactly, and the unit tests pass.
- A new shop is invisible to the public until admin approves it.
- Staff cannot see the Team page.

**Prompt**
> Phase 1 is done. Read CLAUDE.md, SPEC.md and BUILD_PLAN.md. Plan Phase 2: Vendor side and admin approval. Write the pricing autofill as pure tested functions first, using the SPEC example as test cases. Wait for approval.

---

## Phase 3: Customer browsing and search

**Goal:** customers can find bikes and see accurate prices and policies. No booking yet.

**Tasks**
- **Home:** location input (GPS, address via Places autocomplete, BTS/MRT station list), date/time pickers, bike type chips, "Get your bike now" button, featured shops, area links (placeholder until Phase 7).
- **Search results:** list + map toggle (Google Maps, shop pins).
  - Each card shows photo, model, shop, distance, **total price for chosen dates** (from `price_days`), badge (Instant / Request / Ready today), rating, deposit type.
- **Filters:** dates, bike type, transmission, cc range, price range, Get your bike now, deposit type, rating. Delivery and deals filters are hidden until Phase 7.
- **Sort:** Recommended (default), price, distance, rating.
- **Ranking score** (a SQL function or view, weights stored in an admin settings table):
  - 30% admin boost (Featured 1.0 / Preferred 0.6 / Normal 0.3)
  - 20% rating (neutral 0.5 if fewer than 3 reviews)
  - 15% request response rate/speed
  - 15% inverse cancellation rate
  - 20% distance (closer = higher, normalised within results)
  - Featured shops show a badge.
- **Availability in search:** for Instant models, hide models with 0 units free for the chosen dates (use the Phase 4 availability function. In this phase, build `lib/availability.ts` and the SQL function so search can use it). Request models always show, with a "Request" badge.
- **Get your bike now filter:** ready_today_on with count ≥ 1, shop open today, current Bangkok time before the shop's cut-off. Show "Updated today / N days ago" from `ready_today_updated_at`.
- **Bike page:**
  - Photos, specs, price for chosen dates and a mini price table.
  - **Deposit and document policy shown prominently**, plus included items, shop info + map, reviews and cancellation policy.
  - Book button (leads to a "coming soon" in this phase).
- **Shop page:** about, photos, hours, location, all models, reviews.
- Everything server-rendered for SEO, with proper titles and meta descriptions.

**Acceptance criteria**
- Searching from Phra Khanong BTS shows BSR first among equal shops when boosted, and sorting by price works.
- Prices for 1, 7, 10, 30 and 45 days match the pricing function.
- The availability function has unit tests covering buffers, down time and overlapping bookings.
- Lighthouse mobile performance ≥ 85 on home and search.

**Prompt**
> Phase 2 is done. Read CLAUDE.md, SPEC.md and BUILD_PLAN.md. Plan Phase 3: Customer browsing and search, including the availability function and ranking score. Wait for approval.

---

## Phase 4: Booking engine (no real payments yet)

**Goal:** the full booking lifecycle works end to end. Payments are simulated with a test "mark as paid" button that Phase 5 replaces.

**Tasks**
- **Booking state machine** in `lib/booking-state.ts`. Statuses:
  - Pending: `pending_vendor`, `confirmed_unpaid`, `paid`, `picked_up`, `returned`
  - Ended: `declined`, `expired`, `cancelled_customer`, `cancelled_vendor`, `cancelled_unpaid`, `no_show`
  - Allowed transitions (the SPEC diagram does not survive Markdown export, so this list is authoritative):
    - new → `confirmed_unpaid` (Instant, unit free on calendar)
    - new → `pending_vendor` (Request model, or any delivery booking)
    - new → `paid` (Get your bike now, or pickup within 3 days, paid at booking)
    - `pending_vendor` → `confirmed_unpaid` (vendor accepts) | `declined` (vendor declines) | `expired` (no reply in window)
    - `confirmed_unpaid` → `paid` (fee charged) | `cancelled_customer` | `cancelled_vendor` | `cancelled_unpaid` (payment deadline missed)
    - `paid` → `picked_up` (vendor enters booking code) | `cancelled_customer` | `cancelled_vendor` | `no_show`
    - `picked_up` → `returned` (triggers review request)
    - Every change writes `booking_events`. Full unit tests for allowed and forbidden transitions.
- **Availability rule** (SQL + `lib/availability.ts`):
  - Units free = qty − down-time count − max concurrent overlapping bookings.
  - Each booking is widened by buffer_before/buffer_after (model override, else shop default).
  - Statuses that hold a unit: `pending_vendor` (only for Instant models with a delivery request), `confirmed_unpaid`, `paid`, `picked_up`.
  - Pickup and return times must fall inside shop hours and not on closure dates.
- **Create booking RPC:** transaction, lock the bike model row, recheck availability, recalculate price/promo/fee on the server, insert booking + event. Return the booking code (6 characters, no ambiguous letters such as 0/O/1/I).
- **Fee calculation** (`lib/fees.ts`, unit tests):
  - fee = max(round(10% × rental after promotion), 50), but never more than the rental itself.
  - due_at_shop = rental after promotion − fee.
  - Delivery fee is separate.
  - Test cases: 2,880 → fee 288 / shop 2,592; 250 → fee 50 / shop 200.
- **Modes:**
  - **Instant:** confirms immediately → `confirmed_unpaid` (or straight to paid flow if pickup within 3 days. Simulated in this phase).
  - **Request:** → `pending_vendor` with `request_expires_at` = now + shop response window. Vendor Accept/Decline in the dashboard (LINE buttons come in Phase 6).
  - **Get your bike now:** only when the ready-today rules from Phase 3 pass. Confirms instantly, payment required at booking, and decrements `ready_today_count` in the same transaction (auto-Out at 0).
  - **Abuse guard:** reject a new booking if the customer already has an unpaid booking (`confirmed_unpaid` or `pending_vendor`) whose dates overlap. Bookings on different dates are allowed.
- **Checkout page:**
  - Dates/times within shop hours, then a price breakdown exactly like SPEC (rental, promo, rental after promo, pay now, pay at shop).
  - Acceptance of the deposit policy and cancellation policy.
  - Login required at this step.
- **Customer screens:**
  - Booking confirmation with code, map and status.
  - Shop WhatsApp/LINE buttons appear **only once confirmed**.
  - My bookings (upcoming, pending, past) with Cancel.
- **Cancellation rules** (`lib/cancellation.ts`, unit tests):
  - Customer cancels > 3 days before pickup → free.
  - Customer cancels within 3 days → fee kept.
  - Vendor cancels → full refund, recorded for ranking.
  - No-show: vendor marks it after pickup time.
  - In this phase, record the refund decision only; the actual Stripe refund comes in Phase 5.
- **Vendor screens:**
  - Today (pickups/returns, pending requests with countdown), Bookings list/detail, Calendar per model (bookings, buffers, down time, closures).
  - Actions: Accept, Decline, Picked up (enter or scan booking code), Returned, No-show, Cancel.
- Fleet page now subtracts bikes currently on rent from the Ready-today ceiling.
- **Request expiry:** an API route that expires overdue requests. Wire it to cron in Phase 6; callable manually for now.
- Playwright tests:
  - An Instant booking from search to Returned
  - A Request booking accepted
  - A Request booking that expires
  - Two customers racing for the last unit (only one succeeds)

**Acceptance criteria**
- All three booking modes work end to end with the simulated payment.
- Double booking is impossible under concurrent requests.
- The vendor sees the correct "collect ฿X" amount on every booking.

**Prompt**
> Phase 3 is done. Read CLAUDE.md, SPEC.md and BUILD_PLAN.md. Plan Phase 4: Booking engine. Start with the state machine, availability and fee logic as tested pure functions, then the create-booking RPC with row locking. Payments are simulated in this phase. Wait for approval.

---

## Phase 5: Payments (Stripe, test mode)

**Goal:** real fee collection with pay-later, PromptPay, failures, refunds and receipts.

**Tasks**
- Create a Stripe Customer per platform user on first checkout.
- **Pickup more than 3 days away, card:** collect a SetupIntent at checkout (save card, no charge) → `confirmed_unpaid` with `payment_due_at` = pickup date − 3 days (Bangkok time).
- **Pickup within 3 days, or Get your bike now:** PaymentIntent at checkout (card, Apple Pay, Google Pay or PromptPay) → `paid` on success.
- **Request mode:** no card step until the vendor accepts. On accept, the customer gets a link to save a card (or pay now if within 3 days). If they don't do it within 24 hours, cancel as `cancelled_unpaid`.
- **Pay-later charge job** (hourly route): for bookings due, create an off-session PaymentIntent with an idempotency key based on the booking ID.
  - Success → `paid`.
  - Failure (including authentication required) → email the customer a link to update the card, retry after 12 hours. Still unpaid 48 hours before pickup → `cancelled_unpaid` and notify the vendor.
- **PromptPay pay-later:** on the due date, create a PaymentIntent and send the customer a payment link. Unpaid after 24 hours → `cancelled_unpaid`.
- **Webhook** `/api/webhooks/stripe`:
  - Verify the signature.
  - Handle `payment_intent.succeeded`, `payment_intent.payment_failed`, `setup_intent.succeeded`, `charge.refunded`.
  - Idempotent: store processed event IDs.
- **Refunds:** apply the Phase 4 cancellation decisions with real Stripe refunds (full fee refund on vendor cancel or a customer cancelling > 3 days out after an early payment).
- **Receipts:** an email receipt for every fee payment and refund. The issuing company name comes from settings.
- Remove the Phase 4 "mark as paid" test button.
- Customer account page: manage saved cards.
- **Admin Finance:**
  - Fees collected by day/month/shop, refunds, upcoming scheduled charges, failed payments.
  - CSV export.

**Acceptance criteria**
- With Stripe test cards, you can demonstrate:
  - Instant booking paid immediately
  - Pay-later charge succeeding
  - Pay-later charge failing then recovering
  - Failing then auto-cancelling
  - A PromptPay test payment
  - A refund
- Replaying the same webhook event twice changes nothing the second time.
- No amount is ever taken from the browser; all amounts are recalculated on the server.

**Prompt**
> Phase 4 is done. Read CLAUDE.md, SPEC.md and BUILD_PLAN.md. Plan Phase 5: Payments with Stripe in test mode. Check the current Stripe docs for PromptPay in Thailand and off-session charging before planning. Wait for approval.

---

## Phase 6: Notifications and scheduled jobs

**Goal:** vendors run their day from LINE, and customers get timely emails.

**Tasks**
- **LINE linking:** vendors who logged in with LINE are linked automatically. Google-login vendors get a "Connect LINE" button.
  - Show a prompt to add the platform's LINE OA as a friend (push messages need it).
  - Staff members each link their own LINE, and all shop members receive shop notifications.
- **LINE webhook** `/api/webhooks/line`:
  - Verify the signature.
  - Handle postbacks: Accept / Decline request, Accept / Decline delivery, Confirm / Edit ready-today.
  - Postback data carries a signed token (booking ID + action + expiry), never a bare ID.
  - Reply with a confirmation message.
- **Vendor messages:** build every vendor template from SPEC **Notification templates** as LINE Flex messages in Thai and English (vendor's language). Email copies are sent too.
- **Customer emails:** build every customer template from SPEC (Resend, simple branded HTML).
- **Cron jobs** (Netlify Scheduled Functions in `netlify/functions/` that call protected routes), exactly as the SPEC **Scheduled jobs** table. Netlify cron runs in UTC, so convert Bangkok times (e.g. 00:05 Bangkok = `5 17 * * *`). Confirm the 5-minute schedule works on Netlify before relying on it. Scheduled functions only run on the published production deploy:
  - Request expiry (5 min)
  - Pay-later charges and payment deadlines (hourly)
  - Ready-today reminder at each shop's opening time (hourly job that picks shops opening that hour)
  - Down time return (daily 00:05 Bangkok)
  - Day-before pickup reminder (daily 18:00 Bangkok)
  - Review requests (hourly, after Returned)
- **Expired or declined request:** the customer's email includes up to 3 similar available bikes nearby (same type, ±1 cc band, within 5 km).
- **Message log:** every message sent is recorded in `booking_events` (channel, template, success/failure).

**Acceptance criteria**
- A vendor can accept a request from a LINE notification without opening the dashboard, and the customer is emailed within a minute.
- The daily reminder arrives at shop opening time, and Confirm updates `ready_today_updated_at`.
- Tapping an old Accept button after the request expired replies "This request has expired" and changes nothing.

**Prompt**
> Phase 5 is done. Read CLAUDE.md, SPEC.md and BUILD_PLAN.md. Plan Phase 6: Notifications and scheduled jobs. Check the current LINE Messaging API docs for Flex messages, postbacks and webhook signature verification. Wait for approval.

---

## Phase 7: Promotions, delivery, stats, reviews, SEO, WhatsApp

**Goal:** the remaining features from SPEC.

**Tasks**
- **Promotions:**
  - Vendor creates and pauses promotions: % off, ฿ off, long-rental discount (min days), date window, new customers only; all models or chosen models.
  - Best single promotion applies (no stacking).
  - Badge on cards and a Deals filter.
  - Fee is calculated on the discounted price (already in `lib/fees.ts`).
- **Delivery:**
  - Turn on the delivery settings: radius and flat fee or distance zones.
  - Customer chooses delivery and enters an address (Places autocomplete). Distance is checked against the radius.
  - Every delivery booking → `pending_vendor`, even for Instant models (holds a unit while pending).
  - Delivery fee is shown separately and paid at handover.
  - Delivery filter in search.
- **Reviews:**
  - Customer can review after Returned (1–5 stars + text).
  - Shop and bike pages show reviews.
  - Admin can hide abusive reviews.
  - Feed rating into the ranking score.
- **Vendor stats:** listing views (lightweight counter table), requests, confirmed bookings, amount to collect by week/month, response rate and speed, cancellation rate, ratings, top models.
- **SEO area pages:**
  - Generated pages per area/city and bike type, e.g. `/rent/bangkok/sukhumvit`, `/rent/bangkok/monthly`, `/rent/bangkok/automatic-scooter`, from live listings.
  - Unique title/meta/intro (intro editable in admin), sitemap.xml, robots.txt, structured data (LocalBusiness / Product with offers).
  - Pages appear automatically when an area gets its first live shop.
  - Daily refresh job.
- **WhatsApp:**
  - Customer notifications through the WhatsApp Business API using approved templates (confirmed, payment reminder, card failed, day-before pickup, review).
  - Only for customers who added a WhatsApp number and chose WhatsApp.
  - Fall back to email on failure.
- **PWA:** web manifest and icons so the vendor dashboard can be installed on a phone home screen.

**Acceptance criteria**
- A 10% promotion on a 14-day rental shows exactly the SPEC checkout example (3,200 → 2,880; pay now 288; at shop 2,592).
- A delivery request on an Instant model waits for vendor approval and blocks the unit meanwhile.
- Area pages render server-side, appear in the sitemap and pass Google's Rich Results test.

**Prompt**
> Phase 6 is done. Read CLAUDE.md, SPEC.md and BUILD_PLAN.md. Plan Phase 7. Split it into sub-steps (promotions, delivery, reviews, stats, SEO pages, WhatsApp, PWA) and we will build them one at a time. Wait for approval.

---

## Phase 8: Launch hardening

**Goal:** ready for real vendors and real money.

**Tasks**
- **Legal pages:**
  - Terms of service (booking platform, not the renter; damage disputes between customer and shop)
  - Vendor agreement (the four vendor terms)
  - PDPA privacy policy
  - Cookie notice

  Use placeholder text clearly marked for the owner's lawyer to replace.
- Error monitoring (Sentry) and basic analytics (Plausible or Netlify's own analytics). Ask before adding.
- Rate limiting on auth, booking creation and webhook routes.
- Database backups confirmed (Supabase), and a written restore procedure in `docs/ops.md`.
- Full Playwright suite passing against a staging deployment.
- Admin settings page:
  - Fee % and minimum
  - Ranking weights
  - Request window default
  - Company name for receipts
- **Go-live checklist** in `docs/go-live.md`:
  - Switch Stripe to live keys
  - Point the Stripe and LINE webhooks to production
  - Verify the email domain
  - Hosted Supabase sends auth email through Resend SMTP with our magic-link template (`supabase/templates/magic-link.html`)
  - Publish the Google OAuth app (Google Auth Platform → Audience). Google requires a homepage URL and a privacy policy URL on the Branding page first; until then it stays in Testing mode and only listed test users can sign in with Google
  - WhatsApp templates approved
  - Seed only BSR as the live vendor

**Acceptance criteria**
- A full booking passes on staging with Stripe test mode, and the go-live checklist is complete except for the owner's sign-off items.

**Prompt**
> Phase 7 is done. Read CLAUDE.md, SPEC.md and BUILD_PLAN.md. Plan Phase 8: Launch hardening. Wait for approval.

---

## Notes for every phase

- If `SPEC.md` is ambiguous, list the questions in your plan instead of guessing.
- Keep a running `docs/decisions.md` with any decision made during the build (what, why, date).
- If a third-party API does not support something the plan assumes, stop and explain the options. Don't quietly build a workaround.
