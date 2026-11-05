# Motorbike Rental Marketplace — Product Spec

Oct 22, 2026 · Mark · Updated 3 Nov 2026 (owner decisions: per-model deposits, shop extras, date-window discounts, delivery minimum, no 6/12-month rates, bike catalog and model-first browsing, structured "What's included", referral program)

## Overview

A web-based marketplace where foreign customers find and book motorbikes from rental shops across Bangkok, then Thailand. Customers pay a 10% booking fee online (minimum ฿50) and pay the rest to the shop at pickup. The platform is branded separately from BSR; BSR Bike Shop is the first vendor.

**Core principles**

- Shops never have to maintain availability against their will: each bike model is either Instant (calendar) or Request (accept/decline on LINE).
- Vendor revenue never passes through the platform. The only money collected is the booking fee.
- One web app that works on phones and desktop: designed mobile-first, with full desktop layouts. Customers and vendors can install it on their phone home screen as a PWA (e.g. by scanning a QR on the website). Store apps (Google Play first, then the App Store) wrap the same web app later, so there is still one codebase.

| | Customer | Vendor | Admin |
| --- | --- | --- | --- |
| Access | Public website in 10 languages (English, Thai, Chinese, Russian, German, French, Spanish, Italian, Japanese, Korean) | /vendor dashboard, Thai/English toggle | /admin panel |
| Login | Google, LINE, Apple, email | LINE or Google; staff accounts under one shop | Google, restricted |
| Main jobs | Search, book, pay, contact shop, review | Bikes, availability, pricing, extras, promos, delivery, bookings, stats | Approve shops, bike catalog, ranking, refunds, finance, referral partners |
| Notified via | Email + WhatsApp | LINE + email | LINE |

**Open question:** platform name and the company that will run it.

## Vendor onboarding and shop setup

Every shop is hidden until admin approves it; after approval, major edits go live immediately but are flagged for admin review.

**Onboarding steps**

1. Vendor signs in with LINE or Google and creates a shop.
2. Vendor completes the shop profile, policies ("What's included", deposit and documents) and at least one bike model, picked from the bike catalog.
3. Vendor submits for review. Admin checks the shop is real, photos match, and prices and policies are complete.
4. Admin approves (shop goes live) or returns it with notes.
5. Vendor can invite staff accounts (e.g. a store manager) who can manage bookings and fleet but not payout or shop-ownership settings.

**Shop profile fields**

| Field | Notes |
| --- | --- |
| Name, about, photos | Shown on the shop page and shop listing pages |
| Location | Google Maps pin + Maps link; nearest BTS/MRT auto-detected. The vendor can link the shop's Google Business Profile (stored as its Google place ID) |
| Opening hours | Per weekday; pickups and returns only within hours |
| Holiday closures | Date ranges, optionally repeating every year on the same dates (e.g. Songkran); blocks pickups and returns |
| Contact | WhatsApp number and LINE ID; shown to customer only after confirmation |
| Same-day cut-off | Vendor-chosen, e.g. 2 hours before closing |
| Default buffers | Before pickup and after return, in hours; models can override |
| Request response window | Default 2 hours. The clock runs only during opening hours: a request made while the shop is closed starts counting when it next opens |

**What's included, deposit and documents** (structured fields, shown as a comparable block on model pages, shop listings and at checkout)

Each field below is a **shop default**. Any bike model can override any field (blank = use the shop default). Free text is limited to the notes field, so shops can be compared like for like.

| Group | Fields |
| --- | --- |
| Helmets | Number included; types offered (full-face / 3/4 / half, any combination) |
| Gear | Gloves, jacket, rain gear: each included / paid extra / not offered |
| Bike setup | Phone holder, USB charger, top box, side panniers (each yes/no) |
| Usage | Area allowed (Bangkok only / province / all Thailand / cross-border with bike passport); km limit or unlimited |
| Insurance | Compulsory third-party (always yes); medical cover (yes/no). Damage/theft cover is not an inclusion: a shop that offers it adds it as an extra with its own terms (see Extras), and the block shows "Damage/theft cover available as an extra" |
| Deposit | Amount (shop default; each bike model can set its own); method (cash / card authorisation / bank transfer); passport held or copy only; when it is refunded (optional) |
| Documents | Licence required (none / car / motorbike / international driving permit); minimum age; riding experience required |
| Notes | Free text, e.g. fuel policy, late return charges |

