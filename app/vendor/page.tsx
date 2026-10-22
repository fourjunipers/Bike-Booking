import { getTranslations } from "next-intl/server";
import { getVendorLocale } from "@/i18n/vendor";

// TODO(phase-4): Today screen (pickups, returns, pending requests).
export default async function VendorPage() {
  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "Vendor",
  });

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("intro")}</p>
    </section>
  );
}
