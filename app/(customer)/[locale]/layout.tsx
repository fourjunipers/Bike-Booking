import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
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

// TODO(phase-3): real customer header (location, dates, account).
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

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Bangkok"
    >
      <div lang={locale} className="flex flex-1 flex-col">
        <LanguageSuggestion />
        <AreaShell
          area="Customer"
          homeHref={localePath(locale, "/")}
          accountHref={localePath(locale, "/account")}
          nav={<LanguagePicker />}
        >
          {children}
        </AreaShell>
      </div>
    </NextIntlClientProvider>
  );
}
