import { expect, test, type Page } from "@playwright/test";

// Search form: Book ahead / Ride today, several bike types at once, and
// 24-hour time lists (marketplace UI batch, items 3 to 5).

/** Click a bike type chip (its label: the checkbox itself is visually hidden). */
const toggle = (page: Page, name: string) =>
  homeForm(page)
    .locator("label", {
      has: page.getByRole("checkbox", { name, exact: true }),
    })
    .click();

const homeForm = (page: Page) =>
  page.locator("form").filter({ hasText: "When do you want to ride?" });

test("Book ahead is the default path with 24-hour times", async ({ page }) => {
  await page.goto("/");
  const form = homeForm(page);
  await expect(form.getByRole("radio", { name: "Book ahead" })).toBeChecked();

  const pickupTime = form
    .getByRole("group", { name: "Pickup" })
    .getByRole("combobox", { name: "Time" });
  await expect(pickupTime).toHaveValue("10:00");
  const times = await pickupTime.locator("option").allTextContents();
  expect(times).toHaveLength(48);
  expect(times[0]).toBe("00:00");
  expect(times[27]).toBe("13:30");
  expect(times.at(-1)).toBe("23:30");
  await expect(
    form
      .getByRole("group", { name: "Return" })
      .getByRole("combobox", { name: "Time" }),
  ).toHaveValue("10:00");

  // Picking a pickup date fills the return with the next day.
  await form.locator("#from-date").fill("2026-12-01");
  await expect(form.locator("#to-date")).toHaveValue("2026-12-02");
  await pickupTime.selectOption("14:30");
  await form
    .getByRole("button", { name: "Check availability & prices" })
    .click();
  await expect(page).toHaveURL(/from=2026-12-01T14%3A30&to=2026-12-02T10%3A00/);
});

test("Ride today hides the dates and searches bikes ready now", async ({
  page,
}) => {
  await page.goto("/");
  const form = homeForm(page);
  await form.getByText("Ride today", { exact: true }).click();
  await expect(form.getByRole("group", { name: "Pickup" })).toHaveCount(0);
  await expect(form.getByText(/ready to ride away now/)).toBeVisible();
  await form
    .getByRole("button", { name: "Check availability & prices" })
    .click();
  await expect(page).toHaveURL(/\/search\?now=1$/);
  await expect(
    page.getByRole("checkbox", { name: "Ride today: ready now only" }),
  ).toBeChecked();
});

test("bike types are toggles: several at once, none means any", async ({
  page,
}) => {
  await page.goto("/");
  const form = homeForm(page);
  const any = form.getByRole("button", { name: "Any type" });
  await expect(any).toHaveAttribute("aria-pressed", "true");

  await toggle(page, "Sport");
  await toggle(page, "City scooter");
  await expect(any).toHaveAttribute("aria-pressed", "false");
  await expect(
    form.getByRole("checkbox", { name: "Sport", exact: true }),
  ).toBeChecked();

  // Off again, then on: still two.
  await toggle(page, "Sport");
  await expect(
    form.getByRole("checkbox", { name: "Sport", exact: true }),
  ).not.toBeChecked();
  await toggle(page, "Sport");

  await form
    .getByRole("button", { name: "Check availability & prices" })
    .click();
  await expect(page).toHaveURL(/type=city_scooter&type=sport/);

  // The shared link restores the choice in both forms on the search page.
  const filters = page.locator("form").filter({ hasText: "Filters" });
  await expect(
    filters.getByRole("checkbox", { name: "Sport", exact: true }),
  ).toBeChecked();
  await expect(
    filters.getByRole("checkbox", { name: "City scooter" }),
  ).toBeChecked();
  await expect(
    filters.getByRole("checkbox", { name: "Touring" }),
  ).not.toBeChecked();

  // "Any type" clears the choice.
  const search = homeForm(page);
  await search.getByRole("button", { name: "Any type" }).click();
  await expect(
    search.getByRole("checkbox", { name: "Sport", exact: true }),
  ).not.toBeChecked();
});

test("Thai has the new paths and the same 24-hour times", async ({ page }) => {
  await page.goto("/th");
  await expect(
    page.getByRole("button", { name: "เช็กรถว่างและราคา" }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "จองล่วงหน้า" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "ขี่วันนี้" })).toBeAttached();
  const times = await page
    .getByRole("group", { name: "รับรถ" })
    .getByRole("combobox", { name: "เวลา" })
    .locator("option")
    .allTextContents();
  expect(times).toHaveLength(48);
  expect(times[26]).toBe("13:00");
});

test.describe("with the local seed", () => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "needs local Supabase");

  test("several types show bikes of each type, one type only its own", async ({
    page,
  }) => {
    await page.goto("/search?type=adventure&type=city_scooter");
    await expect(page.getByText("Honda NX500 2025")).toBeVisible();
    await expect(page.getByText("Honda PCX 160 2026")).toBeVisible();

    await page.goto("/search?type=adventure");
    await expect(page.getByText("Honda NX500 2025")).toBeVisible();
    await expect(page.getByText("Honda PCX 160 2026")).toHaveCount(0);
  });
});
