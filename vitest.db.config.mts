import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Database tests: run against the local Supabase stack (`npx supabase start`,
// seeded by `npx supabase db reset`). Separate from `npm test` so unit tests
// don't need Docker.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    env: loadEnv("", process.cwd(), ""),
    testTimeout: 20_000,
    // Tests share seeded rows; run files one at a time.
    fileParallelism: false,
  },
});
