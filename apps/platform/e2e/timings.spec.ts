/**
 * Server response time per page, for docs/PROGRESS.md (SPEC › Review
 * decisions › Kickoff prompt additions). Not a pass/fail test: it prints a
 * table. Skipped unless TIMINGS=1.
 *
 *   TIMINGS=1 npx playwright test timings --project=desktop
 *   TIMINGS=1 PLAYWRIGHT_BASE_URL=https://<preview> npx playwright test timings --project=desktop
 *
 * Each page is requested 5 times as the signed-in BSR owner; the figure is
 * the median time until the server has sent the whole page.
 */
import { expect, test } from "@playwright/test";
import { demo, signIn } from "./helpers";

test.skip(!process.env.TIMINGS, "set TIMINGS=1 to measure");

test("server response time per page", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, demo.bsrOwner);

  // A bike, a model and a location to open.
  await page.goto("/bsr/fleet?q=DEMO-001");
  await page.getByRole("link", { name: /DEMO-001/ }).click();
  await expect(page.getByRole("heading", { name: "DEMO-001" })).toBeVisible();
  const unit = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Honda PCX 160" }).first().click();
  await expect(page).toHaveURL(/\/fleet\/models\//);
  const model = new URL(page.url()).pathname;
  await page.goto("/bsr/locations");
  await page.getByRole("link", { name: /BSR Bike Shop/ }).click();
  await expect(page).toHaveURL(/\/locations\/[0-9a-f-]{36}$/);
  const location = new URL(page.url()).pathname;

  const pages: [string, string][] = [
    ["Dashboard", "/bsr/dashboard"],
    ["Maintenance", "/bsr/maintenance"],
    ["Maintenance search", "/bsr/maintenance?plate=DEMO-01"],
    ["Fleet", "/bsr/fleet"],
    ["Model", model],
    ["Vehicle", unit],
    ["Add to inventory", "/bsr/fleet/units/new"],
    ["Import CSV", "/bsr/fleet/import"],
    ["QR stickers (all)", "/bsr/fleet/stickers"],
    ["Locations", "/bsr/locations"],
    ["Location", location],
    ["Shop settings", "/bsr/settings"],
    ["Team", "/bsr/team"],
  ];

  const rows: string[] = [];
  for (const [name, path] of pages) {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const started = Date.now();
      const response = await page.request.get(path);
      await response.body();
      times.push(Date.now() - started);
      expect(response.status(), path).toBe(200);
    }
    times.sort((a, b) => a - b);
    rows.push(`| ${name} | ${times[2]} ms | ${times[0]}–${times[4]} ms |`);
  }
  console.log(
    ["", "| Page | Median | Range |", "| --- | --- | --- |", ...rows, ""].join(
      "\n",
    ),
  );
});
