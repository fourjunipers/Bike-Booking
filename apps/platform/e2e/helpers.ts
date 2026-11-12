import { expect, type Page } from "@playwright/test";

/** Demo users from scripts/seed.mts. */
export const demo = {
  bsrOwner: "owner@bsr.demo.test",
  bsrManager: "manager@bsr.demo.test",
  bsrStaff: "staff@bsr.demo.test",
  bsrMechanic: "mechanic@bsr.demo.test",
  bsrDriver: "driver@bsr.demo.test",
  saigonOwner: "owner@saigon.demo.test",
  both: "both@demo.test",
  bigOwner: "owner@big.demo.test",
  admin: "admin@mangoworks.demo.test",
} as const;

export function demoPassword(): string {
  const password = process.env.DEMO_PASSWORD;
  if (!password) throw new Error("Set DEMO_PASSWORD (see .env.example)");
  return password;
}

/** Signs in with email and password and waits to leave the login page. */
export async function signIn(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(demoPassword());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** The staff tab bar (phones) or the sidebar (desktop), whichever is showing. */
export function mainNav(page: Page, isPhone: boolean) {
  return isPhone
    ? page.getByRole("navigation", { name: "Staff app" })
    : page.getByRole("navigation", { name: "Main" });
}
