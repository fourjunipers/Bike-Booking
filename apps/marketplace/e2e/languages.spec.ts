import { expect, test } from "@playwright/test";

// Customer site languages: English at "/", the others prefixed.

test("each language has its own prefixed page", async ({ page }) => {
  await page.goto("/ja");
  await expect(
    page.getByRole("heading", { name: "バンコクのバイクレンタル" }),
  ).toBeVisible();
  await expect(page.locator("[lang=ja]").first()).toBeVisible();

  await page.goto("/de/login");
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
});

test("the language picker switches language on the same page", async ({
  page,
}) => {
  await page.goto("/login?next=%2Faccount");
  await page.getByLabel("Language").selectOption("th");
  await expect(page).toHaveURL("/th/login?next=%2Faccount");
  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบ" }),
  ).toBeVisible();

  await page.getByLabel("ภาษา").selectOption("en");
  await expect(page).toHaveURL("/login?next=%2Faccount");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("/en redirects to the unprefixed English page", async ({ page }) => {
  await page.goto("/en/login");
  await expect(page).toHaveURL("/login");
});

test("signing in from a language keeps it", async ({ page }) => {
  await page.goto("/ko/account");
  await expect(page).toHaveURL(
    `/ko/login?next=${encodeURIComponent("/ko/account")}`,
  );
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

test("pages list their other languages for search engines", async ({
  page,
}) => {
  await page.goto("/fr");
  await expect(
    page.locator('link[rel=alternate][hreflang="ko"]'),
  ).toHaveAttribute("href", /\/ko$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/fr$/,
  );
});

test.describe("with a Thai browser", () => {
  test.use({ locale: "th-TH" });

  test("English pages offer Thai without redirecting", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    const offer = page.getByRole("link", { name: "ดูเว็บไซต์นี้เป็นภาษาไทย" });
    await expect(offer).toBeVisible();

    await page.getByRole("button", { name: "No thanks" }).click();
    await expect(offer).toBeHidden();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Motorbike rental in Thailand" }),
    ).toBeVisible();
    await expect(offer).toBeHidden();
  });

  test("the offer leads to the Thai page", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "ดูเว็บไซต์นี้เป็นภาษาไทย" }).click();
    await expect(page).toHaveURL("/th/login");
  });
});
