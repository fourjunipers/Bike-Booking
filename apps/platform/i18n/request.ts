import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { localeCookie, pickLocale } from "./config";

// The language comes from a per-device cookie (no URL prefix). The time zone
// is UTC here; tenant pages pass the tenant's own zone to their provider.
export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = pickLocale(
    cookieStore.get(localeCookie)?.value,
    headerStore.get("accept-language"),
  );

  return {
    locale,
    timeZone: "UTC",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
