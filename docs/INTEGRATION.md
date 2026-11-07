# Integration: Bike-Booking marketplace ↔ Mango Works platform

Status: draft for review, 7 Nov 2026. Source of truth for the types: `lib/data/types.ts`.

Bike-Booking is the customer marketplace. **Mango Works** is the rental-management platform that owns shop data: shops, bike models and units, prices, availability, bookings and payments to shops. The marketplace reads and writes that data only through one adapter, `lib/data/`. Today the adapter reads this project's own database (`lib/data/current-db.ts`, temporary). When the Mango Works API exists, the adapter calls it instead, with the same functions and types, and no page changes.

This document lists every adapter function, what it needs from Mango Works, and the rules Mango Works must apply so customers see the same answers they see today.

## 1. Who owns what

| Data or rule | Owner | Notes |
| --- | --- | --- |
| Shops: profile, photos, location, hours, closures, contacts, Google place ID | Mango Works | |
| Bike catalog (make, model, years, cc, type, specs, stock photo) | Mango Works | Shared across shops; shops pick an entry |
| Listings (a shop's offer of one catalog model): quantity, Instant/Request/walk-ins split, photos, deposit, "What's included", extras | Mango Works | |
| Prices: day table 1–30, price per day after 30 days | Mango Works | §4.2 |
| Availability: bookings, buffers, units out of service, notice, minimum days, ready-for-walk-ins | Mango Works | §4.3–4.5 |
| Bookings (orders), status changes, double-booking protection | Mango Works | Orders from here have `channel = "marketplace"` |
| Payments to shops (the rest of the rental, deposits) | Mango Works | Under each shop's own settings |
| Customer accounts and login (LINE, Google, email) | Marketplace | Customer details are sent with each booking |
| Booking fee: 10% of the rental after promotions, min ฿50 | Marketplace | Stripe Connect application fee, marketplace bookings only |
| Ranking: boost levels, weights, the score | Marketplace | Shop signals come from Mango Works (§3.10) |
| Stations (BTS/MRT/ARL/SRT Red) | Marketplace | Admin-editable, from OpenStreetMap |
| Referral program, SEO pages, analytics | Marketplace | |
| Marketplace reviews | Open question | §6 |

## 2. Conventions

- **IDs** are opaque strings (UUIDs today). Slugs are URL-safe and stable; changing one breaks links.
- **Money** is a whole number of baht (`int`), never fractions. Every shop is THB for now; a `currency` field will follow when another country starts.
- **Times** are ISO 8601 instants in UTC. Every business rule (opening hours, "today", cut offs, closures) runs in **Asia/Bangkok** (UTC+7, no daylight saving).
- **Images** are absolute URLs: a full-size one (longest edge about 1,600 px) and a thumbnail (about 480 px) for cards. A placeholder URL is fine when a shop has no photo.
- **Shop-written text** (about, notes, extras) comes in the language the shop wrote it in. The marketplace translates its own interface only.
- **Errors:** "not found" returns `null`; a booking that's no longer possible must say why (§3.12).
- **Freshness:** shop data may be cached by the marketplace for up to a few minutes. Search, availability and quotes are always live.

## 3. Adapter functions

| Function | Used by | Owner of the data |
| --- | --- | --- |
| `listStations()` | Home, search (location picker) | Marketplace |
| `getRankingWeights()` | Search ranking | Marketplace |
| `listFeaturedShops()` | Home | Boost: marketplace; shop summary: Mango Works |
| `getShopBySlug(slug)`, `getShopById(id)` | Shop page, listing page, Google reviews | Mango Works |
| `getCatalogModel(slug)` | Model page, listing page | Mango Works |
| `searchOffers(query)` | Search, model page, shop page, listing page | Mango Works |
| `getListing(shopId, catalogId)` | Listing page, model page comparison | Mango Works |
| `getAvailability(listingId, start, end)` | Checkout (booking phases) | Mango Works |
| `getQuote(listingId, start, end)` | Checkout (booking phases) | Mango Works |
| `getShopSignals(shopIds)` | Search ranking | Mango Works |
| `listShopReviews(shopId)` | Shop and listing pages | Open (§6) |
| `createBooking(booking)` | Checkout (booking phases) | Mango Works |
| `getBooking(id)` | Booking confirmation, My bookings (booking phases) | Mango Works |

The marketplace-owned functions stay on the marketplace's own database after the switch; they're behind the adapter so the UI has one door.

### 3.1 `listStations(): Station[]` (marketplace)
`{ id, nameEn, nameTh, lines[], lat, lng }`. Not needed from Mango Works.

### 3.2 `getRankingWeights(): RankingWeights` (marketplace)
`{ boost, rating, response, cancellation, distance }`, the admin's weights (default 0.30 / 0.20 / 0.15 / 0.15 / 0.20).

### 3.3 `listFeaturedShops(): ShopSummary[]`
Shops the marketplace admin marked "featured" (boost lives in the marketplace). Needs from Mango Works, by shop ID: `{ id, slug, name, nearestStation, thumbUrl }`, live shops only.

### 3.4 `getShopBySlug(slug)` / `getShopById(id): Shop | null`
Needs: `id, slug, name, about, photoUrls[], thumbUrl, location {lat, lng}, mapsUrl, nearestStation, googlePlaceId, hours[] {weekday 0=Sun…6, open "HH:MM", close "HH:MM"}, closures[] {startDate, endDate, note, repeatsYearly}`. Only shops that are live on the marketplace; `null` otherwise. Contact details (WhatsApp, LINE, phone, email) are **not** returned here: they're shown only after a booking is confirmed (booking phases).

### 3.5 `getCatalogModel(slug): CatalogModel | null`
Needs: `id, slug, make, model, yearFrom, yearTo, cc, type (city_scooter | touring | adventure | sport | classic | off_road), transmission (automatic | semi_auto | manual), abs, underseatStorage, usbCharger, keyType (keyless | keyed), description, photoUrl, thumbUrl`. Unknown features are `null`. Only approved catalog entries.

### 3.6 `searchOffers(query): Offer[]`
The main search. One result per **listing** (a shop's offer of one catalog model) that can be rented for the query. The marketplace groups them into one card per model and ranks them itself, so Mango Works returns them unranked.

Query:
| Field | Meaning |
| --- | --- |
| `near {lat, lng}` | Search location; distance is measured from here |
| `radiusKm` | Only shops within this distance (marketplace sends 15 km, or none for "show further") |
| `start`, `end` | Advance booking dates; both or neither |
| `now` | Walk-ins: bikes ready to ride away now (§4.5); `end` may set the length |
| `type`, `transmission`, `ccMin`, `ccMax` | Catalog filters |
| `maxPricePerDay` | `ceil(total / days)` at most this |
| `passportNotHeld` | Only listings whose passport policy is "copy only" |
| `catalogId`, `shopId` | One model (model page) or one shop (shop and listing pages) |

Each `Offer`:
| Field | Meaning |
| --- | --- |
| `listingId` | Stable ID used for availability, quotes and bookings |
| `shop {id, slug, name, location}` | |
| `model {id, slug, make, model, yearFrom, yearTo, cc, type, transmission, thumbUrl}` | The catalog entry |
| `thumbUrl` | The shop's own photo of this bike |
| `distanceKm` | From `near`; `null` without a location |
| `days`, `total`, `perDay` | Price for the query: `days` by §4.1 (1 with no dates; walk-ins: `end` or the walk-in minimum), `total` by §4.2, `perDay = ceil(total / days)` |
| `deposit` | The listing's deposit (listing override, else shop default); `null` = no money deposit |
| `mode` | `instant` / `request` for advance bookings (§4.4), `now` for walk-ins, `null` = not bookable for these dates |
| `freeUnits` | Units free for the whole period |
| `readyNow`, `readyUpdatedAt` | Ready-for-walk-ins flag and when the shop last set it |
| `walkinMaxDays` | Walk-ins: the longest rental possible from now (§4.5) |
| `boost` | Marketplace data: today read with the shop; after the switch the marketplace adds it |

What a listing must satisfy to be returned (today's rules, §4):
- The shop is live, the listing is visible, it has at least one photo, its catalog entry is approved, and it has a full price table plus a price per day after 30 days.
- **With dates:** the listing can be booked in advance for them (`mode` not `null`), the rental is at least the advance-booking minimum days, the pickup is at least the minimum notice from now, and the shop is open at both the pickup and the return time (hours and closures, §4.6).
- **Walk-ins (`now`):** §4.5.
- **No dates:** the listing takes advance bookings (Instant or Request units) or is ready for walk-ins.

### 3.7 `getListing(shopId, catalogId): Listing | null`
Needs: `listingId, photoUrls[], deposit, dayPrices[30] (totals for 1…30 days), pricePerDayAfter30, inclusions, extras[]`.
- `inclusions`: the shop's "What's included" defaults with this listing's overrides applied (helmets and helmet types, gloves, jacket, rain gear, phone holder, USB charger, top box, side panniers, riding area, km limit, medical cover, deposit methods, passport policy, licence, minimum age, experience, notes). Field list: `lib/inclusions.ts`.
- `extras[]`: `{ id, name, description, terms, price }` with `price` either `{ kind: "rental", amount }` or `{ kind: "time", perDay, per7Days, per30Days }`; only active extras that apply to this listing.

### 3.8 `getAvailability(listingId, start, end): Availability`
`{ freeUnits, mode, walkinMaxDays }` by §4.3–4.5. Used at checkout to re-check just before booking.

### 3.9 `getQuote(listingId, start, end): Quote | null`
`{ days, total, perDay }` by §4.1–4.2. **Booking phases add:** promotions (`discount`, `rentalAfterPromotion`) and extras totals, since the marketplace fee is 10% of the rental after promotions. `null` if the listing can't be priced.

### 3.10 `getShopSignals(shopIds): ShopSignals[]`
What the marketplace ranks shops by. One entry per shop:
| Field | Definition |
| --- | --- |
| `rating` | Average 1–5 of reviews (§6); `null` if none |
| `reviewCount` | Number of reviews; the marketplace treats fewer than 3 as neutral |
| `responseRate` | Of Request bookings that have been answered or expired: the share not expired, 0–1; `null` if none |
| `cancellationRate` | Of confirmed bookings (confirmed, paid, picked up, returned, cancelled, no-show): the share the shop cancelled, 0–1; `null` if none |

Useful later, if Mango Works can supply them: median response time (minutes), and how recently the shop updated its walk-in stock. Should signals count all channels or only marketplace bookings? (§6)

### 3.11 `listShopReviews(shopId): Review[]`
`{ rating 1–5, text, createdAt }`, newest first, hidden reviews excluded. See §6.

### 3.12 `createBooking(booking): Booking` (booking phases)
Input (`NewBooking`):
| Field | Meaning |
| --- | --- |
| `listingId`, `start`, `end` | What and when |
| `kind` | `instant`, `request` or `now`, as offered by `getAvailability` |
| `extraIds[]` | Extras the customer ticked (paid at the shop) |
| `customer {name, email, phone, nationality, lineId}` | Mango Works keeps a customer record per shop |
| `customerAccountId` | The marketplace account, for "My bookings" |
| `payment` | Today `{ kind: "fee_only", fee, currency }`: the customer pays only the marketplace fee online (10% of the rental after promotions, min ฿50), charged 3 days before pickup (at booking if pickup is within 3 days); the rest is paid to the shop under its own settings. Later possibly `{ kind: "full", amount, fee, currency }`: full online payment through Stripe Connect with the fee as the application fee |
| `referralCode` | For the marketplace referral program; Mango Works only stores it |
| `channel` | Always `"marketplace"` |

Mango Works must **recheck price and availability** and refuse with a reason if the booking no longer fits: `unavailable`, `price_changed` (with the new quote), `outside_hours`, `too_short`, `too_soon`. It must prevent double bookings (today: a database transaction that locks the listing before checking).

Output (`Booking`): `{ id, code (6 characters, no 0/O/1/I), status, listingId, shopId, start, end, kind, rentalTotal, fee, dueAtShop, requestExpiresAt, paymentDueAt }`.

### 3.13 `getBooking(id): Booking | null` (booking phases)
The booking as above, current status. The marketplace also needs, in the booking phases:
- `listCustomerBookings(customerAccountId)` for My bookings;
- `cancelBooking(id, by, reason)`;
- **events from Mango Works to the marketplace** (webhook), signed: `booking.accepted`, `.declined`, `.expired`, `.cancelled` (by whom), `.picked_up`, `.returned`, `.no_show`. The marketplace uses them to charge or refund the fee, send customer messages, ask for reviews and count referral earnings;
- a "shop data changed" event (optional) so cached shop pages refresh sooner.

## 4. Rules Mango Works must match

These are what the temporary implementation does today. Unit-tested TypeScript versions are in `lib/` (named below); the SQL versions in `supabase/migrations/20261107000200_search.sql` follow them, and `tests/db/search.test.ts` checks both give the same answers.

### 4.1 Rental days (`lib/rental-days.ts`)
Every started 24 hours is a day: `days = max(1, ceil((end − start) / 24 h))`. 10:00 Mon → 10:00 Tue is 1 day; → 10:00 Wed is 2 days; → 10:30 Tue is 2 days. There is no grace period on the price; the time a bike needs between rentals is the shop's buffer after return.

### 4.2 Price for a number of days (`lib/pricing.ts`, `priceForDays` with `dailyAfter30`)
- Each listing has a total for every length from 1 to 30 days. Shops enter anchors (1 and 30 days required, 7/14/21 optional); the days between are filled at equal steps, rounded to the nearest ฿10, and any single day can be edited by hand.
- Up to 30 days: the table's total.
- Over 30 days: `price(30) + floor(e / 30) × min(30 × rate, price(30)) + min((e mod 30) × rate, price(30))`, where `e = days − 30` and `rate` is the listing's required price per day after 30 days. Example: ฿5,500 for 30 days and ฿150/day after → 45 days = ฿7,750, 60 days = ฿10,000.

### 4.3 Units free for a period (`lib/availability.ts`, `offerFor`)
Bikes are a pool: no booking is tied to a particular bike. For a period from `start` to `end`:
1. Widen the period and every booking by the listing's buffers (before pickup, after return; listing value, else shop default).
2. Bookings that hold a unit: `confirmed_unpaid`, `paid`, `picked_up` (later also pending delivery requests on Instant units).
3. Units out of service: each entry has a count and an optional back-in-service date; units count as out on every Bangkok date before that date (no date = until removed).
4. `freeUnits = quantity − the most units held plus out of service at any moment in the widened period`.

If the busiest moment has a unit free, the bookings always fit without anyone changing bikes mid-rental, as long as bikes aren't promised in advance and are handed over in pickup order.

### 4.4 Instant or Request (`offerFor`)
Each listing's quantity is split into Instant units, Request units, and walk-ins-only units (the rest, never booked in advance). For an advance booking with at least one free unit:
- **Instant** if Instant bookings overlapping the period are fewer than the Instant units;
- else **Request** if Request bookings overlapping are fewer than the Request units;
- else not bookable in advance (`mode = null`).

Request bookings are accepted or declined by the shop within its reply window (at most 4 hours, counted in opening hours only); dates already full from bookings can't be requested.

### 4.5 Walk-ins, "Get your bike now" (`longestWalkIn`)
A listing is offered for walk-ins now when:
- it's marked ready for walk-ins with a count of at least 1;
- the shop is open now and it's before closing minus the shop's booking cut off;
- the rental (the customer's chosen length, else the walk-in minimum days) is at least the walk-in minimum days;
- and it ends before the listing's next booking needs a unit. `walkinMaxDays` = the most whole days from now with a unit free throughout (capped at 90).

Walk-ins skip the minimum notice. A walk-in booking holds a unit like any booking, and reduces the ready count by 1; the shop adds it back when the bike is ready again.

### 4.6 Opening hours, closures, notice, minimum days
- Pickups and returns must fall within the shop's hours for that Bangkok weekday, and not on a closure date. A closure that repeats yearly matches the same month and day every year from its first year, including closures that run over New Year (`lib/closures.ts`).
- Advance bookings start at least the minimum notice (hours) after now; walk-ins skip it.
- Minimum rental days: one value for walk-ins, one for advance bookings. Listing value, else shop default.

### 4.7 Deposit and inclusions
The deposit shown is the listing's own amount, else the shop default (`null` = no money deposit). "What's included" is the shop's defaults with the listing's overrides applied (`lib/inclusions.ts`).

## 5. Booking statuses (from SPEC.md)
`pending_vendor` → `confirmed_unpaid` (accepted) | `declined` | `expired` (no reply in the window);
`confirmed_unpaid` → `paid` (fee charged 3 days before pickup) | `cancelled_customer` | `cancelled_vendor` | `cancelled_unpaid` (fee payment deadline missed);
`paid` → `picked_up` | `cancelled_customer` | `cancelled_vendor` | `no_show`;
`picked_up` → `returned`.
Instant bookings start at `confirmed_unpaid`; Request bookings at `pending_vendor`; walk-ins and pickups within 3 days start at `paid` (fee charged at booking).

The fee belongs to the marketplace, so fee-related transitions (`paid`, `cancelled_unpaid`, fee refunds) are driven by the marketplace's Stripe events and reported to Mango Works; everything else is driven by Mango Works and reported back by events (§3.13). To be confirmed with the Mango Works design.

## 6. Open questions for Mango Works
1. **Reviews:** does the marketplace own reviews of marketplace bookings (written here after `booking.returned`), or does Mango Works hold all reviews?
2. **Signals:** should response and cancellation rates count all of a shop's bookings, or marketplace bookings only?
3. **Which shops are on the marketplace:** does Mango Works expose a per-shop "listed on marketplace" switch, and who approves a shop for the marketplace?
4. **Stripe Connect:** does each shop's connected account live in Mango Works (marketplace charges the fee as an application fee on it), or does the marketplace onboard shops to Connect itself?
5. **Promotions** (Phase 7): Mango Works prices them; the quote must return the discount so the fee is 10% of the rental after promotions.
6. **Delivery** (Phase 7): fees and zones are shop settings in Mango Works; delivery requests always need the shop's acceptance.
7. **Search at scale:** today search filters and prices every listing per request. The API may need a precomputed index; the response shape above stays the same.

## 7. Where the temporary implementation reads from (for reference)
`lib/data/current-db.ts` on this project's Supabase database: tables `shops`, `shop_hours`, `shop_closures`, `shop_policies`, `bike_catalog`, `bike_models`, `bike_model_policies`, `bike_model_downtime`, `price_days`, `shop_extras`, `reviews`, `ranking_settings`, `stations`; functions `search_offers`, `model_offer`, `longest_walkin`, `rental_days`, `rental_price`, `shop_stats`, `shop_coordinates`, `station_list`. `createBooking` and `getBooking` are stubs until the booking phases.
