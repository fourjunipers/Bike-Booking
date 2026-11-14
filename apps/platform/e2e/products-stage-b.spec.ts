/**
 * Products, stage B (docs/products-redesign.md §5.7): general products.
 * The two-choice start of "New product" and the General form; the Products
 * list's All, Vehicles and General tabs; a general product's Details, Stock
 * and History; quantity, damaged and lost by role; tracked gear with labels;
 * "Change model" and "Disconnect" on the Moto Mangos panel; and the manual
 * order (Move up, Move down, Reset to A–Z) shared by Fleet and Products.
 * Phone and desktop widths.
 *
 * Runs against local Supabase or a deploy preview on staging, again and
 * again: whatever a test creates it removes.
 */
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import { demo, signIn } from "./helpers";

const stamp = () =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const productTabs = (page: Page) =>
  page.getByRole("navigation", { name: "Sections of this product" });
const listTabs = (page: Page) =>
  page.getByRole("navigation", { name: "Which products" });
const products = (page: Page) => page.getByRole("list", { name: "Products" });
const productRow = (page: Page, name: string) =>
  products(page)
    .locator("> li")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
/** One state's part of the Stock tab: "In use", "Damaged" or "Lost". */
const stateOf = (page: Page, state: "In use" | "Damaged" | "Lost") =>
  page.getByRole("region", { name: new RegExp(`^${state} \\(\\d+\\)$`) });
const WRITE_OFF_QUESTION =
  "Write off? This cannot be undone. The unit leaves this product’s stock counts for good and can’t be marked found again. The History keeps a record.";
/** The counts of a location on the Stock tab. */
const counts = (page: Page) =>
  page.getByRole("list", { name: "Stock at this location" });

/** A second person, signed in, in their own browser window. */
async function as(browser: Browser, email: string, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email, path);
  return { page, close: () => context.close() };
}

/** Adds a general product from "New product" and lands on its page. */
async function addGeneral(
  page: Page,
  shop: string,
  type: "Rental gear" | "Item for sale" | "Service or extra",
  name: string,
  options: { quantity?: string; track?: boolean } = {},
): Promise<string> {
  await page.goto(`/${shop}/products/new`);
  await page.getByRole("radio", { name: /^General/ }).check();
  await page.getByRole("radio", { name: new RegExp(`^${type}`) }).check();
  await page.getByLabel("Product name").fill(name);
  if (options.track)
    await page.getByLabel("Track each unit on its own").check();
  if (options.quantity)
    await page.getByLabel("Quantity", { exact: true }).fill(options.quantity);
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.getByText("Product saved.")).toBeVisible();
  return page.url().replace(/\?.*$/, "");
}

/** Picks a kind of vehicle on the Vehicle form (its radio sits under the chip). */
const pickKind = (page: Page, kind: string) =>
  page
    .getByRole("group", { name: "What kind of product is it?" })
    .locator("label")
    .filter({ hasText: new RegExp(`^${kind}$`) })
    .click();

/** Sets a quantity on the Stock tab and waits for the page to show it. */
async function setQuantity(page: Page, quantity: string) {
  await page.getByLabel("Quantity", { exact: true }).fill(quantity);
  await page.getByRole("button", { name: "Change quantity" }).click();
}

/** Deletes a product from the bottom of its Details tab. */
async function deleteProduct(page: Page, url: string) {
  await page.goto(url);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/products$/);
}

