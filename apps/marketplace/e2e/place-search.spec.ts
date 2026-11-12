import { expect, test, type Page, type Request } from "@playwright/test";

// Place search (UI batch, item 2). The tests answer /api/places/* themselves
// (playwright.config.ts sets a placeholder key so the search box shows), so
// Google is never called.

const AIRPORT = {
  placeId: "ChIJ-airport-chiang-mai",
  main: "Chiang Mai International Airport",
  secondary: "Chiang Mai, Thailand",
};

/** Answer place routes; returns the autocomplete requests made. */
async function fakePlaces(
  page: Page,
  {
    autocomplete = { status: 200, body: { suggestions: [AIRPORT] } },
    details = { status: 200, body: { lat: 18.7668, lng: 98.9626 } },
  }: {
    autocomplete?: { status: number; body: unknown };
    details?: { status: number; body: unknown };
  } = {},
) {
  const calls: Request[] = [];
  await page.route("**/api/places/autocomplete?**", (route) => {
    calls.push(route.request());
    return route.fulfill({
      status: autocomplete.status,
      json: autocomplete.body,
    });
  });
  await page.route("**/api/places/ChIJ*", (route) =>
    route.fulfill({ status: details.status, json: details.body }),
  );
  return calls;
}

const form = (page: Page) =>
  page.locator("form").filter({ hasText: "When do you want to ride?" });
const placeBox = (page: Page) =>
  form(page).getByRole("combobox", { name: "City, area, landmark or airport" });
const param = (r: Request, key: string) =>
  new URL(r.url()).searchParams.get(key);

test("waits for 3 characters and a pause, then one request per pause", async ({
  page,
}) => {
  const calls = await fakePlaces(page);
  await page.goto("/");
  await placeBox(page).pressSequentially("Ch", { delay: 50 });
  await page.waitForTimeout(600);
  expect(calls).toHaveLength(0);

  // Typed quickly: one request after the pause, not one per key.
  await placeBox(page).pressSequentially("iang Mai", { delay: 40 });
  await expect(
    page.getByRole("option", { name: /Chiang Mai International/ }),
  ).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(param(calls[0], "q")).toBe("Chiang Mai");
  expect(param(calls[0], "lang")).toBe("en");
});

test("a chosen place goes in the link, one session per search", async ({
  page,
}) => {
  const calls = await fakePlaces(page);
  const details: Request[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/places/ChIJ")) details.push(r);
  });
  await page.goto("/");
  await placeBox(page).fill("Chiang");
  await expect(page.getByRole("option").first()).toBeVisible();
  await placeBox(page).fill("Chiang Mai");
  await page.getByRole("option", { name: /Chiang Mai International/ }).click();

  await expect(
    form(page).getByText("Near Chiang Mai International Airport"),
  ).toBeVisible();
  // Both suggestion requests and the place lookup share one session token.
  expect(calls).toHaveLength(2);
  const session = param(calls[0], "session");
  expect(session).toMatch(/^[0-9a-f-]{36}$/);
  expect(param(calls[1], "session")).toBe(session);
  expect(param(details[0], "session")).toBe(session);

  // The next search starts a new session.
  await placeBox(page).fill("Patong");
  await expect.poll(() => calls.length).toBe(3);
  expect(param(calls[2], "session")).not.toBe(session);
  await page.keyboard.press("Escape");

  await form(page)
    .getByRole("button", { name: "Check availability & prices" })
    .click();
  await expect(page).toHaveURL(
    /lat=18\.76680&lng=98\.96260&place=Chiang\+Mai\+International\+Airport/,
  );
  await expect(
    page.getByRole("heading", {
      name: /near Chiang Mai International Airport/,
    }),
  ).toBeVisible();
});

for (const [name, setup] of [
  [
    "over its limit",
    { autocomplete: { status: 429, body: { error: "limit" } } },
  ],
  ["down", { autocomplete: { status: 503, body: { error: "unavailable" } } }],
  [
    "failing on the place lookup",
    { details: { status: 503, body: { error: "unavailable" } } },
  ],
] as const) {
  test(`falls back to stations and my location when Places is ${name}`, async ({
    page,
  }) => {
    await fakePlaces(page, setup);
    await page.goto("/");
    await placeBox(page).fill("Chiang Mai");
    if ("details" in setup)
      await page
        .getByRole("option", { name: /Chiang Mai International/ })
        .click();

    await expect(
      form(page)
        .getByRole("alert")
        .filter({ hasText: "Place search isn't working" }),
    ).toBeVisible();
    await expect(placeBox(page)).toHaveCount(0);
    await expect(
      form(page).getByRole("button", { name: "Use my location" }),
    ).toBeVisible();

    await form(page)
      .getByRole("combobox", { name: "Train station" })
      .selectOption({ label: "Phra Khanong (BTS)" });
    await form(page)
      .getByRole("button", { name: "Check availability & prices" })
      .click();
    await expect(page).toHaveURL(/lat=.*place=Phra\+Khanong/);
  });
}

test("Use my location sets the search point", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 13.7146, longitude: 100.5915 });
  await page.goto("/");
  await form(page).getByRole("button", { name: "Use my location" }).click();
  await expect(form(page).getByText("Near My location")).toBeVisible();
  await form(page)
    .getByRole("button", { name: "Check availability & prices" })
    .click();
  await expect(page).toHaveURL(
    /lat=13\.71460&lng=100\.59150&place=My\+location/,
  );
});

test("Near a train station is optional and sets the search point", async ({
  page,
}) => {
  await fakePlaces(page);
  await page.goto("/");
  const stations = form(page).getByText("Near a train station (optional)");
  await stations.click();
  await form(page)
    .getByRole("combobox", { name: "Train station" })
    .selectOption({ label: "Asok (BTS)" });
  await expect(form(page).getByText("Near Asok (BTS)")).toBeVisible();
  await form(page).getByRole("button", { name: "Clear" }).click();
  await expect(form(page).getByText("Near Asok (BTS)")).toHaveCount(0);
});
