# Motorbike Rental Marketplace — Product Spec

Oct 22, 2026 · Mark

## Overview

A web-based marketplace where foreign customers find and book motorbikes from rental shops across Bangkok, then Thailand. Customers pay a 10% booking fee online (minimum ฿50) and pay the rest to the shop at pickup. The platform is branded separately from BSR; BSR Bike Shop is the first vendor.

**Core principles**

- Shops never have to maintain availability against their will: each bike model is either Instant (calendar) or Request (accept/decline on LINE).
- Vendor revenue never passes through the platform. The only money collected is the booking fee.
- One web app, no app-store apps. Customer site is mobile-first; vendor dashboard is installable as a PWA.

| | Customer | Vendor | Admin |
| --- | --- | --- | --- |
| Access | Public website, English | /vendor dashboard, Thai/English toggle | /admin panel |
| Login | Google, LINE, Apple, email | LINE or Google; staff accounts under one shop | Google, restricted |
| Main jobs | Search, book, pay, contact shop, review | Bikes, availability, pricing, promos, delivery, bookings, stats | Approve shops, ranking, refunds, finance |
| Notified via | Email + WhatsApp | LINE + email | LINE |

**Open question:** platform name and the company that will run it.

## Vendor onboarding and shop setup

Every shop is hidden until admin approves it; after approval, major edits go live immediately but are flagged for admin review.

**Onboarding steps**

1. Vendor signs in with LINE or Google and creates a shop.
2. Vendor completes the shop profile, policies and at least one bike model.
3. Vendor submits for review. Admin checks the shop is real, photos match, and prices and policies are complete.
4. Admin approves (shop goes live) or returns it with notes.
5. Vendor can invite staff accounts (e.g. a store manager) who can manage bookings and fleet but not payout or shop-ownership settings.

**Shop profile fields**

| Field | Notes |
| --- | --- |
| Name, about, photos | Shown on shop page and bike pages |
| Location | Google Maps pin + Maps link; nearest BTS/MRT auto-detected |
| Opening hours | Per weekday; pickups and returns only within hours |
| Holiday closures | Date ranges; blocks pickups and returns |
| Contact | WhatsApp number and LINE ID; shown to customer only after confirmation |
| Same-day cut-off | Vendor-chosen, e.g. 2 hours before closing |
| Default buffers | Before pickup and after return, in hours; models can override |
| Request response window | Default 2 hours |

**Deposit and document policy** (one per shop, shown on every bike page and at checkout)

- Deposit type: passport held / cash deposit (amount) / passport copy only
- Licence required: none / car licence / motorbike licence / international driving permit
- Included: helmet(s), insurance (type), phone holder, rain gear
- Free-text notes, e.g. fuel policy, late return charges

**Delivery** (optional)

- Delivery radius in km and fee: flat, or distance zones.
- Every delivery booking needs vendor approval, including Instant models. Vendor checks address and time, then accepts or declines.
- Delivery fee is paid to the vendor at handover. The 10% platform fee applies to the rental only.

## Fleet management

Inventory is tracked per bike model with a quantity, not per individual bike, so a shop with six Honda Click 125s manages one row.

**Bike model fields**

| Field | Values |
| --- | --- |
| Make, model, year range | e.g. Honda PCX 160, 2023–2025 |
| Type | City/scooter, touring, adventure, sport, classic, off-road |
| Transmission | Automatic, semi-auto, manual |
| Engine size | cc (used for cc-range filter) |
| Photos | At least 1, up to 8 |
| Quantity | Total units owned |
| Booking mode | Instant or Request |
| Buffers | Before/after, overrides shop default |
| Pricing | Anchor rates + day table (see Pricing) |
| Visible | On/off without deleting |

**Fleet page: one screen of toggles**

| Model | Qty | Ready today | Down time |
| --- | --- | --- | --- |
| Honda Click 125 | 6 | On · 3 | 1 |
| Honda PCX 160 | 4 | Out | 0 |

**Ready today**

- A toggle plus a count per model. It stays as set; there is no automatic reset.
- Each Get-your-bike-now booking reduces the count by 1; at 0 it switches to Out automatically.
- Daily LINE reminder at shop opening: "Still correct?" with one-tap Confirm or Edit.
- Customers see the last update: "Updated today" or "Updated 3 days ago".
- Ready-today count can never exceed Qty minus down time minus bikes currently on rent.

