import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Database tests: run against the local Supabase stack (`npx supabase start`
// at the repo root). They create and remove their own tenants and users, so
// they don't depend on the demo seed. Separate from `npm test` so unit tests
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
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
