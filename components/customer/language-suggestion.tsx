"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import {
  defaultLocale,
  isCustomerLocale,
  localePath,
  localeSuggestions,
  splitLocalePath,
  type CustomerLocale,
} from "@/i18n/config";

const dismissedKey = "language-suggestion-dismissed";

/**
 * On English pages, offers the visitor's browser language if we have it.
 * Runs in the browser only, so pages stay static and nobody is redirected.
 */
export function LanguageSuggestion() {
  const t = useTranslations("Language");
  const locale = useLocale();
  const pathname = usePathname();
  const browser = useSyncExternalStore(noSubscribe, browserLocale, () => null);
  const [dismissed, setDismissed] = useState(false);

  if (locale !== defaultLocale || !browser || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(dismissedKey, "1");
    } catch {
      // Private mode: the bar just comes back next visit.
    }
  }

  const { path } = splitLocalePath(pathname);
  return (
    <div className="border-b bg-muted">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <Link
          href={localePath(browser, path)}
          lang={browser}
          className="font-medium underline underline-offset-4"
        >
          {localeSuggestions[browser]}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="ml-auto min-h-11 rounded-md px-3"
        >
          {t("dismiss")}
        </button>
      </div>
    </div>
  );
}

function noSubscribe() {
  return () => {};
}

/** The visitor's preferred language if the site has it and it isn't English. */
function browserLocale(): CustomerLocale | null {
  try {
    if (localStorage.getItem(dismissedKey)) return null;
  } catch {
    // Storage blocked: still suggest.
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === defaultLocale) return null;
    if (isCustomerLocale(base)) return base;
  }
  return null;
}
