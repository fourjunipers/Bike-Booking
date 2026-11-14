/**
 * Rental gear, the stock rework (docs/products-redesign.md §5.9). The
 * Details tab's tiles, "Change quantity" stepper, "Report a problem" dialog
 * (a bottom sheet on a phone) and "Out of service" list, by role; the Stock
 * tab's one row per unit; tracked gear by unit; and the History in the
 * buttons' words. Phone and desktop widths.
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

const WRITE_OFF_QUESTION =
  "Remove from stock? This cannot be undone. The unit is removed from this product for good and can’t be marked found again. The History keeps a record.";

const productTabs = (page: Page) =>
  page.getByRole("navigation", { name: "Sections of this product" });
/** One card of the Details tab, by its title. */
const card = (
  page: Page,
  title:
    | "Stock"
    | "Change quantity"
    | "Report a problem"
    | "Out of service"
    | "Product details",
) => page.getByRole("region", { name: title, exact: true });
/** The lines of "Out of service". */
const outLines = (page: Page) => page.locator("li[data-out-unit]");
const reportDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Report a problem" });

/** The tiles: In stock, Available now, In repair, and Lost only when given. */
async function expectTiles(
  page: Page,
  counts: {
    inStock: number;
    available: number;
    inRepair: number;
    lost?: number;
  },
) {
  const tiles = card(page, "Stock").locator("[data-tile]");
  await expect(tiles.locator("dt")).toHaveText([
    "In stock",
    "Available now",
    "In repair",
    ...(counts.lost === undefined ? [] : ["Lost"]),
  ]);
  await expect(tiles.locator("dd")).toHaveText(
    [
      counts.inStock,
      counts.available,
      counts.inRepair,
      ...(counts.lost === undefined ? [] : [counts.lost]),
    ].map(String),
  );
}

/** A day near today, as a date field takes it. */
const dayFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** A second person, signed in, in their own browser window. */
async function as(browser: Browser, email: string, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email, path);
  return { page, close: () => context.close() };
}

/** Adds rental gear from "New product" and lands on its Details tab. */
async function addGear(
  page: Page,
  name: string,
  options: { quantity: string; track?: boolean },
): Promise<string> {
  await page.goto("/bsr/products/new");
  await page.getByRole("radio", { name: /^General/ }).check();
  await page.getByRole("radio", { name: /^Rental gear/ }).check();
  await page.getByLabel("Product name").fill(name);
  if (options.track)
    await page.getByLabel("Track each unit on its own").check();
  await page.getByLabel("Quantity", { exact: true }).fill(options.quantity);
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  return page.url().replace(/\?.*$/, "");
}

/** Types a quantity into the stepper's field and saves it. */
async function saveQuantity(page: Page, quantity: string) {
  await page.getByLabel("Quantity", { exact: true }).fill(quantity);
  await page.getByRole("button", { name: "Save quantity" }).click();
}

/**
 * "Report a problem": opens the dialog, fills it and sends it. Answers with
 * the question the browser asked first, if any ("Remove from stock?").
 */
async function report(
  page: Page,
  what: "In repair" | "Lost" | "Damaged for good",
  fields: {
    howMany?: string;
    unit?: string;
    happenedOn?: string;
    expectedBack?: string;
    notes?: string;
  } = {},
): Promise<string> {
  await page.getByRole("button", { name: "Report a problem" }).click();
  const dialog = reportDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: new RegExp(`^${what}`) }).check();
  if (fields.howMany) await dialog.getByLabel("How many").fill(fields.howMany);
  if (fields.unit)
    await dialog.getByLabel("Which unit").selectOption({ label: fields.unit });
  if (fields.happenedOn)
    await dialog.getByLabel("Date it happened").fill(fields.happenedOn);
  if (fields.expectedBack)
    await dialog
      .getByLabel("Expected back (optional)")
      .fill(fields.expectedBack);
  if (fields.notes)
    await dialog.getByLabel("Notes (optional)").fill(fields.notes);
  let question = "";
  const answer = (asked: { message(): string; accept(): Promise<void> }) => {
    question = asked.message();
    void asked.accept();
  };
  page.on("dialog", answer);
  await dialog
    .getByRole("button", {
      name:
        what === "In repair"
          ? "Mark in repair"
          : what === "Lost"
            ? "Mark lost"
            : "Remove from stock",
    })
    .click();
  await expect(dialog).toBeHidden();
  page.off("dialog", answer);
  return question;
}

