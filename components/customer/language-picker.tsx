"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  customerLocales,
  isCustomerLocale,
  localeNames,
  localePath,
  splitLocalePath,
} from "@/i18n/config";

/** Switches the customer site language, staying on the same page. */
export function LanguagePicker() {
  const t = useTranslations("Language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function change(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (!isCustomerLocale(next)) return;
    const { path } = splitLocalePath(pathname);
    router.push(localePath(next, path) + window.location.search);
  }

  return (
    <div className="border-t">
      <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-4 py-1 text-sm">
        <label htmlFor="language" className="text-muted-foreground">
          {t("label")}
        </label>
        <select
          id="language"
          value={locale}
          onChange={change}
          className="h-11 rounded-md border bg-background px-2"
        >
          {customerLocales.map((l) => (
            <option key={l} value={l} lang={l}>
              {localeNames[l]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
