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

  // The terms are the only thing needed to submit; the rest can come later.
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    page.getByText("Tick the box to accept the vendor terms."),
  ).toBeVisible();
  await page.getByLabel("I accept the vendor terms").check();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Waiting for approval")).toBeVisible();
});

test("the owner sees BSR's fleet and takes a bike off the website", async ({
  page,
}) => {
  await signInByEmail(page, "owner@bsr.test", "/vendor/fleet");
  await expect(page.getByRole("heading", { name: "Fleet" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Honda NX500/ })).toBeVisible();

  const row = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: "Honda PCX 160 2026" }) });
  const live = row.getByRole("switch", {
    name: "Live on website: Honda PCX 160 2026",
  });
  await expect(live).toBeChecked();
  await expect(row).toHaveAttribute("data-status", "listed");

  await live.locator("..").click();
  await expect(row).toHaveAttribute("data-status", "hidden");
  await expect(row.getByRole("status")).toContainText("Saved");

  // Back on, so the next run starts the same way.
  await live.locator("..").click();
  await expect(row).toHaveAttribute("data-status", "listed");
  await expect(row.getByRole("status")).toContainText("Saved");
});

test("a touring model shows its own deposit and inclusion overrides", async ({
  page,
}) => {
  await signInByEmail(page, "owner@bsr.test", "/vendor/fleet");
  await page.getByRole("link", { name: /Honda NX500/ }).click();
  await page.waitForURL(/\/vendor\/fleet\/c0000000-/);
  await expect(page.getByLabel("Deposit (฿)")).toHaveValue("5000");
  await expect(page.getByLabel("Gloves")).toHaveValue("included");
  await expect(page.getByLabel("Riding area")).toHaveValue("thailand");
  // The price table is filled from the anchors.
  await expect(page.getByLabel("1 day (required)")).toHaveValue("2100");
});

test("walk-in stock changes with −1/+1 and unready bikes are lighter", async ({
  page,
}) => {
  await signInByEmail(page, "owner@bsr.test", "/vendor/fleet");
  const row = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: /Honda Click 160/ }) });
  await expect(row).toHaveAttribute("data-ready", "false");

  await row
    .getByRole("button", { name: /^One more ready for walk-ins/ })
    .click();
  await expect(row).toHaveAttribute("data-ready", "true");
  await expect(row.getByLabel(/^Bikes ready for walk-ins today/)).toHaveValue(
    "1",
  );

  // Restore, so the next run starts the same way.
  await row
    .getByRole("button", { name: /^One less ready for walk-ins/ })
    .click();
  await expect(row).toHaveAttribute("data-ready", "false");
});

test("a bike's quantity is split between Instant, Request and walk-ins only", async ({
  page,
}) => {
  await signInByEmail(page, "owner@bsr.test", "/vendor/fleet");
  await page.getByRole("link", { name: /Honda NX500/ }).click();
  await page.waitForURL(/\/vendor\/fleet\/c0000000-/);
  const split = page.getByRole("group", {
    name: "How these bikes can be booked",
  });
  await expect(split.getByLabel("Request", { exact: true })).toHaveValue("1");
  await expect(split.getByLabel("Instant", { exact: true })).toHaveValue("0");
  // Moving the Request bike to Instant: Request is capped by what's left.
  await split.getByRole("button", { name: "One less: Request" }).click();
  await split.getByRole("button", { name: "One more: Instant" }).click();
  await expect(split.getByLabel("Instant", { exact: true })).toHaveValue("1");
  await expect(
    split.getByRole("button", { name: "One more: Request" }),
  ).toBeDisabled();
});

test("shop settings has Store information and Default settings tabs", async ({
  page,
}) => {
  await signInByEmail(page, "owner@bsr.test", "/vendor/settings");
  const tabs = page.getByRole("navigation", { name: "Shop settings" });
  await expect(
    tabs.getByRole("link", { name: "Store information" }),
  ).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Default settings" }).click();
  await expect(page).toHaveURL("/vendor/settings/defaults");
  await expect(page.getByLabel("Minimum rental period (walk-ins)")).toHaveValue(
    "1",
  );
  await expect(
    page.getByRole("heading", { name: "Riding usage restrictions" }),
  ).toBeVisible();

  await page.goto("/vendor/settings/included");
  await expect(page).toHaveURL("/vendor/settings/defaults");
});

test("store information saves with one button and warns about unsaved edits", async ({
  page,
}) => {
  await signInByEmail(page, "owner@bsr.test", "/vendor/settings");
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(
    1,
  );

  const lineId = page.getByLabel("LINE ID");
  const before = await lineId.inputValue();
  await lineId.fill(`${before}x`);
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  // Leaving asks first; dismissing keeps the edit on the page.
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Fleet" }).click();
  await expect(page).toHaveURL("/vendor/settings");
  await expect(lineId).toHaveValue(`${before}x`);

  // Restore and save, so the next run starts the same way.
  await lineId.fill(before);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved." }),
  ).toBeVisible();
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
