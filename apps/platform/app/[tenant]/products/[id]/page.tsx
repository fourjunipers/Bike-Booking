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
  getMemberNames,
  getModel,
  getProductHistory,
  getYearBands,
} from "@/lib/fleet-data";
import { buildHistory, historyValue } from "@/lib/history";
import { knownModels } from "@/lib/known-models";
import { catalogOptions } from "@/lib/model-options";
import { moneyInputValue } from "@/lib/money";
import { canManageFleet } from "@/lib/roles";
import { humanizeKey, reviewNews } from "@/lib/vehicle-kinds";
import { formatInstant } from "@/lib/shop-time";
import { cn } from "@/lib/utils";
import { deleteModel, setModelRetired } from "../../fleet/actions";
import {
  ListingForm,
  ChoosePresetForm,
  SubmitToCatalogForm,
  UsePresetButton,
} from "../moto-mangos-forms";
import {
  DeleteYearBandButton,
  ProductForm,
  YearBandForm,
} from "../product-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.model");
  return { title: t("editTitle") };
}

const text = (value: number | null) => (value === null ? "" : String(value));

const tabs = ["details", "units", "history"] as const;
type Tab = (typeof tabs)[number];

/**
 * One product (docs/products-redesign.md §4.1), in tabs:
 * - Details: what it is and its settings, the Moto Mangos panel, retire and
 *   delete (owners and managers);
 * - Units: its vehicles and their year bands (everyone);
 * - History: who changed what (owners and managers).
 * The tab is in the address (?tab=units), so a tab can be linked to.
 */