test("new product: Vehicle or General; one of each general type; the three list tabs", async ({
  page,
}) => {
  test.slow();
  await signIn(page, demo.bsrOwner);
  const tag = stamp();
  const helmet = `E2E Helmet M ${tag}`;
  const cover = `E2E Full cover ${tag}`;
  const sticker = `E2E Sticker ${tag}`;

  // Two choices. Vehicle is the form as it was.
  await page.goto("/bsr/products/new");
  const choice = page.getByRole("group", { name: "What are you adding?" });
  await expect(choice.getByRole("radio")).toHaveCount(2);
  await expect(choice.getByRole("radio", { name: /^Vehicle/ })).toBeChecked();
  await expect(page.getByText("What kind of product is it?")).toBeVisible();
  await expect(page.getByLabel("Licence class")).toBeVisible();
  await noSidewaysScroll(page);

  // General: a type, a name and a description. No kind, licence class,
  // minimum age, buffers or deposit.
  await choice.getByRole("radio", { name: /^General/ }).check();
  const types = page.getByRole("group", {
    name: "What type of product is it?",
  });
  await expect(types.getByRole("radio")).toHaveCount(3);
  for (const type of ["Rental gear", "Item for sale", "Service or extra"])
    await expect(
      types.getByRole("radio", { name: new RegExp(`^${type}`) }),
    ).toBeVisible();
  await expect(page.getByText("What kind of product is it?")).toHaveCount(0);
  for (const gone of [/Licence class/, /Minimum age/, /Buffer/, /Deposit/])
    await expect(page.getByLabel(gone)).toHaveCount(0);
  await expect(page.getByLabel("Description")).toBeVisible();
  // Gear and items for sale get a quantity; a service has none.
  await expect(page.getByLabel("Quantity", { exact: true })).toBeVisible();
  await types.getByRole("radio", { name: /^Item for sale/ }).check();
  await expect(page.getByLabel("Quantity", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Track each unit on its own")).toHaveCount(0);
  await types.getByRole("radio", { name: /^Service or extra/ }).check();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("A service has no quantity: it is always available."),
  ).toBeVisible();
  // A name is required, and a quantity is a whole number.
  await types.getByRole("radio", { name: /^Rental gear/ }).check();
  await page.getByLabel("Product name").fill(helmet);
  await page.getByLabel("Quantity", { exact: true }).fill("lots");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText("Enter a whole number.")).toBeVisible();
  await noSidewaysScroll(page);

  // Rental gear, with 20 in stock.
  const helmetUrl = await addGeneral(page, "bsr", "Rental gear", helmet, {
    quantity: "20",
  });
  await expect(page.getByText("Rental gear", { exact: true })).toBeVisible();
  await expect(productTabs(page).getByRole("link")).toHaveText([
    "Details",
    /^Stock\s*20$/,
    "History",
  ]);
  // No Moto Mangos panel, and none of a vehicle's fields.
  await expect(page.getByRole("img", { name: "Moto Mangos" })).toHaveCount(0);
  for (const gone of [/Licence class/, /Minimum age/, /Buffer/, /Deposit/])
    await expect(page.getByLabel(gone)).toHaveCount(0);
  // The same name twice is refused.
  await page.goto("/bsr/products/new");
  await page.getByRole("radio", { name: /^General/ }).check();
  await page.getByLabel("Product name").fill(helmet.toUpperCase());
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(
    page.getByText("That name is already used in this shop."),
  ).toBeVisible();

  // A service: no stock, so no Stock tab.
  const coverUrl = await addGeneral(page, "bsr", "Service or extra", cover);
  await expect(productTabs(page).getByRole("link")).toHaveText([
    "Details",
    "History",
  ]);

  // An item for sale: a count on hand with its history.
  const stickerUrl = await addGeneral(page, "bsr", "Item for sale", sticker, {
    quantity: "50",
  });
  await productTabs(page)
    .getByRole("link", { name: /^Stock/ })
    .click();
  await expect(page.getByText("50 on hand")).toBeVisible();
  const ledger = page.getByRole("region", { name: "Stock history" });
  await expect(ledger.getByText("Received +50")).toBeVisible();
  await setQuantity(page, "45");
  await expect(page.getByText("45 on hand")).toBeVisible();
  await expect(ledger.getByText("Adjusted -5")).toBeVisible();
  // No damaged or lost for something that is sold, not lent.
  await expect(page.getByRole("button", { name: "Mark lost" })).toHaveCount(0);
  await noSidewaysScroll(page);

  // The list: All, Vehicles, General.
  await page.goto("/bsr/products");
  await expect(listTabs(page).getByRole("link")).toHaveText([
    "All",
    "Vehicles",
    "General",
  ]);
  await expect(productRow(page, helmet)).toBeVisible();
  await expect(productRow(page, "Honda PCX 160")).toBeVisible();
  await listTabs(page).getByRole("link", { name: "General" }).click();
  await expect(page).toHaveURL(/tab=general/);
  const row = productRow(page, helmet);
  await expect(row).toContainText("Rental gear");
  await expect(row.getByText("20 in stock", { exact: true })).toBeVisible();
  await expect(productRow(page, sticker)).toContainText("Item for sale");
  await expect(
    productRow(page, sticker).getByText("45 in stock", { exact: true }),
  ).toBeVisible();
  await expect(productRow(page, cover)).toContainText("Service or extra");
  await expect(
    productRow(page, cover).getByText("No stock: it is a service"),
  ).toBeAttached();
  await expect(productRow(page, "Honda PCX 160")).toHaveCount(0);
  // The same edit pencil as every other line.
  const pencil = row.getByRole("link", { name: `Edit product: ${helmet}` });
  await expect(pencil).toHaveAttribute("href", new URL(helmetUrl).pathname);
  const box = (await pencil.boundingBox())!;
  expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
  // Kind, category and Moto Mangos are about vehicles.
  for (const gone of ["Kind of vehicle", "Category", "Moto Mangos"])
    await expect(page.getByLabel(gone, { exact: true })).toHaveCount(0);
  // The search stays on the tab.
  await page.getByLabel("Find a product").fill(tag);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/tab=general/);
  await expect(products(page).locator("> li")).toHaveCount(3);
  await noSidewaysScroll(page);
  await listTabs(page).getByRole("link", { name: "Vehicles" }).click();
  await expect(productRow(page, "Honda PCX 160")).toBeVisible();
  await expect(productRow(page, helmet)).toHaveCount(0);
  await expect(page.getByLabel("Kind of vehicle")).toBeAttached();
  // Fleet is vehicles only.
  await page.goto(`/bsr/fleet?q=${tag}`);
  await expect(page.locator("details[data-fleet-product]")).toHaveCount(0);

  // A product with stock isn't deleted: the button says why.
  await page.goto(helmetUrl);
  let said = "";
  page.once("dialog", (dialog) => {
    said = dialog.message();
    void dialog.accept();
  });
  await page.getByRole("button", { name: "Delete product" }).click();
  expect(said).toBe(
    "This product still has stock. Set its quantity to 0, and mark any lost units found or write them off, first.",
  );
  // Editing: the type is fixed; the name and description change.
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByLabel("Description").fill("Open face, size M.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Clean up: stock to zero, then delete.
  for (const url of [helmetUrl, stickerUrl]) {
    await page.goto(`${url}?tab=stock`);
    await setQuantity(page, "0");
    await expect(page.getByText(/^0 (in stock|on hand)$/)).toBeVisible();
    await deleteProduct(page, url);
  }
  await deleteProduct(page, coverUrl);
});

