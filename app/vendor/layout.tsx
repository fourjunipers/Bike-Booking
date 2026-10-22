import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AreaShell } from "@/components/area-shell";
import { getVendorLocale } from "@/i18n/vendor";

// TODO(phase-1): require shop membership, else show "create your shop".
// TODO(phase-2): Thai/English toggle that sets the locale cookie.
export default function VendorLayout({ children }: LayoutProps<"/vendor">) {
  return (
    <AreaShell area="Vendor">
      {/* The language comes from a cookie, so it must render inside Suspense. */}
      <Suspense>
        <VendorLocale>{children}</VendorLocale>
      </Suspense>
    </AreaShell>
  );
}

async function VendorLocale({ children }: { children: React.ReactNode }) {
  const locale = await getVendorLocale();
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Bangkok"
      formats={{}}
    >
      <div lang={locale}>{children}</div>
    </NextIntlClientProvider>
  );
}
