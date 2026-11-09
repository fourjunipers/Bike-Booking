/** Staff languages (SPEC › Built for any country). A new language is a new file in messages/. */
export const locales = ["en", "th"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Each language in its own script, for the switch. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  th: "ไทย",
};

/** Per-device cookie holding the staff language. No URL prefix. */
export const localeCookie = "mw_locale";

export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}

/**
 * The language to show: the cookie if set, else the browser's first supported
 * language (Accept-Language), else English.
 */
export function pickLocale(
  cookie: string | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookie)) return cookie;
  const wanted = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter((w) => w.tag && !Number.isNaN(w.q) && w.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of wanted) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
