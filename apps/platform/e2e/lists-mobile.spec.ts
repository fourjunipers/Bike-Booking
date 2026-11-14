/**
 * Fleet and Products lists on a phone (owner, 14 Nov 2026): two lines per
 * row, every row the same height, the Moto Mangos mango instead of the
 * listing words, no kind or category tags on a phone, "Add vehicle" inside
 * an opened Fleet line, Reorder mode, the sort (A–Z, By type, My order),
 * the filter chips, the plain dividers, and the Appearance setting.
 *
 * Runs at 375 px (phone) and 1280 px (desktop). Screenshots of both lists in
 * light and dark are attached to each run.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { demo, signIn } from "./helpers";

const stamp = () =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const productsList = (page: Page) =>
  page.getByRole("list", { name: "Products" });
const fleetList = (page: Page) =>
  page.getByRole("list", { name: "Vehicles by product" });
const rows = (list: Locator) => list.locator("[data-list-row]");

/** Every row on the list is the same height, and it is two lines high. */
async function sameHeight(list: Locator) {
  const heights = await rows(list).evaluateAll((elements) =>
    elements.map((element) =>
      Math.round(element.getBoundingClientRect().height),
    ),
  );
  expect(heights.length).toBeGreaterThan(1);
  expect(new Set(heights).size, `row heights: ${heights.join(", ")}`).toBe(1);
  expect(heights[0]).toBeLessThanOrEqual(80);
}

/** The name in a row stays on one line, with "…" when it is too long. */
async function oneLineName(row: Locator) {
  const name = row.locator(".truncate.font-semibold").first();
  const box = await name.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(element).lineHeight),
    clipped: element.scrollWidth > element.clientWidth,
    overflow: getComputedStyle(element).textOverflow,
  }));
  expect(box.height).toBeLessThanOrEqual(box.lineHeight + 1);
  expect(box.overflow).toBe("ellipsis");
  return box.clipped;
}

const pickKind = (page: Page, kind: string) =>
  page
    .getByRole("group", { name: "What kind of product is it?" })
    .locator("label")
    .filter({ hasText: new RegExp(`^${kind}$`) })
    .click();

/** Adds a vehicle product from "New product" and returns its page's address. */
async function addVehicle(
  page: Page,
  shop: string,
  name: string,
  kind: string,
  category?: string,
) {
  await page.goto(`/${shop}/products/new`);
  await pickKind(page, kind);
  await page.getByLabel("Product name").fill(name);
  if (category)
    await page
      .getByRole("group", { name: /categor/i })
      .getByText(category, { exact: true })
      .click();
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  return page.url().replace(/\?.*$/, "");
}

async function deleteProduct(page: Page, url: string) {
  await page.goto(url);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/products$/);
}

async function shoot(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await test.info().attach(name, { path, contentType: "image/png" });
}