**Deposit per bike model:** the shop sets a default deposit amount and each bike model can override it. The model page, shop listing page and checkout always show the model's own amount.

**Extras** (shop-defined, optional)

Shops create their own paid extras, e.g. damage/theft cover, use outside Bangkok, riding jacket, bike passport.

| Field | Notes |
| --- | --- |
| Name, description | Shown at checkout and on the shop listing |
| Terms and conditions | Optional, e.g. the deductible and exclusions for damage/theft cover. Shown with the extra and accepted at checkout |
| Price | Whole baht. Either per rental (flat), or time-based. Time-based extras use the same rule as bike pricing: a 1-day price (required) and optional 7-day and 30-day prices, days in between filled at equal steps and rounded to the nearest ฿10, over 30 days by the over-30-days rule. With only a 1-day price, it is that price × days. Charged for the days rented, never rounded up to a whole week or month |
| Applies to | All models, or chosen models |
| Active | On/off toggle without deleting, like every other shop option |

- Customers tick extras at checkout. Extras appear in the price breakdown and are **paid at the shop**.
- The 10% platform fee applies to the rental only, never to extras.
- The vendor's booking notice lists the extras and includes them in the amount to collect.
- Extras chosen on a booking are copied onto the booking (name, unit, price, quantity, total), so later price edits never change existing bookings.

**Delivery** (optional)

- Delivery radius in km and fee: flat, or distance zones.
- Optional minimum rental length for delivery, in days (blank = deliver for any rental length).
- Every delivery booking needs vendor approval, including Instant models. Vendor checks address and time, then accepts or declines.
- Delivery fee is paid to the vendor at handover. The 10% platform fee applies to the rental only.

## Fleet management

Inventory is tracked per bike model with a quantity, not per individual bike, so a shop with six Honda Click 125s manages one row.

**Master bike catalog**

Admin maintains one catalog entry per make / model / year range. Shops never type specs; they pick a catalog entry and add their own offer on top.

| Catalog field | Values |
| --- | --- |
| Make, model, year range | e.g. Honda PCX 160, 2025– |
| Type | City/scooter, touring, adventure, sport, classic, off-road |
| Transmission | Automatic, semi-auto, manual |
| Engine size | cc (used for cc-range filter) |
| Features | ABS (yes/no), under-seat storage (yes/no), USB charger (yes/no), key type (keyless / keyed) |
| Description | Short neutral text |
| Stock photo | Licensed or admin's own photo. Until one exists, a neutral placeholder image. Never copy manufacturer or third-party images without a licence |

If a model is missing, the vendor submits a **catalog request**. Admin approves it (adding the stock photo) or rejects it.