**Down time**

- A toggle plus a count of units out of service, with an optional "back on" date.
- Units in down time are removed from every kind of availability: calendar, Ready today and requests.
- On the "back on" date the units return automatically and the vendor gets a LINE note.

## Pricing

Vendors enter up to five anchor totals per model; the system fills every day in between at equal steps, and the vendor can edit any single day.

**Anchors:** 1 day (required), 7 days, 14 days, 21 days, 30 days (required). Blank optional anchors are skipped and the fill runs between the anchors that are set.

**Fill rule:** for a day d between anchors a and b, price(d) = price(a) + (price(b) − price(a)) × (d − a) ÷ (b − a), rounded to the nearest ฿10. A day the vendor edits by hand is marked as manual and never overwritten when anchors change.

**Example** with anchors ฿300 / ฿1,800 / ฿3,200 / ฿4,400 / ฿5,500:

| Days | Totals (฿) |
| --- | --- |
| 1–7 | 300, 550, 800, 1,050, 1,300, 1,550, 1,800 |
| 8–14 | 2,000, 2,200, 2,400, 2,600, 2,800, 3,000, 3,200 |
| 15–21 | 3,370, 3,540, 3,710, 3,890, 4,060, 4,230, 4,400 |
| 22–30 | 4,520, 4,640, 4,770, 4,890, 5,010, 5,130, 5,260, 5,380, 5,500 |

**Over 30 days:** full months × the 30-day price, plus the remaining days from the table, with the remainder capped at the 30-day price. Example: 45 days = ฿5,500 + ฿3,370 = ฿8,870.

**Validation:** the editor warns when a longer rental is cheaper than a shorter one, or when a day total is below the 1-day price.

**Order of calculation at checkout:** rental total from the table → minus promotion → booking fee = 10% of that (minimum ฿50) → amount due at shop = rental after promotion − booking fee. Delivery fee is shown separately and paid at handover.

## Booking modes and statuses

Each bike model is either Instant or Request; Get your bike now and delivery are layered on top.

| Mode | When it applies | How it confirms |
| --- | --- | --- |
| Instant | Model set to Instant, no delivery | Automatically, if qty − overlapping bookings (with buffers) − down time ≥ 1 |
| Request | Model set to Request | Vendor taps Accept on LINE or in the dashboard within the response window (default 2 hours) |
| Delivery | Any model, delivery chosen | Always needs vendor acceptance, even for Instant models |
| Get your bike now | Ready-today count ≥ 1 and before the shop's cut-off | Instantly; fee paid at booking; Ready-today count drops by 1 |

**Booking status flow**

- Instant booking (unit free on calendar) → `confirmed_unpaid`
- Request booking or any delivery booking → `pending_vendor`
- Get your bike now, or pickup within 3 days → `paid` (fee paid at booking)
- `pending_vendor` → `confirmed_unpaid` (vendor accepts) | `declined` (vendor declines) | `expired` (no reply in window)
- `confirmed_unpaid` → `paid` (fee charged on the pay-later date) | `cancelled_customer` | `cancelled_vendor` | `cancelled_unpaid` (payment deadline missed)
- `paid` → `picked_up` (vendor enters booking code) | `cancelled_customer` | `cancelled_vendor` | `no_show`
- `picked_up` → `returned` (review request sent)

Requests that are declined or get no reply cost the customer nothing. A confirmed booking moves to paid on the pay-later date (or at booking if within 3 days), and only a cancellation or no-show stops it reaching pickup.

**Statuses stored on each booking:** pending_vendor, declined, expired, confirmed_unpaid, paid, picked_up, returned, cancelled_customer, cancelled_vendor, cancelled_unpaid, no_show.

## Payments and cancellation

The platform collects only the booking fee: 10% of the rental after promotions, minimum ฿50. The customer pays the rest to the shop at pickup; there are no vendor statements or payouts.

**Payment methods**

- Cards, Apple Pay, Google Pay via Stripe.
- PromptPay via Stripe or Omise, using a dynamic QR per payment so it confirms automatically by webhook. Mainly for expats with Thai bank accounts.

**When the fee is charged**

