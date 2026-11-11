/**
 * Shop settings keep what was saved (bug, 11 Nov 2026: after saving "Miles"
 * the field showed kilometres again until the page was reloaded).
 *
 * Each width uses its own shop, because the two run side by side and a shop's
 * distance unit is one value. Neither is BSR, whose settings other tests read.
 */
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const shops = {
  phone: { email: "owner@saigon.demo.test", slug: "saigon-scooters" },
  desktop: { email: "owner@big.demo.test", slug: "big-fleet" },
} as const;

test("the distance unit stays as saved, and bikes show it", async ({
  page,
}, info) => {
  const shop = shops[info.project.name as keyof typeof shops];
  await signIn(page, shop.email);
  await page.goto(`/${shop.slug}/settings`);
  const distances = page.getByLabel("Distances");
  const save = page.getByRole("button", { name: "Save", exact: true }).first();

  /** Clicks Save and waits for the server to answer, so nothing reads a half-saved shop. */
  const saveAndWait = async () => {
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === "POST" && response.ok(),
      ),
      save.click(),
    ]);
    await expect(page.getByText("Saved").first()).toBeVisible();
  };

  // Start from kilometres whatever an earlier, interrupted run left behind.
  if ((await distances.inputValue()) !== "km") {
    await distances.selectOption("km");
    await saveAndWait();
    await page.reload();
  }

  await distances.selectOption("mi");
  await saveAndWait();
  // The bug: the field went back to kilometres here.
  await expect(distances).toHaveValue("mi");
  // And it is what the database holds, not only what the form shows.
  await page.reload();
  await expect(page.getByLabel("Distances")).toHaveValue("mi");

  if (shop.slug === "big-fleet") {
    await page.goto(`/${shop.slug}/fleet?group=none`);
    await expect(page.getByText(/\d mi\b/).first()).toBeVisible();
  }

  await page.goto(`/${shop.slug}/settings`);
  await distances.selectOption("km");
  await saveAndWait();
  await expect(distances).toHaveValue("km");
});
