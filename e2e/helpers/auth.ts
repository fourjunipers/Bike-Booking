import { expect, type Page } from "@playwright/test";

/** Local Supabase test inbox (supabase start). */
const MAILPIT = "http://127.0.0.1:54324/api/v1";

/** Signs in through the real magic-link flow, reading the email from Mailpit. */
export async function signInByEmail(page: Page, email: string, next: string) {
  await clearInbox(email);
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");

  const link = await waitForSignInLink(email);
  await page.goto(link);
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