| Booking | Card | PromptPay |
| --- | --- | --- |
| Pickup more than 3 days away (book now, pay later) | Card saved at booking, charged automatically 3 days before pickup | Payment link sent 3 days before pickup; unpaid after 24 hours → booking cancelled |
| Pickup within 3 days | Charged at booking | Paid at booking |
| Get your bike now | Charged at booking | Paid at booking |
| Request mode | Saved/charged only after vendor accepts | Link sent only after vendor accepts |

**Failed card charge:** retry after 12 hours and email + WhatsApp the customer to update the card; unpaid 48 hours before pickup → booking cancelled and vendor notified.

**Abuse guard:** a saved card (or immediate payment) is required for every booking. A customer can hold only one unpaid booking for overlapping dates; bookings on different dates are unlimited, so trip planners can book several bikes across a route.

**Vendor notice once paid:** "Booking #1234 paid. Customer paid ฿350 online. Collect ฿3,150 at pickup (+ delivery fee if applicable)."

**Renewals and extensions:** handled directly at the shop, off-platform, with no fee. Possible later feature.

**Cancellation policy** (platform-wide)

| Situation | Result |
| --- | --- |
| Customer cancels more than 3 days before pickup | Free; nothing charged yet, or fee refunded |
| Customer cancels within 3 days | Fee kept |
| Vendor cancels or declines after confirming | Full refund; counts against vendor ranking |
| Request declined or expired | Nothing charged |
| No-show | Fee kept |

**Receipts:** every fee payment emails a receipt from the platform company. VAT registration is needed once fee revenue passes ฿1.8M a year.

## Customer screens

Customers can browse without logging in; login is required at checkout.

| Screen | Contents |
| --- | --- |
| Home | Location box (GPS, address, BTS/MRT), date picker, bike type chips, "Get your bike now" button, featured shops, area links |
| Search results | List + map toggle. Each card: photo, model, shop, distance, total for chosen dates, Instant / Request / Ready today badge, promo badge, rating, deposit type |
| Filters | Dates, bike type, transmission, cc range, price range, Get your bike now, delivery, deposit type (no passport held), deals, rating |
| Sort | Recommended (ranking score, default), price, distance, rating |
| Bike page | Photos, specs, price table for chosen dates, deposit and document policy (prominent), what's included, shop info + map, reviews, cancellation policy, Book button |
| Shop page | About, photos, hours, location, all models, reviews |
| Checkout | Dates and times (within shop hours), pickup or delivery (address), price breakdown: rental, promo, pay now (fee), pay at shop, delivery fee; payment method; policy acceptance |
| Booking confirmation | Status, booking code, shop address + map, WhatsApp and LINE buttons (after confirmation), payment due date, cancel button |
| My bookings | Upcoming, pending requests, past; cancel; leave review |
| Account | Name, email, WhatsApp number, notification choice, saved cards |

**Price breakdown shown at checkout (example, 14 days)**

| Line | ฿ |
| --- | --- |
| Rental, 14 days | 3,200 |
| Promotion (10% off) | −320 |
| Rental after promotion | 2,880 |
| Pay now (booking fee, 10%) | 288 |
| Pay at shop | 2,592 |

## Vendor screens

The vendor dashboard is mobile-first with a Thai/English toggle; most daily actions also work from LINE buttons without opening it.

| Screen | Contents |
| --- | --- |
| Today | Pickups and returns today, pending requests with countdown, Ready-today confirm button, unpaid bookings |
| Bookings | List by status; booking detail with customer name, contact, dates, amount to collect, booking code; actions: accept, decline, picked up, returned, cancel |
| Calendar | Per-model view of booked units, buffers, down time and holiday closures (Instant models) |
| Fleet | The one-screen toggle table: Qty, Ready today, Down time per model; add model |
| Bike model editor | Specs, photos, booking mode, buffers, anchor prices + editable day table, visibility |
| Promotions | Create and pause promos: % off, ฿ off, long-rental discount, date window, new customers only; applies to all or chosen models |
| Shop settings | Profile, hours, holidays, contacts, deposit and document policy, delivery, cut-off, default buffers |
| Stats | Listing views, requests, confirmed bookings, amount to collect by week/month, response rate and speed, cancellation rate, ratings, top models |
| Team | Invite and remove staff accounts |

**Pickup confirmation:** the vendor enters or scans the customer's booking code and taps Picked up. Returned is tapped at the end, which triggers the review request.

