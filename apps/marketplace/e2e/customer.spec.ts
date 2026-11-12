import { expect, test } from "@playwright/test";

// Phase 3: customer browsing and search (BUILD_PLAN acceptance criteria).
// Needs the local seed: BSR (featured) and the demo shop near On Nut, both
// renting the Honda PCX 160.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "needs local Supabase");

test("searching from Phra Khanong shows one card per model", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox")
    .filter({ hasText: "Choose a BTS/MRT station" })
    .selectOption({ label: "Phra Khanong (BTS)" });
  await page
    .getByRole("button", { name: "Check availability & prices" })
    .click();
  await expect(page).toHaveURL(/\/search\?lat=.*place=Phra/);

  // The PCX is offered by two shops: one card, the lower price, "2 shops".
  const pcx = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Honda PCX 160 2026" }) });
  await expect(pcx).toContainText("2 shops near you");
  await expect(pcx).toContainText("฿550");

  // Its model page lists both shops, the boosted (featured) one first.
  await pcx.getByRole("link").click();
  const shops = page.getByRole("heading", { level: 3 });
  await expect(shops.first()).toHaveText("BSR Bike Shop");
  await expect(shops.nth(1)).toHaveText("On Nut Rentals (demo)");
});

test("sorting by price puts the cheapest model first", async ({ page }) => {
  await page.goto("/search?sort=price");
  const first = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 2 }) })
    .first();
  await expect(first).toContainText("Honda Click 125i");
  await expect(first).toContainText("฿280");
});

test("the shop listing shows deposit, documents and prices", async ({
  page,
}) => {
  await page.goto("/bikes/honda-pcx-160-2026/bsr-bike-shop");
  await expect(
    page.getByRole("heading", { name: "Honda PCX 160 2026" }),
  ).toBeVisible();
  await expect(page.getByText("Deposit and documents")).toBeVisible();
  const prices = page.getByRole("table", { name: "Prices" });
  await expect(prices.getByRole("row", { name: /^1 day/ })).toContainText(
    "฿650",
  );
  await expect(prices.getByRole("row", { name: /^7 days/ })).toContainText(
    "฿2,800",
  );
  await expect(prices.getByRole("row", { name: /^30 days/ })).toContainText(
    "฿6,200",
  );
  await expect(page.getByRole("button", { name: "Book" })).toBeDisabled();
});

test("dates show the total for the rental and hide booked bikes", async ({
  page,
}) => {
  // The seeded booking holds BSR's only PCX from 3 to 17 November.
  await page.goto(
    "/bikes/honda-pcx-160-2026?from=2026-11-09T10:00&to=2026-11-12T10:00",
  );
  await expect(page.getByText("1 shop rents this bike")).toBeVisible();
  const offer = page
    .getByRole("listitem")
    .filter({ hasText: "On Nut Rentals (demo)" });
  await expect(offer).toContainText("3 days");
  await expect(offer).toContainText("Instant");
});

test("the shop page lists its bikes and hours", async ({ page }) => {
  await page.goto("/shops/on-nut-rentals-demo");
  await expect(
    page.getByRole("heading", { name: "On Nut Rentals (demo)", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("2 bikes")).toBeVisible();
  await expect(page.getByText("Opening hours")).toBeVisible();
});

test("search works in other languages", async ({ page }) => {
  await page.goto("/th/search?type=adventure");
  await expect(
    page.getByRole("heading", { name: "ค้นหามอเตอร์ไซค์เช่า" }),
  ).toBeVisible();
  await expect(page.getByText("Honda NX500 2025")).toBeVisible();
});

test("the privacy notice says booking details go to the shop", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL("/privacy");
  await expect(
    page.getByRole("heading", { name: "Sharing your booking with the shop" }),
  ).toBeVisible();
  await expect(page.getByText(/Mango Works rental platform/)).toBeVisible();
});
