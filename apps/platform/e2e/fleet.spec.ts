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

test("fleet: grouped by model, expand and collapse, group by make, search, and the last view is remembered", async ({
  page,
}, info) => {
  await signIn(page, demo.bsrOwner);
  if (isPhone(info.project.name)) {
    // On a phone, Fleet is reached from "You and this device" or Maintenance.
    await page.goto("/bsr/maintenance");
    await page.getByRole("link", { name: "See the whole fleet" }).click();
  } else {
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Fleet" })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Fleet", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/\d+ vehicles in \d+ products\./)).toBeVisible();

  // Grouped by model: a heading per model, a closed group underneath.
  await expect(
    page.getByRole("heading", { name: "Honda PCX 160", exact: true }),
  ).toBeVisible();
  const pcx = page.locator("details[data-fleet-group]", {
    hasText: "Honda PCX 160 · All years",
  });
  await expect(pcx.getByText(/^\d vehicles: \d active/)).toBeVisible();
  await expect(page.getByRole("link", { name: /DEMO-001/ })).toBeHidden();
  await page.getByRole("button", { name: "Expand all" }).click();
  for (const plate of ["DEMO-001", "DEMO-010", "DEMO-019"])
    await expect(
      page.getByRole("link", { name: new RegExp(plate) }),
    ).toBeVisible();
  // The 20th demo bike has no plate yet.
  await expect(page.getByText("Plate pending").first()).toBeVisible();
  await page.getByRole("button", { name: "Collapse all" }).click();
  await expect(page.getByRole("link", { name: /DEMO-001/ })).toBeHidden();
  // One group opens with its down arrow.
  await pcx.locator("summary").click();
  await expect(page.getByRole("link", { name: /DEMO-001/ })).toBeVisible();
  await noSidewaysScroll(page);

  // Group by make.
  await page.getByLabel("Group by").selectOption("make");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/group=make/);
  const makeGroup = (make: string) =>
    page
      .locator("details[data-fleet-group]")
      .filter({ has: page.getByText(make, { exact: true }) });
  await expect(makeGroup("Honda")).toContainText(/\d+ vehicles: \d+ active/);
  await expect(makeGroup("Yamaha")).toContainText("5 vehicles: ");

  // Opening Fleet again brings that view back; Reset forgets it. (The view is
  // noted on the device a moment after the page draws.)
  const remembered = async () =>
    (await page.context().cookies()).find((c) => c.name === "fleetview_bsr")
      ?.value ?? "";
  await expect.poll(remembered).toContain("make");
  await page.goto("/bsr/fleet");
  await expect(page).toHaveURL(/\/bsr\/fleet\?group=make$/);
  await page.getByRole("link", { name: "Reset view" }).click();
  await expect(page.getByLabel("Group by")).toHaveValue("model");
  await expect.poll(remembered).toBe("");
  await page.goto("/bsr/fleet");
  await expect(page).toHaveURL(/\/bsr\/fleet$/);

  // Search opens the matching group.
  await page.getByLabel("Find a vehicle").fill("demo-019");
  await page.getByLabel("Find a vehicle").press("Enter");
  await expect(page).toHaveURL(/q=demo-019/);
  await expect(page.getByRole("link", { name: /DEMO-019/ })).toBeVisible();
  await expect(page.getByText("Showing 1 of ")).toBeVisible();
  await page.goto("/bsr/fleet?q=no-such-plate");
  await expect(
    page.getByText("No vehicle matches “no-such-plate”."),
  ).toBeVisible();

  // Filters: only Yamaha automatics.
  await page.goto("/bsr/fleet?make=Yamaha&transmission=automatic&group=none");
  await expect(page.getByText(/Showing 5 of \d+ vehicles/)).toBeVisible();
  await expect(page.getByText("Filters (2)")).toBeVisible();
});

