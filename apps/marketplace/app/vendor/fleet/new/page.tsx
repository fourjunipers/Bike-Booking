import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireVendorShop } from "@/lib/auth/session";
import { catalogLabel } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { getVendorLocale } from "@/i18n/vendor";
import { CatalogPicker, RequestModelForm } from "./picker";

export default async function NewModelPage({
  searchParams,
}: PageProps<"/vendor/fleet/new">) {
  const shop = await requireVendorShop();
  if (!shop) return null;
  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "NewModel",
  });
  const { error } = await searchParams;
  const supabase = await createClient();
  // RLS returns approved entries plus this shop's own requests.
  const { data: catalog } = await supabase
    .from("bike_catalog")
    .select(
      "id, make, model, year_from, year_to, cc, type, transmission, status",
    )
    .neq("status", "rejected")
    .order("make")
    .order("model");

  const entries = (catalog ?? []).map((c) => ({
    ...c,
    label: catalogLabel(c),
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/vendor/fleet"
          className="text-sm underline underline-offset-4"
        >
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
        {error && (
          <p role="alert" className="text-destructive">
            {t("addFailed")}
          </p>
        )}
      </header>
      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <CatalogPicker entries={entries} />
        <section className="space-y-4 rounded-lg border p-4 md:p-6">
          <h2 className="text-lg font-semibold">{t("requestTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("requestIntro")}</p>
          <RequestModelForm />
        </section>
      </div>
    </div>
  );
}