**Bike model fields** (the shop's offer of one catalog entry)

| Field | Values |
| --- | --- |
| Catalog entry | Picked from the catalog; gives make, model, year range, type, transmission, cc, specs and stock photo |
| Photos | The shop's real photos: at least 1, up to 8 |
| Quantity | Total units owned |
| Deposit | Overrides the shop default deposit amount (blank = shop default) |
| What's included | Any field can override the shop default |
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

**Anchors:** 1 day (required), 7 days, 14 days, 21 days, 30 days (required). Blank optional anchors are skipped and the fill runs between the anchors that are set. There are no 6- or 12-month rates; long rentals use the over-30-days rule below.

**Fill rule:** for a day d between anchors a and b, price(d) = price(a) + (price(b) − price(a)) × (d − a) ÷ (b − a), rounded to the nearest ฿10. A day the vendor edits by hand is marked as manual and never overwritten when anchors change.

**Example** with anchors ฿300 / ฿1,800 / ฿3,200 / ฿4,400 / ฿5,500:

| Days | Totals (฿) |
| --- | --- |
| 1–7 | 300, 550, 800, 1,050, 1,300, 1,550, 1,800 |
| 8–14 | 2,000, 2,200, 2,400, 2,600, 2,800, 3,000, 3,200 |
| 15–21 | 3,370, 3,540, 3,710, 3,890, 4,060, 4,230, 4,400 |
| 22–30 | 4,520, 4,640, 4,770, 4,890, 5,010, 5,130, 5,260, 5,380, 5,500 |

**Over 30 days:** every bike model has a required **price per day after 30 days**. Days 31 onwards cost that much each, and each further 30 days never costs more than the 30-day price. Example with ฿5,500 for 30 days and ฿150/day after: 45 days = ฿5,500 + 15 × ฿150 = ฿7,750. (Time-based extras keep the older rule: full months × the 30-day price plus the remaining days from the table, capped at the 30-day price.)

**Validation:** the editor warns when a longer rental is cheaper than a shorter one, or when a day total is below the 1-day price.

**Order of calculation at checkout:** rental total from the table → minus promotion → booking fee = 10% of that (minimum ฿50) → amount due at shop = rental after promotion − booking fee + extras. Delivery fee is shown separately and paid at handover. Extras never count towards the booking fee.

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

**Vendor notice once paid:** "Booking #1234 paid. Customer paid ฿350 online. Collect ฿3,150 at pickup (+ delivery fee if applicable)." When the booking has extras, the notice lists them and the amount to collect includes them.

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
| Search results | **Model-first.** List + map toggle. One card per catalog model: stock photo, model, "From ฿X/day" (lowest live price for the chosen dates), "N shops near you", promo badge |
| Filters | Dates, bike type, transmission, cc range, price range, Get your bike now, delivery, passport not held, deals, rating |
| Sort | Recommended (ranking score, default), price, distance, rating |
| Model page | Catalog specs and stock photo; every shop offering that model, each with total price for the dates, distance, deposit, badges (Instant, Delivers, Ready today); comparable "What's included" block; map with only those shops pinned |
| Shop listing page | One shop's offer of one model, chosen after the model: the shop's real photos in a gallery, price table for chosen dates, "What's included", deposit and documents (prominent), extras, shop info + map, reviews, cancellation policy, Book button |
| Shop page | About, photos, hours, location, all models, reviews, and the shop's Google rating and reviews when linked (see below) |
| Checkout | Dates and times (within shop hours), pickup or delivery (address), extras (tick boxes), price breakdown: rental, promo, pay now (fee), pay at shop, extras (paid at shop), delivery fee; payment method; policy acceptance |
| Booking confirmation | Status, booking code, shop address + map, WhatsApp and LINE buttons (after confirmation), payment due date, cancel button |
| My bookings | Upcoming, pending requests, past; cancel; leave review |
| Account | Name, email, WhatsApp number, notification choice, saved cards |

**Google rating and reviews** (shop page and shop listing page)

- When a shop has linked its Google Business Profile, its pages show the overall Google star rating, the number of Google reviews and up to 5 Google reviews (the most Google's Places API returns), with a link to all reviews on Google Maps.
- Shown in a separate block from the platform's own reviews, with Google Maps attribution and each reviewer's name next to their review, as Google's Places policies require.
- Only the place ID is stored. Rating and reviews are fetched from Google when the page is shown, because Google doesn't allow storing them. For the same reason the Google rating doesn't feed the ranking score or the rating filter; those use platform reviews only.
- Not shown on search result cards, to keep API costs down.

**Price breakdown shown at checkout (example, 14 days)**

| Line | ฿ |
| --- | --- |
| Rental, 14 days | 3,200 |
| Promotion (10% off) | −320 |
| Rental after promotion | 2,880 |
| Pay now (booking fee, 10%) | 288 |
| Pay at shop | 2,592 |

With extras, each ticked extra is listed under "Pay at shop" (e.g. "Damage/theft cover, 14 days × ฿200 = ฿2,800") and added to the pay-at-shop total. The booking fee does not change.

## Vendor screens

The vendor dashboard is mobile-first with a Thai/English toggle; most daily actions also work from LINE buttons without opening it.

| Screen | Contents |
| --- | --- |
| Today | Pickups and returns today, pending requests with countdown, Ready-today confirm button, unpaid bookings |
| Bookings | List by status; booking detail with customer name, contact, dates, amount to collect, booking code; actions: accept, decline, picked up, returned, cancel |
| Calendar | Per-model view of booked units, buffers, down time and holiday closures (Instant models) |
| Fleet | The one-screen toggle table: Qty, Ready today, Down time per model; add model (pick from catalog, or request a missing model) |
| Bike model editor | Catalog entry (read-only specs), real photos, deposit override, "What's included" overrides, booking mode, buffers, anchor prices + editable day table, visibility |
| Extras | Create, edit and pause extras: name, description, price, unit (day / week / rental), all or chosen models |
| Promotions | Create and pause promos: % off, ฿ off, long-rental discount, date window, new customers only; applies to all or chosen models. A date-window discount (e.g. 20% off touring bikes 1 Apr – 30 Sep) applies only to the rental days that fall inside the window |
| Shop settings | Profile, hours, holidays, contacts, "What's included" defaults, deposit and documents, delivery (incl. minimum rental length), cut-off, default buffers |
| Stats | Listing views, requests, confirmed bookings, amount to collect by week/month, response rate and speed, cancellation rate, ratings, top models |
| Team | Invite and remove staff accounts |

**Pickup confirmation:** the vendor enters or scans the customer's booking code and taps Picked up. Returned is tapped at the end, which triggers the review request.

## Admin screens and ranking

Admin controls which shops go live and how high they rank; BSR is ranked on the same rules as every other shop.

| Screen | Contents |
| --- | --- |
| Approval queue | New shops, flagged edits (new models, policy, inclusion, extra or price changes), catalog requests; approve / return with notes |
| Shops | All shops, status, boost level, stats, suspend |
| Bike catalog | Add and edit catalog entries (specs, description, stock photo); approve or reject vendor catalog requests |
| Referral partners | Approve, suspend or edit partners; hold suspicious earnings; monthly payout run; referral rate setting; CSV export (see Referral program) |
| Bookings | Search any booking, override status, refund fee, resolve disputes |
| Finance | Fees collected by day/month/shop, scheduled pay-later charges, failed payments, refunds, cancellations and no-shows, Stripe/Omise payouts |
| Reviews | Flagged reviews, hide abusive ones |
| SEO pages | Generated area pages and model-per-city pages, edit intro text, publish/unpublish |

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
| New request | New request #1234: Honda PCX 160 × 1, 3–17 Nov (14 days), pickup 10:00. Rental ฿2,880. Extras: [list, if any]. Reply within 2 hours. | Accept · Decline |
| Delivery request | Delivery request #1234: PCX 160, 3 Nov 10:00 to [address], 4.2 km. Delivery fee ฿150 at handover. | Accept · Decline |
| Instant booking | New booking #1234 confirmed: PCX 160 × 1, 3–17 Nov. Payment due 31 Oct. | View |
| Fee paid | Booking #1234 paid. Customer paid ฿288 online. Collect ฿2,592 at pickup (incl. extras: [list, if any]). | View |
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

Core tables in Supabase (Postgres); availability is computed from bookings, buffers and down time rather than stored. Every amount is a whole number in the shop's currency (THB at launch); shops and bookings carry country and currency so other countries can be added later without a second site. The build's actual table and column names are recorded in `docs/decisions.md` where they differ from this list.

| Table | Key fields |
| --- | --- |
| users | id, role (customer/vendor_staff/admin), name, email, whatsapp, line_user_id, language, notify_channels |
| shops | id, name, slug, about, lat, lng, maps_url, nearest_station, whatsapp, line_id, status (draft/pending/live/suspended), boost_level, cutoff_minutes, buffer_before_h, buffer_after_h, request_window_min, delivery_enabled, delivery_radius_km, delivery_min_days (null = any length), google_place_id, country (ISO code, default TH), currency (ISO code, default THB) |
| shop_members | shop_id, user_id, role (owner/staff) |
| shop_hours | shop_id, weekday, open, close |
| shop_closures | shop_id, start_date, end_date, note, repeats_yearly |
| shop_policies | shop_id, the structured "What's included", deposit and documents fields as shop defaults (incl. deposit_amount), notes |
| bike_catalog | id, make, model, year_from, year_to, type, transmission, cc, abs, underseat_storage, usb_charger, key_type (keyless/keyed), description, stock_photo, status (requested/approved/rejected), requested_by_shop_id |
| delivery_zones | shop_id, max_km, fee |
| bike_models | id, shop_id, catalog_id, photos, qty, deposit_amount (null = shop default), price_after_30, booking_mode (instant/request), buffer_before_h, buffer_after_h, ready_today_count, ready_today_on, ready_today_updated_at, downtime_count, downtime_until, visible, flagged_for_review |
| bike_model_policies | bike_model_id, the same "What's included", deposit and documents fields as shop_policies, all nullable (null = shop default) |
| price_days | bike_model_id, day (1–30), total, is_anchor, is_manual |
| shop_extras | id, shop_id, name, description, terms, price_kind (rental/time), price_rental, price_1d, price_7d, price_30d, all_models, active |
| shop_extra_models | extra_id, bike_model_id (when the extra applies to chosen models) |
| promotions | id, shop_id, model_ids, kind (pct/fixed/long_rental/date_window/new_customer), value, min_days, start_date, end_date, active |
| bookings | id, code, customer_id, shop_id, bike_model_id, qty, start_at, end_at, mode (instant/request/now), delivery_address, delivery_fee, rental_total, promo_id, discount, rental_after_promo, fee, extras_total, due_at_shop, currency (copied from the shop), status, payment_method, payment_due_at, stripe_customer_id, payment_method_id, paid_at, request_expires_at, cancelled_by, cancel_reason |
| booking_extras | booking_id, extra_id, name, unit, price, quantity, total (copied at booking) |
| reviews | booking_id, rating, text, hidden |
| referral tables | referral_partners, referral_scans, referral_earnings, referral_payouts, profiles.referred_by_partner_id / referred_at, admin setting referral_rate (see Referral program) |

**Availability for an Instant model over a date range:** qty − downtime_count − max overlapping bookings where each booking is widened by buffer_before and buffer_after. Bookings that hold a unit: confirmed_unpaid, paid, picked_up, and pending_vendor only for delivery requests on Instant models. Ended statuses never hold a unit.

**Events log:** an append-only booking_events table (booking_id, at, actor, event, data) records every status change and message sent, for disputes and stats.

## Referral program

Customer referrals only; there are no shop referrals. Partners (hotels, condos, coworking spaces, guides, influencers) earn a share of the platform's booking fee on every booking by customers they refer, for life.

**Partners**

- Partners apply; admin approves. Each partner gets one code with a link (`/r/<code>`) and a QR code.
- Printable kit: a downloadable, branded table stand and sticker (PDF/PNG) containing the partner's QR.
- Terms wording shown to partners: "Earn a share of our booking fee on every booking from customers you refer, for life. The current rate is 50%. We may change the rate in future; any change applies only to bookings paid after the change."

**Attribution (invisible to the customer)**

- Scanning or opening the link shows the normal homepage. The code is stored in a first-party cookie and never shown, and there is no customer discount.
- When a customer with no partner signs up or books, they are linked to the partner from their cookie, permanently. Every future booking by that customer credits that partner.
- First partner wins; later scans of other codes don't change it.
- No self-referral: a partner earns nothing on their own bookings (same user, email or card).

**Earnings**

- Payout rate is an admin setting, `referral_rate`, currently **50%** of the booking fee. A change applies to fees paid after the change; each earning stores the rate it was created with.
- An earning is created and approved as soon as the booking fee is paid (normally 3 days before pickup, or at booking). No wait for pickup or return.
- If a paid fee is later refunded (e.g. vendor cancels), the matching earning is reversed. If it was already paid out, the amount is deducted from the partner's next payout.
- Earning statuses: approved, held (admin), reversed, paid.

**Partner dashboard:** scans, sign-ups, bookings, upcoming earnings (booked, fee not yet paid), earned balance, payout history, current referral rate, QR and kit download. Partners see booking dates and amounts only, never customer names or contacts.

**Admin:** approve, suspend or edit partners; hold suspicious earnings; monthly payout run listing approved balances of ฿500 or more. Payouts are made by PromptPay or bank transfer outside the app, then marked paid in admin. CSV export for the books. Withholding tax is not built now; payouts carry a nullable `withholding_amount` for later.

**Data:** `referral_partners` (user_id, code, status, payout PromptPay/bank details), `referral_scans`, `referral_earnings` (booking_id, partner_id, fee, rate, amount, status, payout_id), `referral_payouts` (incl. withholding_amount), admin setting `referral_rate`, `profiles.referred_by_partner_id` and `referred_at`.

**PDPA:** the privacy policy mentions referral tracking.

## Stack, integrations and scheduled jobs

Next.js on the front end and Supabase behind it cover the app; everything else is a managed service.

| Need | Tool |
| --- | --- |
| Web app, PWA, SEO pages | Next.js (server-rendered), hosted on Netlify |
| Database, auth, file storage | Supabase (Postgres, Auth, Storage) |
| Logins | Google, Apple, email magic link via Supabase Auth; LINE Login via custom OIDC provider |
| Cards, saved cards, Apple/Google Pay | Stripe (SetupIntent at booking, off-session charge later) |
| PromptPay | Stripe or Omise, dynamic QR + webhook |
| Vendor notifications | LINE Messaging API (Flex messages with buttons) |
| Customer notifications | Email via Resend; WhatsApp Business API (Meta Cloud API or Twilio) with approved templates |
| Maps, distance, station lookup | Google Maps JavaScript + Places APIs |
| Installable app | PWA (web manifest, service worker, web push); later Google Play (Trusted Web Activity) and App Store (native wrapper) builds of the same web app |
| Analytics and ad conversions | Google Analytics 4 and Google Ads conversion tracking via the Google tag, behind cookie consent; fee-paid conversions sent from the server |

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
- One page per catalog model per city, e.g. "Rent a Honda PCX 160 in Bangkok", listing every live shop offering that model.
- thailandmotorbikeriders.org links in.

**AI search visibility**

- robots.txt allows the main AI search crawlers; pages are server-rendered and readable without JavaScript.
- Model and area pages carry short FAQ blocks (deposit, licence, insurance, riding outside Bangkok) with FAQ structured data.
- The site is verified in Google Search Console and Bing Webmaster Tools, with the sitemap submitted to both.

**Analytics and conversions**

- Google Analytics 4 and a dedicated Google Ads account for the platform (separate from BSR's), through the Google tag with consent mode and a cookie banner (PDPA, and GDPR for European visitors).
- Conversions: request sent, booking confirmed, booking fee paid (value = fee). Fee-paid conversions fire from the server when the charge succeeds, because most fees are charged 3 days before pickup, not on the website.

**Before launch**

- [ ] Choose platform name and register the domain
- [ ] Decide which company runs the platform
- [ ] Terms of service: booking platform, not the renter; damage disputes are between customer and shop
- [ ] Vendor agreement covering the four terms above
- [ ] PDPA privacy policy (mentions referral tracking); no passport uploads stored
- [ ] Referral partner terms
- [ ] Stripe account under the platform company; enable PromptPay (Stripe or Omise)
- [ ] LINE Official Account + Messaging API channel for vendors
- [ ] WhatsApp Business account and approved message templates
- [ ] Fee receipt template
- [ ] Onboard BSR Bike Shop as first vendor, then 5–10 shops in one area
- [ ] Test full flows: instant, request, delivery, get your bike now, pay later, failed card, cancellations, extras, referral attribution and payout
- [ ] Licensed or own stock photos for every catalog model in use
