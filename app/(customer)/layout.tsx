import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AreaShell } from "@/components/area-shell";
import { customerLocale } from "@/i18n/config";

// TODO(phase-3): real customer header (location, dates, account).
export default async function CustomerLayout({ children }: LayoutProps<"/">) {
  const messages = await getMessages({ locale: customerLocale });

  return (
    <NextIntlClientProvider locale={customerLocale} messages={messages}>
      <AreaShell area="Customer">{children}</AreaShell>
    </NextIntlClientProvider>
  );
}