test("stock: staff mark helmets damaged and lost, a mechanic can't mark lost, and the owner confirms the loss", async ({
  page,
  browser,
}) => {
  test.slow();
  await signIn(page, demo.bsrOwner);
  const name = `E2E Helmet L ${stamp()}`;
  const url = await addGeneral(page, "bsr", "Rental gear", name, {
    quantity: "20",
  });
  const stockUrl = `${url}?tab=stock`;
  const path = new URL(stockUrl).pathname + "?tab=stock";

  // The owner: the quantity per location.
  await page.goto(stockUrl);
  await expect(counts(page).getByRole("listitem")).toHaveText([
    "20 in stock",
    "20 available now",
  ]);
  await setQuantity(page, "21");
  await expect(
    counts(page).getByText("21 in stock", { exact: true }),
  ).toBeVisible();
  await noSidewaysScroll(page);

  // Staff: no "Change quantity"; they mark 2 damaged and 1 lost.
  const staff = await as(browser, demo.bsrStaff, path);
  await expect(
    staff.page.getByRole("heading", { name, level: 1 }),
  ).toBeVisible();
  await expect(productTabs(staff.page)).toHaveCount(0);
  await expect(
    staff.page.getByRole("button", { name: "Change quantity" }),
  ).toHaveCount(0);
  await staff.page.getByLabel("How many are damaged").fill("2");
  await staff.page.getByRole("button", { name: "Mark damaged" }).click();
  await expect(counts(staff.page).getByRole("listitem")).toHaveText([
    "21 in stock",
    "19 available now",
    "2 damaged",
  ]);
  let question = "";
  staff.page.once("dialog", (dialog) => {
    question = dialog.message();
    void dialog.accept();
  });
  await staff.page.getByLabel("How many are lost").fill("1");
  await staff.page.getByRole("button", { name: "Mark lost" }).click();
  await expect(counts(staff.page).getByRole("listitem")).toHaveText([
    "20 in stock",
    "18 available now",
    "2 damaged",
    "1 lost",
  ]);
  expect(question).toBe(
    "Mark as lost? It is no longer available to rent or counted in your stock. An owner or manager can mark it found or write it off.",
  );
  // Each state has its heading, a line saying what it means, and its own
  // actions under it.
  await expect(stateOf(staff.page, "In use")).toContainText(
    "In use: available to rent. Mark a unit damaged while it is cleaned or repaired, or lost if it is missing.",
  );
  await expect(stateOf(staff.page, "In use").getByRole("heading")).toHaveText(
    "In use (18)",
  );
  for (const action of ["Mark damaged", "Mark lost"])
    await expect(
      stateOf(staff.page, "In use").getByRole("button", { name: action }),
    ).toBeVisible();
  await expect(stateOf(staff.page, "Damaged")).toContainText(
    "Damaged: not available to rent, but still counted in your stock. Mark it back in use when it is ready.",
  );
  await expect(stateOf(staff.page, "Damaged").getByRole("heading")).toHaveText(
    "Damaged (2)",
  );
  await expect(stateOf(staff.page, "Damaged").getByRole("button")).toHaveText([
    "Back in use",
  ]);
  await expect(stateOf(staff.page, "Lost").getByRole("heading")).toHaveText(
    "Lost (1)",
  );
  await expect(stateOf(staff.page, "Lost")).toContainText(
    "Lost: not available to rent and not counted in your stock. Mark it found to put it back in use, or write it off to remove it permanently.",
  );
  // Staff can't mark it found or write it off.
  await expect(stateOf(staff.page, "Lost")).toContainText(
    "An owner or manager marks it found or writes it off.",
  );
  for (const gone of ["Found, back in use", "Write off"])
    await expect(staff.page.getByRole("button", { name: gone })).toHaveCount(0);
  for (const old of ["Back in stock", "Remove for good"])
    await expect(staff.page.getByText(old)).toHaveCount(0);
  await noSidewaysScroll(staff.page);
  await staff.close();

  // A mechanic marks damaged but is never offered "Mark lost".
  const mechanic = await as(browser, demo.bsrMechanic, path);
  await expect(
    mechanic.page.getByRole("button", { name: "Mark damaged" }),
  ).toBeVisible();
  await expect(
    mechanic.page.getByRole("button", { name: "Back in use", exact: true }),
  ).toBeVisible();
  for (const gone of [
    "Mark lost",
    "Change quantity",
    "Found, back in use",
    "Write off",
  ])
    await expect(mechanic.page.getByRole("button", { name: gone })).toHaveCount(
      0,
    );
  await mechanic.close();

  // A driver reads the counts and can do nothing to them.
  const driver = await as(browser, demo.bsrDriver, path);
  await expect(
    counts(driver.page).getByText("20 in stock", { exact: true }),
  ).toBeVisible();
  for (const gone of [
    "Mark damaged",
    "Back in use",
    "Mark lost",
    "Change quantity",
    "Write off",
  ])
    await expect(driver.page.getByRole("button", { name: gone })).toHaveCount(
      0,
    );
  await driver.close();

  // The list says "20 in stock, 1 lost".
  await page.goto("/bsr/products?tab=general");
  await expect(
    productRow(page, name).getByText("20 in stock, 1 lost", { exact: true }),
  ).toBeVisible();

  // The owner: the quantity can't go below the damaged ones.
  await page.goto(stockUrl);
  await setQuantity(page, "1");
  await expect(
    page.getByText(
      "2 units are damaged or booked, so the quantity can’t go below 2.",
    ),
  ).toBeVisible();
  await expect(
    counts(page).getByText("20 in stock", { exact: true }),
  ).toBeVisible();
  // The lost unit's two actions sit under "Lost", and nowhere else.
  const lost = stateOf(page, "Lost");
  await expect(lost.getByRole("button")).toHaveText([
    "Found, back in use",
    "Write off",
  ]);
  // "Write off" asks first, saying it can't be undone and what it changes.
  let writeOff = "";
  page.once("dialog", (dialog) => {
    writeOff = dialog.message();
    void dialog.dismiss();
  });
  await page.getByLabel("How many to write off").fill("1");
  await page.getByRole("button", { name: "Write off" }).click();
  expect(writeOff).toBe(WRITE_OFF_QUESTION);
  await expect(lost.getByRole("heading")).toHaveText("Lost (1)");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Write off" }).click();
  await expect(counts(page).getByRole("listitem")).toHaveText([
    "20 in stock",
    "18 available now",
    "2 damaged",
  ]);
  await expect(stateOf(page, "Lost")).toHaveCount(0);
  // A damaged unit goes back in use: it returns to the available count.
  await page.getByLabel("How many are back in use").fill("2");
  await page.getByRole("button", { name: "Back in use", exact: true }).click();
  await expect(counts(page).getByRole("listitem")).toHaveText([
    "20 in stock",
    "20 available now",
  ]);
  await expect(stateOf(page, "Damaged")).toHaveCount(0);
  // A lost unit that turns up: "Found, back in use" restores it.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByLabel("How many are lost").fill("1");
  await page.getByRole("button", { name: "Mark lost" }).click();
  await expect(stateOf(page, "Lost").getByRole("heading")).toHaveText(
    "Lost (1)",
  );
  await page.getByLabel("How many were found").fill("1");
  await page.getByRole("button", { name: "Found, back in use" }).click();
  await expect(counts(page).getByRole("listitem")).toHaveText([
    "20 in stock",
    "20 available now",
  ]);
  await noSidewaysScroll(page);

  // History: who did what, with how many, in the buttons' words.
  await productTabs(page).getByRole("link", { name: "History" }).click();
  for (const line of [
    /changed the quantity of this product/,
    /marked 2 damaged on this product/,
    /marked 1 lost on this product/,
    /wrote off 1 on this product/,
    /put 2 back in use on this product/,
    /marked 1 found, back in use on this product/,
  ])
    await expect(page.getByText(line).first()).toBeVisible();
  await expect(page.getByText("Quantity: 20 → 21")).toBeVisible();

  await page.goto(stockUrl);
  await setQuantity(page, "0");
  await expect(
    counts(page).getByText("0 in stock", { exact: true }),
  ).toBeVisible();
  await deleteProduct(page, url);
});

