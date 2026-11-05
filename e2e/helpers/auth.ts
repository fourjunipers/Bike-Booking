import { mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Local Supabase test inbox (supabase start). */
const MAILPIT = "http://127.0.0.1:54324/api/v1";

/** Signs in through the real magic-link flow, reading the email from Mailpit. */
export async function signInByEmail(page: Page, email: string, next: string) {
  // Parallel workers share the seeded accounts. A second link request for the
  // same address is rate limited and voids the first link, so take turns.
  await withEmailLock(email, async () => {
    await clearInbox(email);
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("status")).toContainText("Check your email");

    const link = await waitForSignInLink(email);
    await page.goto(link);
  });
  // Pages like the fleet table are interactive only once hydrated; under
  // parallel load that can take a while, and a click before it does nothing.
  await page.waitForLoadState("networkidle");
}

/** A cross-worker lock: mkdir is atomic, so only one worker holds it. */
async function withEmailLock(email: string, fn: () => Promise<void>) {
  const dir = join(tmpdir(), `bike-booking-e2e-signin-${email}`);
  for (let attempt = 0; ; attempt++) {
    try {
      await mkdir(dir);
      break;
    } catch {
      // A worker that crashed mid sign-in leaves the lock behind.
      const held = await stat(dir).catch(() => null);
      if (held && Date.now() - held.mtimeMs > 30_000) {
        await rm(dir, { recursive: true, force: true });
      }
      if (attempt > 240) throw new Error(`Sign-in lock stuck for ${email}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  try {
    await fn();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** A fresh address, so tests that sign up a new user don't collide. */
export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@bike-booking.test`;
}

async function clearInbox(email: string) {
  await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${email}`)}`, {
    method: "DELETE",
  });
}

async function waitForSignInLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(
      `${MAILPIT}/search?query=${encodeURIComponent(`to:${email}`)}`,
    ).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${MAILPIT}/message/${id}`).then((r) =>
        r.json(),
      );
      const href = /href="([^"]+)"/.exec(message.HTML)?.[1];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in email arrived for ${email}`);
}
