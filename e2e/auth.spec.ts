import { expect, test } from "@playwright/test";
import { signInByEmail, uniqueEmail } from "./helpers/auth";

// These need the local Supabase stack and its Mailpit inbox.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "needs local Supabase");

test("admin signs in by email and sees the admin panel", async ({ page }) => {
  await signInByEmail(page, "admin@bike-booking.test", "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Admin panel" }),
  ).toBeVisible();
  await expect(
    page.getByText("Signed in as admin@bike-booking.test"),
  ).toBeVisible();
});

test("a customer gets not-found at /admin", async ({ page }) => {
  await signInByEmail(page, "customer@bike-booking.test", "/admin");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Admin panel" })).toHaveCount(
    0,
  );
});

test("a new customer signs up by email and saves their profile", async ({
  page,
}) => {
  await signInByEmail(page, uniqueEmail("e2e-profile"), "/account");
  await expect(
    page.getByRole("heading", { name: "Your account" }),
  ).toBeVisible();

  await page.getByLabel("Name").fill("Pat Rider");
  await page.getByLabel("WhatsApp number").fill("0812345678");
  await page.getByLabel("Email and WhatsApp").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Use international format")).toBeVisible();

  await page.getByLabel("WhatsApp number").fill("+66 81 234 5678");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved." }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Name")).toHaveValue("Pat Rider");
  await expect(page.getByLabel("WhatsApp number")).toHaveValue("+66812345678");
  await expect(page.getByLabel("Email and WhatsApp")).toBeChecked();
});

test("a shop owner sees their shop on the vendor dashboard", async ({
  page,
}) => {
  await signInByEmail(page, "owner@bsr.test", "/vendor");
  await expect(
    page.getByRole("heading", { name: "Vendor dashboard" }),
  ).toBeVisible();
  await expect(page.getByText("BSR Bike Shop · Owner")).toBeVisible();
});

test("the vendor dashboard follows the Thai locale cookie", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "locale", value: "th", url: baseURL! }]);
  await signInByEmail(page, "staff@bsr.test", "/vendor");
  await expect(
    page.getByRole("heading", { name: "แดชบอร์ดร้านค้า" }),
  ).toBeVisible();
  await expect(page.getByText("BSR Bike Shop · พนักงาน")).toBeVisible();
});

test("someone with no shop is offered to create one", async ({ page }) => {
  await signInByEmail(page, uniqueEmail("e2e-noshop"), "/vendor");
  await expect(
    page.getByRole("heading", { name: "Create your shop" }),
  ).toBeVisible();
});

test("signing out ends the session", async ({ page }) => {
  await signInByEmail(page, "customer@bike-booking.test", "/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
});