test("tracked gear: one line per unit with an optional label", async ({
  page,
  browser,
}) => {
  test.slow();
  await signIn(page, demo.bsrOwner);
  const tag = stamp();
  const name = `E2E Camera ${tag}`;
  const url = await addGeneral(page, "bsr", "Rental gear", name, {
    quantity: "2",
    track: true,
  });
  const stockUrl = `${url}?tab=stock`;
  await page.goto(stockUrl);
  const units = page.locator("li[data-gear-unit]");
  const unit = (label: string): Locator => units.filter({ hasText: label });
  /** A unit's line, under the heading of the state it should be in. */
  const unitIn = (
    target: Page,
    state: "In use" | "Damaged" | "Lost",
    label: string,
  ) => stateOf(target, state).locator("li[data-gear-unit]", { hasText: label });
  // One nameless line per unit, under "In use".
  await expect(units).toHaveCount(2);
  await expect(unitIn(page, "In use", "Unit 1")).toBeVisible();
  await expect(unitIn(page, "In use", "Unit 2")).toBeVisible();
  await expect(stateOf(page, "In use").getByRole("heading")).toHaveText(
    "In use (2)",
  );

  // A label is optional: one unit gets one, the other stays without.
  const label = `GoPro ${tag}`;
  await units.first().getByLabel("Label (optional)").fill(label);
  await units.first().getByRole("button", { name: "Save label" }).click();
  await expect(unitIn(page, "In use", label)).toBeVisible();
  await expect(units).toHaveCount(2);
  // No two alike.
  const other = units.filter({ hasNotText: label });
  await other.getByLabel("Label (optional)").fill(label.toUpperCase());
  await other.getByRole("button", { name: "Save label" }).click();
  await expect(
    page.getByText("Another unit of this product already has that label."),
  ).toBeVisible();
  await noSidewaysScroll(page);

  // Staff mark this one damaged, then lost; they can't rename it.
  const staff = await as(
    browser,
    demo.bsrStaff,
    new URL(stockUrl).pathname + "?tab=stock",
  );
  const staffUnit = staff.page
    .locator("li[data-gear-unit]")
    .filter({ hasText: label });
  await expect(staff.page.getByLabel("Label (optional)")).toHaveCount(0);
  // In use: "Mark damaged" and "Mark lost".
  await expect(staffUnit.getByRole("button")).toHaveText([
    `Mark damaged: ${label}`,
    `Mark lost: ${label}`,
  ]);
  await staffUnit
    .getByRole("button", { name: `Mark damaged: ${label}` })
    .click();
  // Damaged: it moves under "Damaged", with "Back in use" and "Mark lost".
  await expect(unitIn(staff.page, "Damaged", label)).toBeVisible();
  await expect(staffUnit.getByRole("button")).toHaveText([
    `Back in use: ${label}`,
    `Mark lost: ${label}`,
  ]);
  await staffUnit
    .getByRole("button", { name: `Back in use: ${label}` })
    .click();
  await expect(unitIn(staff.page, "In use", label)).toBeVisible();
  await staffUnit
    .getByRole("button", { name: `Mark damaged: ${label}` })
    .click();
  await expect(unitIn(staff.page, "Damaged", label)).toBeVisible();
  staff.page.once("dialog", (dialog) => void dialog.accept());
  await staffUnit.getByRole("button", { name: `Mark lost: ${label}` }).click();
  // Lost: under "Lost", and nothing staff can do to it.
  await expect(unitIn(staff.page, "Lost", label)).toBeVisible();
  await expect(staffUnit.getByRole("button")).toHaveCount(0);
  await expect(stateOf(staff.page, "Lost")).toContainText(
    "An owner or manager marks it found or writes it off.",
  );
  await staff.close();

  // The owner: a lost unit has "Found, back in use" and "Write off".
  await page.goto(stockUrl);
  await expect(unitIn(page, "Lost", label)).toBeVisible();
  await expect(
    unit(label).getByRole("button", { name: new RegExp(`: ${label}$`) }),
  ).toHaveText([`Found, back in use: ${label}`, `Write off: ${label}`]);
  await unit(label)
    .getByRole("button", { name: `Found, back in use: ${label}` })
    .click();
  await expect(unitIn(page, "In use", label)).toBeVisible();
  await expect(
    counts(page).getByText("2 in stock", { exact: true }),
  ).toBeVisible();
  // Lost again, and written off: the confirmation, then the unit is gone.
  page.once("dialog", (dialog) => void dialog.accept());
  await unit(label)
    .getByRole("button", { name: `Mark lost: ${label}` })
    .click();
  await expect(unitIn(page, "Lost", label)).toBeVisible();
  let writeOff = "";
  page.once("dialog", (dialog) => {
    writeOff = dialog.message();
    void dialog.accept();
  });
  await unit(label)
    .getByRole("button", { name: `Write off: ${label}` })
    .click();
  await expect(unit(label)).toHaveCount(0);
  expect(writeOff).toBe(WRITE_OFF_QUESTION);
  await expect(units).toHaveCount(1);
  await expect(
    counts(page).getByText("1 in stock", { exact: true }),
  ).toBeVisible();
  await expect(stateOf(page, "Lost")).toHaveCount(0);

  // History keeps the record, in the buttons' words, written-off unit included.
  await productTabs(page).getByRole("link", { name: "History" }).click();
  for (const line of [
    `marked unit ${label} damaged`,
    `put unit ${label} back in use`,
    `marked unit ${label} lost`,
    `marked unit ${label} found, back in use`,
    `wrote off unit ${label}`,
  ])
    await expect(page.getByText(line).first()).toBeVisible();
  await page.goto(stockUrl);

  await setQuantity(page, "0");
  await expect(
    counts(page).getByText("0 in stock", { exact: true }),
  ).toBeVisible();
  await deleteProduct(page, url);
});

