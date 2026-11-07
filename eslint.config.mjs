import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
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
    ignores: [
      "app/(customer)/*/account/**",
      "app/(customer)/*/login/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/*", "@/lib/data/current-db"],
              message:
                "Use @/lib/data for shop data (see docs/INTEGRATION.md).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
