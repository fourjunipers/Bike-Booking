import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FileUp, Plus, QrCode, Search } from "lucide-react";
import { matchesUnit, UnitRow } from "@/components/fleet/unit-bits";
import { inputClass } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import { getFleet } from "@/lib/fleet-data";
import { canManageFleet } from "@/lib/roles";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("fleet") };
}

/** Fleet (SPEC › Fleet): every model with its bikes. Everyone reads; owners and managers set it up. */
export default async function FleetPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/fleet">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireArea(slug, "fleet");
  const { tenant, role } = membership;
  const [t, tCommon, locale, fleet] = await Promise.all([
    getTranslations("Fleet"),
    getTranslations("Common"),
    getLocale(),
    getFleet(tenant.id),
  ]);
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const manage = canManageFleet(role);
  const base = `/${slug}/fleet`;

  const total = fleet.reduce((n, model) => n + model.units.length, 0);
  const shown = fleet
    .map((model) => ({
      ...model,
      units: model.units.filter((unit) => matchesUnit(unit, q)),
    }))
    .filter((model) => !q || model.units.length > 0);
  const link = (variant: "default" | "outline") =>
    cn(buttonVariants({ variant }), "h-11 px-4");

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro", { units: total, models: fleet.length })}
        actions={
          <div className="flex flex-wrap gap-2">
            {total > 0 && (
              <Link href={`${base}/stickers`} className={link("outline")}>
                <QrCode aria-hidden />
                {t("stickers")}
              </Link>
            )}
            {manage && (
              <>
                <Link href={`${base}/import`} className={link("outline")}>
                  <FileUp aria-hidden />
                  {t("importCsv")}
                </Link>
                <Link href={`${base}/models/new`} className={link("default")}>
                  <Plus aria-hidden />
                  {t("addModel")}
                </Link>
              </>
            )}
          </div>
        }
      />

      <form role="search" action={base} className="mb-6 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">
          {t("searchLabel")}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          className={cn(inputClass, "flex-1")}
        />
        <Button type="submit" className="h-11 px-4">
          <Search aria-hidden />
          <span className="max-sm:sr-only">{tCommon("search")}</span>
        </Button>
      </form>

      {fleet.length === 0 && (
        <p className="rounded-lg border bg-card p-5 text-muted-foreground">
          {t("empty")}
        </p>
      )}
      {q && shown.length === 0 && fleet.length > 0 && (
        <p className="rounded-lg border bg-card p-5 text-muted-foreground">
          {t("noMatch", { query: q })}
        </p>
      )}

      <div className="space-y-4">
        {shown.map((model) => (
          <section
            key={model.id}
            aria-labelledby={`model-${model.id}`}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b bg-muted/40 px-4 py-3">
              <div className="min-w-0">
                <h2 id={`model-${model.id}`} className="font-semibold">
                  <Link
                    href={`${base}/models/${model.id}`}
                    className="hover:underline"
                  >
                    {model.name}
                  </Link>
                </h2>
                {model.catalog && (
                  <p className="text-sm text-muted-foreground">
                    {t("catalogLine", {
                      make: model.catalog.make,
                      model: model.catalog.model,
                      cc: model.catalog.cc,
                      transmission: t(
                        `transmission.${model.catalog.transmission}` as "transmission.manual",
                      ),
                    })}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("unitCount", { count: model.units.length })}
              </p>
            </div>
            {model.units.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {t("noUnits")}
              </p>
            ) : (
              <ul className="divide-y">
                {model.units.map((unit) => (
                  <UnitRow
                    key={unit.id}
                    unit={unit}
                    href={`${base}/units/${unit.id}`}
                    distanceUnit={tenant.distanceUnit}
                    locale={locale}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