test("Moto Mangos: a product on a list entry can change its model or disconnect", async ({
  page,
}) => {
  test.slow();
  await signIn(page, demo.bsrOwner);
  const name = `E2E Listed ${stamp()}`;
  await page.goto("/bsr/products/new");
  await page.getByLabel("Product name").fill(name);
  await page
    .getByRole("group", { name: "Categories" })
    .getByText("Scooter", { exact: true })
    .click();
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  const url = page.url().replace(/\?.*$/, "");
  const mangos = page.locator("#moto-mangos");

  // Not on the list yet: neither action is there.
  for (const gone of ["Change model", "Disconnect"])
    await expect(mangos.getByText(gone, { exact: true })).toHaveCount(0);

  // Put it on a list entry.
  await mangos.locator("#list-make").selectOption("Honda");
  await mangos.locator("#catalog_id").selectOption({ index: 1 });
  await mangos.getByRole("button", { name: "Select" }).click();
  await expect(
    mangos.getByText(/^On the Moto Mangos list as Honda /),
  ).toBeVisible();

  // Change model: the same Make, then Model dropdowns and a Select button.
  await mangos.getByText("Change model", { exact: true }).click();
  const change = mangos.getByRole("group", {
    name: "Select the new make and model",
  });
  await expect(change).toBeVisible();
  await expect(change.locator("#catalog_id")).toBeDisabled();
  await change.locator("#list-make").selectOption("Yamaha");
  await change.locator("#catalog_id").selectOption({ index: 1 });
  await mangos.getByRole("button", { name: "Select" }).click();
  await expect(
    mangos.getByText(/^On the Moto Mangos list as Yamaha /),
  ).toBeVisible();
  await noSidewaysScroll(page);

  // Disconnect asks first, and says bookings stay.
  let question = "";
  page.once("dialog", (dialog) => {
    question = dialog.message();
    void dialog.dismiss();
  });
  await mangos.getByRole("button", { name: "Disconnect" }).click();
  expect(question).toBe(
    "Disconnect this product from Moto Mangos? Its listing is switched off and its list entry is cleared. Bookings already made stay as they are.",
  );
  await expect(
    mangos.getByText(/^On the Moto Mangos list as Yamaha /),
  ).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  await mangos.getByRole("button", { name: "Disconnect" }).click();
  // Back to the picker, and the listing can't be switched on.
  await expect(
    mangos.getByRole("group", {
      name: "Select your make and model from the list",
    }),
  ).toBeVisible();
  await expect(
    mangos.getByLabel("List this product on Moto Mangos"),
  ).toBeDisabled();
  await expect(mangos.getByText(/^On the Moto Mangos list as/)).toHaveCount(0);

  // Both are in the product's history.
  await productTabs(page).getByRole("link", { name: "History" }).click();
  await expect(
    page.getByText(/moved this product to another Moto Mangos list entry/),
  ).toBeVisible();
  await expect(
    page.getByText(/disconnected this product from Moto Mangos/),
  ).toBeVisible();

  await deleteProduct(page, url);
});

