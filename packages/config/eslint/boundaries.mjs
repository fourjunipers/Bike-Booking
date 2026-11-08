// Monorepo import boundaries (docs/platform/SPEC.md › Repository and database).
// Each entry is a `no-restricted-imports` pattern object.

const APPS = ["marketplace", "platform"];

/** Patterns that stop code from importing an app (by package name or path). */
export function appImportPatterns(allowedApp) {
  return APPS.filter((app) => app !== allowedApp).map((app) => ({
    regex: `^(@mango/${app}(/.*)?|(\.\./)+(apps/)?${app}(/.*)?|.*/apps/${app}(/.*)?)$`,
    message: `Apps never import from another app (here: ${app}). Move shared code to packages/.`,
  }));
}

/** packages/core is pure TypeScript: no React, Next.js or Supabase. */
export const pureCorePatterns = [
  {
    group: [
      "react",
      "react/*",
      "react-dom",
      "react-dom/*",
      "next",
      "next/*",
      "server-only",
    ],
    message: "packages/core is pure TypeScript: no React or Next.js.",
  },
  {
    group: ["@supabase/*", "@mango/db", "@mango/db/*"],
    message: "packages/core is pure TypeScript: no Supabase or database code.",
  },
];

/** Packages never import from an app or use an app's "@/..." alias. */
export const packagePatterns = [
  ...appImportPatterns(null),
  {
    group: ["@/*"],
    message: "Packages can't use an app's @/ alias. Import from packages only.",
  },
];
