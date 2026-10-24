import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    // tests/db needs local Supabase: run it with `npm run test:db`.
    exclude: ["node_modules/**", ".next/**", "e2e/**", "tests/db/**"],
    environment: "node",
  },
});
