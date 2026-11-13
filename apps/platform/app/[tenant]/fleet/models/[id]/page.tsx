import type { Metadata } from "next";
import Image from "next/image";
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
import { suggestCatalog } from "@/lib/catalog-match";
import {
  catalogName,
  getCatalog,
  getCatalogEntry,
  getFleet,
  getLocations,
  getModel,
  getYearBands,
} from "@/lib/fleet-data";
import { catalogOptions } from "@/lib/model-options";
import { moneyInputValue } from "@/lib/money";
import { canManageFleet } from "@/lib/roles";
import { humanizeKey, reviewNews } from "@/lib/vehicle-kinds";
import { formatInstant } from "@/lib/shop-time";
import { cn } from "@/lib/utils";
import { deleteModel, setModelRetired } from "../../actions";
import {
  ListingForm,
  ChoosePresetForm,
  SubmitToCatalogForm,
  UsePresetButton,
} from "../../moto-mangos-forms";
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
  // The catalog entry it is linked to: a preset, or its own submission.
  const entry = model.catalog_id
    ? (catalog.find((c) => c.id === model.catalog_id) ??
      (await getCatalogEntry(model.catalog_id)))
    : null;
  const waiting = entry?.status === "requested";
  const news = reviewNews(model, new Date());
  const own = !model.catalog_id;
  const matches = own ? suggestCatalog(model.make, model.model, catalog) : [];
  const base = `/${slug}/fleet`;
  // Once none of its vehicles is in the fleet (or it has none).
  const canRetire = units.every(
    (unit) => unit.status === "sold" || unit.status === "retired",
  );

  return (
    <>
      <BackLink href={base} label={tFleet("title")} />
      <PageHeader
        title={model.name}
        intro={[
          `${model.make} ${model.model}`,
          model.cc ? `${model.cc} cc` : null,
          model.transmission
            ? tFleet(`transmission.${model.transmission}`)
            : null,
          model.vehicle_type === "motorbike"
            ? null
            : tFleet(`kind.${model.vehicle_type}` as "kind.car"),
          ...model.categories.map((key) =>
            tFleet.has(`category.${key}` as "category.sedan")
              ? tFleet(`category.${key}` as "category.sedan")
              : humanizeKey(key),
          ),
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {manage && (
          <Panel id="model-details">
            <ModelForm
              what={{
                vehicle_type: model.vehicle_type,
                catalog_id: own || waiting ? "" : (model.catalog_id ?? ""),
                make: own ? model.make : "",
                model: own ? model.model : "",
                cc: own && model.cc !== null ? String(model.cc) : "",
                transmission: own ? (model.transmission ?? "") : "",
                categories: model.categories,
              }}
              waiting={waiting}
              makes={[...new Set(catalog.map((c) => c.make))].sort()}
              slug={slug}
              currency={tenant.currency}
              listOptions={catalogOptions(catalog)}
              listTypes={Object.fromEntries(catalog.map((c) => [c.id, c.type]))}
              values={{
                id: model.id,
                name: model.name,
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
          {manage && (
            <Panel
              id="moto-mangos"
              // The logo is the heading (its alt text is the name). On a
              // white plate, so it reads on the dark theme too.
              title={
                <span className="inline-flex rounded-md bg-white px-2 py-1">
                  <Image
                    src="/moto-mangos-logo.png"
                    alt={tFleet("motoMangos.title")}
                    width={710}
                    height={290}
                    className="h-12 w-auto"
                  />
                </span>
              }
              intro={tFleet("motoMangos.intro")}
            >
              {/* What Moto Mangos decided about this model's last request,
                  until it is sent again or put on a list entry. */}
              {model.catalog_rejected_at && !waiting && (
                <div
                  role="status"
                  className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
                >
                  <p className="font-medium">
                    {tFleet("motoMangos.rejected", {
                      date: formatInstant(
                        new Date(model.catalog_rejected_at),
                        tenant.timezone,
                        locale,
                      ),
                    })}
                  </p>
                  {model.catalog_reject_reason ? (
                    <p className="mt-2">
                      {tFleet("motoMangos.rejectReason")}{" "}
                      <q>{model.catalog_reject_reason}</q>
                    </p>
                  ) : (
                    <p className="mt-2">
                      {tFleet("motoMangos.rejectNoReason")}
                    </p>
                  )}
                  {/* What to do next: only a model that came back to the
                      shop can be changed and sent again. */}
                  {own && (
                    <div className="mt-3 border-t border-amber-300 pt-3">
                      <p className="font-medium">
                        {tFleet("motoMangos.nextTitle")}
                      </p>
                      <p className="mt-1">{tFleet("motoMangos.nextHelp")}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href="#model-details"
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "h-11 bg-card px-4 text-foreground",
                          )}
                        >
                          {tFleet("motoMangos.editAgain")}
                        </a>
                        <a
                          href="#choose-from-list"
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "h-11 bg-card px-4 text-foreground",
                          )}
                        >
                          {tFleet("motoMangos.chooseInstead")}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {news === "added" && model.catalog_approved_at && (
                <p
                  role="status"
                  className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-950"
                >
                  {tFleet("motoMangos.approved", {
                    date: formatInstant(
                      new Date(model.catalog_approved_at),
                      tenant.timezone,
                      locale,
                    ),
                  })}
                </p>
              )}
              {waiting ? (
                <p className="text-sm">{tFleet("motoMangos.waiting")}</p>
              ) : entry?.status === "rejected" ? (
                <p className="text-sm">{tFleet("motoMangos.rejectedLinked")}</p>
              ) : entry ? (
                <>
                  <p className="mb-3 text-sm">
                    {tFleet("motoMangos.ready", { name: catalogName(entry) })}
                  </p>
                  <ListingForm
                    slug={slug}
                    id={model.id}
                    listed={model.marketplace_listed}
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    {tFleet("motoMangos.later")}
                  </p>
                </>
              ) : model.vehicle_type !== "motorbike" ? (
                <p className="text-sm">{tFleet("motoMangos.bikesOnly")}</p>
              ) : model.categories.length === 0 ? (
                <p className="text-sm">{tFleet("motoMangos.categoryFirst")}</p>
              ) : (
                <>
                  <p className="text-sm">{tFleet("motoMangos.notOnList")}</p>
                  {matches.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 font-medium">
                        {tFleet("motoMangos.didYouMean")}
                      </p>
                      <ul className="space-y-2">
                        {matches.map((match) => (
                          <li key={match.id}>
                            <UsePresetButton
                              slug={slug}
                              id={model.id}
                              catalogId={match.id}
                              label={tFleet("motoMangos.use", {
                                name: catalogName(match),
                              })}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-5 border-t pt-5">
                    <h3 className="mb-3 font-medium">
                      {tFleet("motoMangos.submitTitle")}
                    </h3>
                    <SubmitToCatalogForm
                      slug={slug}
                      id={model.id}
                      again={Boolean(model.catalog_rejected_at)}
                    />
                  </div>
                  <div
                    id="choose-from-list"
                    className="mt-5 scroll-mt-20 border-t pt-5"
                  >
                    <h3 className="mb-1 font-medium">
                      {tFleet("motoMangos.chooseTitle")}
                    </h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {tFleet("motoMangos.chooseHelp")}
                    </p>
                    <ChoosePresetForm
                      slug={slug}
                      id={model.id}
                      options={catalogOptions(catalog)}
                    />
                  </div>
                </>
              )}
            </Panel>
          )}
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
          {/* Out of use: retire it (kept, hidden) once none of its vehicles
              is in the fleet; delete it when it has no vehicles at all. */}
          {manage && model.retired_at && (
            <Panel title={t("retiredTitle")}>
              <p className="mb-3 text-sm">
                {t("retiredOn", {
                  date: formatInstant(
                    new Date(model.retired_at),
                    tenant.timezone,
                    locale,
                  ),
                })}
              </p>
              <ActionForm
                action={setModelRetired}
                hidden={{ slug, id: model.id, retired: "0" }}
                submitLabel={t("restore")}
                className="space-y-1"
              />
            </Panel>
          )}
          {manage && !model.retired_at && canRetire && (
            <ActionForm
              action={setModelRetired}
              hidden={{ slug, id: model.id, retired: "1" }}
              submitLabel={t("retire")}
              confirm={t("retireConfirm")}
              destructive
            />
          )}
          {manage && units.length === 0 && (
            <ActionForm
              action={deleteModel}
              hidden={{ slug, id: model.id }}
              submitLabel={t("delete")}
              confirm={t(waiting ? "deleteConfirmWaiting" : "deleteConfirm")}
              destructive
            />
          )}
        </div>
      </div>
    </>
  );
}