test("manual order: Move up, Move down and Reset to A–Z, one order for Fleet and Products", async ({
  page,
  browser,
}, testInfo) => {
  // The order belongs to the whole shop, so this runs once (in the phone
  // project) and checks both widths itself; side by side, the two projects
  // would reorder the same shop under each other.
  test.skip(
    testInfo.project.name !== "phone",
    "one shop-wide order: run once, both widths inside",
  );
  test.slow();
  const shop = "saigon-scooters";
  await signIn(page, demo.saigonOwner);
  const tag = stamp();
  const names = {
    a: `${tag} A`,
    b: `${tag} B`,
    c: `${tag} C`,
    gear: `${tag} D gear`,
  };
  const urls: string[] = [];
  for (const name of [names.a, names.b, names.c]) {
    await page.goto(`/${shop}/products/new`);
    await pickKind(page, "Other");
    await page.getByLabel("Product name").fill(name);
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    urls.push(page.url().replace(/\?.*$/, ""));
  }
  urls.push(await addGeneral(page, shop, "Rental gear", names.gear));

  /** This run's products, in the order the page shows them. */
  const mine = async (target: Page = page) =>
    (
      await products(target).locator("> li a.font-semibold").allInnerTexts()
    ).filter((name) => name.startsWith(tag));
  const fleetNames = async () =>
    (
      await page
        .locator("details[data-fleet-product] > summary span.font-semibold")
        .allInnerTexts()
    ).filter((name) => name.startsWith(tag));
  const reset = page.getByRole("button", { name: "Reset to A–Z" });

  // Default: A to Z, and nothing to reset.
  await page.goto(`/${shop}/products`);
  if (await reset.isVisible()) {
    page.once("dialog", (dialog) => void dialog.accept());
    await reset.click();
  }
  await expect(reset).toHaveCount(0);
  await expect
    .poll(() => mine())
    .toEqual([names.a, names.b, names.c, names.gear]);
  // The top line can't go up and the bottom line can't go down.
  const lines = products(page).locator("> li");
  await expect(
    lines.first().getByRole("button", { name: /^Move up: / }),
  ).toBeDisabled();
  await expect(
    lines.last().getByRole("button", { name: /^Move down: / }),
  ).toBeDisabled();
  const down = page.getByRole("button", { name: `Move down: ${names.a}` });
  const box = (await down.boundingBox())!;
  expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
  await noSidewaysScroll(page);

  // Move down on the first: saved, and kept after a reload.
  await down.click();
  await expect(page.getByText("Shown in your own order.")).toBeVisible();
  await expect
    .poll(() => mine())
    .toEqual([names.b, names.a, names.c, names.gear]);
  await page.reload();
  await expect
    .poll(() => mine())
    .toEqual([names.b, names.a, names.c, names.gear]);
  await expect(reset).toBeVisible();

  // Fleet shows the same order (its vehicles), and moves there show here.
  await page.goto(`/${shop}/fleet`);
  await expect.poll(fleetNames).toEqual([names.b, names.a, names.c]);
  // The arrows sit on a line that opens and closes on a tap: pressing one
  // moves the product and leaves the line as it was.
  const lineC = page.locator("details[data-fleet-product]", {
    has: page.getByText(names.c, { exact: true }),
  });
  const isOpen = () =>
    lineC.evaluate((line) => (line as HTMLDetailsElement).open);
  const wasOpen = await isOpen();
  await page.getByRole("button", { name: `Move up: ${names.c}` }).click();
  await expect.poll(fleetNames).toEqual([names.b, names.c, names.a]);
  expect(await isOpen()).toBe(wasOpen);
  // A tap on the line itself still opens it.
  await lineC.locator("summary span.font-semibold").click();
  expect(await isOpen()).toBe(!wasOpen);
  await noSidewaysScroll(page);
  await page.goto(`/${shop}/products`);
  await expect
    .poll(() => mine())
    .toEqual([names.b, names.c, names.a, names.gear]);
  // General products take part in the same order.
  await page.getByRole("button", { name: `Move up: ${names.gear}` }).click();
  await expect
    .poll(() => mine())
    .toEqual([names.b, names.c, names.gear, names.a]);
  await page.goto(`/${shop}/fleet`);
  await expect.poll(fleetNames).toEqual([names.b, names.c, names.a]);

  // A new product goes to the bottom of a custom order, whatever its name.
  const first = `${tag} 0 new`;
  await page.goto(`/${shop}/products/new`);
  await pickKind(page, "Other");
  await page.getByLabel("Product name").fill(first);
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(
    page.getByRole("heading", { name: first, level: 1 }),
  ).toBeVisible();
  urls.push(page.url().replace(/\?.*$/, ""));
  await page.goto(`/${shop}/products`);
  await expect
    .poll(() => mine())
    .toEqual([names.b, names.c, names.gear, names.a, first]);

  // Off while a search or filter is on.
  await page.goto(`/${shop}/products?q=${tag}`);
  await expect(
    page.getByRole("button", { name: /^Move (up|down): / }),
  ).toHaveCount(0);
  await expect(reset).toHaveCount(0);
  await expect(
    page.getByText("Clear the search and filters to change the order."),
  ).toBeVisible();
  await page.goto(`/${shop}/fleet?q=${tag}`);
  await expect(
    page.getByRole("button", { name: /^Move (up|down): / }),
  ).toHaveCount(0);

  // Staff see the saved order and can't change it.
  const staff = await as(browser, demo.both, `/${shop}/products`);
  await expect(products(staff.page)).toBeVisible();
  await expect
    .poll(() => mine(staff.page))
    .toEqual([names.b, names.c, names.gear, names.a, first]);
  await expect(
    staff.page.getByRole("button", { name: /^Move (up|down): / }),
  ).toHaveCount(0);
  await expect(
    staff.page.getByRole("button", { name: "Reset to A–Z" }),
  ).toHaveCount(0);
  await staff.close();

  // Desktop width: the same buttons; then back to A to Z.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/${shop}/products`);
  await page.getByRole("button", { name: `Move down: ${names.b}` }).click();
  await expect
    .poll(() => mine())
    .toEqual([names.c, names.b, names.gear, names.a, first]);
  await noSidewaysScroll(page);
  // It asks first: declining keeps the order.
  let question = "";
  page.once("dialog", (dialog) => {
    question = dialog.message();
    void dialog.dismiss();
  });
  await reset.click();
  expect(question).toBe(
    "Reset to A–Z? Your own order of products is cleared, on Fleet and on the Products list.",
  );
  await expect(reset).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  await reset.click();
  await expect(reset).toHaveCount(0);
  await expect
    .poll(() => mine())
    .toEqual([first, names.a, names.b, names.c, names.gear]);
  await page.goto(`/${shop}/fleet`);
  await expect.poll(fleetNames).toEqual([first, names.a, names.b, names.c]);

  for (const url of urls) await deleteProduct(page, url);
});
