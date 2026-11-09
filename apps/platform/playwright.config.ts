import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// DEMO_PASSWORD and the Supabase keys come from .env.local locally, from the
// workflow's environment in CI.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const port = 3300;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // Every staff screen works on a phone and fully on desktop (SPEC › Staff app).
  projects: [
    {
      name: "phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  // Skip the local server when testing a deployed preview via PLAYWRIGHT_BASE_URL.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start --port ${port}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
