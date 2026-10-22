import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AreaShell } from "@/components/area-shell";
import { adminLocale } from "@/i18n/config";

// TODO(phase-1): require the admin role (ADMIN_EMAILS).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const messages = await getMessages({ locale: adminLocale });

  return (
    <NextIntlClientProvider locale={adminLocale} messages={messages}>
      <AreaShell area="Admin">{children}</AreaShell>
    </NextIntlClientProvider>
  );
}
