import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AreaShell } from "@/components/area-shell";
import { requireAdmin } from "@/lib/auth/session";
import { adminLocale } from "@/i18n/config";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const messages = await getMessages({ locale: adminLocale });

  return (
    <NextIntlClientProvider locale={adminLocale} messages={messages}>
      <AreaShell area="Admin">
        {/* The role check reads the session, so render inside Suspense. */}
        <Suspense>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </AreaShell>
    </NextIntlClientProvider>
  );
}

/** Admins only; everyone else gets the not-found page. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
