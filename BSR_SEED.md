# BSR_SEED.md

Input for Phase 2: owner decisions that change the spec, and the real BSR Bike Shop data for the seed. BSR data comes from bsrbikeshop.com (read 3 Nov 2026) plus the owner's answers.

## Part 1: Spec changes (owner decisions, 3 Nov 2026)

Apply these to `SPEC.md` and `BUILD_PLAN.md` in the repo, record them in `docs/decisions.md`, and include them in the Phase 2 plan.

1. **Deposit per bike model.** The shop sets a default deposit amount; each bike model can override it. Bike page and checkout show the model's own amount. Data: `bike_models.deposit_amount` (null = shop default). Build in Phase 2.
2. **Shop-defined extras.** Shops create their own paid extras (e.g. damage/theft cover, use outside Bangkok, riding jacket, bike passport).
   - Fields: name, description, price, unit (per day / per week / per rental), applies to all models or chosen models, active.
   - Customers tick extras at checkout. Extras appear in the price breakdown and are paid at the shop.
   - The 10% platform fee applies to the rental only, not extras.
   - The vendor's booking notice lists the extras and includes them in the amount to collect.
   - Data: `shop_extras` (id, shop_id, name, description, price, unit, active) + `shop_extra_models` join, and `booking_extras` (booking_id, extra_id, name, unit, price, quantity, total), copied at booking so later price edits don't change existing bookings.
   - Build: vendor Extras screen in Phase 2; checkout selection, totals and notices in Phase 4.
3. **Date-based discounts.** Vendors can discount chosen models for a date window (e.g. 20% off touring bikes 1 Apr – 30 Sep). This is the existing "date window" promotion kind. The discount applies only to rental days that fall inside the window. Build in Phase 7 with promotions.
4. **Delivery minimum rental length.** Optional per-shop setting (blank = deliver for any length). Data: `shops.delivery_min_days`. Build with delivery in Phase 7.
5. **No 6- or 12-month rates.** Pricing stays as in SPEC (anchors up to 30 days, then full months).
6. **Master bike catalog and model-first browsing.** Build the catalog and vendor model picker in Phase 2, and the model-first search in Phase 3.
   - Admin maintains a catalog: one entry per make/model/generation with stock photo, cc, transmission, type, short specs (seat height, fuel tank, weight) and description. Data: `bike_catalog`.
   - Vendors add bikes by **picking a catalog entry**, then set their own quantity, prices, deposit, booking mode, buffers and real photos. `bike_models` gets `catalog_id`. If a model is missing, the vendor submits a catalog request; admin approves it and adds the stock photo.
   - Until real stock photos exist, use a neutral placeholder image. Never copy manufacturer or third-party images without a licence.
   - **Search results:** one card per catalog model, with stock photo, "From ฿X/day" (lowest live price for the chosen dates), and "N shops near you". Default sort is ranking.
   - **Model page:** all shops offering that model, each with total price for the dates, distance, deposit, badges (Instant, Delivers, Ready today), and a map with only those shops pinned.
   - **Shop listing page:** chosen after the model. Shows the shop's real photos in a gallery, "What's included", policies, extras and the Book button.
   - **SEO:** one page per catalog model per city, e.g. "Rent a Honda PCX 160 in Bangkok".
7. **Structured "What's included".** Replace free-text inclusions with fixed fields. Each field is a shop default; any bike model can override it. Show them as a comparable block on model pages and shop listings. Build in Phase 2.
   - Helmets: number included; type (full-face / 3/4 / half); sizes available.
   - Gear: gloves, jacket, rain gear, each included / paid extra / not offered.
   - Bike setup: phone holder, USB charger, top box, side panniers.
   - Usage: area allowed (Bangkok only / province / all Thailand / cross-border with bike passport); km limit or unlimited.
   - Insurance: compulsory third-party (always yes); medical cover (yes/no); damage/theft (included / optional extra with price and deductible / none).
   - Deposit: amount; method (cash / card authorisation / bank transfer); passport held or copy only; when it is refunded.
   - Documents: licence required; minimum age; riding experience required.
