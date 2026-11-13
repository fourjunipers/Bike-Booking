/**
 * Products, stage A (docs/products-redesign.md): the Products list, a
 * product's tabs (Details, Units, History), old addresses redirecting, and
 * who sees what. Phone and desktop widths. Creating a product with the
 * make-and-model type-ahead is covered in fleet.spec.ts.
 *
 * Runs against local Supabase or a deploy preview on staging, again and
 * again: whatever a test creates it removes.
 */
import { expect, test, type Page } from "@playwright/test";
import { demo, signIn } from "./helpers";

const stamp = () =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const tabs = (page: Page) =>
  page.getByRole("navigation", { name: "Sections of this product" });
const products = (page: Page) => page.getByRole("list", { name: "Products" });

/** Opens the demo PCX from the Products list and answers with its id. */
async function openPcx(page: Page): Promise<string> {
  await page.goto("/bsr/products");
  await products(page)
    .getByRole("link", { name: "Open Honda PCX 160" })
    .click();
  await expect(page).toHaveURL(/\/bsr\/products\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname.split("/").pop()!;
}

test("products list: one row per product, filters, and a product's three tabs", async ({
  page,
}, testInfo) => {
  await signIn(page, demo.bsrOwner);
  // Products is in the menu, before Fleet.
  if (testInfo.project.name === "desktop") {
    const menu = page.getByRole("navigation", { name: "Main" });
    await expect(menu.getByRole("link", { name: "Products" })).toHaveAttribute(
      "href",
      "/bsr/products",
    );
    await menu.getByRole("link", { name: "Products" }).click();
  } else {
    await page.goto("/bsr/products");
  }
  await expect(
    page.getByRole("heading", { name: "Products", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(/^\d+ products: what you rent out\./),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "New product", exact: true }),
  ).toHaveAttribute("href", "/bsr/products/new");

  // One row per product: what it is, its vehicles in the fleet, and where
  // it stands on Moto Mangos.
  const row = products(page).getByRole("link", { name: "Open Honda PCX 160" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Vehicle · Motorbike");
  await expect(row.getByText(/^\d+ vehicles? in the fleet$/)).toBeVisible();
  await expect(row.getByText("Scooter", { exact: true })).toBeVisible();
  await expect(row.getByText(/Moto Mangos$/)).toBeVisible();
  expect(Math.round((await row.boundingBox())!.height)).toBeGreaterThanOrEqual(
    44,
  );
  await noSidewaysScroll(page);

  // Search and filters live in the address.
  await page.getByLabel("Find a product").fill("pcx");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=pcx/);
  await expect(row).toBeVisible();
  await expect(page.getByText(/^Showing \d+ of \d+$/)).toBeVisible();
  await page.goto("/bsr/products?kind=car");
  await expect(
    page.getByText("No product matches. Change the search or the filters."),
  ).toBeVisible();
  await expect(page.getByLabel("Kind of vehicle")).toHaveValue("car");
  await page.getByLabel("Category").selectOption({ label: "Scooter" });
  await page.getByLabel("Kind of vehicle").selectOption({ label: "Motorbike" });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/category=city_scooter/);
  await expect(row).toBeVisible();
  await page.getByRole("link", { name: "Reset view" }).click();
  await expect(page).toHaveURL(/\/bsr\/products$/);

  // Its page: Details first (for those who set the shop up), then Units and
  // History, each with its own address.
  await row.click();
  await expect(page).toHaveURL(/\/bsr\/products\/[0-9a-f-]{36}$/);
  const productUrl = page.url();
  await expect(
    page.getByRole("heading", { name: "Honda PCX 160", level: 1 }),
  ).toBeVisible();
  await expect(tabs(page).getByRole("link")).toHaveText([
    "Details",
    /^Units\s*\d+$/,
    "History",
  ]);
  await expect(
    tabs(page).getByRole("link", { name: "Details" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Name")).toHaveValue("Honda PCX 160");
  await expect(
    page.getByRole("region", { name: "Moto Mangos", exact: true }),
  ).toBeVisible();
  for (const link of await tabs(page).getByRole("link").all())
    expect(
      Math.round((await link.boundingBox())!.height),
    ).toBeGreaterThanOrEqual(44);

  await tabs(page)
    .getByRole("link", { name: /^Units/ })
    .click();
  await expect(page).toHaveURL(/\?tab=units$/);
  await expect(
    page.getByRole("heading", { name: "Vehicles of this product" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /DEMO-/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Add vehicle" })).toHaveAttribute(
    "href",
    /\/bsr\/fleet\/units\/new\?product=[0-9a-f-]{36}$/,
  );
  await expect(page.getByLabel("Name")).toHaveCount(0);
  // Fleet shows the same vehicles, unit by unit.
  const plate = (
    await page.getByRole("link", { name: /DEMO-/ }).first().innerText()
  ).match(/DEMO-\d+/)![0];
  await page.getByRole("link", { name: "See these vehicles in Fleet" }).click();
  await expect(page).toHaveURL(/\/bsr\/fleet\?model=/);
  await expect(
    page.getByRole("link", { name: new RegExp(plate) }),
  ).toBeVisible();
  // ...and the product's title there opens the product.
  await page
    .getByRole("link", { name: "Honda PCX 160", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(productUrl);

  // History: who changed what. A rename shows with the person and both names.
  const renamed = `PCX ${stamp()}`;
  await page.getByLabel("Name").fill(renamed);
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByText("Saved").first()).toBeVisible();
  await page.goto(`${productUrl}?tab=history`);
  const history = page.getByRole("listitem").filter({ hasText: renamed });
  await expect(history.first()).toContainText("changed this product");
  await expect(history.first()).toContainText(
    `Name: Honda PCX 160 → ${renamed}`,
  );
  await expect(history.first()).toContainText(/BSR|Owner|owner/);
  await noSidewaysScroll(page);
  // Put the name back.
  await page.goto(productUrl);
  await page.getByLabel("Name").fill("Honda PCX 160");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByText("Saved").first()).toBeVisible();
});

test("old addresses still open: the product page, New product, and Add vehicle with ?model=", async ({
  page,
}) => {
  await signIn(page, demo.bsrManager);
  const id = await openPcx(page);

  await page.goto(`/bsr/fleet/models/${id}`);
  await expect(page).toHaveURL(new RegExp(`/bsr/products/${id}$`));
  await expect(
    page.getByRole("heading", { name: "Honda PCX 160", level: 1 }),
  ).toBeVisible();

  await page.goto("/bsr/fleet/models/new?then=inventory");
  await expect(page).toHaveURL(/\/bsr\/products\/new\?then=inventory$/);
  await expect(
    page.getByRole("heading", { name: "New product", level: 1 }),
  ).toBeVisible();

  await page.goto(`/bsr/fleet/units/new?model=${id}`);
  await expect(
    page.getByRole("heading", { name: "Add vehicle", level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("Product", { exact: true })).toHaveValue(
    `model:${id}`,
  );
});

test("a mechanic and a driver read products and can't change them; staff neither", async ({
  page,
}) => {
  for (const who of [demo.bsrMechanic, demo.bsrDriver, demo.bsrStaff]) {
    await signIn(page, who);
    await page.goto("/bsr/products");
    await expect(
      page.getByRole("heading", { name: "Products", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "New product" })).toHaveCount(
      0,
    );
    // The Moto Mangos state is the owner's and manager's business.
    await expect(page.getByLabel("Moto Mangos")).toHaveCount(0);
    const row = products(page).getByRole("link", {
      name: "Open Honda PCX 160",
    });
    await expect(row.getByText(/Moto Mangos$/)).toHaveCount(0);
    await row.click();
    // Its vehicles, and nothing to set up: no tabs, no form, no history.
    await expect(
      page.getByRole("heading", { name: "Vehicles of this product" }),
    ).toBeVisible();
    await expect(tabs(page)).toHaveCount(0);
    await expect(page.getByLabel("Name")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Add vehicle" })).toHaveCount(
      0,
    );
    const url = page.url();
    await page.goto(`${url}?tab=history`);
    await expect(
      page.getByRole("heading", { name: "Vehicles of this product" }),
    ).toBeVisible();
    await page.goto(`${url}?tab=details`);
    await expect(page.getByLabel("Name")).toHaveCount(0);
    await page.goto("/bsr/products/new");
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await page.context().clearCookies();
  }
});

test("another shop's product can't be opened", async ({ page }) => {
  await signIn(page, demo.bsrOwner);
  const id = await openPcx(page);
  await page.context().clearCookies();
  await signIn(page, demo.bigOwner);
  await page.goto(`/big-fleet/products/${id}`);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  // An address that isn't a product at all is not found either, not an error.
  await page.goto("/big-fleet/products/not-a-product");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});