## Admin screens and ranking

Admin controls which shops go live and how high they rank; BSR is ranked on the same rules as every other shop.

| Screen | Contents |
| --- | --- |
| Approval queue | New shops, flagged edits (new models, policy or price changes), approve / return with notes |
| Shops | All shops, status, boost level, stats, suspend |
| Bookings | Search any booking, override status, refund fee, resolve disputes |
| Finance | Fees collected by day/month/shop, scheduled pay-later charges, failed payments, refunds, cancellations and no-shows, Stripe/Omise payouts |
| Reviews | Flagged reviews, hide abusive ones |
| SEO pages | Generated area pages, edit intro text, publish/unpublish |

**Ranking score** (default sort for search)

| Factor | Weight (starting point) |
| --- | --- |
| Admin boost: Featured / Preferred / Normal | 30% |
| Rating (min 3 reviews, else neutral) | 20% |
| Response rate and speed on requests | 15% |
| Cancellation rate (lower is better) | 15% |
| Distance from search location | 20% |

Featured shops carry a visible badge. Weights are admin-adjustable settings.

## Notification templates

Vendors get LINE (with buttons) plus email; customers get email plus WhatsApp. Vendor messages are sent in the vendor's chosen language.

**To vendor**

| Trigger | Message | Buttons |
| --- | --- | --- |
| New request | New request #1234: Honda PCX 160 × 1, 3–17 Nov (14 days), pickup 10:00. Rental ฿2,880. Reply within 2 hours. | Accept · Decline |
| Delivery request | Delivery request #1234: PCX 160, 3 Nov 10:00 to [address], 4.2 km. Delivery fee ฿150 at handover. | Accept · Decline |
| Instant booking | New booking #1234 confirmed: PCX 160 × 1, 3–17 Nov. Payment due 31 Oct. | View |
| Fee paid | Booking #1234 paid. Customer paid ฿288 online. Collect ฿2,592 at pickup. | View |
| Get your bike now | Booking #1234: Click 125, pickup today 15:00. Paid ฿50. Collect ฿250. Ready today now 2. | View |
| Customer cancelled | Booking #1234 cancelled by customer. Bike released. | — |
| Daily reminder | Good morning. Ready today: Click 125 × 3, PCX 160 Out. Still correct? | Confirm · Edit |
| Down time ends | 1 × Click 125 back in service today. | View |

**To customer**

| Trigger | Message |
| --- | --- |
| Request sent | Request sent to [Shop]. They usually reply within 2 hours. No charge until they accept. |
| Confirmed | Booked! PCX 160 at [Shop], 3 Nov 10:00. Code: K7Q4. Pay ฿288 now or by 31 Oct; ฿2,592 at the shop. [Map] [WhatsApp] [LINE] |
| Request declined / expired | [Shop] couldn't take your request. Here are similar bikes nearby. [Link] |
| Payment reminder (PromptPay) | Pay ฿288 by tomorrow 10:00 to keep your booking. [Pay] |
| Card charge failed | We couldn't charge your card. Update it by [time] to keep your booking. [Update] |
| Day before pickup | Pickup tomorrow 10:00 at [Shop]. Bring: [documents/deposit]. Code: K7Q4. |
| After return | How was your PCX from [Shop]? [Leave a review] |

## Data model

Twelve core tables in Supabase (Postgres); availability is computed from bookings, buffers and down time rather than stored.

| Table | Key fields |
| --- | --- |
| users | id, role (customer/vendor_staff/admin), name, email, whatsapp, line_user_id, language, notify_channels |
| shops | id, name, slug, about, lat, lng, maps_url, nearest_station, whatsapp, line_id, status (draft/pending/live/suspended), boost_level, cutoff_minutes, buffer_before_h, buffer_after_h, request_window_min, delivery_enabled, delivery_radius_km |
| shop_members | shop_id, user_id, role (owner/staff) |
| shop_hours | shop_id, weekday, open, close |
| shop_closures | shop_id, start_date, end_date, note |
| shop_policies | shop_id, deposit_type, deposit_amount, licence_required, included_items, notes |
| delivery_zones | shop_id, max_km, fee |
| bike_models | id, shop_id, make, model, type, transmission, cc, photos, qty, booking_mode (instant/request), buffer_before_h, buffer_after_h, ready_today_count, ready_today_on, ready_today_updated_at, downtime_count, downtime_until, visible, flagged_for_review |
| price_days | bike_model_id, day (1–30), total, is_anchor, is_manual |
| promotions | id, shop_id, model_ids, kind (pct/fixed/long_rental/new_customer), value, min_days, start_date, end_date, active |
| bookings | id, code, customer_id, shop_id, bike_model_id, qty, start_at, end_at, mode (instant/request/now), delivery_address, delivery_fee, rental_total, promo_id, discount, rental_after_promo, fee, due_at_shop, status, payment_method, payment_due_at, stripe_customer_id, payment_method_id, paid_at, request_expires_at, cancelled_by, cancel_reason |
| reviews | booking_id, rating, text, hidden |