8. **Referral program (customer referrals only).** New phase after Phase 5 (it needs paid booking fees).
   - **Partners** (hotels, condos, coworking, guides, influencers) apply. Admin approves. Each partner gets one code with a link (`/r/<code>`) and a QR code.
   - **Printable kit:** downloadable, branded table stand and sticker (PDF/PNG) containing the partner's QR.
   - **Invisible to the customer:** scanning opens the normal homepage. The code is stored in a first-party cookie and never shown, and there is no discount.
   - **Lifetime attribution:** when a customer with no partner signs up or books, they are linked to the partner from their cookie, permanently. Every future booking by that customer credits that partner. First partner wins; later scans of other codes don't change it. Data: `profiles.referred_by_partner_id`, `referred_at`.
   - **Payout rate:** an admin setting, `referral_rate`, currently **50%** of the platform booking fee. Admin can change it at any time. A change applies to fees paid after the change; earnings already recorded keep the rate they were created with (store `rate` on each earning).
   - **When it's earned:** as soon as the booking fee is paid (normally 3 days before pickup, or at booking). The earning is approved at that moment; no need to wait for pickup or return.
   - **Refunds:** if a paid fee is later refunded (e.g. vendor cancels), the matching earning is reversed. If it was already paid out, the amount is deducted from the partner's next payout.
   - **Partner terms wording:** "Earn a share of our booking fee on every booking from customers you refer, for life. The current rate is 50%. We may change the rate in future; any change applies only to bookings paid after the change."
   - **No self-referral:** a partner earns nothing on their own bookings (same user, email or card).
   - **Partner dashboard:** scans, sign-ups, bookings, upcoming earnings (booked, fee not yet paid), earned balance, payout history, current referral rate, QR and kit download. Partners see booking dates and amounts only, never customer names or contacts.
   - **Admin:** approve, suspend or edit partners; hold suspicious earnings; monthly payout run listing approved balances of ฿500 or more. Payout is by PromptPay or bank transfer made outside the app, then marked paid in admin. Export CSV for the books.
   - **Data:** `referral_partners` (user_id, code, status, payout PromptPay/bank details), `referral_scans`, `referral_earnings` (booking_id, partner_id, fee, rate, amount, status approved/held/reversed/paid, payout_id), admin setting `referral_rate`, `referral_payouts`.
   - Withholding tax: not built now. Leave a nullable `withholding_amount` on payouts for later.
   - PDPA: the privacy policy mentions referral tracking.

## Part 2: BSR Bike Shop seed data

### Shop profile

| Field | Value |
| --- | --- |
| Name | BSR Bike Shop |
| Address | 79/37 Soi Phumichit, Rama 4, Phra Khanong, Khlong Toei, Bangkok 10110 |
| Nearest station | BTS Phra Khanong |
| Location pin | Geocode the address; owner checks the pin in the vendor dashboard |
| Phone | 085 055 0247 |
| WhatsApp | +66 85 055 0247 (store as E.164: +66850550247; the leading 0 is dropped after +66) |
| LINE ID | bsrbikeshop |
| Email | info@bsrbikeshop.com |
| Opening hours | Mon–Fri 10:00–18:00, Sat–Sun 11:00–16:00 |
| About | Bangkok rental shop for city bikes and fully equipped touring motorcycles. 10,000,000+ km ridden by 5,000+ customers from 100+ countries. English-speaking staff, free luggage storage, one-way touring rentals, bike passports for Laos, Cambodia and Malaysia. |
| Booking mode | **Request for every model** (owner decision) |
| Default buffers | 0 h before pickup, **24 h after return** |
| Same-day cut-off | 2 hours before closing (default; owner can change in the dashboard) |
| Request response window | 2 hours (default) |
| Delivery | On, flat ฿200, minimum rental length blank (any length), radius to be set by owner |

### Policies

| Policy | Value |
| --- | --- |
| Deposit type | Cash deposit (cash or credit card authorisation) |
| Deposit amount (shop default) | ฿2,000 (city bikes). Touring models override to ฿5,000 |
| Passport | Not held, copy only |
| Licence required | Motorbike licence (ASEAN licence or IDP accepted) |
| Minimum age | 21 |
| Included | Helmets, phone holder, medical insurance, luggage storage; city bikes unlimited km in Bangkok; touring bikes also gloves, USB power, tail box with backrest, unlimited km anywhere in Thailand, side panniers on NX500/CB500X |
| Notes | Riding experience required for touring bikes. City bikes may not leave Bangkok without the out-of-Bangkok extra. |

### Extras

| Extra | Price | Unit | Applies to |
| --- | --- | --- | --- |
| Use outside Bangkok (110–125cc) | 1,200 | week | City bikes 110–125cc |
| Use outside Bangkok (150–300cc) | 1,500 | week | City bikes 150cc and up |
| Damage/theft cover (155–449cc), ฿10,000 deductible | 200 | day | Models 155–449cc |
| Damage/theft cover (450–699cc), ฿10,000 deductible | 300 | day | NX500, CB500X |
| Bike passport (Laos, Cambodia, Malaysia), deposit ฿30,000 total, advance notice needed | 5,000 | rental | Touring bikes |
| Riding jacket | Owner to set | — | All |

Note: BSR's site also lists weekly and monthly rates for damage cover (e.g. 155–449cc ฿1,000/week, ฿3,000/month). Extras have one price unit each, so seed the daily rate; the owner can adjust.

