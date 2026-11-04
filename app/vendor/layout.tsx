import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { AreaShell } from "@/components/area-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { VendorNav } from "@/components/vendor/nav";
import { getMyShops, requireUser } from "@/lib/auth/session";
import { getVendorLocale } from "@/i18n/vendor";
import { CreateShopForm } from "./create-shop-form";

export default function VendorLayout({ children }: LayoutProps<"/vendor">) {
  return (
    <AreaShell
      area="Vendor"
      wide
      nav={
        <Suspense>
          <VendorLocale>
            <VendorNav />
          </VendorLocale>
        </Suspense>
      }
    >
      {/* Language and membership come from cookies, so render inside Suspense. */}
      <Suspense>
        <VendorLocale>
          <VendorGate>{children}</VendorGate>
        </VendorLocale>
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

/** Signed in and a member of a shop, otherwise "create your shop". */
async function VendorGate({ children }: { children: React.ReactNode }) {
  await requireUser("/vendor");
  const shops = await getMyShops();
  if (shops.length > 0) return children;

  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "Vendor",
  });

  return (
    <section className="max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("createShopTitle")}</h1>
        <p className="text-muted-foreground">{t("createShopIntro")}</p>
      </div>
      <CreateShopForm />
      <SignOutButton label={t("signOut")} />
    </section>
  );
}
