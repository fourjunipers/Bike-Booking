import { expect, test } from "@playwright/test";
import { signInByEmail, uniqueEmail } from "./helpers/auth";

// Phase 2: vendor dashboard and admin approval. Needs the local Supabase
// stack (seeded with `npx supabase db reset`) and its Mailpit inbox.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "needs local Supabase");

test("a new vendor creates a shop and gets the setup checklist", async ({
  page,
}) => {
  await signInByEmail(page, uniqueEmail("e2e-vendor"), "/vendor");
  await page.getByLabel("Shop name").fill("E2E Scooters");
  await page.getByRole("button", { name: "Create shop" }).click();
  await expect(
    page.getByRole("heading", { name: "E2E Scooters" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Get your shop ready" }),
  ).toBeVisible();

  // Submitting early lists what's missing and keeps the shop a draft.
  await page.getByLabel("I accept the vendor terms").check();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(
    page.getByText("Some setup steps are still missing"),
  ).toBeVisible();
  await expect(
    page.getByText("Draft (not visible to customers)"),
  ).toBeVisible();
});

test("the owner sees BSR's fleet and edits a quantity inline", async ({
  page,
}) => {
  await signInByEmail(page, "owner@bsr.test", "/vendor/fleet");
  await expect(page.getByRole("heading", { name: "Fleet" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Honda NX500/ })).toBeVisible();

  const qty = page.getByLabel("Quantity of Honda PCX 160 2026");
  // Change it from whatever it is, then wait for the restore to save so the
  // next run starts from the same value.
  const before = await qty.inputValue();
  await qty.fill(before === "2" ? "3" : "2");
  await qty.blur();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved" }).first(),
  ).toBeVisible();
  const restored = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.ok(),
  );
  await qty.fill(before);
  await qty.blur();
  await restored;
});

test("a touring model shows its own deposit and inclusion overrides", async ({
  page,
}) => {
  await signInByEmail(page, "owner@bsr.test", "/vendor/fleet");
  await page.getByRole("link", { name: /Honda NX500/ }).click();
  await expect(page.getByLabel("Deposit (฿)")).toHaveValue("5000");
  await expect(page.getByLabel("Gloves")).toHaveValue("included");
  await expect(page.getByLabel("Riding area")).toHaveValue("thailand");
  // The price table is filled from the anchors.
  await expect(page.getByLabel("1 day (required)")).toHaveValue("2100");
});

test("staff can't open the Team page", async ({ page }) => {
  await signInByEmail(page, "staff@bsr.test", "/vendor/team");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("admin sees the catalog request in the approval queue", async ({
  page,
}) => {
  await signInByEmail(page, "admin@bike-booking.test", "/admin");
  await expect(
    page.getByRole("heading", { name: /Catalog requests/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Vespa Primavera 150/ }),
  ).toBeVisible();
});
