import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { ActionForm, Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { UnitRow } from "@/components/fleet/unit-bits";
import { PageHeader } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import {
  getCatalog,
  getFleet,
  getLocations,
  getModel,
  getYearBands,
} from "@/lib/fleet-data";
import { catalogOptions } from "@/lib/model-options";
import { moneyInputValue } from "@/lib/money";
import { canManageFleet } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { deleteModel } from "../../actions";
import {
  DeleteYearBandButton,
  ModelForm,
  YearBandForm,
} from "../../model-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.model");
  return { title: t("editTitle") };
}

const text = (value: number | null) => (value === null ? "" : String(value));

/** One model: its settings (owners and managers) and its bikes (everyone). */
export default async function ModelPage({
  params,
}: PageProps<"/[tenant]/fleet/models/[id]">) {
  const { tenant: slug, id } = await params;
  const { membership } = await requireArea(slug, "fleet");
  const { tenant, role } = membership;
  const [
    t,
    tFleet,
    tCommon,
    locale,
    model,
    fleet,
    catalog,
    allBands,
    locations,
  ] = await Promise.all([
    getTranslations("Fleet.model"),
    getTranslations("Fleet"),
    getTranslations("Common"),
    getLocale(),
    getModel(tenant.id, id),
    getFleet(tenant.id),
    getCatalog(),
    getYearBands(tenant.id),
    getLocations(tenant.id),
  ]);
  const bands = allBands.filter((band) => band.model_id === id);
  const locationNames = new Map(locations.map((l) => [l.id, l.name]));
  if (!model) notFound();
  const manage = canManageFleet(role);
  const units = fleet.find((m) => m.id === id)?.units ?? [];
  const entry = catalog.find((c) => c.id === model.catalog_id);
  const base = `/${slug}/fleet`;

  return (
    <>
      <BackLink href={base} label={tFleet("title")} />
      <PageHeader
        title={model.name}
        intro={
          entry &&
          tFleet("catalogLine", {
            make: entry.make,
            model: entry.model,
            cc: entry.cc,
            transmission: tFleet(
              `transmission.${entry.transmission}` as "transmission.manual",
            ),
          })
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {manage && (
          <Panel>
            <ModelForm
              slug={slug}
              currency={tenant.currency}
              requestHref={`${base}/catalog-request`}
              catalogOptions={catalogOptions(catalog, t("pendingRequest"))}
              values={{
                id: model.id,
                name: model.name,
                catalog_id: model.catalog_id,
                description: model.description ?? "",
                bookable_online: model.bookable_online,
                buffer_before_minutes: text(model.buffer_before_minutes),
                buffer_after_minutes: text(model.buffer_after_minutes),
                deposit:
                  model.deposit === null
                    ? ""
                    : moneyInputValue(model.deposit, tenant.currency),
                min_age: text(model.min_age),
                licence_class: model.licence_class ?? "",
                instant_units: String(model.instant_units),
                request_units: String(model.request_units),
                ready_now: String(model.ready_now),
              }}
            />
          </Panel>
        )}
        <div className="space-y-6">
          <section
            aria-labelledby="model-units"
            className="overflow-hidden rounded-lg border bg-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
              <h2 id="model-units" className="font-semibold">
                {t("units")}
              </h2>
              {manage && (
                <Link
                  href={`${base}/units/new?model=${model.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-11 px-4",
                  )}
                >
                  <Plus aria-hidden />
                  {tFleet("addUnit")}
                </Link>
              )}
            </div>
            {units.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {tFleet("noUnits")}
              </p>
            ) : (
              <ul className="divide-y">
                {units.map((unit) => (
                  <UnitRow
                    key={unit.id}
                    unit={unit}
                    href={`${base}/units/${unit.id}`}
                    distanceUnit={tenant.distanceUnit}
                    locale={locale}
                    detail={
                      [unit.model_year, locationNames.get(unit.location_id)]
                        .filter(Boolean)
                        .join(" · ") || undefined
                    }
                  />
                ))}
              </ul>
            )}
          </section>
          <Panel title={tFleet("bands.title")} intro={tFleet("bands.intro")}>
            {bands.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tFleet("bands.none")}
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {bands.map((band) => (
                  <li
                    key={band.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <span className="font-medium">
                      {tFleet("bands.range", {
                        from: band.year_from,
                        to: band.year_to,
                      })}
                    </span>
                    {manage && (
                      <DeleteYearBandButton
                        slug={slug}
                        band={band.id}
                        label={tCommon("delete")}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {manage && (
              <div className="mt-5 border-t pt-5">
                <YearBandForm slug={slug} id={model.id} />
              </div>
            )}
          </Panel>
          {manage && units.length === 0 && (
            <ActionForm
              action={deleteModel}
              hidden={{ slug, id: model.id }}
              submitLabel={t("delete")}
              confirm={t("deleteConfirm")}
              destructive
            />
          )}
        </div>
      </div>
    </>
  );
}
