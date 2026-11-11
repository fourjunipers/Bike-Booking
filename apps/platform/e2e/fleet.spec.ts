/**
 * Phase 1a click-through at phone and desktop widths: the fleet from the demo
 * seed (20 bikes from CSV), role limits in the UI, downtime and the overlap
 * message, CSV import, QR stickers, locations and the settings that moved.
 *
 * Runs against local Supabase or a deploy preview on staging. It can run
 * again and again: whatever a test creates it removes, and the phone and
 * desktop projects (which run side by side) use different bikes.
 */
import { expect, test, type Page } from "@playwright/test";
import { demo, mainNav, signIn } from "./helpers";

const isPhone = (name: string) => name === "phone";
/** A plate no other run has used. */
const freshPlate = () =>
  `E2E-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.toUpperCase();

async function openBike(page: Page, plate: string) {
  await page.goto(`/bsr/fleet?q=${encodeURIComponent(plate)}`);
  await page
    .getByRole("link", { name: new RegExp(plate) })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: plate, level: 1 }),
  ).toBeVisible();
}

test("the owner sees the 20 demo bikes and can search them", async ({
  page,
}, info) => {
  await signIn(page, demo.bsrOwner);
  if (isPhone(info.project.name)) {
    // On a phone, Fleet is reached from "You and this device" or Maintenance.
    await page.goto("/bsr/maintenance");
    await page.getByRole("link", { name: "See the whole fleet" }).click();
  } else {
    await mainNav(page, false).getByRole("link", { name: "Fleet" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Fleet", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/\d+ bikes in \d+ models\./)).toBeVisible();
  for (const plate of ["DEMO-001", "DEMO-010", "DEMO-019"]) {
    await expect(
      page.getByRole("link", { name: new RegExp(plate) }),
    ).toBeVisible();
  }
  // The 20th demo bike has no plate yet.
  await expect(page.getByText("Plate pending").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Honda PCX 160", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Honda PCX 160 · 160 cc · Automatic").first(),
  ).toBeVisible();

  await page.getByLabel("Find a bike").fill("demo-019");
  await page.getByLabel("Find a bike").press("Enter");
  await expect(page).toHaveURL(/q=demo-019/);
  await expect(page.getByRole("link", { name: /DEMO-019/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /DEMO-001/ })).toHaveCount(0);

  await page.goto("/bsr/fleet?q=no-such-plate");
  await expect(
    page.getByText("No bike matches “no-such-plate”."),
  ).toBeVisible();
});

test("purchase prices are for owners and managers only", async ({
  page,
  browser,
}) => {
  await signIn(page, demo.bsrOwner);
  await openBike(page, "DEMO-001");
  await expect(
    page.getByRole("heading", { name: "Purchase and sale" }),
  ).toBeVisible();
  await expect(page.getByLabel("Purchase price (THB)").first()).toHaveValue(
    "94000.00",
  );
  await expect(page.getByLabel("Bought from").first()).toHaveValue(
    "Demo dealer (not a real purchase)",
  );
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
    await expect(other.getByText("Mark as sold")).toHaveCount(0);
    await expect(other.getByText("94000")).toHaveCount(0);
    await expect(
      other.getByRole("button", { name: "Delete bike" }),
    ).toHaveCount(0);
    // Everyone sees the frame number and the sticker.
    await expect(other.getByText("DEMOFRAME0001")).toBeVisible();
    await expect(
      other.getByRole("heading", { name: "QR sticker" }),
    ).toBeVisible();
    await context.close();
  }
});

test("a driver reads a bike but can't change it", async ({ page }) => {
  await signIn(page, demo.bsrDriver);
  await page.goto("/bsr/fleet");
  await expect(page.getByRole("link", { name: "Add model" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Import CSV" })).toHaveCount(0);
  await openBike(page, "DEMO-004");
  await expect(
    page.getByText("You can view this bike but not change it."),
  ).toBeVisible();
  await expect(page.getByLabel(/^Odometer \(/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add downtime" })).toHaveCount(
    0,
  );
  await page.goto("/bsr/fleet/import");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});

test("a mechanic finds a bike, updates the odometer, and adds and ends downtime; an overlap is refused clearly", async ({
  page,
}, info) => {
  const phone = isPhone(info.project.name);
  const plate = phone ? "DEMO-002" : "DEMO-003";
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

  // Odometer: up is fine, down needs a manager.
  const odometer = page.getByLabel("Odometer (km)");
  const reading = Number(await odometer.inputValue());
  await odometer.fill(String(reading + 1));
  const save = page
    .getByRole("region", { name: "Odometer and status" })
    .getByRole("button", { name: "Save" });
  await save.click();
  await expect(page.getByText("Saved").first()).toBeVisible();
  await odometer.fill(String(Math.max(0, reading - 5)));
  await save.click();
  await expect(
    page.getByText(
      "That reading is lower than the last one. Ask a manager to correct it.",
    ),
  ).toBeVisible();

  // Downtime far in the future, so it never meets real data.
  const add = async () => {
    await page.getByLabel("From").fill("2031-03-10T09:00");
    await page.getByLabel("Until").fill("2031-03-12T18:00");
    await page.getByLabel("Reason").fill("E2E tyre change");
    await page.getByRole("button", { name: "Add downtime" }).click();
  };
  await add();
  await expect(page.getByText("Downtime: E2E tyre change")).toBeVisible();
  await expect(
    page.getByText(/10 Mar 2031.*12 Mar 2031|Mar 10, 2031.*Mar 12, 2031/),
  ).toBeVisible();

  await add();
  await expect(
    page.getByText("This bike is already blocked for part of that time."),
  ).toBeVisible();
  await expect(page.getByText("Downtime: E2E tyre change")).toHaveCount(1);

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Downtime: E2E tyre change")).toHaveCount(0);
  await expect(page.getByText("No downtime now or planned.")).toBeVisible();

  // No horizontal scrolling at either width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("CSV import: problems are listed by line and nothing is saved; a clean file imports", async ({
  page,
}) => {
  await signIn(page, demo.bsrManager);
  await page.goto("/bsr/fleet/import");
  await expect(
    page.getByRole("heading", { name: "Import bikes from CSV" }),
  ).toBeVisible();
  const plate = freshPlate();

  await page
    .getByLabel("Or paste the rows here")
    .fill(
      [
        "model,catalog,plate,first_registered,purchase_price",
        `Honda PCX 160,,${plate},2026-01-15,95000`,
        "Honda PCX 160,,DEMO-001,,",
        "Brand New Model,,,2026-02-30,12.345",
      ].join("\n"),
    );
  await page.getByRole("button", { name: "Check and import" }).click();
  await expect(
    page.getByText("4 problems found. Nothing was imported."),
  ).toBeVisible();
  const problems = page.getByRole("table");
  await expect(problems.getByRole("row")).toHaveCount(5);
  await expect(
    problems.getByText("A bike in your fleet already has this plate."),
  ).toBeVisible();
  await expect(
    problems.getByText("This is a new model, so it needs a catalog code."),
  ).toBeVisible();
  await page.goto(`/bsr/fleet?q=${plate}`);
  await expect(page.getByText(`No bike matches “${plate}”.`)).toBeVisible();

  await page.goto("/bsr/fleet/import");
  await page
    .getByLabel("Or paste the rows here")
    .fill(
      [
        "model,plate,colour,odometer,purchase_price",
        `Honda PCX 160,${plate},Orange,1234,95000`,
      ].join("\n"),
    );
  await page.getByRole("button", { name: "Check and import" }).click();
  await expect(
    page.getByText("Imported 1 bike and no new models."),
  ).toBeVisible();

  await openBike(page, plate);
  await expect(page.getByLabel("Colour")).toHaveValue("Orange");
  await expect(page.getByLabel("Odometer (km)")).toHaveValue("1234");
  await expect(page.getByLabel("Purchase price (THB)").first()).toHaveValue(
    "95000.00",
  );

  // Clean up.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete bike" }).click();
  await expect(page).toHaveURL(/\/bsr\/fleet$/);
});

test("a manager adds a model and a bike without a plate, then removes them", async ({
  page,
}) => {
  await signIn(page, demo.bsrManager);
  const name = `E2E model ${freshPlate()}`;
  await page.goto("/bsr/fleet/models/new");
  await page.getByLabel("Name").fill(name);
  await page
    .getByLabel("Catalog entry")
    .selectOption({ label: "Honda Forza 350" });
  await page.getByLabel("Deposit (THB)").fill("5000");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.getByLabel("Deposit (THB)")).toHaveValue("5000.00");
  await expect(page.getByText("No bikes of this model yet.")).toBeVisible();

  // Booking modes can't promise more bikes than the model has.
  await page.getByLabel("Instant units").fill("1");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(
    page.getByText(/can't be more than the model's active bikes/),
  ).toBeVisible();

  await page.getByRole("link", { name: "Add bike" }).click();
  await page.getByLabel("Frame (chassis) number").fill("E2EFRAME");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByText("Enter the plate, or tick “Plate pending”."),
  ).toBeVisible();
  await page.getByLabel("Plate pending (not registered yet)").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: "No plate", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This bike has no plate yet. Staff are warned before check-out.",
    ),
  ).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete bike" }).click();
  await expect(page).toHaveURL(/\/bsr\/fleet$/);
  await page.getByRole("link", { name, exact: true }).click();
  await page.getByRole("button", { name: "Delete model" }).click();
  await expect(page).toHaveURL(/\/bsr\/fleet$/);
  await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
});

test("QR stickers: a sheet to print, and the code opens the bike only for its shop", async ({
  page,
  browser,
}) => {
  await signIn(page, demo.bsrStaff);
  await page.goto("/bsr/fleet/stickers");
  await expect(
    page.getByRole("heading", { name: "QR stickers" }),
  ).toBeVisible();
  const stickers = page.locator(".sticker-sheet li");
  expect(await stickers.count()).toBeGreaterThanOrEqual(20);
  await expect(stickers.first().locator("svg")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print" })).toBeVisible();

  await openBike(page, "DEMO-005");
  const bikeUrl = page.url();
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
  await expect(
    outsider.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await outsider.goto(new URL(bikeUrl).pathname);
  await expect(
    outsider.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await outsider.goto(`/q/${"0".repeat(32)}`);
  await expect(
    outsider.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
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
  await expect(
    staff.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await staff.context().close();
});

test("settings: distances in km or miles, and a locked currency once money is saved", async ({
  page,
}) => {
  await signIn(page, demo.bsrOwner);
  await page.goto("/bsr/settings");
  await expect(page.getByLabel("Distances")).toHaveValue("km");
  await expect(page.getByLabel("Currency")).toBeDisabled();
  await expect(
    page.getByText("Locked: prices have been saved in this currency."),
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
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();

  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, "admin@mangoworks.demo.test", "/admin/catalog");
  await expect(
    admin.getByRole("heading", { name: "Catalog requests" }),
  ).toBeVisible();
  await admin.context().close();
});
