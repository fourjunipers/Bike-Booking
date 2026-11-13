import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Copy, Plus } from "lucide-react";
import { ActionForm, Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { UnitRow } from "@/components/fleet/unit-bits";
import { PageHeader } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import {
  catalogName,
  countUpcomingBookings,
  getCatalog,
  getCatalogEntry,
  getFleet,
  getLocations,
  getModel,
  getProduct,
} from "@/lib/fleet-data";
import { isGeneralType } from "@/lib/general-products";
import { splitMakeModel } from "@/lib/known-models";
import { catalogChoices } from "@/lib/model-options";
import { minutesToHours } from "@/lib/fleet";
import { moneyInputValue } from "@/lib/money";
import { canManageFleet } from "@/lib/roles";
import { humanizeKey, reviewNews } from "@/lib/vehicle-kinds";
import { formatInstant } from "@/lib/shop-time";
import { cn } from "@/lib/utils";
import { setModelRetired } from "../../fleet/actions";
import { DeleteProductButton } from "../delete-product";
import { GeneralProductPage } from "../general-product";
import { HistoryTab } from "../history-tab";
import {
  ChooseFromListForm,
  ListEntryActions,
  ListingForm,
  ReviewRequest,
} from "../moto-mangos-forms";
import { ProductForm } from "../product-form";

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
 * - Units: its vehicles (everyone);
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
  const asked = typeof query.tab === "string" ? query.tab : "";
  // Rental gear, an item for sale or a service: its own page (Details,
  // Stock, History). A vehicle carries on below, as before.
  const product = await getProduct(tenant.id, id);
  if (product && isGeneralType(product.type))
    return (
      <GeneralProductPage
        slug={slug}
        tenant={tenant}
        role={role}
        product={product}
        asked={asked}
        added={query.added === "1"}
      />
    );
  // Details and History are for those who set the shop up.
  const allowed: readonly Tab[] = manage ? tabs : ["units"];
  const tab: Tab = (allowed as readonly string[]).includes(asked)
    ? (asked as Tab)
    : allowed[0];

  const [t, tFleet, tProducts, locale, model, fleet, catalog, locations] =
    await Promise.all([
      getTranslations("Fleet.model"),
      getTranslations("Fleet"),
      getTranslations("Products"),
      getLocale(),
      getModel(tenant.id, id),
      getFleet(tenant.id),
      getCatalog(),
      getLocations(tenant.id),
    ]);
  if (!model) notFound();
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
        actions={
          manage && (
            <Link
              href={`/${slug}/products/new?from=${model.id}`}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 px-4",
              )}
            >
              <Copy aria-hidden />
              {tProducts("duplicate")}
            </Link>
          )
        }
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
          tenantId={tenant.id}
          model={model}
          units={units}
          catalog={catalog}
          timezone={tenant.timezone}
          currency={tenant.currency}
          locale={locale}
        />
      )}

      {tab === "units" && (
        <div className="max-w-3xl">
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
        </div>
      )}

      {tab === "history" && (
        <HistoryTab
          tenantId={tenant.id}
          productId={model.id}
          units={units.map((unit) => ({ id: unit.id, name: unit.plate }))}
          unitsAre="vehicles"
          timezone={tenant.timezone}
          locale={locale}
        />
      )}
    </>
  );
}

type Product = NonNullable<Awaited<ReturnType<typeof getModel>>>;
type Catalog = Awaited<ReturnType<typeof getCatalog>>;

/**
 * What the product is, its Moto Mangos panel (motorcycles only), and, at the
 * very bottom of the page, deleting it.
 *
 * The Moto Mangos panel, top to bottom (owner, 13 Nov 2026): the logo; "List
 * it on Moto Mangos"; a picker of the list; "Don't see your bike above?",
 * which opens the review form; then the listing switch and settings, usable
 * only once a model is selected or approved.
 */
