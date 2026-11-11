/**
 * Maintenance › Scan QR: the camera button beside the plate search.
 *
 * The camera here is Chromium's stand-in (a test pattern), so what these
 * tests prove is everything around the reading: the button, the camera
 * opening, a read code opening the right bike, a code that isn't a sticker
 * being refused, and the message where a browser can't read codes. Reading a
 * real printed sticker with a real phone camera is checked by hand.
 */
import { expect, test, type Page } from "@playwright/test";
import { demo, signIn } from "./helpers";

/** Replaces the browser's code reader with one that "sees" window.__code. */
async function fakeReader(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector =
      class {
        async detect() {
          const code = (window as unknown as { __code?: string }).__code;
          return code ? [{ rawValue: code }] : [];
        }
      };
  });
}
const show = (page: Page, code: string) =>
  page.evaluate((value) => {
    (window as unknown as { __code?: string }).__code = value;
  }, code);

test("scanning a sticker opens that bike; another code is refused", async ({
  page,
}) => {
  await fakeReader(page);
  await signIn(page, demo.bsrMechanic);

  // What DEMO-006's sticker holds.
  await page.goto("/bsr/fleet?q=DEMO-006");
  await page.getByRole("link", { name: /DEMO-006/ }).click();
  await expect(page.getByRole("heading", { name: "DEMO-006" })).toBeVisible();
  const bikeUrl = page.url();
  const sticker = await page
    .getByRole("link", { name: "QR sticker" })
    .getAttribute("href");
  expect(sticker).toMatch(/\/q\/[0-9a-f]{32}$/);

  await page.goto("/bsr/maintenance");
  // Plate box, Search, then the camera button.
  const buttons = page.getByRole("search").getByRole("button");
  await expect(buttons).toHaveText([/Search/, /Scan QR/]);
  await page.getByRole("button", { name: "Scan QR" }).click();
  const scanner = page.getByRole("dialog", {
    name: "Scan a bike's QR sticker",
  });
  await expect(scanner).toBeVisible();
  await expect(
    scanner.getByText(/Point the camera at the sticker/),
  ).toBeVisible();
  // The camera is running.
  await expect
    .poll(() =>
      scanner.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThanOrEqual(2);

  // A code that isn't a bike sticker is not followed anywhere.
  await show(page, "https://example.com/somewhere-else");
  await expect(
    scanner.getByText("That code isn't one of your bike stickers."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/bsr\/maintenance$/);

  // The sticker, as printed from some other address: the bike opens here.
  await show(
    page,
    `https://old-address.example.com${new URL(sticker!).pathname}`,
  );
  await expect(page).toHaveURL(bikeUrl);
  await expect(page.getByRole("heading", { name: "DEMO-006" })).toBeVisible();
});

test("closing the scanner turns the camera off", async ({ page }) => {
  await fakeReader(page);
  await signIn(page, demo.bsrStaff);
  await page.goto("/bsr/maintenance");
  await page.getByRole("button", { name: "Scan QR" }).click();
  const scanner = page.getByRole("dialog");
  await expect
    .poll(() =>
      scanner.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  const live = () =>
    page.evaluate(() => {
      const video = document.querySelector("video");
      const stream = video?.srcObject as MediaStream | null;
      return stream
        ? stream.getTracks().some((t) => t.readyState === "live")
        : false;
    });
  expect(await live()).toBe(true);
  // Keep hold of the stream to look at it after the dialog has gone.
  await page.evaluate(() => {
    (window as unknown as { __stream: unknown }).__stream =
      document.querySelector("video")?.srcObject;
  });
  await scanner.getByRole("button", { name: "Close" }).click();
  await expect(scanner).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      (window as unknown as { __stream: MediaStream }).__stream
        .getTracks()
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
});

test("a browser that can't read codes says so and points at the camera app", async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  });
  await signIn(page, demo.bsrMechanic);
  await page.goto("/bsr/maintenance");
  await page.getByRole("button", { name: "Scan QR" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(
        /This browser can't read QR codes here\. Use your phone's camera app/,
      ),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // The plate search still works as before.
  await page.getByLabel("Plate number").fill("demo-006");
  await page.getByLabel("Plate number").press("Enter");
  await expect(page.getByRole("link", { name: /DEMO-006/ })).toBeVisible();
});
