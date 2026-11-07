/** Vendor dashboard languages (CLAUDE.md). */
export const locales = ["en", "th"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/**
 * Customer site languages. English lives at "/", the others under a prefix
 * ("/ja/account"). Languages beyond Thai and English carry only the customer
 * namespaces (customerNamespaces, checked by i18n/messages.test.ts).
 */
export const customerLocales = [
  "en",
  "th",
  "zh",
  "ru",
  "de",
  "fr",
  "es",
  "it",
  "ja",
  "ko",
] as const;
export type CustomerLocale = (typeof customerLocales)[number];

/** Message namespaces the customer site uses. */
export const customerNamespaces = [
  "Customer",
  "Language",
  "Login",
  "Account",
  "Join",
  "Search",
  "Bikes",
  "Bike",
  "BikeInfo",
  "Shop",
  "Days",
] as const;

/** Each language in its own script, for the language picker. */
export const localeNames: Record<CustomerLocale, string> = {
  en: "English",
  th: "ไทย",
  zh: "中文",
  ru: "Русский",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
};

/** "View this site in …", written in that language, for the suggestion bar. */
export const localeSuggestions: Record<CustomerLocale, string> = {
  en: "View this site in English",
  th: "ดูเว็บไซต์นี้เป็นภาษาไทย",
  zh: "以中文浏览本网站",
  ru: "Открыть сайт на русском",
  de: "Diese Seite auf Deutsch ansehen",
  fr: "Voir ce site en français",
  es: "Ver este sitio en español",
  it: "Visualizza il sito in italiano",
  ja: "日本語でこのサイトを見る",
  ko: "한국어로 이 사이트 보기",
};

/** Admin panel is English only (CLAUDE.md). */
export const adminLocale: Locale = "en";

/** Cookie holding the vendor dashboard language. */
export const localeCookie = "locale";

export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}

export function isCustomerLocale(value: unknown): value is CustomerLocale {
  return customerLocales.includes(value as CustomerLocale);
}

/** A customer path in a language: ("ja", "/account") → "/ja/account". */
export function localePath(locale: CustomerLocale, path: string): string {
  if (locale === defaultLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * Splits a customer URL path into its language and the rest.
 * "/ja/account" → ja + "/account"; "/account" → en + "/account".
 */
export function splitLocalePath(pathname: string): {
  locale: CustomerLocale;
  path: string;
} {
  const [, first, ...rest] = pathname.split("/");
  if (isCustomerLocale(first)) {
    return { locale: first, path: `/${rest.join("/")}` };
  }
  return { locale: defaultLocale, path: pathname || "/" };
}