### City bikes

All: type city/scooter, Request mode, deposit ฿2,000 (shop default), quantity 1 (owner adjusts as availability changes). Prices are anchors for day 1 / 7 / 14 / 21 / 30, in baht.

| Model | Years | cc | Transmission | 1 day | 7 days | 14 days | 21 days | 30 days |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Base (one of several older 110–125cc models) | — | 125 | Automatic | 250 | 1,200 | 1,700 | 2,200 | 2,500 |
| Honda Click 125i | 2019–2022 | 125 | Automatic | 300 | 1,400 | 2,100 | 2,600 | 3,000 |
| Yamaha Grand Filano | 2018–2022 | 125 | Automatic | 300 | 1,400 | 2,300 | 2,800 | 3,200 |
| Honda Scoopy | 2021–2023 | 110 | Automatic | 300 | 1,500 | 2,500 | 3,000 | 3,500 |
| Honda Lead | 2023 | 125 | Automatic | 300 | 1,500 | 2,500 | 3,000 | 3,500 |
| Yamaha Fazzio | 2025–2026 | 125 | Automatic | 350 | 1,500 | 2,500 | 3,000 | 3,500 |
| Honda Click 150i | 2019–2022 | 150 | Automatic | 350 | 1,500 | 2,500 | 3,000 | 3,500 |
| Honda Scoopy (New Gen) | 2025–2026 | 110 | Automatic | 350 | 1,700 | 2,700 | 3,400 | 3,900 |
| Honda Giorno | 2025–2026 | 125 | Automatic | 350 | 1,700 | 2,700 | 3,400 | 3,900 |
| Honda Lead (New Gen) | 2026 | 125 | Automatic | 400 | 1,800 | 2,800 | 3,500 | 4,000 |
| Yamaha Aerox 155 (1st Gen) | 2018–2020 | 155 | Automatic | 400 | 1,800 | 2,800 | 3,500 | 4,000 |
| Honda Click 160 | 2023–2025 | 160 | Automatic | 400 | 1,900 | 2,900 | 3,700 | 4,500 |
| Yamaha Aerox 155 (2nd Gen) | 2024–2026 | 155 | Automatic | 500 | 2,200 | 3,500 | 4,500 | 5,400 |
| Yamaha NMAX | 2026 | 155 | Automatic | 600 | 2,500 | 3,900 | 5,000 | 5,900 |
| Benelli Leoncino 250 | 2022–2024 | 250 | Manual | 600 | 2,500 | 3,900 | 5,000 | 5,900 |
| Honda PCX 160 | 2026 | 160 | Automatic | 650 | 2,800 | 4,200 | 5,400 | 6,200 |
| Honda ADV 160 | 2026 | 160 | Automatic | 650 | 3,000 | 4,400 | 5,700 | 6,500 |

### Touring bikes

All: Request mode, deposit ฿5,000 (model override), quantity 1 (owner adjusts). High-season prices; low season (1 Apr – 30 Sep) is 20% off, seeded as a date-window promotion once promotions exist (Phase 7).

| Model | Years | cc | Type | Transmission | 1 day | 7 days | 14 days | 21 days | 30 days |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Honda NX500 | 2025 | 471 | Adventure | Manual | 2,100 | 14,000 | 22,000 | 28,000 | 34,000 |
| Honda CB500X | 2022–2023 | 471 | Adventure | Manual | 1,800 | 12,000 | 20,000 | 26,000 | 31,000 |
| Honda CB500X | 2019–2021 | 471 | Adventure | Manual | 1,500 | 10,000 | 18,000 | 23,000 | 28,000 |
| Honda CB500X | 2016–2018 | 471 | Adventure | Manual | 1,200 | 8,000 | 15,000 | 21,000 | 26,000 |
| Honda Forza 350 | — | 330 | Touring | Automatic | 1,100 | 7,000 | 13,000 | 17,000 | 21,000 |
| Honda CB300R | — | 286 | Sport | Manual | 900 | 6,000 | 10,000 | 15,000 | 19,000 |
| Honda CRF300L | — | 286 | Off-road | Manual | 1,100 | 7,000 | 13,000 | 18,000 | 22,000 |
| Yamaha WR155 | — | 155 | Off-road | Manual | 700 | 4,500 | 8,000 | 11,500 | 14,000 |

### Still to confirm with the owner

- On the website, the price blocks for **Base** and **Honda Scoopy (New Gen)** sit above the bike name rather than below it. The tables assume each block belongs to the nearest bike; owner to check those two rows.
- Delivery radius.
- Riding jacket price.
- Photos: use the owner's uploads; don't copy images from the website without asking.