test("a 150-bike fleet: year bands newest first, unknown year last, and it stays usable", async ({
  page,
}) => {
  await signIn(page, demo.bigOwner);
  const started = Date.now();
  await page.goto("/big-fleet/fleet?reset=1");
  // The working fleet: the demo's 5 retired bikes are kept, one link away.
  // About 145 in 5 models; people trying the demo may have added their own.
  await expect(
    page.getByText(/1\d\d vehicles in \d+ products\./),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^\d+ sold or retired$/ }),
  ).toBeVisible();
  const loaded = Date.now() - started;

  const section = page.locator("section", {
    has: page.getByRole("heading", { name: "Honda PCX 160", exact: true }),
  });
  await expect(section.getByText("160 cc · Automatic")).toBeVisible();
  // Its chips: where it stands with Moto Mangos, its categories, how many.
  const facts = section.getByRole("list", { name: "About Honda PCX 160" });
  await expect(facts.getByRole("listitem")).toHaveText([
    "Not on Moto Mangos",
    "Scooter",
    /^(29|30) vehicles$/,
  ]);
  const groups = section.locator("details summary p:first-child");
  await expect(groups).toHaveText([
    "Honda PCX 160 · 2024–2026",
    "Honda PCX 160 · 2020–2023",
    "Honda PCX 160 · 2014–2019",
    "Honda PCX 160 · Unknown year",
  ]);
  // A status breakdown on every group.
  await expect(
    section
      .locator("details[data-fleet-group]")
      .first()
      .getByText(/^\d+ vehicles: \d+ active/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(page.getByRole("link", { name: /BIG-001/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /BIG-150/ })).toBeVisible();
  await noSidewaysScroll(page);

  // By status, and by location.
  await page.goto("/big-fleet/fleet?group=status");
  await expect(
    page
      .locator("details[data-fleet-group]")
      .filter({ has: page.getByText("Maintenance", { exact: true }) }),
  ).toContainText(/\d+ vehicles: \d+ maintenance/);
  await page.goto("/big-fleet/fleet?group=location&sort=count");
  await expect(page.locator("details summary p:first-child")).toHaveText([
    "Big Fleet Demo",
    "Airport desk",
  ]);
  await page.goto("/big-fleet/fleet?year=2024&group=none");
  await expect(page.getByText(/Showing \d+ of 1\d\d vehicles/)).toBeVisible();
  // Sold and retired bikes: out of the way, not gone.
  await page.goto("/big-fleet/fleet?reset=1");
  await page.getByRole("link", { name: /^\d+ sold or retired$/ }).click();
  await expect(page).toHaveURL(/scope=past/);
  await expect(page.getByLabel("Show")).toHaveValue("past");
  await expect(page.getByRole("link", { name: /BIG-029/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /BIG-001/ })).toHaveCount(0);
  await page.getByLabel("Show").selectOption("all");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/^1\d\d vehicles$/)).toBeVisible();
  await page.goto("/big-fleet/fleet?reset=1");

  // Generous: a preview's functions are far from its database.
  expect(loaded).toBeLessThan(process.env.PLAYWRIGHT_BASE_URL ? 15_000 : 5_000);
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
    page.getByText(/make, model, model_year, name, plate/),
  ).toBeVisible();
  await expect(page.getByText("first_registered")).toHaveCount(0);
  // The category column, and what to write in it for each kind of vehicle.
  await expect(page.getByText(/vehicle_type, category, cc/)).toBeVisible();
  const categories = panel(page, "Categories");
  await expect(
    categories.getByText("sedan, suv, pickup, van, hatchback, convertible"),
  ).toBeVisible();
  await expect(categories.getByText("atv, utv", { exact: true })).toBeVisible();
  const plate = freshPlate();

  await page
    .getByLabel("Or paste the rows here")
    .fill(
      [
        "make,model,model_year,plate,purchase_price",
        `Honda,PCX 160,2026,${plate},95000`,
        "Honda,PCX 160,,DEMO-001,",
        "Hodna,PCX 160,,,",
        "Honda,PCX 160,26,,12.345",
      ].join("\n"),
    );
  await page.getByRole("button", { name: "Check and import" }).click();
  await expect(
    page.getByText("6 problems found. Nothing was imported."),
  ).toBeVisible();
  const problems = page.getByRole("table").first();
  await expect(
    problems.getByText("A vehicle in your fleet already has this plate."),
  ).toBeVisible();
  await expect(
    // Once for the engine size, once for the transmission.
    problems
      .getByText(/isn't in the list, so it will be one of your own/)
      .first(),
  ).toBeVisible();
  await expect(
    problems.getByText("A new motorbike or car needs a “category”."),
  ).toBeVisible();
  // The pasted rows are still there to fix.
  await expect(page.getByLabel("Or paste the rows here")).toHaveValue(/Hodna/);
  await page.goto(`/bsr/fleet?q=${plate}`);
  await expect(page.getByText(`No vehicle matches “${plate}”.`)).toBeVisible();

  await page.goto("/bsr/fleet/import");
  await page
    .getByLabel("Or paste the rows here")
    .fill(
      [
        "make,model,model_year,plate,colour,odometer,purchase_price",
        `Honda,PCX 160,2026,${plate},Orange,1234,95000`,
      ].join("\n"),
    );
  await page.getByRole("button", { name: "Check and import" }).click();
  await expect(
    page.getByText("Imported 1 vehicle and no new products."),
  ).toBeVisible();

  await openBike(page, plate);
  await expect(page.getByLabel("Colour")).toHaveValue("Orange");
  await expect(page.getByLabel("Model year")).toHaveValue("2026");
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

test("a manager adds a product with a kind and a name, year bands, a bike, and marks it sold", async ({
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
  await expect(nameField).toHaveAttribute("placeholder", "e.g. Honda PCX 160");
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
        "To put this vehicle on the Moto Mangos marketplace, save it first. Then, on its product page, choose its model from the Moto Mangos list or send its details for review.",
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

  // Booking modes can't promise more bikes than the model has.
  await page.getByLabel("Instant units").fill("1");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(
    page.getByText(/can't be more than the model's active vehicles/),
  ).toBeVisible();

  // The shop's own year bands for this product, with its vehicles on the
  // Units tab.
  await tab(page, "Units").click();
  const bands = panel(page, "Model-year bands");
  await expect(bands.getByText("No bands yet")).toBeVisible();
  await bands.getByLabel("From year").fill("2020");
  await bands.getByLabel("To year").fill("2023");
  await bands.getByRole("button", { name: "Add band" }).click();
  await expect(bands.getByText("2020–2023")).toBeVisible();
  await bands.getByLabel("From year").fill("2022");
  await bands.getByLabel("To year").fill("2025");
  await bands.getByRole("button", { name: "Add band" }).click();
  await expect(
    bands.getByText("These years overlap another band of this model."),
  ).toBeVisible();

  // A bike of it: the model is already chosen.
  await page.getByRole("link", { name: "Add vehicle" }).click();
  await expect(
    page.getByRole("heading", { name: "Add vehicle", level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("Product", { exact: true })).toHaveValue(
    /^model:/,
  );
  await page.getByLabel("Model year").fill("2021");
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

  // It lands in its year band on the Fleet list.
  await page.goto(`/bsr/fleet?q=${frame}`);
  await expect(
    page.locator("details[data-fleet-group]", {
      hasText: `${name} · 2020–2023`,
    }),
  ).toContainText("1 vehicle: 1 active");
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
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/bsr\/products(\?.*)?$/);

  // Off-road: ATV, UTV and Dirt bike.
  await page.goto("/bsr/products/new");
  await page.getByText("Off-road", { exact: true }).click();
  await expect(categories(page).locator("label")).toHaveText([
    "ATV",
    "UTV",
    "Dirt bike",
  ]);

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
  const mangos = panel(page, "Moto Mangos");
  await expect(
    mangos.getByText("Moto Mangos lists motorbikes only, for now."),
  ).toBeVisible();
  // As a motorbike, it gets "Did you mean" from its name and can take the
  // list entry. A car's category doesn't carry over to a motorbike.
  await page.getByText("Motorbike", { exact: true }).click();
  await expect(
    categories(page).getByRole("checkbox", { checked: true }),
  ).toHaveCount(0);
  await tick(page, "Adventure");
  await tick(page, "Touring");
  await page.getByRole("button", { name: "Save" }).first().click();
  // Both show, in the list's own order.
  await expect(page.getByText(/Vehicle · Touring · Adventure/)).toBeVisible();
  await expect(mangos.getByText("Did you mean:")).toBeVisible();
  await mangos.getByRole("button", { name: "Use Honda Forza 350" }).click();
  await expect(
    mangos.getByText("On the Moto Mangos list as Honda Forza 350."),
  ).toBeVisible();
  // On the list now: it has the list's make, model, engine size and
  // transmission, and its kind can no longer be changed here.
  await expect(
    page.getByText(/Honda Forza 350 · 330 cc · Automatic/),
  ).toBeVisible();
  await expect(page.getByText("What kind of product is it?")).toHaveCount(0);
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
  // The panel is headed by the Moto Mangos logo, and says how a model that
  // isn't on the list gets listed.
  await expect(mangos.getByRole("img", { name: "Moto Mangos" })).toBeVisible();
  await expect(
    mangos.getByText(
      "This make and model isn’t on the Moto Mangos list yet. You can still list it: switch it on and we’ll review it first, because it’s a new make and model. It goes live once approved. Or select the model if already in the list below.",
    ),
  ).toBeVisible();
  await expect(
    mangos.getByRole("heading", { name: "Choose a model from the list" }),
  ).toBeVisible();
  await expect(mangos.getByText("Did you mean:")).toHaveCount(0);
  // Not listable until it is on their list.
  await expect(mangos.getByLabel("List this model on Moto Mangos")).toHaveCount(
    0,
  );
  // Sending it for review is the moment its make, model, engine size and
  // transmission are asked for: all four required. The make and model start
  // from its name.
  await expect(
    mangos.getByText(
      "Give its make, model, engine size and transmission: all four are needed for a motorbike. We review it first because it is new to our list.",
    ),
  ).toBeVisible();
  const send = mangos.getByRole("button", {
    name: "Switch on and send for review",
  });
  await expect(mangos.getByLabel("Make", { exact: true })).toHaveValue(make);
  await expect(mangos.getByLabel("Model", { exact: true })).toHaveValue(
    "Tester 125",
  );
  for (const label of ["Make", "Model", "Engine size (cc)", "Transmission"])
    await expect(mangos.getByLabel(label, { exact: true })).toHaveAttribute(
      "required",
      "",
    );
  await expect(mangos.getByLabel("Engine size (cc)")).toHaveValue("");
  // Without the engine size and transmission nothing is sent.
  await send.click();
  await expect(mangos.getByText(/Sent to Moto Mangos\./)).toHaveCount(0);
  await mangos.getByLabel("Engine size (cc)").fill("125");
  await mangos.getByLabel("Transmission").selectOption("automatic");
  await send.click();
  await expect(mangos.getByText(/Sent to Moto Mangos\./)).toBeVisible();
  // The details are on the product now.
  await expect(page.getByText(/125 cc · Automatic/)).toBeVisible();
  await page.goto(`/bsr/fleet?q=${plate}`);
  await expect(page.getByText("In review", { exact: true })).toBeVisible();

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
  await page.goto(`/bsr/fleet?q=${plate}`);
  await expect(page.getByText("Needs changes", { exact: true })).toBeVisible();
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
    mangos.getByRole("button", { name: "Use this model" }),
  ).toBeVisible();
  // Edited and sent again: it is pending again and the old outcome goes.
  // The review form holds what was sent before, ready to be corrected.
  await editAgain.click();
  await expect(page).toHaveURL(/#send-for-review$/);
  await expect(mangos.getByLabel("Make", { exact: true })).toHaveValue(make);
  await expect(mangos.getByLabel("Engine size (cc)")).toHaveValue("125");
  await expect(mangos.getByLabel("Transmission")).toHaveValue("automatic");
  await mangos.getByLabel("First model year").fill("2024");
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
  await page.goto(`/bsr/fleet?q=${plate}`);
  await expect(
    page.getByText("Listed on Moto Mangos", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Needs changes", { exact: true })).toHaveCount(0);
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
    mangos.getByLabel("List this model on Moto Mangos"),
  ).toBeChecked();
  await mangos.getByLabel("List this model on Moto Mangos").uncheck();
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

  // While a vehicle is in the fleet its make & model can't be retired.
  await page.goto(modelUrl);
  await expect(
    page.getByRole("button", { name: "Retire product" }),
  ).toHaveCount(0);
  await page.goto(unitUrl);

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

  // Now the make & model can be retired: it leaves the list and the
  // inventory form, and says so on its page.
  await page.goto(modelUrl);
  await page.getByRole("button", { name: "Retire product" }).click();
  await expect(
    page.getByText(/^Retired on .+\. It is hidden from/),
  ).toBeVisible();
  expect(questions).toContain(
    "Retire this product? It leaves the Products and Fleet lists and the “Add vehicle” form, and comes off Moto Mangos. Its vehicles and their history are kept, and you can restore it later.",
  );
  // (reset=1: the default view, not the one remembered from the line above.)
  await page.goto("/bsr/fleet?reset=1");
  await expect(
    page.getByRole("link", { name: "Honda PCX 160", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
  await page.goto("/bsr/fleet?scope=past");
  const retired = page.locator("section", {
    has: page.getByRole("link", { name, exact: true }),
  });
  await expect(
    retired
      .getByRole("list", { name: `About ${name}` })
      .getByText("Retired", { exact: true }),
  ).toBeVisible();
  await expect(retired.getByRole("link", { name: /Add vehicle/ })).toHaveCount(
    0,
  );
  await page.goto("/bsr/fleet/units/new");
  await expect(
    page
      .getByLabel("Make", { exact: true })
      .locator("option", { hasText: make }),
  ).toHaveCount(0);

  // Its vehicle can't come back before it does.
  await page.goto(unitUrl);
  await status.getByRole("button", { name: "Restore" }).click();
  await expect(
    status.getByText("This product is retired. Restore it first."),
  ).toBeVisible();
  await page.goto(modelUrl);
  await page.getByRole("button", { name: "Restore product" }).click();
  await expect(
    page.getByRole("button", { name: "Restore product" }),
  ).toHaveCount(0);
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

test("fleet: New product at the top, Add vehicle on each row, and a kind filter", async ({
  page,
}) => {
  await signIn(page, demo.bsrManager);
  await page.goto("/bsr/fleet");
  // The two jobs have one button each, and nothing says "bike".
  await expect(
    page.getByRole("link", { name: "New product", exact: true }),
  ).toHaveAttribute("href", "/bsr/products/new");
  // No separate "Add vehicle" button at the top: each row has its own.
  await expect(
    page.getByRole("link", { name: "Add vehicle", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /add bike/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /add model/i })).toHaveCount(0);

  // A make & model's title is a link with no underline until hovered.
  const title = page.getByRole("link", { name: "Honda PCX 160", exact: true });
  expect(
    await title.evaluate((el) => getComputedStyle(el).textDecorationLine),
  ).toBe("none");
  // The model's categories show beside it.
  const facts = page.getByRole("list", { name: "About Honda PCX 160" });
  await expect(facts.getByText("Scooter", { exact: true })).toBeVisible();
  // A count badge, a Moto Mangos chip, and a kind icon in a fixed box at the
  // start of the row (so nothing moves when a photo loads).
  await expect(facts.getByText(/^\d+ vehicles?$/)).toBeVisible();
  await expect(
    facts.getByText("Not on Moto Mangos", { exact: true }),
  ).toBeVisible();
  const header = page.locator("section", { has: title }).locator("div").first();
  const iconBox = await header.locator("span").first().boundingBox();
  expect(Math.round(iconBox!.width)).toBe(44);
  expect(Math.round(iconBox!.height)).toBe(44);
  await expect(header.locator("span").first().locator("svg")).toBeVisible();
  // The header row has the light mango tint.
  expect(
    await header.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(255, 247, 237)");

  // "+ Vehicle" on a model's row adds a vehicle of that make & model. It
  // looks like a button: labelled, outlined, 44 px tall.
  const plus = page
    .getByRole("link", {
      name: /^Add vehicle\s*: Honda PCX 160$/,
    })
    .first();
  await expect(plus).toContainText("Add vehicle");
  const box = await plus.boundingBox();
  expect(Math.round(box!.width)).toBeGreaterThanOrEqual(44);
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);
  expect(await plus.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe(
    "1px",
  );
  await plus.click();
  await expect(page).toHaveURL(
    /\/bsr\/fleet\/units\/new\?product=[0-9a-f-]{36}$/,
  );
  await expect(page.getByLabel("Make", { exact: true })).toHaveValue("Honda");
  // Only the shop's own makes & models: nothing from the Moto Mangos list
  // that the shop doesn't have.
  const offered = page.getByLabel("Product", { exact: true }).locator("option");
  await expect(offered.filter({ hasText: "PCX 160" })).toHaveCount(1);
  await expect(offered.filter({ hasText: "Wave" })).toHaveCount(0);

  // The kind filter: this shop has motorbikes only.
  await page.goto("/bsr/fleet?kind=car");
  await expect(
    page.getByText("No vehicles match these filters."),
  ).toBeVisible();
  await expect(page.getByLabel("Kind of vehicle")).toHaveValue("car");
  await page.getByLabel("Kind of vehicle").selectOption({ label: "Motorbike" });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/kind=motorbike/);
  await expect(
    page.getByRole("link", { name: "Honda PCX 160", exact: true }),
  ).toBeVisible();
  // The category filter finds a model by any of its categories.
  await page.getByLabel("Category").selectOption({ label: "Scooter" });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/category=city_scooter/);
  await expect(
    page.getByRole("link", { name: "Honda PCX 160", exact: true }),
  ).toBeVisible();
  await page.goto("/bsr/fleet?category=pontoon");
  await expect(
    page.getByRole("link", { name: "Honda PCX 160", exact: true }),
  ).toHaveCount(0);
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

  // Filter by make, then select everything listed.
  await page.getByLabel("Make", { exact: true }).selectOption("Yamaha");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/make=Yamaha/);
  await expect(boxes).toHaveCount(5);
  await page.getByLabel("Select all 5 listed").check();
  await expect(page.getByText("5 selected")).toBeVisible();

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
