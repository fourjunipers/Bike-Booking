import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronDown, FileUp, Plus, Printer, Search } from "lucide-react";
import { KindIcon } from "@/components/fleet/kind-icon";
import {
  MoveButtons,
  MoveForms,
  OrderBar,
} from "@/components/fleet/order-controls";
import { EditPencil, ProductTags } from "@/components/fleet/product-tags";
import { UnitRow } from "@/components/fleet/unit-bits";
import { Field, inputClass } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import { unitStatuses } from "@/lib/fleet";
import {
  getBlockedUnitIds,
  getFleet,
  getLocations,
  getProductOrder,
} from "@/lib/fleet-data";
import {
  buildFleetList,
  fleetFilterCount,
  fleetScopes,
  parseFleetList,
} from "@/lib/fleet-list";
import { hasCustomOrder, orderIndex } from "@/lib/general-products";
import { shopModelOptions } from "@/lib/model-options";
import { canManageFleet } from "@/lib/roles";
import {
  humanizeKey,
  kindTypes,
  listingStatus,
  vehicleKinds,
} from "@/lib/vehicle-kinds";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("fleet") };
}

/**
 * Fleet (owner, 13 Nov 2026): the shop's vehicles, one line per product, A
 * to Z by name, each with how many vehicles it has and how many are
 * available now. A line opens to its vehicles. No group headings and no make
 * or model: a product is known by its name. Search and filters live in the
 * address. Everyone reads; owners and managers set up.
 */
