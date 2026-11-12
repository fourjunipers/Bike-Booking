import { expect, test } from "@playwright/test";

test("customer home renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Motorbike rental in Thailand" }),
  ).toBeVisible();
});

for (const path of ["/admin/ranking", "/account"]) {
  test(`${path} sends signed-out visitors to sign in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
}

test("area links lead to sign-in for protected areas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Franking$/);
});

// Shop data lives on the Mango Works platform: the vendor dashboard and the
// shop-side admin screens are hidden (lib/hidden-areas.ts).
for (const path of [
  "/vendor",
  "/vendor/fleet",
  "/admin/shops",
  "/admin/catalog",
]) {
  test(`${path} is hidden and goes home`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL("/");
  });
}

test("the header no longer links to the vendor dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Vendor", exact: true }),
  ).toHaveCount(0);
});
