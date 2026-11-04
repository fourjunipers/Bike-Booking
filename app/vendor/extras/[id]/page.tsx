import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { deleteExtra, saveExtra } from "@/app/vendor/actions/extras";
import { requireShopOwner } from "@/lib/auth/session";
import { catalogLabel } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { getVendorLocale } from "@/i18n/vendor";
import { DeleteExtraForm, ExtraForm } from "./extra-form";

/** /vendor/extras/new creates; /vendor/extras/<id> edits. */
export default async function ExtraPage({
  params,
}: PageProps<"/vendor/extras/[id]">) {
  const shop = await requireShopOwner();
  const { id } = await params;
  const isNew = id === "new";
  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "Extras",
  });
  const supabase = await createClient();

  const [{ data: extra }, { data: models }] = await Promise.all([
    isNew
      ? Promise.resolve({ data: null })
      : supabase
          .from("shop_extras")
          .select(
            "id, name, description, terms, price_kind, price_rental, price_1d, price_7d, price_30d, all_models, active, shop_extra_models (bike_model_id)",
          )
          .eq("id", id)
          .eq("shop_id", shop.id)
          .maybeSingle(),
    supabase
      .from("bike_models")
      .select("id, catalog:bike_catalog (make, model, year_from, year_to, cc)")
      .eq("shop_id", shop.id),
  ]);
  if (!isNew && !extra) notFound();

  const modelOptions = (models ?? [])
    .flatMap((m) =>
      m.catalog
        ? [{ id: m.id, cc: m.catalog.cc, label: catalogLabel(m.catalog) }]
        : [],
    )
    .sort((a, b) => a.cc - b.cc || a.label.localeCompare(b.label));

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <Link
          href="/vendor/extras"
          className="text-sm underline underline-offset-4"
        >
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold">
          {isNew ? t("newTitle") : t("editTitle")}
        </h1>
      </header>
      <ExtraForm
        action={saveExtra.bind(null, isNew ? null : id)}
        extra={extra}
        models={modelOptions}
      />
      {!isNew && (
        <section className="space-y-3 rounded-lg border border-destructive/40 p-4">
          <h2 className="font-semibold">{t("deleteTitle")}</h2>
          <DeleteExtraForm action={deleteExtra.bind(null, id)} />
        </section>
      )}
    </div>
  );
}
