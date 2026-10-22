import { getTranslations } from "next-intl/server";
import { adminLocale } from "@/i18n/config";

// TODO(phase-2): approval queue.
export default async function AdminPage() {
  const t = await getTranslations({ locale: adminLocale, namespace: "Admin" });

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("intro")}</p>
    </section>
  );
}