export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/products/[id]">) {
  const [{ tenant: slug, id }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const { membership } = await requireArea(slug, "products");
  // An address that isn't an id is simply not found (the database would
  // refuse to compare it with one).
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { tenant, role } = membership;
  const manage = canManageFleet(role);
  // Details and History are for those who set the shop up.
  const allowed: readonly Tab[] = manage ? tabs : ["units"];
  const asked = typeof query.tab === "string" ? query.tab : "";
  const tab: Tab = (allowed as readonly string[]).includes(asked)
    ? (asked as Tab)
    : allowed[0];

  const [
    t,
    tFleet,
    tProducts,
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
    getTranslations("Products"),
    getTranslations("Common"),
    getLocale(),
    getModel(tenant.id, id),
    getFleet(tenant.id),
    getCatalog(),
    getYearBands(tenant.id),
    getLocations(tenant.id),
  ]);
  if (!model) notFound();
  const bands = allBands.filter((band) => band.product_id === id);
  const locationNames = new Map(locations.map((l) => [l.id, l.name]));
  const units = fleet.find((m) => m.id === id)?.units ?? [];
  const here = `/${slug}/products/${model.id}`;

  return (
    <>
      <BackLink href={`/${slug}/products`} label={tProducts("title")} />
      <PageHeader
        title={model.name}
        intro={[
          tProducts(`type.${model.type}` as "type.vehicle"),
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
      {query.added === "1" && (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-950"
        >
          {tProducts("added")}
        </p>
      )}
      {allowed.length > 1 && (
        <nav
          aria-label={tProducts("tabs.label")}
          className="mb-5 flex gap-1 overflow-x-auto border-b"
        >
          {allowed.map((name) => (
            <Link
              key={name}
              href={name === allowed[0] ? here : `${here}?tab=${name}`}
              aria-current={name === tab ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                name === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {tProducts(`tabs.${name}`)}
              {name === "units" && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                  {units.length}
                </span>
              )}
            </Link>
          ))}
        </nav>
      )}

      {tab === "details" && (
        <DetailsTab
          slug={slug}
          model={model}
          units={units}
          catalog={catalog}
          timezone={tenant.timezone}
          currency={tenant.currency}
          locale={locale}
        />
      )}

      {tab === "units" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section
            aria-labelledby="model-units"
            className="overflow-hidden rounded-lg border bg-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
              <h2 id="model-units" className="font-semibold">
                {t("units")}
              </h2>
              {manage && !model.retired_at && (
                <Link
                  href={`/${slug}/fleet/units/new?product=${model.id}`}
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
                    href={`/${slug}/fleet/units/${unit.id}`}
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
            {units.length > 0 && (
              <p className="border-t px-4 py-3 text-sm">
                <Link
                  href={`/${slug}/fleet?model=${model.id}&scope=all`}
                  className="font-medium underline underline-offset-4"
                >
                  {tProducts("seeInFleet")}
                </Link>
              </p>
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
        </div>
      )}

      {tab === "history" && (
        <HistoryTab
          tenantId={tenant.id}
          productId={model.id}
          units={units}
          timezone={tenant.timezone}
          locale={locale}
        />
      )}
    </>
  );
}

type Product = NonNullable<Awaited<ReturnType<typeof getModel>>>;
type Catalog = Awaited<ReturnType<typeof getCatalog>>;

/** What the product is, its Moto Mangos panel, and taking it out of use. */
async function DetailsTab({
  slug,
  model,
  units,
  catalog,
  timezone,
  currency,
  locale,
}: {
  slug: string;
  model: Product;
  units: { status: string }[];
  catalog: Catalog;
  timezone: string;
  currency: string;
  locale: string;
}) {
  const [t, tFleet] = await Promise.all([
    getTranslations("Fleet.model"),
    getTranslations("Fleet"),
  ]);
  // The list entry it is linked to: a known model, or its own submission.
  const entry = model.catalog_id
    ? (catalog.find((c) => c.id === model.catalog_id) ??
      (await getCatalogEntry(model.catalog_id)))
    : null;
  const waiting = entry?.status === "requested";
  const news = reviewNews(model, new Date());
  const own = !model.catalog_id;
  const matches = own ? suggestCatalog(model.make, model.model, catalog) : [];
  // Once none of its vehicles is in the fleet (or it has none).
  const canRetire = units.every(
    (unit) => unit.status === "sold" || unit.status === "retired",
  );
  const outline = cn(
    buttonVariants({ variant: "outline" }),
    "h-11 bg-card px-4 text-foreground",
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel id="model-details">
        <ProductForm
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
          slug={slug}
          currency={currency}
          known={knownModels(catalog)}
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
                : moneyInputValue(model.deposit, currency),
            min_age: text(model.min_age),
            licence_class: model.licence_class ?? "",
            instant_units: String(model.instant_units),
            request_units: String(model.request_units),
            ready_now: String(model.ready_now),
          }}
        />
      </Panel>
      <div className="space-y-6">
        <Panel
          id="moto-mangos"
          // The logo is the heading (its alt text is the name). On a white
          // plate, so it reads on the dark theme too.
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
          {/* What Moto Mangos decided about this model's last request, until
              it is sent again or put on a known model. */}
          {model.catalog_rejected_at && !waiting && (
            <div
              role="status"
              className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
            >
              <p className="font-medium">
                {tFleet("motoMangos.rejected", {
                  date: formatInstant(
                    new Date(model.catalog_rejected_at),
                    timezone,
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
                <p className="mt-2">{tFleet("motoMangos.rejectNoReason")}</p>
              )}
              {/* What to do next: only a model that came back to the shop
                  can be changed and sent again. */}
              {own && (
                <div className="mt-3 border-t border-amber-300 pt-3">
                  <p className="font-medium">
                    {tFleet("motoMangos.nextTitle")}
                  </p>
                  <p className="mt-1">{tFleet("motoMangos.nextHelp")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href="#model-details" className={outline}>
                      {tFleet("motoMangos.editAgain")}
                    </a>
                    <a href="#choose-from-list" className={outline}>
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
                  timezone,
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
        {/* Out of use: retire it (kept, hidden) once none of its vehicles is
            in the fleet; delete it when it has no vehicles at all. */}
        {model.retired_at && (
          <Panel title={t("retiredTitle")}>
            <p className="mb-3 text-sm">
              {t("retiredOn", {
                date: formatInstant(
                  new Date(model.retired_at),
                  timezone,
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
        {!model.retired_at && canRetire && (
          <ActionForm
            action={setModelRetired}
            hidden={{ slug, id: model.id, retired: "1" }}
            submitLabel={t("retire")}
            confirm={t("retireConfirm")}
            destructive
          />
        )}
        {units.length === 0 && (
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
  );
}

/** Who changed what on the product and its vehicles, newest first. */
async function HistoryTab({
  tenantId,
  productId,
  units,
  timezone,
  locale,
}: {
  tenantId: string;
  productId: string;
  units: { id: string; plate: string | null }[];
  timezone: string;
  locale: string;
}) {
  const limit = 100;
  const [t, tFleet, rows, names] = await Promise.all([
    getTranslations("Products.history"),
    getTranslations("Fleet"),
    getProductHistory(
      tenantId,
      productId,
      units.map((unit) => unit.id),
      limit,
    ),
    getMemberNames(tenantId),
  ]);
  const entries = buildHistory(rows);
  const plates = new Map(
    units.map((unit) => [unit.id, unit.plate ?? tFleet("noPlate")]),
  );
  const words = { empty: t("empty"), yes: t("yes"), no: t("no") };
  const fieldLabel = (field: string) =>
    t.has(`field.${field}` as "field.name")
      ? t(`field.${field}` as "field.name")
      : humanizeKey(field);
  const what = (entity: string, entityId: string) =>
    entity === "units"
      ? t("on.units", { name: plates.get(entityId) ?? tFleet("noPlate") })
      : entity === "product_year_bands"
        ? t("on.product_year_bands")
        : t("on.products");

  return (
    <Panel intro={t("intro")} className="max-w-3xl">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ol className="divide-y rounded-md border">
          {entries.map((entry) => {
            const who =
              entry.actor === null
                ? t("system")
                : (names.get(entry.actor) ?? t("formerMember"));
            const subject = what(entry.entity, entry.entityId);
            const line = t.has(`action.${entry.action}` as "action.insert")
              ? t(`action.${entry.action}` as "action.insert", {
                  who,
                  what: subject,
                })
              : t("action.other", {
                  who,
                  action: entry.action,
                  what: subject,
                });
            return (
              <li key={entry.id} className="p-3 text-sm">
                <p className="font-medium">{line}</p>
                <p className="text-xs text-muted-foreground">
                  <time dateTime={entry.at}>
                    {formatInstant(new Date(entry.at), timezone, locale)}
                  </time>
                </p>
                {entry.changes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {entry.changes.map((change) => (
                      <li key={change.field}>
                        {t("change", {
                          field: fieldLabel(change.field),
                          from: historyValue(change.from, words),
                          to: historyValue(change.to, words),
                        })}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {rows.length >= limit && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("latest", { count: limit })}
        </p>
      )}
    </Panel>
  );
}
