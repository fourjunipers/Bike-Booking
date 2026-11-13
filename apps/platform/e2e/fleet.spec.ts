/**
 * Phase 1a click-through at phone and desktop widths: the grouped fleet list,
 * role limits in the UI, the one status control, the odometer (with the
 * lower-reading confirmation), downtime and its overlap message, tax and
 * insurance, CSV import, make and model dropdowns, QR stickers, locations.
 *
 * Runs against local Supabase or a deploy preview on staging. It can run
 * again and again: whatever a test creates it removes, and the phone and
 * desktop projects (which run side by side) use different bikes.
 */
import { expect, test, type Page } from "@playwright/test";
import { demo, signIn } from "./helpers";

const isPhone = (name: string) => name === "phone";
/** A plate no other run has used. */
const freshPlate = () =>
  `E2E-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.toUpperCase();
const notFound = (page: Page) =>
  page.getByRole("heading", { name: "Page not found" });
/** A panel on a bike or model page, by its heading. */
const panel = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

async function openBike(page: Page, plate: string, shop = "bsr") {
  await page.goto(`/${shop}/fleet?q=${encodeURIComponent(plate)}`);
  await page
    .getByRole("link", { name: new RegExp(plate) })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: plate, level: 1 }),
  ).toBeVisible();
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** A product page's tab. */
const tab = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Sections of this product" })
    .getByRole("link", { name: new RegExp(`^${name}`) });

/** The category chips of the product form (a product can have several). */
const categories = (page: Page) =>
  page.getByRole("group", { name: "Categories" });
/** Ticks or unticks one category chip. */
const tick = (page: Page, label: string) =>
  categories(page).getByText(label, { exact: true }).click();

/** A product's line on the Fleet list. */
const fleetLine = (page: Page, name: string) =>
  page.locator("details[data-fleet-product]", {
    has: page.getByText(name, { exact: true }),
  });

test("fleet: one line per product, A to Z, with vehicle and available counts, and one search box", async ({
  page,
}) => {
  await signIn(page, demo.bsrOwner);
  await page.goto("/bsr/fleet");
  await expect(
    page.getByRole("heading", { name: "Fleet", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/\d+ vehicles in \d+ products\./)).toBeVisible();

  // One line per product, A to Z by name. No group headings.
  const list = page.getByRole("list", { name: "Vehicles by product" });
  const names = await list
    .locator("details[data-fleet-product] > summary span.font-semibold")
    .allInnerTexts();
  expect(names.length).toBeGreaterThanOrEqual(11);
  expect(names).toEqual(
    [...names].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    ),
  );
  expect(names).toContain("Honda PCX 160");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  for (const gone of ["Expand all", "Collapse all"])
    await expect(page.getByRole("button", { name: gone })).toHaveCount(0);
  // No make, model, engine size or transmission anywhere on the page.
  for (const gone of [
    "Make",
    "Model",
    "Group by",
    "Sort by",
    "Transmission",
    "Engine size from (cc)",
  ])
    await expect(page.getByLabel(gone, { exact: true })).toHaveCount(0);
  await expect(page.getByText(/\d+ cc/)).toHaveCount(0);

  // Each line: how many vehicles, and how many are available now.
  const pcx = fleetLine(page, "Honda PCX 160");
  await expect(pcx.locator("summary")).toContainText(
    /3 vehicles · [0-3] available/,
  );
  // A line opens to its vehicles.
  await expect(page.getByRole("link", { name: /DEMO-001/ })).toBeHidden();
  await pcx.getByText("Honda PCX 160", { exact: true }).click();
  await expect(page.getByRole("link", { name: /DEMO-001/ })).toBeVisible();

  // One search box: a plate finds its product, with just that vehicle...
  await page.getByLabel("Find a vehicle").fill("DEMO-002");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=DEMO-002/);
  await expect(list.locator("details[data-fleet-product]")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /DEMO-002/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /DEMO-001/ })).toHaveCount(0);
  // ...and a product's name finds the product, with all its vehicles.
  await page.getByLabel("Find a vehicle").fill("pcx");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(list.locator("details[data-fleet-product]")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /DEMO-00[123]/ })).toHaveCount(3);
  await page.getByLabel("Find a vehicle").fill("no such thing");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(
    page.getByText("No vehicle matches “no such thing”."),
  ).toBeVisible();

  // The product filter: one dropdown, A to Z.
  await page.goto("/bsr/fleet");
  const options = await page
    .getByLabel("Product", { exact: true })
    .locator("option")
    .allInnerTexts();
  expect(options.slice(1)).toEqual(
    [...options.slice(1)].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ),
  );
  await page.getByText(/^Filters/).click();
  await page
    .getByLabel("Product", { exact: true })
    .selectOption({ label: "Yamaha NMAX" });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/product=[0-9a-f-]{36}/);
  await expect(list.locator("details[data-fleet-product]")).toHaveCount(1);
  await expect(fleetLine(page, "Yamaha NMAX")).toBeVisible();
  await page.getByRole("link", { name: "Reset view" }).click();
  await expect(page).toHaveURL(/\/bsr\/fleet$/);
  await noSidewaysScroll(page);
});

test("a 150-bike fleet: five lines, their counts, and it stays usable", async ({
  page,
}) => {
  await signIn(page, demo.bigOwner);
  const started = Date.now();
  await page.goto("/big-fleet/fleet");
  // The working fleet: the demo's 5 retired bikes are kept, one link away.
  await expect(
    page.getByText(/1\d\d vehicles in \d+ products\./),
  ).toBeVisible();
  expect(Date.now() - started).toBeLessThan(15_000);
  const lines = page.locator("details[data-fleet-product]");
  expect(await lines.count()).toBeGreaterThanOrEqual(5);
  await expect(lines.first().locator("summary")).toContainText(
    /\d+ vehicles · \d+ available/,
  );
  // Closed until opened: a long fleet stays quick to scroll.
  await expect(page.getByRole("link", { name: /BIG-/ })).toHaveCount(0);
  await lines.first().locator("summary span.font-semibold").click();
  expect(
    await lines.first().getByRole("link", { name: /BIG-/ }).count(),
  ).toBeGreaterThan(10);
  await noSidewaysScroll(page);
  await page.getByRole("link", { name: /^\d+ sold or retired$/ }).click();
  await expect(page).toHaveURL(/scope=past/);
  await expect(page.getByLabel("Show")).toHaveValue("past");
  await expect(page.getByRole("link", { name: /BIG-/ }).first()).toBeVisible();
});

test("purchase and sale sit in one section, for owners and managers only", async ({
  page,
  browser,
}) => {
  await signIn(page, demo.bsrOwner);
  await openBike(page, "DEMO-001");
  const money = panel(page, "Purchase and sale");
  await expect(money).toBeVisible();
  await expect(money.getByLabel("Purchase price (THB)")).toHaveValue(
    "94000.00",
  );
  await expect(money.getByLabel("Bought from")).toHaveValue(
    "Demo dealer (not a real purchase)",
  );
  // The only price and sale fields on the page are in that section.
  await expect(page.getByLabel("Sale price (THB)")).toHaveCount(1);
  await expect(page.getByLabel("Sold to")).toHaveCount(1);
  await expect(page.getByText("Mark as sold")).toHaveCount(0);
  const url = page.url();

  for (const email of [demo.bsrMechanic, demo.bsrStaff, demo.bsrDriver]) {
    const context = await browser.newContext();
    const other = await context.newPage();
    await signIn(other, email);
    await other.goto(url);
    await expect(
      other.getByRole("heading", { name: "DEMO-001" }),
    ).toBeVisible();
    await expect(other.getByText("Purchase and sale")).toHaveCount(0);
    await expect(other.getByText("94000")).toHaveCount(0);
    await expect(
      other.getByRole("button", { name: "Delete vehicle" }),
    ).toHaveCount(0);
    // Everyone sees the frame number, the dates and the sticker.
    await expect(other.getByText("DEMOFRAME0001")).toBeVisible();
    await expect(other.getByText("Insurance expires")).toBeVisible();
    await expect(
      other.getByRole("heading", { name: "QR sticker" }),
    ).toBeVisible();
    // The renewal's cost is money too.
    await expect(other.getByText("645")).toHaveCount(0);
    await context.close();
  }
});

test("a driver reads a bike but can't change it", async ({ page }) => {
  await signIn(page, demo.bsrDriver);
  await page.goto("/bsr/fleet");
  await expect(page.getByRole("link", { name: /Add vehicle/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New product" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Import CSV" })).toHaveCount(0);
  await openBike(page, "DEMO-004");
  await expect(
    page.getByText("You can view this vehicle but not change it."),
  ).toBeVisible();
  await expect(page.getByLabel(/^Odometer \(/)).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add downtime" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Add record" })).toHaveCount(0);
  await page.goto("/bsr/fleet/import");
  await expect(notFound(page)).toBeVisible();
});

test("a mechanic: one status control, the odometer with a confirmation when lower, and downtime with a clear overlap message", async ({
  page,
}, info) => {
  // Two tabs and many steps: three times the usual time limit.
  test.slow();
  const plate = isPhone(info.project.name) ? "DEMO-002" : "DEMO-003";
  await signIn(page, demo.bsrMechanic);
  await expect(page).toHaveURL(/\/bsr\/maintenance$/);
  await page.getByLabel("Plate number").fill(plate.toLowerCase());
  await page.getByLabel("Plate number").press("Enter");
  await page.getByRole("link", { name: new RegExp(plate) }).click();
  await expect(
    page.getByRole("heading", { name: plate, level: 1 }),
  ).toBeVisible();

  // Left over from a run that was cut short.
  const leftover = page.getByRole("button", { name: /^(Remove|End now)$/ });
  while ((await leftover.count()) > 0) {
    const before = await leftover.count();
    await leftover.first().click();
    await expect(leftover).toHaveCount(before - 1);
  }

  // Status: one control, with a line of help each. No second one by the odometer.
  const status = panel(page, "Status");
  await expect(status.getByRole("radio")).toHaveCount(2);
  await expect(
    status.getByText("Can be rented.", { exact: true }),
  ).toBeVisible();
  await expect(
    status.getByText(/Can't be rented until it is set back to Active/),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveCount(0);
  await status.getByRole("radio", { name: /^Maintenance/ }).check();
  await status.getByRole("button", { name: "Save" }).click();
  await expect(status.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(
    panel(page, "Status").getByRole("radio", { name: /^Maintenance/ }),
  ).toBeChecked();
  await panel(page, "Status")
    .getByRole("radio", { name: /^Active/ })
    .check();
  await panel(page, "Status").getByRole("button", { name: "Save" }).click();
  await expect(panel(page, "Status").getByText("Saved")).toBeVisible();

  // Odometer: up saves straight away.
  const odometerPanel = panel(page, "Odometer");
  const odometer = odometerPanel.getByLabel("Odometer (km)");
  const reading = Number(await odometer.inputValue());
  await odometer.fill(String(reading + 10));
  await odometerPanel.getByRole("button", { name: "Save" }).click();
  await expect(odometerPanel.getByText("Saved")).toBeVisible();

  // Lower: a question first. "Cancel" changes nothing.
  let question = "";
  page.once("dialog", (dialog) => {
    question = dialog.message();
    void dialog.dismiss();
  });
  await odometer.fill(String(reading + 4));
  await odometerPanel.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(() => question)
    .toBe(
      `Are you sure? This is lower than the current reading (${reading + 10} km).`,
    );
  await page.reload();
  await expect(panel(page, "Odometer").getByLabel("Odometer (km)")).toHaveValue(
    String(reading + 10),
  );
  // "OK" saves it, for a mechanic too.
  page.once("dialog", (dialog) => void dialog.accept());
  await panel(page, "Odometer")
    .getByLabel("Odometer (km)")
    .fill(String(reading));
  await panel(page, "Odometer").getByRole("button", { name: "Save" }).click();
  await expect(panel(page, "Odometer").getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(panel(page, "Odometer").getByLabel("Odometer (km)")).toHaveValue(
    String(reading),
  );

  // Downtime far in the future, so it never meets real data.
  const add = async () => {
    await page.getByLabel("From", { exact: true }).fill("2031-03-10T09:00");
    await page.getByLabel("Until", { exact: true }).fill("2031-03-12T18:00");
    await page.getByLabel("Reason").fill("E2E tyre change");
    await page.getByRole("button", { name: "Add downtime" }).click();
  };
  await add();
  await expect(page.getByText("Downtime: E2E tyre change")).toBeVisible();
  await add();
  await expect(
    page.getByText("This vehicle is already blocked for part of that time."),
  ).toBeVisible();
  await expect(page.getByText("Downtime: E2E tyre change")).toHaveCount(1);
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Downtime: E2E tyre change")).toHaveCount(0);
  await expect(page.getByText("No downtime now or planned.")).toBeVisible();

  // Downtime from now ("From" left blank), with the bike open in two tabs.
  // (The form still holds the times of the refused attempt above.)
  await page.getByLabel("From", { exact: true }).fill("");
  await page.getByLabel("Until", { exact: true }).fill("");
  await page.getByLabel("Reason").fill("E2E flat tyre");
  await page.getByRole("button", { name: "Add downtime" }).click();
  await expect(page.getByText("Downtime: E2E flat tyre")).toBeVisible();
  const second = await page.context().newPage();
  await second.goto(page.url());
  await expect(second.getByText("Downtime: E2E flat tyre")).toBeVisible();
  // Ended in the first tab...
  await page.getByRole("button", { name: "End now" }).click();
  await expect(page.getByText("No downtime now or planned.")).toBeVisible();
  // ...so the second, stale, tab is told so and nothing is written again.
  await second.getByRole("button", { name: "End now" }).click();
  await expect(
    second.getByText(/already ended or removed by someone else/),
  ).toBeVisible();
  await expect(second.getByText("No downtime now or planned.")).toBeVisible();
  // A new downtime can be added straight away, in either tab, no reload.
  await second.getByLabel("Reason").fill("E2E second flat");
  await second.getByRole("button", { name: "Add downtime" }).click();
  await expect(second.getByText("Downtime: E2E second flat")).toBeVisible();
  await second.getByRole("button", { name: "End now" }).click();
  await expect(second.getByText("No downtime now or planned.")).toBeVisible();
  await second.close();
  await page.getByLabel("Reason").fill("E2E third flat");
  await page.getByRole("button", { name: "Add downtime" }).click();
  await expect(page.getByText("Downtime: E2E third flat")).toBeVisible();
  await page.getByRole("button", { name: "End now" }).click();
  await expect(page.getByText("No downtime now or planned.")).toBeVisible();
  await noSidewaysScroll(page);
});

test("CSV import by make and model; then tax and insurance on the bike and the dashboard", async ({
  page,
}) => {
  await signIn(page, demo.bsrManager);
  await page.goto("/bsr/fleet/import");
  await expect(
    page.getByRole("heading", { name: "Import vehicles from CSV" }),
  ).toBeVisible();
  await expect(
    page.getByText(/product, vehicle_type, category, year, plate/),
  ).toBeVisible();
  await expect(page.getByText("first_registered")).toHaveCount(0);
  // No make, model, engine size or transmission column, and a line saying
  // where a shop can put them.
  await expect(
    page.getByText(
      /put the make, model and years in the product’s name or description/,
    ),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "make" })).toHaveCount(0);
  const categories = panel(page, "Categories");
  await expect(
    categories.getByText("sedan, suv, pickup, van, hatchback, convertible"),
  ).toBeVisible();
  await expect(
    categories.getByText("atv, utv, dirt_bike", { exact: true }),
  ).toBeVisible();
  const plate = freshPlate();

  await page
    .getByLabel("Or paste the rows here")
    .fill(
      [
        "product,year,plate,purchase_price",
        `Honda PCX 160,2026,${plate},95000`,
        "honda  pcx160,,DEMO-001,",
        "Brand new scooter,,,",
        "Honda PCX 160,26,,12.345",
      ].join("\n"),
    );
  await page.getByRole("button", { name: "Check and import" }).click();
  await expect(
    page.getByText("4 problems found. Nothing was imported."),
  ).toBeVisible();
  const problems = page.getByRole("table").first();
  await expect(
    problems.getByText("A vehicle in your fleet already has this plate."),
  ).toBeVisible();
  await expect(
    problems.getByText("A new motorbike or car needs a “category”."),
  ).toBeVisible();
  // The pasted rows are still there to fix.
  await expect(page.getByLabel("Or paste the rows here")).toHaveValue(
    /Brand new scooter/,
  );
  await page.goto(`/bsr/fleet?q=${plate}`);
  await expect(page.getByText(`No vehicle matches “${plate}”.`)).toBeVisible();

  await page.goto("/bsr/fleet/import");
  await page.getByLabel("Or paste the rows here").fill(
    [
      "product,year,plate,colour,odometer,purchase_price",
      // The product is found by its name, whatever the case and spacing.
      `honda pcx  160,2026,${plate},Orange,1234,95000`,
    ].join("\n"),
  );
  await page.getByRole("button", { name: "Check and import" }).click();
  await expect(
    page.getByText("Imported 1 vehicle and no new products."),
  ).toBeVisible();

  await openBike(page, plate);
  await expect(page.getByLabel("Colour")).toHaveValue("Orange");
  await expect(page.getByLabel("Year", { exact: true })).toHaveValue("2026");
  await expect(page.getByLabel("Odometer (km)")).toHaveValue("1234");
  await expect(page.getByLabel("Purchase price (THB)")).toHaveValue("95000.00");
  // Removed for good.
  await expect(page.getByText("First registered")).toHaveCount(0);
  await expect(page.getByText(/Borrowed/)).toHaveCount(0);

  // Tax and insurance: two labelled dates, empty until a record exists.
  const renewals = panel(page, "Tax and insurance");
  await expect(renewals.getByText("Road tax expires")).toBeVisible();
  await expect(renewals.getByText("Insurance expires")).toBeVisible();
  await expect(renewals.getByText("No record")).toHaveCount(2);

  // Insurance expiring in 30 days (the spec's acceptance check).
  const in30 = new Date(Date.now() + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  await renewals.getByLabel("Kind").selectOption("compulsory_insurance");
  await renewals.getByLabel("Provider").fill("E2E insurer");
  await renewals.getByLabel("Policy or receipt number").fill("E2E-1");
  await renewals.getByLabel("Cost (THB)").fill("645");
  await renewals.getByLabel("Expiry date").fill(in30);
  await renewals.getByRole("button", { name: "Add record" }).click();
  // The runner's clock and the shop's can be a day apart.
  await expect(renewals.getByText(/Expires in (29|30|31) days/)).toBeVisible();
  await expect(renewals.getByText("No record")).toHaveCount(1);
  await renewals.getByText(/1 record/).click();
  await expect(renewals.getByText(/E2E insurer · E2E-1 · .*645/)).toBeVisible();

  // It is on the dashboard, under Upcoming, and opens the bike.
  await page.goto("/bsr/dashboard?view=upcoming");
  const due = page.getByRole("link", {
    name: new RegExp(`${plate} · Insurance \\(compulsory\\)`),
  });
  await expect(due).toBeVisible();
  await due.click();
  await expect(
    page.getByRole("heading", { name: plate, level: 1 }),
  ).toBeVisible();

  // Clean up (its records go with it).
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete vehicle" }).click();
  await expect(page).toHaveURL(/\/bsr\/fleet(\?.*)?$/);
  await page.goto("/bsr/dashboard?view=upcoming");
  await expect(due).toHaveCount(0);
});

test("the dashboard lists seeded renewals: overdue road tax under Late", async ({
  page,
}) => {
  await signIn(page, demo.bsrStaff);
  await page.goto("/bsr/dashboard?view=late");
  await expect(
    page.getByRole("link", { name: /DEMO-002 · Road tax/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /DEMO-002 · Road tax/ }).click();
  await expect(page.getByRole("heading", { name: "DEMO-002" })).toBeVisible();
  await expect(
    panel(page, "Tax and insurance").getByText(/Expired \d+ days? ago/),
  ).toBeVisible();
});

test("a manager adds a product with a kind and a name, buffers in hours, a bike, and marks it sold", async ({
  page,
}) => {
  // Many steps on one bike: three times the usual time limit.
  test.slow();
  await signIn(page, demo.bsrManager);
  const name = `E2E model ${freshPlate()}`;
  const frame = `F${freshPlate()}`;
  await page.goto("/bsr/products/new");
  // The create form (owner, 13 Nov 2026): a heading, the kind, and one line
  // for the product's name. No make, model, engine size or transmission, and
  // nothing that suggests or fills in a model.
  await expect(
    page.getByRole("heading", { name: "Product details" }),
  ).toBeVisible();
  await expect(page.getByText("What kind of product is it?")).toBeVisible();
  const nameField = page.getByLabel("Product name");
  await expect(nameField).toHaveAttribute(
    "placeholder",
    "e.g. Honda CB500X 2022-2024",
  );
  for (const gone of [
    "Make and model",
    "Make",
    "Model",
    "Engine size (cc)",
    "Transmission",
  ])
    await expect(page.getByLabel(gone, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  for (const gone of ["Manually enter", "Choose from the list instead"])
    await expect(page.getByRole("button", { name: gone })).toHaveCount(0);
  // The tip says where the Moto Mangos model is chosen: on the product page.
  await expect(
    page
      .getByRole("complementary", { name: "Helpful tip" })
      .getByText(
        "To put this vehicle on the Moto Mangos marketplace, save it first. Then, on its product page, select its make and model from the Moto Mangos list or send us its details.",
      ),
  ).toBeVisible();
  // The name is required...
  await expect(nameField).toHaveAttribute("required", "");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page).toHaveURL(/\/products\/new/);
  await nameField.fill(name);
  // ...and a motorbike needs a category: refused with a message under the
  // chips, and what was typed is still there.
  const ticked = categories(page).getByRole("checkbox", { checked: true });
  await expect(ticked).toHaveCount(0);
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(categories(page).getByRole("alert")).toHaveText("Required.");
  await expect(page).toHaveURL(/\/products\/new/);
  await expect(nameField).toHaveValue(name);
  await tick(page, "Touring");
  await expect(ticked).toHaveCount(1);
  await page.getByLabel("Deposit (THB)").fill("5000");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.getByLabel("Deposit (THB)")).toHaveValue("5000.00");
  // Saved with a name alone: nothing but its type and category beside it.
  await expect(
    page.getByText("Vehicle · Touring", { exact: true }),
  ).toBeVisible();
  const modelUrl = page.url();

  // The listing switch and settings sit in the Moto Mangos panel, and can't
  // be used until a model is selected or approved.
  const listing = panel(page, "Moto Mangos");
  await expect(
    listing.getByText(
      "You can switch this on once a model is selected from the list above, or your request is approved.",
    ),
  ).toBeVisible();
  for (const label of [
    "List this product on Moto Mangos",
    "Instant units",
    "Request units",
    "Walk-ins",
  ])
    await expect(listing.getByLabel(label, { exact: true })).toBeDisabled();
  // What each quantity is for.
  for (const text of [
    "Set bike quantities per booking type",
    "Future bookings that receive instant approval",
    "Future bookings that require your approval",
    "Bookings that are ready for immediate pickup today (overrides the booking buffer)",
  ])
    await expect(listing.getByText(text, { exact: true })).toBeVisible();
  await expect(
    listing.getByText(/How many of the active vehicles confirm instantly/),
  ).toHaveCount(0);
  await expect(panel(page, "Details").getByLabel("Instant units")).toHaveCount(
    0,
  );

  // Buffers are typed in hours, decimals allowed.
  const before = page.getByLabel("Buffer before pickup (hours)");
  const after = page.getByLabel("Buffer after return (hours)");
  await before.fill("0.5");
  await after.fill("a while");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(
    page.getByText("Enter the hours as a number, like 2 or 0.5 (168 at most)."),
  ).toBeVisible();
  await after.fill("1,5");
  await page.getByRole("button", { name: "Save" }).first().click();
  // (Exactly "Saved": the "Product saved" note is still on the page.)
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(before).toHaveValue("0.5");
  await expect(after).toHaveValue("1.5");

  // Retire and Delete are the last things on the page.
  const lastButton = page.getByRole("main").getByRole("button").last();
  await expect(lastButton).toHaveText("Delete product");

  // Its vehicles are on the Units tab.
  await tab(page, "Units").click();
  await expect(page.getByText("Model-year bands")).toHaveCount(0);

  // A bike of it: the model is already chosen.
  await page.getByRole("link", { name: "Add vehicle" }).click();
  await expect(
    page.getByRole("heading", { name: "Add vehicle", level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("Product", { exact: true })).toHaveValue(
    /^model:/,
  );
  await page.getByLabel("Year", { exact: true }).fill("2021");
  await page.getByLabel("Frame (chassis) number").fill(frame);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByText("Enter the plate, or tick “Plate pending”."),
  ).toBeVisible();
  // What was typed is still there.
  await expect(page.getByLabel("Frame (chassis) number")).toHaveValue(frame);
  await page.getByLabel("Plate pending (not registered yet)").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: "No plate", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This vehicle has no plate yet. Staff are warned before check-out.",
    ),
  ).toBeVisible();

  // An old form can't overwrite a newer save. The same bike is open in a
  // second tab and saved there; saving from this, now stale, tab is refused.
  const second = await page.context().newPage();
  await second.goto(page.url());
  const secondDetails = panel(second, "Details");
  await secondDetails.getByLabel(/^Odometer/).fill("1500");
  await secondDetails.getByRole("button", { name: "Save" }).click();
  await expect(secondDetails.getByText("Saved")).toBeVisible();
  await second.close();
  const details = panel(page, "Details");
  await details.getByLabel("Colour").fill("Blue");
  await details.getByRole("button", { name: "Save" }).click();
  await expect(
    details.getByText(/changed by someone else while this form was open/),
  ).toBeVisible();
  await page.reload();
  // The newer reading is still there; after the reload the change saves.
  await expect(panel(page, "Details").getByLabel(/^Odometer/)).toHaveValue(
    "1500",
  );
  await panel(page, "Details").getByLabel("Colour").fill("Blue");
  await panel(page, "Details").getByRole("button", { name: "Save" }).click();
  await expect(panel(page, "Details").getByText("Saved")).toBeVisible();

  // It is on its product's line on the Fleet list.
  await page.goto(`/bsr/fleet?q=${frame}`);
  await expect(fleetLine(page, name).locator("summary")).toContainText(
    "1 vehicle · 1 available",
  );
  await page.getByRole("link", { name: /No plate/ }).click();

  // Sold is refused while the bike has a block in the future.
  await page.getByLabel("From", { exact: true }).fill("2031-05-01T09:00");
  await page.getByLabel("Until", { exact: true }).fill("2031-05-02T09:00");
  await page.getByRole("button", { name: "Add downtime" }).click();
  await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
  const status = panel(page, "Status");
  await expect(status.getByRole("radio")).toHaveCount(4);
  await status.getByRole("radio", { name: /^Sold/ }).check();
  // Selling asks first, saying what will happen.
  let sellQuestion = "";
  page.once("dialog", (dialog) => {
    sellQuestion = dialog.message();
    void dialog.accept();
  });
  await status.getByRole("button", { name: "Save" }).click();
  await expect(
    status.getByText(/still has a block that ends in the future/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("No downtime now or planned.")).toBeVisible();

  expect(sellQuestion).toBe(
    "Mark this vehicle as sold? It leaves the fleet list and can't be rented or booked. Its history is kept. You fill in the sale details next.",
  );

  // Sold only changes the status, then sends you to the one money section.
  await status.getByRole("radio", { name: /^Sold/ }).check();
  page.once("dialog", (dialog) => void dialog.accept());
  await status.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/sold=1#purchase-sale$/);
  const money = panel(page, "Purchase and sale");
  await expect(
    money.getByText(
      "Marked as sold. Fill in the sale date, price and buyer here, then save.",
    ),
  ).toBeVisible();
  await expect(money).toBeInViewport();
  await expect(money.getByLabel("Sale price (THB)")).toHaveValue("");
  await money.getByLabel("Sale price (THB)").fill("61000");
  await money.getByLabel("Sold to").fill("E2E buyer");
  await money.getByRole("button", { name: "Save" }).click();
  await expect(money.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(
    panel(page, "Purchase and sale").getByLabel("Sale price (THB)"),
  ).toHaveValue("61000.00");

  // A sold bike leaves the everyday Fleet list but is still on file.
  const soldUrl = page.url();
  await page.goto(`/bsr/fleet?q=${frame}`);
  await expect(page.getByText(`No vehicle matches “${frame}”.`)).toBeVisible();
  await page.goto(`/bsr/fleet?scope=past&q=${frame}`);
  await expect(page.getByRole("link", { name: /No plate/ })).toBeVisible();
  await page.goto(soldUrl);

  // Clean up: the bike, then the model (its bands go with it).
  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete vehicle" }).click();
  await expect(page).toHaveURL(/\/bsr\/fleet(\?.*)?$/);
  await page.goto(modelUrl);
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/bsr\/products(\?.*)?$/);
});

test("my own product: a kind and a name, no duplicate names, then matched or sent to Moto Mangos with its details", async ({
  page,
  browser,
}) => {
  // Two people and many steps: three times the usual time limit.
  test.slow();
  await signIn(page, demo.bsrOwner);
  const make = `E2emake${Date.now().toString(36)}`;
  // "+ Add to inventory" only offers what the shop has; the link under the
  // dropdowns goes to "+ Make & model" and comes back.
  await page.goto("/bsr/fleet/units/new");
  await expect(
    page.getByRole("heading", { name: "Add vehicle", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Only your own products are listed."),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Product not here? Add it first" })
    .click();
  await expect(
    page.getByRole("heading", { name: "New product", level: 1 }),
  ).toBeVisible();
  // A kind and a name, and it is saved at once: no approval, no details.
  const own = `${make} Tester 125`;
  const tip = page.getByRole("complementary", { name: "Helpful tip" });
  await expect(tip).toBeVisible();
  await page.getByLabel("Product name").fill(own);
  await tick(page, "Scooter");
  await page.getByRole("button", { name: "Save and add a vehicle" }).click();

  // Back on "Add vehicle" with it chosen.
  await expect(page).toHaveURL(/\/fleet\/units\/new\?product=/);
  await expect(
    page
      .getByLabel("Product", { exact: true })
      .locator("option", { hasText: own }),
  ).toHaveCount(1);
  await expect(page.getByLabel("Product", { exact: true })).toHaveValue(
    /^model:/,
  );
  const plate = freshPlate();
  await page.getByLabel("Plate", { exact: true }).fill(plate);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: plate, level: 1 }),
  ).toBeVisible();
  const bikeUrl = page.url();

  // The same name again, in other letters and spacing: refused.
  await page.goto("/bsr/products/new");
  await page
    .getByLabel("Product name")
    .fill(`  ${make.toUpperCase()}  tester125 `);
  await tick(page, "Scooter");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(
    page.getByText("That name is already used in this shop."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/products\/new/);

  // Any vehicle. A boat's category is optional, and it has no Moto Mangos
  // tip (Moto Mangos lists motorbikes).
  const boatName = `Yamaha Boat ${Date.now().toString(36)}`;
  await page.getByText("Boat or jet ski", { exact: true }).click();
  await expect(tip).toHaveCount(0);
  await page.getByLabel("Product name").fill(boatName);
  await expect(categories(page).locator("label")).toHaveText([
    "Jet ski",
    "Speedboat",
    "Pontoon",
  ]);
  await tick(page, "Jet ski");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(
    page.getByRole("heading", { name: boatName, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/Boat or jet ski · Jet ski/)).toBeVisible();
  // Not a motorcycle: no Moto Mangos panel.
  await expect(panel(page, "Moto Mangos")).toHaveCount(0);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/bsr\/products(\?.*)?$/);

  // Off-road: ATV, UTV and Dirt bike. No Moto Mangos tip, and no panel
  // once it is saved: Moto Mangos lists motorcycles only.
  await page.goto("/bsr/products/new");
  // (Motorbikes have an "Off-road" category too: this is the kind.)
  await page
    .getByRole("group", { name: "What kind of product is it?" })
    .getByText("Off-road", { exact: true })
    .click();
  await expect(categories(page).locator("label")).toHaveText([
    "ATV",
    "UTV",
    "Dirt bike",
  ]);
  await expect(tip).toHaveCount(0);
  const dirtBike = `Dirt bike ${Date.now().toString(36)}`;
  await page.getByLabel("Product name").fill(dirtBike);
  await tick(page, "Dirt bike");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(
    page.getByRole("heading", { name: dirtBike, level: 1 }),
  ).toBeVisible();
  await expect(panel(page, "Moto Mangos")).toHaveCount(0);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/bsr\/products(\?.*)?$/);
  await page.goto("/bsr/products/new");

  // A car: a category is required. Its name is close to a list entry, so
  // its page offers the match once it is a motorbike.
  await page.getByText("Car", { exact: true }).click();
  await expect(categories(page).locator("label")).toHaveText([
    "Sedan",
    "SUV",
    "Pickup",
    "Van",
    "Hatchback",
    "Convertible",
  ]);
  const carName = `Honda Forza 350 ${Date.now().toString(36)}`;
  await page.getByLabel("Product name").fill(carName);
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(categories(page).getByRole("alert")).toHaveText("Required.");
  // A product can have more than one category.
  await tick(page, "SUV");
  await tick(page, "Pickup");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(
    page.getByRole("heading", { name: carName, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/Car · SUV · Pickup/)).toBeVisible();
  // The Moto Mangos panel is for motorcycles only: a car has none.
  const mangos = panel(page, "Moto Mangos");
  await expect(mangos).toHaveCount(0);
  await expect(page.getByText("List it on Moto Mangos")).toHaveCount(0);
  // As a motorbike it gets the Moto Mangos panel, and can take a model
  // from its list. A car's category doesn't carry over to a motorbike.
  await page.getByText("Motorbike", { exact: true }).click();
  await expect(
    categories(page).getByRole("checkbox", { checked: true }),
  ).toHaveCount(0);
  await tick(page, "Adventure");
  await tick(page, "Touring");
  await page.getByRole("button", { name: "Save" }).first().click();
  // Both show, in the list's own order.
  await expect(page.getByText(/Vehicle · Touring · Adventure/)).toBeVisible();
  await expect(mangos).toBeVisible();
  await expect(mangos.getByText("Did you mean:")).toHaveCount(0);
  // The picker: Make, then Model with its years, filtered by the make.
  await expect(
    mangos.getByRole("group", {
      name: "Select your make and model from the list",
    }),
  ).toBeVisible();
  const listMake = mangos.locator("#list-make");
  const listModel = mangos.locator("#catalog_id");
  await expect(listModel).toBeDisabled();
  const makes = (await listMake.locator("option").allInnerTexts()).slice(1);
  expect(makes).toEqual([...makes].sort((a, b) => a.localeCompare(b)));
  expect(makes).toContain("Yamaha");
  await listMake.selectOption("Honda");
  await expect(listModel).toBeEnabled();
  const models = (await listModel.locator("option").allInnerTexts()).slice(1);
  expect(
    models.some((label) => /^Forza 350( \(\d{4}(–\d{4})?\))?$/.test(label)),
  ).toBe(true);
  // Only Honda's models, each without the make in front.
  expect(models.filter((label) => /NMAX|Aerox|Honda/.test(label))).toEqual([]);
  // Another make empties the model again.
  await listMake.selectOption("Yamaha");
  await expect(listModel).toHaveValue("");
  await listMake.selectOption("Honda");
  await listModel.selectOption(
    (await listModel
      .locator("option", { hasText: "Forza 350" })
      .first()
      .getAttribute("value"))!,
  );
  await expect(
    mangos.getByRole("button", { name: "Use this model" }),
  ).toHaveCount(0);
  await mangos.getByRole("button", { name: "Select", exact: true }).click();
  await expect(
    mangos.getByText(/On the Moto Mangos list as Honda Forza 350/),
  ).toBeVisible();
  // A model is selected: the listing switch and settings can be used now.
  await expect(
    mangos.getByLabel("List this product on Moto Mangos"),
  ).toBeEnabled();
  // Its kind is the list's from here on; no make or model shows on the page.
  await expect(page.getByText("What kind of product is it?")).toHaveCount(0);
  await expect(page.getByText(/330 cc/)).toHaveCount(0);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/bsr\/products(\?.*)?$/);

  // The first one matches nothing: it is sent to Moto Mangos.
  await page.goto(bikeUrl);
  await page.getByRole("link", { name: own }).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);
  const modelUrl = page.url();
  await expect(
    mangos.getByText(
      "An online marketplace where you can list your rental bikes to be seen by renters in your area.",
    ),
  ).toBeVisible();
  // The panel, top to bottom: the logo, "List it on Moto Mangos", the
  // picker, the line that opens the review form, then the listing settings.
  await expect(mangos.getByRole("img", { name: "Moto Mangos" })).toBeVisible();
  const order = await mangos.evaluate((panel) => {
    const top = (selector: string, text?: string) =>
      [...panel.querySelectorAll(selector)]
        .find((el) => !text || el.textContent?.includes(text))!
        .getBoundingClientRect().top;
    return [
      top("img"),
      top("h3", "List it on Moto Mangos"),
      top("select[name=catalog_id]"),
      top("summary", "Don’t see your bike above?"),
      top("input[name=listed]"),
    ];
  });
  expect(order).toEqual([...order].sort((a, b) => a - b));
  await expect(
    mangos.getByRole("group", {
      name: "Select your make and model from the list",
    }),
  ).toBeVisible();
  // Not listable until a model is selected or approved.
  await expect(
    mangos.getByLabel("List this product on Moto Mangos"),
  ).toBeDisabled();

  // Nothing is sent until the review form is opened and filled in. (The
  // owner once sent a product and never saw the form: it used to sit open in
  // the panel, its make and model already filled in from the name.)
  const send = mangos.getByRole("button", { name: "Send for review" });
  await expect(send).toBeHidden();
  await expect(mangos.getByLabel("Year of your bike")).toBeHidden();
  await expect(mangos.getByText(/Sent to Moto Mangos\./)).toHaveCount(0);
  await mangos
    .getByText(
      "Don’t see your bike above? Send us the details and we’ll get it added",
    )
    .click();
  await expect(send).toBeVisible();
  // The one place that asks for a make, model, engine size, transmission
  // and year: all five required. The make and model start from its name.
  await expect(
    mangos.getByText(
      "Give its make, model, engine size, transmission and year: all five are needed. We review it first because it is new to our list.",
    ),
  ).toBeVisible();
  // The review form (the panel also has a make and model picker for the
  // list, so the form is found by its own anchor).
  const review = page.locator("#send-for-review");
  await expect(review.getByLabel("Make", { exact: true })).toHaveValue(make);
  await expect(review.getByLabel("Model", { exact: true })).toHaveValue(
    "Tester 125",
  );
  for (const label of [
    "Make",
    "Model",
    "Engine size (cc)",
    "Transmission",
    "Year of your bike",
  ])
    await expect(review.getByLabel(label, { exact: true })).toHaveAttribute(
      "required",
      "",
    );
  await expect(review.getByLabel("Engine size (cc)")).toHaveValue("");
  // Without the engine size and transmission nothing is sent.
  await send.click();
  await expect(mangos.getByText(/Sent to Moto Mangos\./)).toHaveCount(0);
  await review.getByLabel("Engine size (cc)").fill("125");
  await review.getByLabel("Transmission").selectOption("automatic");
  // ...nor without the year of the bike. A single year; no range to give.
  await send.click();
  await expect(mangos.getByText(/Sent to Moto Mangos\./)).toHaveCount(0);
  await expect(review.getByLabel("First model year")).toHaveCount(0);
  await review.getByLabel("Year of your bike").fill("2023");
  await send.click();
  await expect(mangos.getByText(/Sent to Moto Mangos\./)).toBeVisible();
  // The Moto Mangos chip is on the Products list.
  await page.goto(`/bsr/products?q=${make}`);
  const chips = page.getByRole("list", { name: "Products" });
  await expect(chips.getByText("In review", { exact: true })).toBeVisible();

  // The admin rejects it with a note, and the shop is told why on its model.
  const reviewer = await (await browser.newContext()).newPage();
  await signIn(reviewer, demo.admin, "/admin/catalog");
  const rejected = reviewer.locator("li", { hasText: `${make} Tester 125` });
  await expect(
    rejected.getByText("If you reject, the shop sees this note on its model."),
  ).toBeVisible();
  await rejected.getByLabel("Review note").fill("E2E: add the model years");
  await rejected.getByRole("button", { name: "Reject" }).click();
  await expect(rejected).toHaveCount(0);
  await reviewer.context().close();
  await page.goto(modelUrl);
  await expect(
    mangos.getByText(
      /Moto Mangos reviewed this model on .+ and didn't add it\./,
    ),
  ).toBeVisible();
  await expect(mangos.getByText("E2E: add the model years")).toBeVisible();
  // The dashboard and the Fleet list say so too, until it is dealt with.
  await page.goto("/bsr/dashboard");
  const news = page.getByRole("region", { name: "Moto Mangos reviews" });
  await expect(
    news.getByRole("link", { name: `${make} Tester 125` }),
  ).toContainText("Not added: see why");
  // The Moto Mangos chip is on the Products list.
  await page.goto(`/bsr/products?q=${make}`);
  await expect(chips.getByText("Needs changes", { exact: true })).toBeVisible();
  await page.goto(modelUrl);
  // What to do next, beside the reason: two buttons and one line.
  await expect(mangos.getByText("What to do next")).toBeVisible();
  await expect(
    mangos.getByText(
      "Fix the details and send it for review again, or switch to a model that is already on the list.",
    ),
  ).toBeVisible();
  const editAgain = mangos.getByRole("link", { name: "Edit and send again" });
  await expect(editAgain).toHaveAttribute("href", "#send-for-review");
  expect(
    Math.round((await editAgain.boundingBox())!.height),
  ).toBeGreaterThanOrEqual(44);
  await mangos
    .getByRole("link", { name: "Choose a model from the list instead" })
    .click();
  await expect(page).toHaveURL(/#choose-from-list$/);
  await expect(
    mangos.getByRole("button", { name: "Select", exact: true }),
  ).toBeVisible();
  // Edited and sent again: it is pending again and the old outcome goes.
  // The review form holds what was sent before, ready to be corrected.
  await editAgain.click();
  await expect(page).toHaveURL(/#send-for-review$/);
  await expect(review.getByLabel("Make", { exact: true })).toHaveValue(make);
  await expect(review.getByLabel("Engine size (cc)")).toHaveValue("125");
  await expect(review.getByLabel("Transmission")).toHaveValue("automatic");
  await review.getByLabel("Year of your bike").fill("2024");
  await mangos.getByRole("button", { name: "Send for review again" }).click();
  await expect(mangos.getByText(/Sent to Moto Mangos\./)).toBeVisible();
  await expect(mangos.getByText("E2E: add the model years")).toHaveCount(0);

  // The only place the approval list appears: the platform admin's. Here
  // the admin decides it is really an existing entry and merges it.
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, demo.admin, "/admin/catalog");
  const request = admin.locator("li", { hasText: `${make} Tester 125` });
  await expect(request).toBeVisible();
  await request
    .getByLabel("It is the same bike as")
    .selectOption({ label: "Honda Forza 350" });
  await request.getByRole("button", { name: "Merge" }).click();
  await expect(request).toHaveCount(0);
  await admin.context().close();

  // The shop's model now sits on that preset and can be listed. The shop is
  // told on the model, the Fleet list and the dashboard.
  // Sending it was asking for it to be listed, so it is listed now.
  // The Moto Mangos chip is on the Products list.
  await page.goto(`/bsr/products?q=${make}`);
  await expect(
    chips.getByText("Listed on Moto Mangos", { exact: true }),
  ).toBeVisible();
  await expect(chips.getByText("Needs changes", { exact: true })).toHaveCount(
    0,
  );
  await page.goto("/bsr/dashboard");
  await expect(
    page
      .getByRole("region", { name: "Moto Mangos reviews" })
      .getByRole("link", { name: `${make} Tester 125` }),
  ).toContainText("Added to the Moto Mangos list");
  await page.goto(modelUrl);
  await expect(
    mangos.getByText(/Moto Mangos added this model to its list on /),
  ).toBeVisible();
  await expect(
    mangos.getByText("On the Moto Mangos list as Honda Forza 350."),
  ).toBeVisible();
  // Already switched on by the approval; the shop can switch it off.
  await expect(
    mangos.getByLabel("List this product on Moto Mangos"),
  ).toBeChecked();
  await mangos.getByLabel("List this product on Moto Mangos").uncheck();
  await mangos.getByRole("button", { name: "Save" }).click();
  await expect(mangos.getByText("Saved")).toBeVisible();

  // Clean up: the bike, then the model.
  await page.goto(bikeUrl);
  await page.getByRole("button", { name: "Delete vehicle" }).click();
  await expect(page).toHaveURL(/\/bsr\/fleet(\?.*)?$/);
  await page.goto(modelUrl);
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/bsr\/products(\?.*)?$/);
});

test("removing things: deleting for good, Restore, and retiring a product", async ({
  page,
}) => {
  test.slow();
  await signIn(page, demo.bsrOwner);
  const make = `Retmake${Date.now().toString(36)}`;
  const name = `${make} Old 110`;
  await page.goto("/bsr/products/new");
  await page.getByLabel("Product name").fill(name);
  await tick(page, "Scooter");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  const modelUrl = page.url().replace(/\?.*$/, "");

  // One vehicle, with a downtime booked for later.
  await tab(page, "Units").click();
  await page.getByRole("link", { name: "Add vehicle" }).click();
  const plate = freshPlate();
  await page.getByLabel("Plate", { exact: true }).fill(plate);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: plate, level: 1 }),
  ).toBeVisible();
  const unitUrl = page.url();
  await page.getByLabel("From", { exact: true }).fill("2032-05-01T09:00");
  await page.getByLabel("Until", { exact: true }).fill("2032-05-02T09:00");
  await page.getByRole("button", { name: "Add downtime" }).click();
  await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();

  // Every step asks first, saying what will happen.
  const questions: string[] = [];
  page.on("dialog", (dialog) => {
    questions.push(dialog.message());
    void dialog.accept();
  });
  // Delete is the last thing on the page, under the purchase and sale
  // details, and a solid red button.
  const del = page.getByRole("button", { name: "Delete vehicle" });
  const delBox = (await del.boundingBox())!;
  const moneyBox = (await panel(page, "Purchase and sale").boundingBox())!;
  expect(delBox.y).toBeGreaterThan(moneyBox.y + moneyBox.height);
  expect(Math.round(delBox.height)).toBeGreaterThanOrEqual(44);
  expect(
    await del.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toMatch(/rgba\(0, 0, 0, 0\)|255, 255, 255|244, 244, 245/);
  expect(await del.evaluate((el) => getComputedStyle(el).color)).toBe(
    "rgb(255, 255, 255)",
  );

  // Retiring is refused while a downtime is still to come.
  const status = panel(page, "Status");
  await status.getByRole("radio", { name: /^Retired/ }).check();
  await status.getByRole("button", { name: "Save" }).click();
  await expect(
    status.getByText(/still has a block that ends in the future/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("No downtime now or planned.")).toBeVisible();
  await status.getByRole("radio", { name: /^Retired/ }).check();
  await status.getByRole("button", { name: "Save" }).click();
  await expect(status.getByRole("button", { name: "Restore" })).toBeVisible();
  expect(questions).toContain(
    "Retire this vehicle? It leaves the fleet list and can't be rented or booked. Its history is kept, and you can restore it later.",
  );

  // A retired vehicle is with the sold and retired ones, and has Restore.
  await page.goto(`/bsr/fleet?q=${plate}`);
  await expect(page.getByText(`No vehicle matches “${plate}”.`)).toBeVisible();
  await page.goto(`/bsr/fleet?scope=past&q=${plate}`);
  await expect(
    page.getByRole("link", { name: new RegExp(plate) }),
  ).toBeVisible();

  // A product is deleted from its page, never retired, and only once it has
  // no vehicles at all. Its one vehicle is retired, and still counts.
  await page.goto(modelUrl);
  await expect(
    page.getByRole("button", { name: "Retire product" }),
  ).toHaveCount(0);
  const deleteProduct = page.getByRole("button", { name: "Delete product" });
  // The last thing on the page.
  await expect(page.getByRole("main").getByRole("button").last()).toHaveText(
    "Delete product",
  );
  const asked = questions.length;
  await deleteProduct.click();
  await expect.poll(() => questions.length).toBe(asked + 1);
  expect(questions.at(-1)).toBe(
    "This product still has vehicles. Remove all its vehicles first.",
  );
  // Nothing happened: it is still there, with its vehicle.
  await page.reload();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await tab(page, "Units").click();
  await expect(
    page.getByRole("link", { name: new RegExp(plate) }),
  ).toBeVisible();

  await page.goto(unitUrl);
  await status.getByRole("button", { name: "Restore" }).click();
  await expect(status.getByRole("radio", { name: /^Active/ })).toBeChecked();
  await expect(status.getByRole("button", { name: "Restore" })).toHaveCount(0);

  // A downtime that has ended stays on the vehicle's record. It used to stop
  // the vehicle being deleted at all; now it goes with the vehicle.
  await page.getByLabel("From", { exact: true }).fill("");
  await page.getByLabel("Until", { exact: true }).fill("");
  await page.getByLabel("Reason").fill("E2E old repair");
  await page.getByRole("button", { name: "Add downtime" }).click();
  await page.getByRole("button", { name: "End now" }).click();
  await expect(page.getByText("No downtime now or planned.")).toBeVisible();

  // Deleted for good, after a warning that says so. Then the model.
  await del.click();
  await expect(page).toHaveURL(/\/bsr\/fleet(\?.*)?$/);
  expect(questions).toContain(
    "Delete this vehicle for good? This is permanent and can't be undone. Its purchase and sale details, tax and insurance records, downtime and odometer history are erased with it.",
  );
  await page.goto(`/bsr/fleet?scope=all&q=${plate}`);
  await expect(page.getByText(`No vehicle matches “${plate}”.`)).toBeVisible();
  await page.goto(modelUrl);
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/bsr\/products(\?.*)?$/);
});

test("fleet: New product at the top, Add vehicle on each line with one Product dropdown, and filters", async ({
  page,
}) => {
  await signIn(page, demo.bsrManager);
  await page.goto("/bsr/fleet");
  await expect(
    page.getByRole("link", { name: "New product", exact: true }),
  ).toHaveAttribute("href", "/bsr/products/new");
  await expect(
    page.getByRole("link", { name: "Add vehicle", exact: true }),
  ).toHaveCount(0);

  const pcx = fleetLine(page, "Honda PCX 160");
  // The edit pencil beside the title opens the product; no "Open product"
  // button. Named, focusable, 44 px to tap.
  const pencil = pcx.getByRole("link", { name: "Edit product: Honda PCX 160" });
  await expect(pencil).toHaveAttribute(
    "href",
    /\/bsr\/products\/[0-9a-f-]{36}$/,
  );
  const pencilBox = (await pencil.boundingBox())!;
  expect(Math.round(pencilBox.width)).toBeGreaterThanOrEqual(44);
  expect(Math.round(pencilBox.height)).toBeGreaterThanOrEqual(44);
  await pencil.focus();
  await expect(pencil).toBeFocused();
  await expect(page.getByRole("link", { name: /^Open product/ })).toHaveCount(
    0,
  );
  // The same tags as on the Products list.
  const tags = pcx.getByRole("list", { name: "About Honda PCX 160" });
  await expect(tags.getByText("Scooter", { exact: true })).toBeVisible();
  await expect(tags.getByText(/Moto Mangos$/)).toBeVisible();
  // "Add vehicle" on a product's line: labelled, outlined, 44 px tall.
  const plus = pcx.getByRole("link", {
    name: /^Add vehicle\s*: Honda PCX 160$/,
  });
  await expect(plus).toContainText("Add vehicle");
  const box = await plus.boundingBox();
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);
  await plus.click();
  await expect(page).toHaveURL(
    /\/bsr\/fleet\/units\/new\?product=[0-9a-f-]{36}$/,
  );
  // One Product dropdown, A to Z by name; no make, no model.
  await expect(page.getByLabel("Make", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Model", { exact: true })).toHaveCount(0);
  const product = page.getByLabel("Product", { exact: true });
  await expect(product).toHaveValue(/^model:/);
  const offered = (await product.locator("option").allInnerTexts()).slice(1);
  expect(offered).toEqual(
    [...offered].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ),
  );
  // Only the shop's own products: nothing from the Moto Mangos list.
  expect(offered).toContain("Honda PCX 160");
  expect(offered.filter((label) => /Wave/.test(label))).toEqual([]);

  // The kind filter: this shop has motorbikes only.
  await page.goto("/bsr/fleet?kind=car");
  await expect(
    page.getByText("No vehicles match these filters."),
  ).toBeVisible();
  await expect(page.getByLabel("Kind of vehicle")).toHaveValue("car");
  await page.getByLabel("Kind of vehicle").selectOption({ label: "Motorbike" });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/kind=motorbike/);
  await expect(fleetLine(page, "Honda PCX 160")).toBeVisible();
  // The category filter finds a product by any of its categories.
  await page.getByLabel("Category").selectOption({ label: "Scooter" });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/category=city_scooter/);
  await expect(fleetLine(page, "Honda PCX 160")).toBeVisible();
  await page.goto("/bsr/fleet?category=pontoon");
  await expect(fleetLine(page, "Honda PCX 160")).toHaveCount(0);
  await noSidewaysScroll(page);
});

test("print stickers: tick bikes or select all for the filter; the code opens the bike only for its shop", async ({
  page,
  browser,
}) => {
  await signIn(page, demo.bsrStaff);
  await page.goto("/bsr/fleet?reset=1");
  await page.getByRole("link", { name: "Print stickers" }).click();
  await expect(
    page.getByRole("heading", { name: "Print stickers" }),
  ).toBeVisible();
  const boxes = page.locator(".sticker-sheet").getByRole("checkbox");
  const total = await boxes.count();
  expect(total).toBeGreaterThanOrEqual(20);
  const print = page.getByRole("button", { name: "Print" });
  await expect(print).toBeDisabled();
  await expect(page.getByText("0 selected")).toBeVisible();

  await boxes.nth(0).check();
  await boxes.nth(2).check();
  await expect(page.getByText("2 selected")).toBeVisible();
  await expect(print).toBeEnabled();
  // On paper: only the ticked stickers, no checkboxes, no app shell.
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sticker-sheet li:visible")).toHaveCount(2);
  await expect(page.locator(".sticker-sheet li:visible svg")).toHaveCount(2);
  await expect(boxes.first()).toBeHidden();
  await expect(print).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  // Filter by product (one dropdown), then select everything listed.
  await expect(page.getByLabel("Make", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Product", { exact: true })
    .selectOption({ label: "Yamaha NMAX" });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/product=[0-9a-f-]{36}/);
  await expect(boxes).toHaveCount(2);
  await page.getByLabel("Select all 2 listed").check();
  await expect(page.getByText("2 selected")).toBeVisible();

  // From a bike's page, that bike is already ticked.
  await openBike(page, "DEMO-005");
  const bikeUrl = page.url();
  await page.getByRole("link", { name: "Print this sticker" }).click();
  await expect(page.getByText("1 selected")).toBeVisible();
  await page.goBack();

  const code = page.getByRole("link", { name: "QR sticker" });
  const stickerUrl = await code.getAttribute("href");
  expect(stickerUrl).toMatch(/\/q\/[0-9a-f]{32}$/);
  await code.click();
  await expect(page).toHaveURL(bikeUrl);

  // Someone from another shop gets "not found", the same as for a made-up code.
  const context = await browser.newContext();
  const outsider = await context.newPage();
  await outsider.goto(new URL(stickerUrl!).pathname);
  await expect(outsider).toHaveURL(/\/login\?next=%2Fq%2F/);
  await signIn(outsider, demo.saigonOwner, new URL(stickerUrl!).pathname);
  await expect(notFound(outsider)).toBeVisible();
  await outsider.goto(new URL(bikeUrl).pathname);
  await expect(notFound(outsider)).toBeVisible();
  await outsider.goto(`/q/${"0".repeat(32)}`);
  await expect(notFound(outsider)).toBeVisible();
  await context.close();
});

test("locations: the owner sets the time zone; a manager can't; staff can't open the page", async ({
  page,
  browser,
}) => {
  await signIn(page, demo.bsrOwner);
  await page.goto("/bsr/locations");
  await expect(page.getByRole("heading", { name: "Locations" })).toBeVisible();
  await page
    .getByRole("link", { name: /BSR Bike Shop.*Main location/ })
    .click();
  await expect(page.getByLabel("Time zone")).toHaveValue("Asia/Bangkok");
  await expect(page.getByLabel("Address")).toHaveValue(/Soi Phumichit/);
  await expect(page.getByLabel("Phone")).toHaveValue("+66850550247");
  await expect(
    page.getByRole("heading", { name: "Opening hours" }),
  ).toBeVisible();
  await expect(page.getByLabel("Opens").first()).toHaveValue(/^1[01]:00$/);
  await expect(page.getByText("Songkran · every year")).toBeVisible();
  // The main location can't be deleted.
  await expect(
    page.getByRole("button", { name: "Delete location" }),
  ).toHaveCount(0);
  const url = page.url();

  // A phone number in a national format is refused.
  await page.getByLabel("Phone").fill("085 055 0247");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(
    page.getByText("Use the international format, such as +66850550247."),
  ).toBeVisible();

  const manager = await (await browser.newContext()).newPage();
  await signIn(manager, demo.bsrManager);
  await manager.goto(url);
  await expect(
    manager.getByText("Only an owner can change the time zone."),
  ).toBeVisible();
  await expect(manager.getByLabel("Time zone")).toHaveCount(0);
  await manager.context().close();

  const staff = await (await browser.newContext()).newPage();
  await signIn(staff, demo.bsrStaff);
  await staff.goto("/bsr/locations");
  await expect(notFound(staff)).toBeVisible();
  await staff.context().close();
});

test("settings: distances, a locked currency once money is saved, and the reminder days", async ({
  page,
}) => {
  await signIn(page, demo.bsrOwner);
  await page.goto("/bsr/settings");
  await expect(page.getByLabel("Distances")).toHaveValue("km");
  await expect(page.getByLabel("Currency")).toBeDisabled();
  await expect(
    page.getByText("Locked: prices have been saved in this currency."),
  ).toBeVisible();
  const reminders = panel(page, "Tax and insurance reminders");
  // Whatever the shop has chosen (the default is 45, 30, 14, 7).
  await expect(reminders.getByLabel("Days before expiry")).toHaveValue(
    /^\d+(, \d+)*$/,
  );
  // Checked before anything is saved.
  await reminders.getByLabel("Days before expiry").fill("45, soon");
  await reminders.getByRole("button", { name: "Save" }).click();
  await expect(
    reminders.getByText(/Enter up to 10 whole numbers from 1 to 365/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open locations" }).click();
  await expect(page).toHaveURL(/\/bsr\/locations$/);
});

test("catalog requests are for platform admins, not shop owners", async ({
  page,
  browser,
}) => {
  await signIn(page, demo.bsrOwner);
  await page.goto("/admin/catalog");
  await expect(notFound(page)).toBeVisible();

  // Signing in with no address in mind lands the admin on their page, not
  // on "You're not in a shop yet".
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, demo.admin);
  await expect(admin).toHaveURL(/\/admin\/catalog$/);
  await expect(
    admin.getByRole("heading", { name: "Catalog requests" }),
  ).toBeVisible();
  await admin.context().close();
});
