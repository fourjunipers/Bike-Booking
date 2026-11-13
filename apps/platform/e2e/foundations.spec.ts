/**
 * Phase 0 click-through, at phone and desktop widths: sign-in, the shop
 * picker, role-based tabs, tenant isolation in the UI, and the per-device
 * settings (language, tab bar). Needs local Supabase with the demo seed.
 */
import { expect, test } from "@playwright/test";
import { demo, mainNav, signIn } from "./helpers";

const isPhone = (name: string) => name === "phone";

test("signed-out visitors are sent to sign in, then back", async ({ page }) => {
  await page.goto("/bsr/orders");
  await expect(page).toHaveURL(/\/login\?next=%2Fbsr%2Forders/);
  await page.getByLabel("Email").fill(demo.bsrStaff);
  await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/bsr\/orders$/);
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
});

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(demo.bsrOwner);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "don't match" }),
  ).toHaveText("That email and password don't match.");
});

test("an owner gets all four tabs and the admin pages", async ({
  page,
}, info) => {
  await signIn(page, demo.bsrOwner);
  await expect(page).toHaveURL(/\/bsr\/dashboard$/);
  const nav = mainNav(page, isPhone(info.project.name));
  for (const tab of ["Dashboard", "Orders", "New order", "Maintenance"]) {
    await expect(nav.getByRole("link", { name: tab })).toBeVisible();
  }

  await nav.getByRole("link", { name: "Orders" }).click();
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await page.getByLabel("Find an order").fill("1กข-1234");
  await page.getByLabel("Find an order").press("Enter");
  await expect(page).toHaveURL(/q=1%E0%B8%81/);
  await page.getByRole("link", { name: "Overdue" }).click();
  await expect(page).toHaveURL(/filter=overdue/);
  await expect(page.getByText("Searching for “1กข-1234”")).toBeVisible();

  await nav.getByRole("link", { name: "New order" }).click();
  await expect(page.getByRole("heading", { name: "New order" })).toBeVisible();
  await nav.getByRole("link", { name: "Maintenance" }).click();
  await expect(
    page.getByRole("heading", { name: "Maintenance" }),
  ).toBeVisible();

  await page.goto("/bsr/team");
  await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
  await expect(page.getByText(demo.bsrMechanic)).toBeVisible();
  await page.goto("/bsr/settings");
  // The time zone moved to the location in Phase 1a.
  await expect(page.getByLabel("Distances")).toHaveValue("km");
});

test("a mechanic opens on Maintenance and sees only its tabs", async ({
  page,
}, info) => {
  await signIn(page, demo.bsrMechanic);
  await expect(page).toHaveURL(/\/bsr\/maintenance$/);
  const nav = mainNav(page, isPhone(info.project.name));
  // The sidebar also lists Products and Fleet, which every role can read.
  await expect(nav.getByRole("link")).toHaveText(
    isPhone(info.project.name)
      ? ["Dashboard", "Maintenance"]
      : ["Dashboard", "Maintenance", "Products", "Fleet"],
  );

  // A tab the role doesn't have sends it home; admin pages don't exist for it.
  await page.goto("/bsr/new-order");
  await expect(page).toHaveURL(/\/bsr\/maintenance$/);
  // The page streams behind its loading state, so the status is already 200
  // when the role check runs; the not-found page replaces it and no team
  // data is sent.
  await page.goto("/bsr/team");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page.getByText(demo.bsrOwner)).toHaveCount(0);
});

test("a driver gets Dashboard and Orders", async ({ page }, info) => {
  await signIn(page, demo.bsrDriver);
  await expect(page).toHaveURL(/\/bsr\/dashboard$/);
  await expect(
    mainNav(page, isPhone(info.project.name)).getByRole("link"),
  ).toHaveText(
    isPhone(info.project.name)
      ? ["Dashboard", "Orders"]
      : ["Dashboard", "Orders", "Products", "Fleet"],
  );
});