export default async function FleetPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/fleet">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const base = `/${slug}/fleet`;
  const { membership } = await requireArea(slug, "fleet");
  const { tenant, role } = membership;
  const manage = canManageFleet(role);
  const [t, tCommon, locale, fleet, locations, blocked, everyProduct] =
    await Promise.all([
      getTranslations("Fleet"),
      getTranslations("Common"),
      getLocale(),
      getFleet(tenant.id),
      getLocations(tenant.id),
      getBlockedUnitIds(tenant.id, new Date()),
      // The one order Fleet shares with the Products list covers every
      // product, general ones included.
      getProductOrder(tenant.id),
    ]);

  const view = parseFleetList(query);
  const { rows, current, past, shown } = buildFleetList(
    fleet.map((product) => ({
      id: product.id,
      name: product.name,
      kind: product.vehicle_type,
      categories: product.categories,
      retired: product.retired_at !== null,
      units: product.units,
    })),
    blocked,
    view,
    orderIndex(everyProduct),
  );
  const filters = fleetFilterCount(view);
  // The order is changed on the whole list, never on a search or a filter.
  const lines = rows.map((row) => row.id);
  const reorder = manage && filters === 0 && rows.length > 1;
  const listings = new Map(
    fleet.map((p) => [p.id, listingStatus(p, p.entry_status)]),
  );
  const categoriesOf = new Map(fleet.map((p) => [p.id, p.categories]));
  const locationNames = new Map(locations.map((l) => [l.id, l.name]));
  // Open when someone is looking for a vehicle, or there is little to scroll.
  const openAll = view.q !== "" || filters > 0 || shown <= 12;
  const link = (variant: "default" | "outline") =>
    cn(buttonVariants({ variant }), "h-11 px-4");
  const categoryLabel = (key: string) =>
    t.has(`category.${key}` as "category.sedan")
      ? t(`category.${key}` as "category.sedan")
      : humanizeKey(key);

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={
          <>
            {t("intro", { units: current, products: fleet.length })}
            {past > 0 && view.scope === "current" && (
              <>
                {" "}
                <Link
                  href={`${base}?scope=past`}
                  className="font-medium underline"
                >
                  {t("view.pastLink", { count: past })}
                </Link>
              </>
            )}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {current + past > 0 && (
              <Link href={`${base}/stickers`} className={link("outline")}>
                <Printer aria-hidden />
                {t("printStickers")}
              </Link>
            )}
            {manage && (
              <>
                <Link href={`${base}/import`} className={link("outline")}>
                  <FileUp aria-hidden />
                  {t("importCsv")}
                </Link>
                <Link
                  href={`/${slug}/products/new`}
                  className={link("default")}
                >
                  <Plus aria-hidden />
                  {t("addModel")}
                </Link>
              </>
            )}
          </div>
        }
      />

      <form
        // A new view redraws the form, so its fields show the view on screen.
        key={JSON.stringify(view)}
        role="search"
        action={base}
        className="mb-4 space-y-3 rounded-lg border bg-card p-3 sm:p-4"
      >
        <div className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            {t("searchLabel")}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={view.q}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            className={cn(inputClass, "flex-1")}
          />
          <Button type="submit" className="h-11 px-4">
            <Search aria-hidden />
            <span className="max-sm:sr-only">{tCommon("search")}</span>
          </Button>
        </div>
        <details open={filters > (view.q ? 1 : 0)}>
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
            <ChevronDown aria-hidden className="size-4" />
            {t("view.filters", { count: filters })}
          </summary>
          <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="scope" label={t("view.show")}>
              <select
                id="scope"
                name="scope"
                defaultValue={view.scope}
                className={inputClass}
              >
                {fleetScopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {t(`view.scope.${scope}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="product" label={t("unit.model")}>
              <select
                id="product"
                name="product"
                defaultValue={view.product}
                className={inputClass}
              >
                <option value="">{t("view.any")}</option>
                {/* Products in use, A to Z: a retired one isn't offered. */}
                {shopModelOptions(fleet).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="kind" label={t("view.kind")}>
              <select
                id="kind"
                name="kind"
                defaultValue={view.kind}
                className={inputClass}
              >
                <option value="">{t("view.any")}</option>
                {kindTypes.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`kind.${kind}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="category" label={t("view.category")}>
              <select
                id="category"
                name="category"
                defaultValue={view.category}
                className={inputClass}
              >
                <option value="">{t("view.any")}</option>
                {vehicleKinds
                  .filter((kind) => kind.categories.length > 0)
                  .map((kind) => (
                    <optgroup key={kind.type} label={t(`kind.${kind.type}`)}>
                      {kind.categories.map((key) => (
                        <option key={key} value={key}>
                          {categoryLabel(key)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
              </select>
            </Field>
            <Field id="status" label={t("unit.status")}>
              <select
                id="status"
                name="status"
                defaultValue={view.status}
                className={inputClass}
              >
                <option value="">{t("view.any")}</option>
                {unitStatuses.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </select>
            </Field>
            {locations.length > 1 && (
              <Field id="location" label={t("unit.location")}>
                <select
                  id="location"
                  name="location"
                  defaultValue={view.location}
                  className={inputClass}
                >
                  <option value="">{t("view.any")}</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field id="year" label={t("unit.modelYear")}>
              <input
                id="year"
                name="year"
                inputMode="numeric"
                maxLength={4}
                defaultValue={view.year ?? ""}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2 pt-3">
            <Button type="submit" variant="outline" className="h-11 px-4">
              {t("view.apply")}
            </Button>
            {filters > 0 && (
              <Link
                href={base}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-11 px-4",
                )}
              >
                {t("view.reset")}
              </Link>
            )}
          </div>
        </details>
      </form>

      {fleet.length === 0 ? (
        <p className="rounded-lg border bg-card p-5 text-muted-foreground">
          {t("empty")}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border bg-card p-5 text-muted-foreground">
          {view.q ? t("noMatch", { query: view.q }) : t("view.noneMatch")}
        </p>
      ) : (
        <>
          {manage && (
            <OrderBar
              slug={slug}
              custom={hasCustomOrder(everyProduct)}
              filtered={filters > 0}
            />
          )}
          <ul
            aria-label={t("list")}
            className="divide-y overflow-hidden rounded-lg border bg-card"
          >
            {rows.map((row) => (
              <li key={row.id} className="even:bg-accent/40">
                {reorder && <MoveForms slug={slug} id={row.id} shown={lines} />}
                <details
                  data-fleet-product
                  className="group"
                  open={openAll && row.units.length > 0}
                >
                  <summary className="flex min-h-16 cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none sm:px-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground">
                      <KindIcon kind={row.kind} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1 basis-40">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="min-w-0 font-semibold">
                          {row.name}
                        </span>
                        {/* The edit pencil, beside the title: opens the product. */}
                        <EditPencil
                          href={`/${slug}/products/${row.id}`}
                          name={row.name}
                        />
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {t("vehicleCounts", {
                          vehicles: row.vehicles,
                          available: row.available,
                        })}
                      </span>
                    </span>
                    {/* The same tags as on the Products list. */}
                    <ProductTags
                      name={row.name}
                      retired={row.retired}
                      listing={manage ? (listings.get(row.id) ?? null) : null}
                      categories={categoriesOf.get(row.id) ?? []}
                    />
                    {manage && !row.retired && (
                      <Link
                        href={`${base}/units/new?product=${row.id}`}
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "-my-1 h-11 bg-card px-3",
                        )}
                      >
                        <Plus aria-hidden />
                        {t("addUnitRow")}
                        <span className="sr-only">
                          {": "}
                          {row.name}
                        </span>
                      </Link>
                    )}
                    {reorder && (
                      <MoveButtons id={row.id} name={row.name} shown={lines} />
                    )}
                    <ChevronDown
                      aria-hidden
                      className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    />
                  </summary>
                  {row.units.length === 0 ? (
                    <p className="border-t bg-card px-4 py-3 text-sm text-muted-foreground">
                      {t("noUnits")}
                    </p>
                  ) : (
                    <ul className="divide-y border-t bg-card">
                      {row.units.map((unit) => (
                        <UnitRow
                          key={unit.id}
                          unit={unit}
                          href={`${base}/units/${unit.id}`}
                          distanceUnit={tenant.distanceUnit}
                          locale={locale}
                          detail={
                            [
                              unit.model_year,
                              locations.length > 1
                                ? locationNames.get(unit.location_id)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || undefined
                          }
                        />
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
