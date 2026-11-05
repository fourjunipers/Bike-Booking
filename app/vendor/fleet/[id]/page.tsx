import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  deleteModel,
  saveModel,
  saveModelInclusions,
  savePrices,
} from "@/app/vendor/actions/fleet";
import { InclusionsForm } from "@/components/vendor/inclusions-form";
import { PriceEditor } from "@/components/vendor/price-editor";
import { requireVendorShop } from "@/lib/auth/session";
import { catalogLabel } from "@/lib/catalog";
import {
  INCLUSION_FIELDS,
  type InclusionOverrides,
  type Inclusions,
} from "@/lib/inclusions";
import type { Anchors, ManualDays } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { getVendorLocale } from "@/i18n/vendor";
import { DeleteModelForm, ModelForm } from "./model-form";

export default async function ModelPage({
  params,
  searchParams,
}: PageProps<"/vendor/fleet/[id]">) {
  const shop = await requireVendorShop();
  if (!shop) return null;
  const { id } = await params;
  const { existing } = await searchParams;
  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "Model",
  });
  const supabase = await createClient();

  const [
    { data: model },
    { data: prices },
    { data: overrides },
    { data: shopDefaults },
    { data: extras },
    { data: shopRules },
  ] = await Promise.all([
    supabase
      .from("bike_models")
      .select(
        "id, shop_id, qty, instant_qty, request_qty, photos, deposit_amount, price_after_30, buffer_before_h, buffer_after_h, min_days_walkin, min_days_booking, notice_h, visible, catalog:bike_catalog (make, model, year_from, year_to, cc, type, transmission, status, abs, underseat_storage, usb_charger, key_type)",
      )
      .eq("id", id)
      .eq("shop_id", shop.id)
      .maybeSingle(),
    supabase
      .from("price_days")
      .select("day, total, is_anchor, is_manual")
      .eq("bike_model_id", id),
    supabase
      .from("bike_model_policies")
      .select(INCLUSION_FIELDS.join(", "))
      .eq("bike_model_id", id)
      .maybeSingle<InclusionOverrides>(),
    supabase
      .from("shop_policies")
      .select(`deposit_amount, ${INCLUSION_FIELDS.join(", ")}`)
      .eq("shop_id", shop.id)
      .single<Inclusions & { deposit_amount: number | null }>(),
    supabase
      .from("shop_extras")
      .select("id, name, active, all_models, shop_extra_models (bike_model_id)")
      .eq("shop_id", shop.id)
      .order("sort"),
    supabase
      .from("shops")
      .select(
        "buffer_before_h, buffer_after_h, min_days_walkin, min_days_booking, notice_h",
      )
      .eq("id", shop.id)
      .single(),
  ]);
  if (!model || !model.catalog || !shopDefaults || !shopRules) notFound();

  const anchors: Anchors = {};
  const manual: ManualDays = {};
  for (const p of prices ?? []) {
    if (p.is_anchor) anchors[p.day as keyof Anchors] = p.total;
    else if (p.is_manual) manual[p.day] = p.total;
  }
  const appliesHere = (extras ?? []).filter(
    (e) =>
      e.all_models || e.shop_extra_models.some((m) => m.bike_model_id === id),
  );
  const c = model.catalog;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/vendor/fleet"
          className="text-sm underline underline-offset-4"
        >
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold">{catalogLabel(c)}</h1>
        {existing && (
          <p role="status" className="rounded-md border p-3 text-sm">
            {t("alreadyInFleet")}
          </p>
        )}
        <p className="text-muted-foreground">
          {c.cc}cc · {t("specsFromCatalog")}
          {c.status === "requested" && ` · ${t("catalogPending")}`}
        </p>
      </header>

      <section className="space-y-4 rounded-lg border p-4 md:p-6">
        <h2 className="text-lg font-semibold">{t("details")}</h2>
        <ModelForm
          action={saveModel.bind(null, id)}
          shopId={shop.id}
          modelId={id}
          model={model}
          shopDeposit={shopDefaults.deposit_amount}
          shopDefaults={shopRules}
        />
      </section>

      <section className="space-y-4 rounded-lg border p-4 md:p-6">
        <h2 className="text-lg font-semibold">{t("prices")}</h2>
        <PriceEditor
          action={savePrices.bind(null, id)}
          initialAnchors={anchors}
          initialManual={manual}
          initialDailyAfter30={model.price_after_30}
        />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("included")}</h2>
          <p className="text-sm text-muted-foreground">{t("includedHint")}</p>
        </div>
        <InclusionsForm
          mode="model"
          action={saveModelInclusions.bind(null, id)}
          shop={shopDefaults}
          overrides={overrides}
        />
      </section>

      <section className="space-y-3 rounded-lg border p-4 md:p-6">
        <h2 className="text-lg font-semibold">{t("extras")}</h2>
        {appliesHere.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            {appliesHere.map((e) => (
              <li key={e.id}>
                {e.name}
                {!e.active && ` (${t("paused")})`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("noExtras")}</p>
        )}
        <Link
          href="/vendor/extras"
          className="text-sm underline underline-offset-4"
        >
          {t("manageExtras")}
        </Link>
      </section>

      <section className="space-y-3 rounded-lg border border-destructive/40 p-4 md:p-6">
        <h2 className="text-lg font-semibold">{t("deleteTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("deleteHint")}</p>
        <DeleteModelForm action={deleteModel.bind(null, id)} />
      </section>
    </div>
  );
}