test("the dashboard has Today, Tomorrow, Upcoming and Late tabs", async ({
  page,
}) => {
  await signIn(page, demo.bsrStaff);
  await expect(page).toHaveURL(/\/bsr\/dashboard$/);
  const tabs = page.getByRole("tablist", { name: "When" }).getByRole("tab");
  await expect(tabs).toHaveText([
    // Counts depend on the demo renewals and the day the seed ran.
    /^Today\s*\d+/,
    /^Tomorrow\s*\d+/,
    /^Upcoming\s*\d+/,
    /^Late\s*\d+/,
  ]);
  // The panel being shown. While tabs switch, the outgoing panel stays in the
  // page for a moment, marked inert, so "the tabpanel" alone can match two.
  const panel = page.locator('[role="tabpanel"]:not([inert])');
  const today = page.getByRole("tab", { name: /^Today/ });
  await expect(today).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("Pickups");

  // Late: its own sections, and the choice survives a reload.
  await page.getByRole("tab", { name: /^Late/ }).click();
  await expect(page).toHaveURL(/\?view=late$/);
  await expect(panel).toContainText("Overdue vehicles");
  await expect(panel).toContainText(
    "Missed pickups, deliveries and collections",
  );
  await expect(panel).toContainText("Unpaid past deadline");
  await page.reload();
  await expect(page.getByRole("tab", { name: /^Late/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Keyboard: arrow keys move between tabs.
  await page.getByRole("tab", { name: /^Late/ }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: /^Upcoming/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel).toContainText("Next 7 days");
});

test("the look: grey page, white panels, orange accent", async ({
  page,
}, info) => {
  await signIn(page, demo.bsrStaff);
  const color = (selector: string, prop: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  expect(await color("body", "background-color")).toBe("rgb(244, 244, 245)");
  const orange = "rgb(194, 65, 12)";
  // The selected dashboard tab is filled orange with white text.
  expect(
    await color('[role="tab"][aria-selected="true"]', "background-color"),
  ).toBe(orange);
  if (isPhone(info.project.name)) {
    const tabBar = 'nav[aria-label="Staff app"]';
    // White at 95% (the bar blurs what scrolls under it).
    expect(await color(tabBar, "background-color")).toMatch(
      /255, 255, 255|oklab\(0\.99/,
    );
    expect(await color(`${tabBar} [aria-current="page"]`, "color")).toBe(
      orange,
    );
  } else {
    expect(await color("aside", "background-color")).toBe("rgb(255, 255, 255)");
    expect(await color('aside [aria-current="page"] svg', "color")).toBe(
      orange,
    );
  }
});

test("a member of one shop can't open another shop", async ({ page }) => {
  await signIn(page, demo.bsrOwner);
  const response = await page.goto("/saigon-scooters/dashboard");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Saigon Scooters")).toHaveCount(0);
});

test("someone in two shops picks one, then can switch", async ({ page }) => {
  await signIn(page, demo.both);
  await expect(
    page.getByRole("heading", { name: "Choose a shop" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Saigon Scooters/ }).click();
  await expect(page).toHaveURL(/\/saigon-scooters\/dashboard$/);
  // Shop time is shown in the shop's own zone.
  await expect(page.getByText(/Asia\/Ho_Chi_Minh/)).toBeVisible();
  await page.getByRole("link", { name: "Switch shop" }).first().click();
  await page.getByRole("link", { name: /BSR Bike Shop/ }).click();
  await expect(page).toHaveURL(/\/bsr\/dashboard$/);
});

test("language and tab bar are saved on this device", async ({
  page,
}, info) => {
  await signIn(page, demo.bsrStaff);
  await page.goto("/bsr/me");

  if (isPhone(info.project.name)) {
    const tabBar = page.getByRole("navigation", { name: "Staff app" });
    const bottomBefore = (await tabBar.boundingBox())!.y;
    expect(bottomBefore).toBeGreaterThan(600);
    await page.getByRole("button", { name: "Top", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Top", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect((await tabBar.boundingBox())!.y).toBeLessThan(100);
  } else {
    // On desktop the tabs live in the sidebar; the phone tab bar is hidden.
    await expect(
      page.getByRole("navigation", { name: "Staff app" }),
    ).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  }

  await page.getByRole("button", { name: "ไทย" }).click();
  await expect(
    page.getByRole("heading", { name: "คุณและอุปกรณ์นี้" }),
  ).toBeVisible();
  await page.goto("/bsr/dashboard");
  await expect(
    page.getByRole("heading", { name: "สิ่งที่กำลังจะมาถึง" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
});

test("the app is installable", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
  expect((await request.get("/sw.js")).ok()).toBe(true);
  expect((await request.get("/offline.html")).ok()).toBe(true);
});
