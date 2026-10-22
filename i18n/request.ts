import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "./config";

// Never reads cookies or headers, so customer and admin pages stay static.
// The vendor dashboard passes its cookie locale explicitly (see ./vendor.ts).
export default getRequestConfig(async ({ locale }) => {
  const resolved: Locale = isLocale(locale) ? locale : defaultLocale;

  return {
    locale: resolved,
    timeZone: "Asia/Bangkok",
    messages: (await import(`../messages/${resolved}.json`)).default,
  };
});
