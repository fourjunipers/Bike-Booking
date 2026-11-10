import type en from "./messages/en.json";
import type { Locale } from "./i18n/config";

// Typed message keys and locales for next-intl.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
