import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isCustomerLocale, type CustomerLocale } from "./config";

// Never reads cookies or headers, so customer and admin pages stay static.
// Callers pass the locale explicitly: the customer site from its [locale]
// segment, the vendor dashboard from its cookie (see ./vendor.ts).
export default getRequestConfig(async ({ locale }) => {
  const resolved: CustomerLocale = isCustomerLocale(locale)
    ? locale
    : defaultLocale;

  return {
    locale: resolved,
    timeZone: "Asia/Bangkok",
    messages: (await import(`../messages/${resolved}.json`)).default,
  };
});
