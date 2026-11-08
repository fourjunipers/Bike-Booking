import { defineConfig } from "eslint/config";
import { nextApp } from "@mango/config/eslint/next";
import { appImportPatterns } from "@mango/config/eslint/boundaries";

const eslintConfig = defineConfig([
  // Next.js rules, Prettier, and "never import from another app".
  ...nextApp("marketplace"),
  // Marketplace rule (docs/INTEGRATION.md): customer pages, components and
  // API routes reach shop data only through "@/lib/data", never a database
  // client, so the Mango Works API can replace it without UI changes.
  {
    files: [
      "app/(customer)/**",
      "app/api/**",
      "components/customer/**",
      "lib/search.ts",
      "lib/marketplace-search.ts",
    ],
    // Customer accounts and sign-in are the marketplace's own data.
    ignores: ["app/(customer)/*/account/**", "app/(customer)/*/login/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            // Repeated here because this block replaces the app-wide option.
            ...appImportPatterns("marketplace"),
            {
              group: ["@mango/db", "@mango/db/*", "@/lib/data/current-db"],
              message:
                "Use @/lib/data for shop data (see docs/INTEGRATION.md).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
