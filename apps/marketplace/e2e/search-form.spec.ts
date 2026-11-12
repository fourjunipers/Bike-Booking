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
  await expect(form.getByRole("tab", { name: "Book ahead" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

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
  await form.getByRole("tab", { name: "Ride today" }).click();
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

test("Book ahead and Ride today are tabs that swap a tinted card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const form = homeForm(page);
  const ahead = form.getByRole("tab", { name: "Book ahead" });
  const today = form.getByRole("tab", { name: "Ride today" });
  const panel = form.getByRole("tabpanel");

  // Big enough to tap on a phone.
  for (const tab of [ahead, today]) {
    const box = (await tab.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }

  // Book ahead: leaf-green card, filled leaf tab, outlined mango tab.
  await expect(panel).toHaveAccessibleName("Book ahead");
  const bg = (l: typeof panel) =>
    l.evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect.poll(() => bg(panel)).toBe("rgb(237, 246, 224)"); // --leaf-soft
  await expect.poll(() => bg(ahead)).toBe("rgb(63, 127, 0)"); // --leaf
  await expect.poll(() => bg(today)).toBe("rgb(255, 255, 255)");

  // Keyboard: arrows move between the tabs and swap the card.
  await ahead.focus();
  await page.keyboard.press("ArrowRight");
  await expect(today).toBeFocused();
  await expect(today).toHaveAttribute("aria-selected", "true");
  await expect(ahead).toHaveAttribute("tabindex", "-1");
  await expect(panel).toHaveAccessibleName("Ride today");
  await expect.poll(() => bg(panel)).toBe("rgb(255, 241, 220)"); // --mango-soft
  await expect.poll(() => bg(today)).toBe("rgb(248, 146, 10)"); // --mango
  await expect(form.getByRole("group", { name: "Pickup" })).toHaveCount(0);

  await page.keyboard.press("Home");
  await expect(ahead).toBeFocused();
  await expect(form.getByRole("group", { name: "Pickup" })).toBeVisible();
  await page.keyboard.press("End");
  await expect(today).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(ahead).toHaveAttribute("aria-selected", "true");
});

test("a Ride today link opens on the Ride today tab", async ({ page }) => {
  await page.goto("/search?now=1");
  await expect(page.getByRole("tab", { name: "Ride today" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
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
  await expect(page.getByRole("tab", { name: "จองล่วงหน้า" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "ขี่วันนี้" })).toBeVisible();
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
