import { expect, test } from "@playwright/test";

test("customer home renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Motorbike rental in Bangkok" }),
  ).toBeVisible();
});

test("vendor dashboard renders in English by default", async ({ page }) => {
  await page.goto("/vendor");
  await expect(
    page.getByRole("heading", { name: "Vendor dashboard" }),
  ).toBeVisible();
});

test("vendor dashboard renders in Thai from the locale cookie", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "locale", value: "th", url: baseURL! }]);
  await page.goto("/vendor");
  await expect(
    page.getByRole("heading", { name: "แดชบอร์ดร้านค้า" }),
  ).toBeVisible();
});

test("admin panel renders", async ({ page }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Admin panel" }),
  ).toBeVisible();
});

test("area links navigate between the three areas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "Vendor" }).click();
  await expect(page).toHaveURL(/\/vendor$/);
});