/** Deletes a product from the bottom of its Details tab. */
async function deleteProduct(page: Page, url: string) {
  await page.goto(url);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/products$/);
}

test("gear counted by quantity: tiles, stepper, Report a problem and Out of service, role by role", async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  const isPhone = testInfo.project.name === "phone";
  await signIn(page, demo.bsrOwner);
  const name = `E2E Helmet L ${stamp()}`;
  const url = await addGear(page, name, { quantity: "20" });
  const path = new URL(url).pathname;

  // The owner's Details tab, top to bottom: the product, then the four
  // stock cards.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Product details",
    "Stock",
    "Change quantity",
    "Report a problem",
    "Out of service",
  ]);
  await expectTiles(page, { inStock: 20, available: 20, inRepair: 0 });
  await expect(card(page, "Out of service")).toContainText(
    "Nothing is out of service.",
  );
  // The stepper: "Save quantity" shows only once the number has changed.
  const save = page.getByRole("button", { name: "Save quantity" });
  await expect(save).toHaveCount(0);
  await page.getByRole("button", { name: "One more" }).click();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("21");
  await expect(save).toBeVisible();
  await page.getByRole("button", { name: "One fewer" }).click();
  await expect(save).toHaveCount(0);
  await page.getByRole("button", { name: "One more" }).click();
  await save.click();
  await expectTiles(page, { inStock: 21, available: 21, inRepair: 0 });
  await expect(save).toHaveCount(0);
  await noSidewaysScroll(page);

  // Staff: the Details and Stock tabs; no stepper, no product form, no delete.
  const staff = await as(browser, demo.bsrStaff, path);
  await expect(productTabs(staff.page).getByRole("link")).toHaveText([
    "Details",
    /^Stock\s*21$/,
  ]);
  await expect(staff.page.getByRole("heading", { level: 2 })).toHaveText([
    "Stock",
    "Report a problem",
    "Out of service",
  ]);
  await expect(
    staff.page.getByRole("button", { name: "Delete product" }),
  ).toHaveCount(0);

  // The dialog: a bottom sheet on a phone, a centred box on a desktop.
  await staff.page.getByRole("button", { name: "Report a problem" }).click();
  const sheet = reportDialog(staff.page);
  await expect(sheet).toBeVisible();
  const box = (await sheet.boundingBox())!;
  const viewport = staff.page.viewportSize()!;
  if (isPhone) {
    expect(Math.round(box.width)).toBe(viewport.width);
    expect(Math.round(box.y + box.height)).toBe(viewport.height);
  } else {
    expect(box.width).toBeLessThan(viewport.width / 2);
    expect(box.y).toBeGreaterThan(0);
    expect(box.y + box.height).toBeLessThan(viewport.height);
  }
  // Staff are offered "In repair" and "Lost", never "Damaged for good".
  await expect(sheet.getByRole("radio")).toHaveCount(2);
  await expect(
    sheet.getByRole("radio", { name: /^Damaged for good/ }),
  ).toHaveCount(0);
  // Each label sits above its field; the date is today; "Expected back" is
  // for a repair only.
  await expect(sheet.getByLabel("How many")).toHaveValue("1");
  await expect(sheet.getByLabel("Date it happened")).not.toHaveValue("");
  // Under each date: it is a record, and changes no count.
  await expect(
    sheet.getByText(
      "For information only. It does not affect stock quantities.",
    ),
  ).toHaveCount(2);
  await expect(sheet.getByLabel("Expected back (optional)")).toBeVisible();
  await sheet.getByRole("radio", { name: /^Lost/ }).check();
  await expect(sheet.getByLabel("Expected back (optional)")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await expectTiles(staff.page, { inStock: 21, available: 21, inRepair: 0 });

  // Two into repair, with one date, expected-back date and note between them.
  const happened = dayFromNow(-2);
  const expected = dayFromNow(4);
  await report(staff.page, "In repair", {
    howMany: "2",
    happenedOn: happened,
    expectedBack: expected,
    notes: "Cracked visor",
  });
  // In repair: still in stock, not available.
  await expectTiles(staff.page, { inStock: 21, available: 19, inRepair: 2 });
  const staffLines = outLines(staff.page);
  await expect(staffLines).toHaveCount(2);
  for (const line of await staffLines.all()) {
    await expect(line).toContainText("In repair");
    await expect(line).toContainText("Cracked visor");
    await expect(line).toContainText("Date it happened");
    await expect(line).toContainText("Expected back");
    // Staff: back in use and edit; writing off is not theirs.
    await expect(line.getByRole("button")).toHaveText(["Back in use", "Edit"]);
  }
  // One lost: out of stock altogether, and the Lost tile appears.
  await report(staff.page, "Lost", { notes: "Customer lost it" });
  await expectTiles(staff.page, {
    inStock: 20,
    available: 18,
    inRepair: 2,
    lost: 1,
  });
  const staffLost = staffLines.filter({ hasText: "Customer lost it" });
  await expect(staffLost).toContainText("Lost");
  await expect(staffLost).not.toContainText("Expected back");
  await expect(staffLost.getByRole("button")).toHaveText(["Edit"]);
  await expect(staffLost).toContainText(
    "An owner or manager marks it found or removes it from stock.",
  );

  // Each unit has its own record: editing one line leaves the other alone.
  await staffLines.first().getByRole("button", { name: "Edit" }).click();
  const editing = staff.page.getByRole("dialog", { name: "Edit details" });
  await expect(editing.getByLabel("Date it happened")).toHaveValue(happened);
  await expect(editing.getByLabel("Expected back (optional)")).toHaveValue(
    expected,
  );
  await editing.getByLabel("Notes (optional)").fill("Visor replaced, drying");
  await editing.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editing).toBeHidden();
  await expect(
    staffLines.filter({ hasText: "Visor replaced, drying" }),
  ).toHaveCount(1);
  await expect(staffLines.filter({ hasText: "Cracked visor" })).toHaveCount(1);
  await noSidewaysScroll(staff.page);
  await staff.close();

  // A mechanic: in repair and back in use, nothing else.
  const mechanic = await as(browser, demo.bsrMechanic, path);
  await mechanic.page.getByRole("button", { name: "Report a problem" }).click();
  await expect(reportDialog(mechanic.page).getByRole("radio")).toHaveCount(1);
  await expect(
    reportDialog(mechanic.page).getByRole("radio", { name: /^In repair/ }),
  ).toBeChecked();
  await reportDialog(mechanic.page)
    .getByRole("button", { name: "Close" })
    .click();
  const mechanicLines = outLines(mechanic.page);
  await expect(
    mechanicLines.filter({ hasText: "Cracked visor" }).getByRole("button"),
  ).toHaveText(["Back in use", "Edit"]);
  await expect(
    mechanicLines.filter({ hasText: "Customer lost it" }).getByRole("button"),
  ).toHaveCount(0);
  await expect(card(mechanic.page, "Change quantity")).toHaveCount(0);
  await mechanic.close();

  // A driver reads the counts and the list, and can do nothing to them.
  const driver = await as(browser, demo.bsrDriver, path);
  await expectTiles(driver.page, {
    inStock: 20,
    available: 18,
    inRepair: 2,
    lost: 1,
  });
  await expect(outLines(driver.page)).toHaveCount(3);
  for (const gone of [
    "Report a problem",
    "Back in use",
    "Edit",
    "Found, back in use",
    "Remove from stock",
    "Save quantity",
  ])
    await expect(driver.page.getByRole("button", { name: gone })).toHaveCount(
      0,
    );
  await expect(card(driver.page, "Report a problem")).toHaveCount(0);
  await driver.close();

  // The list says "20 in stock, 1 lost".
  await page.goto("/bsr/products?tab=general");
  await expect(
    page
      .getByRole("list", { name: "Products" })
      .locator("> li")
      .filter({ has: page.getByRole("link", { name, exact: true }) })
      .getByText("20 in stock, 1 lost", { exact: true }),
  ).toBeVisible();

  // The owner: the quantity can't go below the ones in repair.
  await page.goto(url);
  await saveQuantity(page, "1");
  await expect(
    page.getByText(
      "2 units are in repair or booked, so the quantity can’t go below 2.",
    ),
  ).toBeVisible();
  await expectTiles(page, { inStock: 20, available: 18, inRepair: 2, lost: 1 });
  await page.reload();

  // The owner's lines: every action that belongs to the state.
  const lines = outLines(page);
  const lost = lines.filter({ hasText: "Customer lost it" });
  await expect(lost.getByRole("button")).toHaveText([
    "Found, back in use",
    "Edit",
    "Remove from stock",
  ]);
  await expect(
    lines.filter({ hasText: "Cracked visor" }).getByRole("button"),
  ).toHaveText(["Back in use", "Edit", "Remove from stock"]);
  // "Remove from stock" asks first, in the owner's words. Saying no changes nothing.
  let asked = "";
  page.once("dialog", (dialog) => {
    asked = dialog.message();
    void dialog.dismiss();
  });
  await lost.getByRole("button", { name: "Remove from stock" }).click();
  expect(asked).toBe(WRITE_OFF_QUESTION);
  await expect(lines).toHaveCount(3);
  page.once("dialog", (dialog) => void dialog.accept());
  await lost.getByRole("button", { name: "Remove from stock" }).click();
  // Written off: it leaves the list, and the Lost tile goes with it.
  await expect(lines).toHaveCount(2);
  await expectTiles(page, { inStock: 20, available: 18, inRepair: 2 });

  // One repair can't be saved: written off as damaged. It leaves stock.
  page.once("dialog", (dialog) => {
    asked = `again: ${dialog.message()}`;
    void dialog.accept();
  });
  await lines
    .filter({ hasText: "Cracked visor" })
    .getByRole("button", { name: "Remove from stock" })
    .click();
  await expect(lines).toHaveCount(1);
  expect(asked).toBe(`again: ${WRITE_OFF_QUESTION}`);
  await expectTiles(page, { inStock: 19, available: 18, inRepair: 1 });
  // The other is ready: back in use, and available again.
  await lines.getByRole("button", { name: "Back in use" }).click();
  await expectTiles(page, { inStock: 19, available: 19, inRepair: 0 });
  await expect(card(page, "Out of service")).toContainText(
    "Nothing is out of service.",
  );

  // Damaged for good, straight from the dialog: asks, then it is gone.
  expect(
    await report(page, "Damaged for good", { notes: "Run over in the yard" }),
  ).toBe(WRITE_OFF_QUESTION);
  await expectTiles(page, { inStock: 18, available: 18, inRepair: 0 });
  await expect(lines).toHaveCount(0);
  // A lost unit that turns up.
  await report(page, "Lost");
  await expectTiles(page, { inStock: 17, available: 17, inRepair: 0, lost: 1 });
  await lines.getByRole("button", { name: "Found, back in use" }).click();
  await expectTiles(page, { inStock: 18, available: 18, inRepair: 0 });
  await noSidewaysScroll(page);

  // The Stock tab: one row per unit with a status chip, and a hint about
  // tracking each unit on its own.
  await report(page, "In repair");
  await productTabs(page)
    .getByRole("link", { name: /^Stock/ })
    .click();
  const rows = page.locator("li[data-gear-unit]");
  await expect(rows).toHaveCount(18);
  await expect(rows.filter({ hasText: "In use" })).toHaveCount(17);
  await expect(rows.filter({ hasText: "In repair" })).toHaveCount(1);
  await expect(rows.first()).toContainText("Unit 1");
  await expect(page.locator("[data-untracked-hint]")).toContainText(
    "switch on “Track each unit on its own” under Product details, on the Details tab.",
  );
  // The hint takes an owner straight to that switch.
  await expect(
    page
      .locator("[data-untracked-hint]")
      .getByRole("link", { name: "Open Product details" }),
  ).toHaveAttribute("href", /#product-details$/);
  // Nothing here changes a unit: no forms, no buttons in the rows.
  await expect(rows.getByRole("button")).toHaveCount(0);
  await noSidewaysScroll(page);

  // History: who did what, with how many, in the buttons' words, and each
  // event's day and notes.
  await productTabs(page).getByRole("link", { name: "History" }).click();
  for (const line of [
    /changed the quantity of this product/,
    /marked 2 in repair on this product/,
    /marked 1 lost on this product/,
    /changed the details of a unit in repair on this product/,
    /removed 1 from stock as lost on this product/,
    /removed 1 from stock as damaged on this product/,
    /marked 1 back in use on this product/,
    /marked 1 found, back in use on this product/,
  ])
    await expect(page.getByText(line).first()).toBeVisible();
  await expect(page.getByText("Quantity: 20 → 21")).toBeVisible();
  await expect(page.getByText("Notes: Run over in the yard")).toBeVisible();
  await expect(page.getByText("Notes: Customer lost it").first()).toBeVisible();
  await expect(
    page.getByText("Notes: Cracked visor → Visor replaced, drying"),
  ).toBeVisible();
  await expect(page.getByText(/^Date it happened: /).first()).toBeVisible();
  await expect(page.getByText(/^Expected back: /).first()).toBeVisible();
  for (const old of [/marked \d+ damaged/, /Back in stock/, /Remove for good/])
    await expect(page.getByText(old)).toHaveCount(0);

  // Clean up: the repair back in use, the quantity to zero, then delete.
  await page.goto(url);
  await lines.getByRole("button", { name: "Back in use" }).click();
  await expect(lines).toHaveCount(0);
  await saveQuantity(page, "0");
  await expectTiles(page, { inStock: 0, available: 0, inRepair: 0 });
  await deleteProduct(page, url);
});

