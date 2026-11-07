import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { AreaShell } from "@/components/area-shell";
import { LanguagePicker } from "@/components/customer/language-picker";
import { LanguageSuggestion } from "@/components/customer/language-suggestion";
import {
  customerLocales,
  customerNamespaces,
  isCustomerLocale,
  localePath,
} from "@/i18n/config";

// Every language is prerendered. proxy.ts serves English (no prefix) from "en".
export function generateStaticParams() {
  return customerLocales.map((locale) => ({ locale }));
}

export default async function CustomerLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isCustomerLocale(locale)) notFound();

  // Only the customer text goes to the browser, not the vendor dashboard's.
  const all = await getMessages({ locale });
  const messages = Object.fromEntries(
    customerNamespaces.map((ns) => [ns, all[ns]]),
  );
  const tp = await getTranslations({ locale, namespace: "Privacy" });

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Bangkok"
    >
      <div lang={locale} className="flex flex-1 flex-col">
        {/* Both read the address, which on bike and shop pages is only
            known per request: they stream in after the static shell. */}
        <Suspense>
          <LanguageSuggestion />
        </Suspense>
        <AreaShell
          area="Customer"
          wide
          homeHref={localePath(locale, "/")}
          accountHref={localePath(locale, "/account")}
          nav={
            <Suspense fallback={<div className="h-[53px] border-t" />}>
              <LanguagePicker />
            </Suspense>
          }
        >
          {children}
        </AreaShell>
        <footer className="border-t bg-card">
          <nav
            aria-label={tp("link")}
            className="mx-auto flex max-w-6xl gap-4 px-4 py-4 text-sm"
          >
            <Link
              href={localePath(locale, "/privacy")}
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              {tp("link")}
            </Link>
          </nav>
        </footer>
      </div>
    </NextIntlClientProvider>
  );
}