**Availability for an Instant model over a date range:** qty − downtime_count − max overlapping bookings where each booking is widened by buffer_before and buffer_after. Bookings that hold a unit: confirmed_unpaid, paid, picked_up, and pending_vendor only for delivery requests on Instant models. Ended statuses never hold a unit.

**Events log:** an append-only booking_events table (booking_id, at, actor, event, data) records every status change and message sent, for disputes and stats.

## Stack, integrations and scheduled jobs

Next.js on the front end and Supabase behind it cover the app; everything else is a managed service.

| Need | Tool |
| --- | --- |
| Web app, PWA, SEO pages | Next.js (server-rendered), hosted on Vercel |
| Database, auth, file storage | Supabase (Postgres, Auth, Storage) |
| Logins | Google, Apple, email magic link via Supabase Auth; LINE Login via custom OIDC provider |
| Cards, saved cards, Apple/Google Pay | Stripe (SetupIntent at booking, off-session charge later) |
| PromptPay | Stripe or Omise, dynamic QR + webhook |
| Vendor notifications | LINE Messaging API (Flex messages with buttons) |
| Customer notifications | Email via Resend; WhatsApp Business API (Meta Cloud API or Twilio) with approved templates |
| Maps, distance, station lookup | Google Maps JavaScript + Places APIs |

**Scheduled jobs**

| Job | Runs | Does |
| --- | --- | --- |
| Request expiry | Every 5 min | Expire requests past their window, notify customer, suggest alternatives |
| Pay-later charges | Hourly | Charge saved cards due in 3 days; send PromptPay links |
| Payment deadlines | Hourly | Retry failed cards; cancel unpaid bookings at deadline; notify both sides |
| Ready-today reminder | Daily at each shop's opening time | LINE confirm/edit message |
| Down time return | Daily 00:05 | Return units whose back-on date is today; notify vendor |
| Pickup reminders | Daily 18:00 | Day-before message to customers |
| Review requests | Hourly | After vendor taps Returned |
| SEO page refresh | Daily | Rebuild area pages from live listings |

## Vendor terms and launch checklist

Vendors pay nothing to join; in return they agree to four rules, and repeated breaches lower ranking or suspend the shop.

**Vendor terms**

1. Honour every confirmed booking.
2. Price parity: never charge app customers more at the counter than the app shows.
3. Keep Ready today and down time accurate.
4. Respond to requests and delivery approvals within the response window.

**SEO area pages**

- Auto-generated per area and city, e.g. "Scooter rental Sukhumvit", "Monthly motorbike rental Bangkok", "Automatic scooter rental Phra Khanong".
- Each lists live bikes and shops for that area, so content is always current; pages appear automatically when an area gets its first shop.
- thailandmotorbikeriders.org links in.

**Before launch**

- [ ] Choose platform name and register the domain
- [ ] Decide which company runs the platform
- [ ] Terms of service: booking platform, not the renter; damage disputes are between customer and shop
- [ ] Vendor agreement covering the four terms above
- [ ] PDPA privacy policy; no passport uploads stored
- [ ] Stripe account under the platform company; enable PromptPay (Stripe or Omise)
- [ ] LINE Official Account + Messaging API channel for vendors
- [ ] WhatsApp Business account and approved message templates
- [ ] Fee receipt template
- [ ] Onboard BSR Bike Shop as first vendor, then 5–10 shops in one area
- [ ] Test full flows: instant, request, delivery, get your bike now, pay later, failed card, cancellations