test("rows: two lines, one height, long names cut short, the mango, the right icon", async ({
  page,
}, info) => {
  test.slow();
  const phone = info.project.name === "phone";
  const shop = "bsr";
  await signIn(page, demo.bsrOwner);
  const tag = stamp();
  // A name with a year range, and one far too long for a phone.
  const years = `E2E Honda CB500X (2019 - 2022) ${tag}`;
  const long = `E2E Yamaha XMAX 300 Tech Max Special Edition with a very long name ${tag}`;
  const boat = `E2E Boat ${tag}`;
  const urls: string[] = [];
  try {
    urls.push(await addVehicle(page, shop, years, "Motorbike", "Touring"));
    urls.push(await addVehicle(page, shop, long, "Motorbike", "Scooter"));
    urls.push(await addVehicle(page, shop, boat, "Boat or jet ski"));

    for (const path of ["fleet", "products"] as const) {
      await page.goto(`/${shop}/${path}`);
      const list = path === "fleet" ? fleetList(page) : productsList(page);
      await expect(rows(list).first()).toBeVisible();
      await sameHeight(list);
      await noSidewaysScroll(page);

      const row = (name: string) =>
        rows(list)
          .filter({ hasText: name.slice(0, 20) })
          .filter({
            has: page.locator(`.font-semibold[title="${name}"]`),
          });
      // Long names stay on one line; on a phone the long one is cut short.
      await oneLineName(row(years));
      expect(await oneLineName(row(long))).toBe(phone);

      // The icon is the saved kind: a scooter shows a bike, a boat a boat.
      await expect(row(long).locator("[data-icon]")).toHaveAttribute(
        "data-icon",
        "motorbike",
      );
      await expect(row(boat).locator("[data-icon]")).toHaveAttribute(
        "data-icon",
        "boat",
      );

      // The mango, for motorbikes only, with a name; no listing words.
      await expect(
        row(long).getByRole("img", { name: "Not on Moto Mangos" }),
      ).toBeVisible();
      await expect(
        row(long).getByRole("img", { name: "Not on Moto Mangos" }),
      ).toHaveAttribute("title", "Not on Moto Mangos");
      await expect(row(boat).locator("[data-mango]")).toHaveCount(0);
      await expect(list.getByText("Not on Moto Mangos")).toHaveCount(0);

      // Tags: none on a phone; the kind and categories on a wide screen.
      const tag = row(years).getByText("Touring", { exact: true });
      if (phone) await expect(tag).toBeHidden();
      else await expect(tag).toBeVisible();

      // No alternating shading: every row has the same background.
      const backgrounds = await list
        .locator(":scope > li")
        .evaluateAll((items) =>
          items
            .slice(0, 4)
            .map((item) => getComputedStyle(item).backgroundColor),
        );
      expect(new Set(backgrounds).size).toBe(1);
    }

    // "Add vehicle" is inside the opened Fleet line, not on the line itself.
    await page.goto(`/${shop}/fleet?q=${encodeURIComponent(years)}`);
    const line = page.locator("details[data-fleet-product]").first();
    const add = line.getByRole("link", {
      name: /^Add vehicle\s*: E2E Honda CB500X/,
    });
    await expect(
      line.locator("summary").getByRole("link", { name: /^Add vehicle/ }),
    ).toHaveCount(0);
    if (!(await line.evaluate((d) => (d as HTMLDetailsElement).open)))
      await line.locator("summary").click({ position: { x: 4, y: 4 } });
    await expect(add).toBeVisible();
    // The chevron still closes it.
    await line.locator("summary").click({ position: { x: 4, y: 4 } });
    await expect(add).toBeHidden();
  } finally {
    for (const url of urls) await deleteProduct(page, url);
  }
});

test("screenshots: Fleet and the three Products tabs, light and dark", async ({
  page,
}, info) => {
  await signIn(page, demo.bsrOwner);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of [
      "fleet",
      "products",
      "products?tab=vehicles",
      "products?tab=general",
    ]) {
      await page.goto(`/bsr/${path}`);
      await expect(page.locator("html")).toHaveClass(
        scheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/,
      );
      const list = path === "fleet" ? fleetList(page) : productsList(page);
      if (await list.isVisible()) {
        await sameHeight(list).catch((error) => {
          // The General tab may hold a single product in the demo shop.
          if ((path as string) !== "products?tab=general") throw error;
        });
      }
      await shoot(
        page,
        `${info.project.name}-${scheme}-${path.replace(/\W+/g, "-")}`,
      );
    }
  }
});

test("Reorder mode: quiet arrows, no pencil, the line doesn't open; Done leaves", async ({
  page,
}) => {
  // Read-only: nothing is moved here (e2e/products-stage-b.spec.ts moves).
  await signIn(page, demo.bigOwner);
  for (const path of ["fleet", "products"] as const) {
    await page.goto(`/big-fleet/${path}`);
    const list = path === "fleet" ? fleetList(page) : productsList(page);
    // No arrows until Reorder is pressed.
    await expect(list.getByRole("button", { name: /^Move up: / })).toHaveCount(
      0,
    );
    await page.getByRole("link", { name: "Reorder" }).click();
    await expect(page).toHaveURL(/reorder=1/);
    await expect(
      page.getByText(
        "Move products up or down. Fleet and the Products list share this order.",
      ),
    ).toBeVisible();
    const first = rows(list).first();
    await expect(
      first.getByRole("button", { name: /^Move up: / }),
    ).toBeDisabled();
    const down = first.getByRole("button", { name: /^Move down: / });
    await expect(down).toBeEnabled();
    // Small to see, 44 px to tap.
    const box = (await down.boundingBox())!;
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    expect(
      await down
        .locator("svg")
        .evaluate((svg) => svg.getBoundingClientRect().width),
    ).toBeLessThanOrEqual(16);
    // Nothing else on the line works while reordering.
    await expect(
      list.getByRole("link", { name: /^Edit product: / }),
    ).toHaveCount(0);
    await expect(list.locator("details")).toHaveCount(0);
    await expect(list.locator("a")).toHaveCount(0);
    await sameHeight(list);
    await noSidewaysScroll(page);

    await page.getByRole("link", { name: "Done" }).click();
    await expect(page).not.toHaveURL(/reorder/);
    await expect(list.getByRole("button", { name: /^Move up: / })).toHaveCount(
      0,
    );
    await expect(
      list.getByRole("link", { name: /^Edit product: / }).first(),
    ).toBeVisible();
  }
});

