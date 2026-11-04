import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { setExtraActive } from "@/app/vendor/actions/extras";
import { Button } from "@/components/ui/button";
import { requireVendorShop } from "@/lib/auth/session";
import { formatBaht } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { getVendorLocale } from "@/i18n/vendor";

export default async function ExtrasPage() {
  const shop = await requireVendorShop();
  if (!shop) return null;
  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "Extras",
  });
  const owner = shop.role === "owner";
  const supabase = await createClient();
  const { data: extras } = await supabase
    .from("shop_extras")
    .select(
      "id, name, description, terms, price_kind, price_rental, price_1d, price_7d, price_30d, all_models, active, shop_extra_models (bike_model_id)",
    )
    .eq("shop_id", shop.id)
    .order("sort")
    .order("created_at");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
        </div>
        {owner && (
          <Link
            href="/vendor/extras/new"
            className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground"
          >
            {t("add")}
          </Link>
        )}
      </header>

      {!extras || extras.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {extras.map((e) => (
            <li key={e.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-semibold">{e.name}</h2>
                <span className="text-sm">
                  {e.active ? t("active") : t("paused")}
                </span>
              </div>
              <p>
                {e.price_kind === "rental"
                  ? t("perRental", { price: formatBaht(e.price_rental ?? 0) })
                  : [
                      t("perDay", { price: formatBaht(e.price_1d ?? 0) }),
                      e.price_7d &&
                        t("per7", { price: formatBaht(e.price_7d) }),
                      e.price_30d &&
                        t("per30", { price: formatBaht(e.price_30d) }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </p>
              {e.description && (
                <p className="text-sm text-muted-foreground">{e.description}</p>
              )}
              {e.terms && (
                <p className="text-sm">{t("termsLabel", { terms: e.terms })}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {e.all_models
                  ? t("allModels")
                  : t("someModels", { count: e.shop_extra_models.length })}
              </p>
              {owner && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/vendor/extras/${e.id}`}
                    className="inline-flex h-11 items-center rounded-md border px-4"
                  >
                    {t("edit")}
                  </Link>
                  <form action={setExtraActive}>
                    <input type="hidden" name="id" value={e.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={String(!e.active)}
                    />
                    <Button type="submit" variant="outline" className="h-11">
                      {e.active ? t("pause") : t("resume")}
                    </Button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!owner && (
        <p className="text-sm text-muted-foreground">{t("ownerOnly")}</p>
      )}
    </div>
  );
}
