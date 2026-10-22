import { cache } from "react";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookie, type Locale } from "./config";

/**
 * The vendor dashboard language, from the locale cookie. Reads runtime data,
 * so callers must render inside the vendor layout's Suspense boundary.
 */
export const getVendorLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(localeCookie)?.value;
  return isLocale(value) ? value : defaultLocale;
});
