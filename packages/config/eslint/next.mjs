import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { globalIgnores } from "eslint/config";
import { appImportPatterns } from "./boundaries.mjs";

/**
 * ESLint for a Next.js app in apps/<app>. Spread it into the app's
 * eslint.config.mjs and add app rules after it.
 */
export function nextApp(app) {
  return [
    ...nextVitals,
    ...nextTs,
    prettier,
    {
      rules: {
        "no-restricted-imports": [
          "error",
          { patterns: appImportPatterns(app) },
        ],
      },
    },
    globalIgnores([
      // Default ignores of eslint-config-next:
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
    ]),
  ];
}
