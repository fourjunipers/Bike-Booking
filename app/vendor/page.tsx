import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";
import { getMyShops } from "@/lib/auth/session";
import { getVendorLocale } from "@/i18n/vendor";

// TODO(phase-4): Today screen (pickups, returns, pending requests).
export default async function VendorPage() {
  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "Vendor",
  });
  // The layout only renders this page for shop members.
  // TODO(phase-2): shop switcher for people in more than one shop.
  const [shop] = await getMyShops();

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p>
          {t("shopLine", {
            shop: shop.name,
            role: t(shop.role === "owner" ? "roleOwner" : "roleStaff"),
          })}
        </p>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <SignOutButton label={t("signOut")} />
    </section>
  );
}
