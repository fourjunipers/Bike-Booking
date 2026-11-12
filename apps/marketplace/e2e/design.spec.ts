import { expect, test } from "@playwright/test";

// Moto Mangos look (UI batch, item 1): every main page at phone and desktop
// width, with the logo, the favicon, brand colours and no sideways scroll.
// Screenshots are attached to the report for a visual check.

const PAGES = ["/", "/th", "/search", "/search?now=1", "/login", "/privacy"];

// Pages that need the local seed's shops and bikes.
const SEEDED = [
  "/bikes/honda-pcx-160-2026",
  "/bikes/honda-pcx-160-2026/bsr-bike-shop",
  "/shops/on-nut-rentals-demo",
];

const pages = process.env.PLAYWRIGHT_BASE_URL ? PAGES : [...PAGES, ...SEEDED];

for (const width of [375, 1280]) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const path of pages) {
      test(`${path} has the brand and no sideways scroll`, async ({
        page,
      }, info) => {
        await page.goto(path);
        const home = page
          .getByRole("navigation", { name: "Areas" })
          .getByRole("link")
          .first();
        await expect(
          home.getByRole("img", {
            name: "Moto Mangos – motorbike rental in Thailand",
          }),
        ).toBeVisible();

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);

        // Clipped boxes (the hero) hide overflow from the check above, so
        // also check that nothing inside a form sticks out of it.
        const sticking = await page.evaluate(() =>
          [...document.querySelectorAll("form")].flatMap((form) => {
            const edge = form.getBoundingClientRect().right + 1;
            return [...form.querySelectorAll("*")]
              .filter((el) => el.getBoundingClientRect().right > edge)
              .map((el) => el.outerHTML.slice(0, 80));
          }),
        );
        expect(sticking).toEqual([]);

        await info.attach(`${width}${path.replace(/\W+/g, "_")}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      });
    }
  });
}

test("the favicon is the mango icon", async ({ page, request }) => {
  await page.goto("/");
  const href = await page
    .locator('link[rel="icon"][type="image/svg+xml"]')
    .getAttribute("href");
  expect(href).toContain("/icon.svg");
  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  expect(await res.text()).toContain("#0b1220");
});

test("primary buttons are mango with near-black text", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", {
    name: "Check availability & prices",
  });
  const colours = await button.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, fg: s.color };
  });
  // --mango #f8920a (the logo's orange) and --ink #0b1220.
  expect(colours.bg).toBe("rgb(248, 146, 10)");
  expect(colours.fg).toBe("rgb(11, 18, 32)");
});

for (const [path, home] of [
  ["/", "/"],
  ["/th", "/th"],
] as const) {
  test(`the top bar logo links home (${path})`, async ({ page }) => {
    await page.goto(path);
    const logo = page
      .getByRole("navigation", { name: "Areas" })
      .getByRole("img", { name: "Moto Mangos – motorbike rental in Thailand" });
    await expect(logo).toBeVisible();
    expect(
      await logo.evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);
    await expect(
      page.getByRole("navigation", { name: "Areas" }).getByRole("link", {
        name: "Moto Mangos – motorbike rental in Thailand",
      }),
    ).toHaveAttribute("href", home);
  });
}

test("the hero keeps a real H1 with the subline under it", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Motorbike rental in Thailand",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Compare bikes, prices and deposits from local shops. Get the best bike at the best price.",
    ),
  ).toBeVisible();
  // Title unchanged by the hero work.
  await expect(page).toHaveTitle("Motorbike rental in Thailand");
  await page.goto("/th");
  await expect(
    page.getByText(/เลือกรถที่ดีที่สุดในราคาที่ดีที่สุด/),
  ).toBeVisible();
});