test("tracked gear: which unit, its name on the line and in the History, and labels on the Stock tab", async ({
  page,
  browser,
}) => {
  test.slow();
  await signIn(page, demo.bsrOwner);
  const tag = stamp();
  const name = `E2E Camera ${tag}`;
  const url = await addGear(page, name, { quantity: "2", track: true });
  const stockUrl = `${url}?tab=stock`;
  const path = new URL(url).pathname;

  // The Stock tab: one row per unit; a label is optional, no two alike.
  await page.goto(stockUrl);
  const rows = page.locator("li[data-gear-unit]");
  const row = (label: string): Locator => rows.filter({ hasText: label });
  await expect(rows).toHaveCount(2);
  await expect(row("Unit 1")).toContainText("In use");
  await expect(row("Unit 2")).toContainText("In use");
  await expect(page.locator("[data-untracked-hint]")).toHaveCount(0);
  const label = `GoPro ${tag}`;
  await rows.first().getByLabel("Label (optional)").fill(label);
  await rows.first().getByRole("button", { name: "Save label" }).click();
  await expect(row(label)).toHaveCount(1);
  const other = rows.filter({ hasNotText: label });
  await other.getByLabel("Label (optional)").fill(label.toUpperCase());
  await other.getByRole("button", { name: "Save label" }).click();
  await expect(
    page.getByText("Another unit of this product already has that label."),
  ).toBeVisible();
  await noSidewaysScroll(page);

  // Staff: the dialog asks which unit, by name. No label field for them.
  const staff = await as(browser, demo.bsrStaff, path);
  await staff.page.getByRole("button", { name: "Report a problem" }).click();
  const which = reportDialog(staff.page).getByLabel("Which unit");
  await expect(which.locator("option")).toHaveText([label, "Unit 2"]);
  await expect(reportDialog(staff.page).getByLabel("How many")).toHaveCount(0);
  await reportDialog(staff.page).getByRole("button", { name: "Close" }).click();
  await report(staff.page, "In repair", { unit: label, notes: "Lens fogged" });
  await expectTiles(staff.page, { inStock: 2, available: 1, inRepair: 1 });
  const staffLine = outLines(staff.page).filter({ hasText: label });
  await expect(staffLine).toContainText("In repair");
  await expect(staffLine).toContainText("Lens fogged");
  // The buttons say which unit they are for.
  await expect(staffLine.getByRole("button")).toHaveText([
    `Back in use: ${label}`,
    `Edit: ${label}`,
  ]);
  // The Stock tab shows its state; staff can't rename it.
  await productTabs(staff.page)
    .getByRole("link", { name: /^Stock/ })
    .click();
  await expect(
    staff.page.locator("li[data-gear-unit]").filter({ hasText: label }),
  ).toContainText("In repair");
  await expect(staff.page.getByLabel("Label (optional)")).toHaveCount(0);
  await productTabs(staff.page).getByRole("link", { name: "Details" }).click();
  await staffLine
    .getByRole("button", { name: `Back in use: ${label}` })
    .click();
  await expect(outLines(staff.page)).toHaveCount(0);
  await report(staff.page, "Lost", { unit: label });
  await expectTiles(staff.page, {
    inStock: 1,
    available: 1,
    inRepair: 0,
    lost: 1,
  });
  // Only the unit still in use is offered now.
  await staff.page.getByRole("button", { name: "Report a problem" }).click();
  await expect(
    reportDialog(staff.page).getByLabel("Which unit").locator("option"),
  ).toHaveText(["Unit 2"]);
  await staff.close();

  // The owner: found, lost again, then written off for good.
  await page.goto(url);
  const line = outLines(page).filter({ hasText: label });
  await expect(line.getByRole("button")).toHaveText([
    `Found, back in use: ${label}`,
    `Edit: ${label}`,
    `Remove from stock: ${label}`,
  ]);
  await line
    .getByRole("button", { name: `Found, back in use: ${label}` })
    .click();
  await expectTiles(page, { inStock: 2, available: 2, inRepair: 0 });
  await report(page, "Lost", { unit: label });
  let asked = "";
  page.once("dialog", (dialog) => {
    asked = dialog.message();
    void dialog.accept();
  });
  await line
    .getByRole("button", { name: `Remove from stock: ${label}` })
    .click();
  await expect(outLines(page)).toHaveCount(0);
  expect(asked).toBe(WRITE_OFF_QUESTION);
  await expectTiles(page, { inStock: 1, available: 1, inRepair: 0 });
  await page.goto(stockUrl);
  await expect(rows).toHaveCount(1);
  await expect(row(label)).toHaveCount(0);

  // History names the unit on every line about it, the written-off one too,
  // and says each thing once.
  await productTabs(page).getByRole("link", { name: "History" }).click();
  for (const said of [
    /marked 1 in repair on this product/,
    /marked 1 back in use on this product/,
    /marked 1 lost on this product/,
    /marked 1 found, back in use on this product/,
    /removed 1 from stock as lost on this product/,
  ])
    await expect(page.getByText(said).first()).toBeVisible();
  await expect(
    page.getByText(/marked 1 in repair on this product/),
  ).toHaveCount(1);
  await expect(page.getByText(`Unit: ${label}`).first()).toBeVisible();
  await expect(page.getByText("Notes: Lens fogged").first()).toBeVisible();
  await expect(page.getByText(`marked unit ${label}`)).toHaveCount(0);

  await page.goto(url);
  await saveQuantity(page, "0");
  await expectTiles(page, { inStock: 0, available: 0, inRepair: 0 });
  await deleteProduct(page, url);
});
