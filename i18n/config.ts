export const locales = ["en", "th"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Customer site and admin panel are English only (CLAUDE.md). */
export const customerLocale: Locale = "en";
export const adminLocale: Locale = "en";

/** Cookie holding the vendor dashboard language. */
export const localeCookie = "locale";

export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}
