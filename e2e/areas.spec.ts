import { expect, test } from "@playwright/test";

test("customer home renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Motorbike rental in Bangkok" }),
  ).toBeVisible();
});

for (const path of ["/vendor", "/admin", "/account"]) {
  test(`${path} sends signed-out visitors to sign in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
}

test("area links lead to sign-in for protected areas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Vendor", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fvendor$/);
});