test("sort: A–Z and By type change one list only; My order is the shared one", async ({
  page,
}) => {
  await signIn(page, demo.bsrOwner);
  const names = async (list: Locator) =>
    (await list
      .locator("[data-list-row] .font-semibold[title]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("title")!),
      )) as string[];
  const az = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });

  await page.goto("/bsr/fleet");
  const sortNav = page.getByRole("navigation", { name: "Sort" });
  await expect(sortNav.getByRole("link", { name: "My order" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  const fleetMine = await names(fleetList(page));

  // Products, A–Z.
  await page.goto("/bsr/products?tab=vehicles");
  await sortNav.getByRole("link", { name: "A–Z" }).click();
  await expect(page).toHaveURL(/sort=az/);
  const sorted = await names(productsList(page));
  expect(sorted).toEqual([...sorted].sort(az.compare));

  // By type: motorbikes (by category) come before any boat.
  await sortNav.getByRole("link", { name: "By type" }).click();
  await expect(page).toHaveURL(/sort=type/);
  const icons = await productsList(page)
    .locator("[data-icon]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-icon")),
    );
  const firstOther = icons.findIndex((icon) => icon !== "motorbike");
  if (firstOther >= 0)
    expect(icons.slice(firstOther)).not.toContain("motorbike");
  // No Reorder while another sort is on screen? It is there, and opens My order.
  await expect(page.getByRole("link", { name: "Reorder" })).toHaveAttribute(
    "href",
    "/bsr/products?tab=vehicles&reorder=1",
  );

  // Fleet is still in its own order.
  await page.goto("/bsr/fleet");
  expect(await names(fleetList(page))).toEqual(fleetMine);
});

test("filter chips: only what the shop has, and they work with the search", async ({
  page,
}) => {
  await signIn(page, demo.bsrOwner);
  await page.goto("/bsr/fleet");
  const chips = page.getByRole("navigation", { name: "Show only" });
  await expect(chips.getByRole("link", { name: "All" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  // BSR has scooters; it has no cars, so no Sedan chip.
  await expect(chips.getByRole("link", { name: "Scooter" })).toBeVisible();
  await expect(chips.getByRole("link", { name: "Sedan" })).toHaveCount(0);
  // The row scrolls sideways on a phone; the page doesn't.
  await noSidewaysScroll(page);

  await chips.getByRole("link", { name: "Scooter" }).click();
  await expect(page).toHaveURL(/category=city_scooter/);
  await expect(chips.getByRole("link", { name: "Scooter" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  const scooters = await rows(fleetList(page)).count();
  expect(scooters).toBeGreaterThan(0);

  // A search keeps the chip…
  await page.getByLabel("Find a vehicle").fill("Honda");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/category=city_scooter/);
  await expect(page).toHaveURL(/q=Honda/);
  for (const title of await rows(fleetList(page))
    .locator(".font-semibold[title]")
    .evaluateAll((elements) => elements.map((e) => e.getAttribute("title")!)))
    expect(title.toLowerCase()).toContain("honda");
  // …and the chip keeps the search.
  await chips.getByRole("link", { name: "All" }).click();
  await expect(page).toHaveURL(/q=Honda/);
  await expect(page).not.toHaveURL(/category=/);
});

test("appearance: Light, Dark and Match device each work on a dark and a light device, and after a reload", async ({
  page,
}) => {
  // Bug, 14 Nov 2026: on a phone set to dark, Light and Dark did nothing and
  // Match device turned the app light.
  await page.emulateMedia({ colorScheme: "dark" });
  await signIn(page, demo.bsrStaff);
  await page.goto("/bsr/me");
  const html = page.locator("html");
  const appearance = page.getByRole("group", { name: "Appearance" });
  const choose = async (name: string) => {
    await appearance.getByRole("button", { name }).click();
    await expect(appearance.getByRole("button", { name })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  };
  const dark = () => expect(html).toHaveClass(/\bdark\b/);
  const light = () => expect(html).not.toHaveClass(/\bdark\b/);

  await choose("Match device");
  await dark();
  await choose("Light");
  await light();
  await page.reload();
  await light();
  await choose("Dark");
  await dark();
  await page.reload();
  await dark();
  await choose("Match device");
  await dark();
  await page.reload();
  await dark();

  // The device turns light: Match device follows it, at once and on reload.
  await page.emulateMedia({ colorScheme: "light" });
  await light();
  await page.reload();
  await light();
  await choose("Dark");
  await dark();
  await choose("Light");
  await light();
  await choose("Match device");
  await light();
});
