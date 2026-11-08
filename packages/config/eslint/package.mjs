import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { packagePatterns, pureCorePatterns } from "./boundaries.mjs";

/**
 * ESLint for a shared package in packages/<name>. TypeScript rules only, no
 * React or Next.js rules. `pure: true` also bans React, Next.js and Supabase
 * imports (packages/core).
 */
export function sharedPackage({ pure = false } = {}) {
  return [
    ...nextTs,
    prettier,
    {
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: pure
              ? [...packagePatterns, ...pureCorePatterns]
              : packagePatterns,
          },
        ],
      },
    },
  ];
}
