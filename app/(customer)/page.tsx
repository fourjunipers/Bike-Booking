import { getTranslations } from "next-intl/server";
import { customerLocale } from "@/i18n/config";

// TODO(phase-3): home screen (location, dates, bike types, Get your bike now).
export default async function HomePage() {
  const t = await getTranslations({
    locale: customerLocale,
    namespace: "Customer",
  });

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("intro")}</p>
    </section>
  );
}
