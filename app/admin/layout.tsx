import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AreaShell } from "@/components/area-shell";
import { NavLink } from "@/components/nav-link";
import { requireAdmin } from "@/lib/auth/session";
import { adminLocale } from "@/i18n/config";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const messages = await getMessages({ locale: adminLocale });

  return (
    <NextIntlClientProvider
      locale={adminLocale}
      messages={messages}
      timeZone="Asia/Bangkok"
    >
      <AreaShell
        area="Admin"
        wide
        nav={
          <div className="border-t">
            <nav
              aria-label="Admin"
              className="mx-auto flex max-w-6xl flex-wrap px-2 py-1 text-sm"
            >
              <NavLink href="/admin" exact>
                Approvals
              </NavLink>
              <NavLink href="/admin/shops">Shops</NavLink>
              <NavLink href="/admin/catalog">Bike catalog</NavLink>
            </nav>
          </div>
        }
      >
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
