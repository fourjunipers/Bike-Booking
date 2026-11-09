import type { Metadata } from "next";
import {
  customerLocales,
  defaultLocale,
  localePath,
  type CustomerLocale,
} from "./config";

/**
 * Canonical URL and hreflang links for a customer page, so search engines
 * list each language version. `path` is the page without its language.
 */
export function languageAlternates(
  locale: CustomerLocale,
  path: string,
): Metadata["alternates"] {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(
        customerLocales.map((l) => [l, localePath(l, path)]),
      ),
      "x-default": localePath(defaultLocale, path),
    },
  };
}