async function DetailsTab({
  slug,
  tenantId,
  model,
  units,
  catalog,
  timezone,
  currency,
  locale,
}: {
  slug: string;
  tenantId: string;
  model: Product;
  units: { id: string; status: string }[];
  catalog: Catalog;
  timezone: string;
  currency: string;
  locale: string;
}) {
  const [t, tFleet] = await Promise.all([
    getTranslations("Fleet.model"),
    getTranslations("Fleet"),
  ]);
  // The list entry it is on: one picked from the list, or its own request.
  const entry = model.catalog_id
    ? (catalog.find((c) => c.id === model.catalog_id) ??
      (await getCatalogEntry(model.catalog_id)))
    : null;
  const waiting = entry?.status === "requested";
  const approved = entry?.status === "approved";
  // Bookings that changing the model or disconnecting must leave alone.
  const upcoming = approved
    ? await countUpcomingBookings(
        tenantId,
        units.map((unit) => unit.id),
      )
    : 0;
  const news = reviewNews(model, new Date());
  const own = !model.catalog_id;
  const motorbike = model.vehicle_type === "motorbike";
  // A first guess at the make and model from the name, for the review form.
  const guess = splitMakeModel(model.name, [
    ...new Set(catalog.map((c) => c.make)),
  ]);
  const outline = cn(
    buttonVariants({ variant: "outline" }),
    "h-11 bg-card px-4 text-foreground",
  );

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "grid gap-6",
          motorbike && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
        )}
      >
        <Panel
          id="model-details"
          className={motorbike ? undefined : "max-w-3xl"}
        >
          <ProductForm
            what={{
              vehicle_type: model.vehicle_type,
              categories: model.categories,
            }}
            // On a list entry, or waiting on one: its kind is the entry's.
            locked={!own}
            slug={slug}
            currency={currency}
            values={{
              id: model.id,
              name: model.name,
              description: model.description ?? "",
              bookable_online: model.bookable_online,
              buffer_before_hours: minutesToHours(model.buffer_before_minutes),
              buffer_after_hours: minutesToHours(model.buffer_after_minutes),
              deposit:
                model.deposit === null
                  ? ""
                  : moneyInputValue(model.deposit, currency),
              min_age: text(model.min_age),
              licence_class: model.licence_class ?? "",
            }}
          />
        </Panel>
        {motorbike && (
          <Panel
            id="moto-mangos"
            // The logo first (its alt text is the panel's name). On a white
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
          >
            <h3 className="text-lg font-semibold">
              {tFleet("motoMangos.submitTitle")}
            </h3>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              {tFleet("motoMangos.intro")}
            </p>

            {/* What Moto Mangos decided about its last request, until it is
              sent again or put on a list entry. */}
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
                {/* What to do next: only a product that came back to the shop
                  can be changed and sent again. */}
                {own && (
                  <div className="mt-3 border-t border-amber-300 pt-3">
                    <p className="font-medium">
                      {tFleet("motoMangos.nextTitle")}
                    </p>
                    <p className="mt-1">{tFleet("motoMangos.nextHelp")}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a href="#send-for-review" className={outline}>
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
            ) : approved && entry ? (
              <>
                <p className="text-sm">
                  {tFleet("motoMangos.ready", { name: catalogName(entry) })}
                </p>
                {/* Already on a list entry: change it, or disconnect. */}
                <ListEntryActions
                  slug={slug}
                  id={model.id}
                  choices={catalogChoices(
                    catalog.filter((c) => c.id !== entry.id),
                  )}
                  upcoming={upcoming}
                />
              </>
            ) : (
              <div className="space-y-4">
                <div id="choose-from-list" className="scroll-mt-20">
                  <ChooseFromListForm
                    slug={slug}
                    id={model.id}
                    choices={catalogChoices(catalog)}
                  />
                </div>
                {model.categories.length === 0 ? (
                  <p className="text-sm">
                    {tFleet("motoMangos.categoryFirst")}
                  </p>
                ) : (
                  <ReviewRequest
                    slug={slug}
                    id={model.id}
                    again={Boolean(model.catalog_rejected_at)}
                    // A request being corrected starts open, with what was sent.
                    open={Boolean(model.catalog_rejected_at)}
                    values={{
                      make: model.make || guess.make,
                      model: model.make ? model.model : guess.model,
                      cc: model.cc === null ? "" : String(model.cc),
                      transmission: model.transmission ?? "",
                    }}
                  />
                )}
              </div>
            )}

            {/* The listing switch and settings: below, and only usable once a
              model is selected or approved. */}
            <div className="mt-5 border-t pt-5">
              <h3 className="mb-3 font-medium">
                {tFleet("motoMangos.listingTitle")}
              </h3>
              <ListingForm
                slug={slug}
                id={model.id}
                enabled={Boolean(approved) && !model.retired_at}
                values={{
                  listed: model.marketplace_listed,
                  instant_units: String(model.instant_units),
                  request_units: String(model.request_units),
                  ready_now: String(model.ready_now),
                }}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {tFleet("motoMangos.later")}
              </p>
            </div>
          </Panel>
        )}
      </div>

      {/* The very bottom of the page. Out of use: retire it (kept, hidden)
          once none of its vehicles is in the fleet; delete it when it has no
          vehicles at all. */}
      {model.retired_at && (
        <Panel title={t("retiredTitle")} className="max-w-3xl">
          <p className="mb-3 text-sm">
            {t("retiredOn", {
              date: formatInstant(new Date(model.retired_at), timezone, locale),
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
      <section
        aria-label={t("removeTitle")}
        className="flex flex-wrap gap-3 border-t pt-6"
      >
        <DeleteProductButton
          slug={slug}
          id={model.id}
          hasVehicles={units.length > 0}
          label={t("delete")}
          confirm={t(waiting ? "deleteConfirmWaiting" : "deleteConfirm")}
          blocked={t("deleteBlocked")}
        />
      </section>
    </div>
  );
}
