import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronDown, FileUp, Plus, Printer, Search } from "lucide-react";
import { EditPencil } from "@/components/fleet/edit-pencil";
import { RowIcon } from "@/components/fleet/kind-icon";
import {
  cell,
  FilterChips,
  ListToolbar,
  MangoStatus,
  rowGrid,
  RowTags,
} from "@/components/fleet/list-bits";
import { MoveButtons, MoveForms } from "@/components/fleet/order-controls";
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
import {
  filterChips,
  parseListSort,
  parseReorder,
  sortRows,
  type ListSort,
} from "@/lib/product-list";
import { canManageFleet } from "@/lib/roles";
import { humanizeKey, listingStatus } from "@/lib/vehicle-kinds";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("fleet") };
}

/**
 * Fleet (owner, 13 and 14 Nov 2026): the shop's vehicles, one line per
 * product, each with how many vehicles it has and how many are available
 * now. A line opens to its vehicles, with "Add vehicle" under them. Every
 * line is two lines high (components/fleet/list-bits rowGrid). Sorted A–Z,
 * by type or in the shop's own order; chips filter by kind and category.
 * Search, filters and sort live in the address. Everyone reads; owners and
 * managers set up and reorder.
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
  const [t, tCommon, tLists, locale, fleet, locations, blocked, everyProduct] =
    await Promise.all([
      getTranslations("Fleet"),
      getTranslations("Common"),
      getTranslations("Lists"),
      getLocale(),
      getFleet(tenant.id),
      getLocations(tenant.id),
      getBlockedUnitIds(tenant.id, new Date()),
      // The one order Fleet shares with the Products list covers every
      // product, general ones included.
      getProductOrder(tenant.id),
    ]);

  const view = parseFleetList(query);
  const sort = parseListSort(query);
  const built = buildFleetList(
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
  const { current, past, shown } = built;
  const rows = sortRows(
    built.rows.map((row) => ({ ...row, type: "vehicle" })),
    sort,
  );
  const filters = fleetFilterCount(view);
  // The order is changed on the whole list in its own order, never on a
  // search, a filter or another sort.
  const lines = rows.map((row) => row.id);
  const reordering =
    manage &&
    parseReorder(query) &&
    sort === "mine" &&
    filters === 0 &&
    rows.length > 1;
  const listings = new Map(
    fleet.map((p) => [p.id, listingStatus(p, p.entry_status)]),
  );
  const locationNames = new Map(locations.map((l) => [l.id, l.name]));
  // Open when someone is looking for a vehicle, or there is little to scroll.
  const openAll = view.q !== "" || filters > 0 || shown <= 12;
  const link = (variant: "default" | "outline") =>
    cn(buttonVariants({ variant }), "h-11 px-4");
  const categoryLabel = (key: string) =>
    t.has(`category.${key}` as "category.sedan")
      ? t(`category.${key}` as "category.sedan")
      : humanizeKey(key);

  /** This view with some of it changed, as an address. */
  const href = (
    changes: Partial<typeof view> & { sort?: ListSort; reorder?: boolean },
  ) => {
    const next = { ...view, sort, reorder: false, ...changes };
    const search = new URLSearchParams();
    if (next.q) search.set("q", next.q);
    if (next.scope !== "current") search.set("scope", next.scope);
    for (const key of [
      "product",
      "status",
      "location",
      "kind",
      "category",
    ] as const)
      if (next[key]) search.set(key, next[key]);
    if (next.year !== null) search.set("year", String(next.year));
    if (next.sort !== "mine") search.set("sort", next.sort);
    if (next.reorder) search.set("reorder", "1");
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };

  // Chips: only the kinds and categories the shop has (in the scope shown).
  const chips = [
    {
      label: tLists("chips.all"),
      href: href({ kind: "", category: "" }),
      current: !view.kind && !view.category,
    },
    ...filterChips(
      fleet
        .filter((p) => view.scope !== "current" || p.retired_at === null)
        .map((p) => ({
          id: p.id,
          name: p.name,
          type: "vehicle",
          kind: p.vehicle_type,
          categories: p.categories,
        })),
    ).map((chip) =>
      chip.by === "kind"
        ? {
            label: t(`kind.${chip.key}` as "kind.car"),
            href: href({ kind: chip.key, category: "" }),
            current: view.kind === chip.key && !view.category,
          }
        : {
            label: categoryLabel(chip.key),
            href: href({ kind: "", category: chip.key }),
            current: view.category === chip.key,
          },
    ),
  ];
  // The filters panel holds the rest: kind and category are the chips.
  const panelFilters =
    filters - Number(view.kind !== "") - Number(view.category !== "");

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
        key={JSON.stringify([view, sort])}
        role="search"
        action={base}
        className="mb-3 space-y-3 rounded-lg border bg-card p-3 sm:p-4"
      >
        {/* A search keeps the chip and the sort. */}
        {view.kind && <input type="hidden" name="kind" value={view.kind} />}
        {view.category && (
          <input type="hidden" name="category" value={view.category} />
        )}
        {sort !== "mine" && <input type="hidden" name="sort" value={sort} />}
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
        <details open={panelFilters > (view.q ? 1 : 0)}>
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
            <ChevronDown aria-hidden className="size-4" />
            {t("view.filters", { count: panelFilters })}
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

      <FilterChips chips={chips} />

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
          <ListToolbar
            slug={slug}
            sort={sort}
            sortHref={(next) => href({ sort: next })}
            reorderHref={
              manage && fleet.length > 1 ? `${base}?reorder=1` : null
            }
            doneHref={base}
            reordering={reordering}
            custom={hasCustomOrder(everyProduct)}
          />
          <ul
            aria-label={t("list")}
            className="divide-y rounded-lg border bg-card"
          >
            {rows.map((row) => {
              const listing = manage ? (listings.get(row.id) ?? null) : null;
              const firstLine = (
                <>
                  <span className={cell.icon}>
                    <RowIcon
                      type="vehicle"
                      kind={row.kind}
                      className="size-4"
                    />
                  </span>
                  {/* One line; the full name is on the product page. */}
                  <span className={cell.name} title={row.name}>
                    {row.name}
                  </span>
                </>
              );
              const secondLine = (
                <>
                  <span className={cell.summary}>
                    <span className="min-w-0 shrink-0 truncate max-sm:shrink">
                      {row.retired && <>{t("listing.retired")} · </>}
                      {t("vehicleCounts", {
                        vehicles: row.vehicles,
                        available: row.available,
                      })}
                    </span>
                    {/* Wide screens: the kind and categories, as far as they fit. */}
                    <RowTags
                      labels={[
                        t(`kind.${row.kind}` as "kind.car"),
                        ...row.categories.map(categoryLabel),
                      ]}
                    />
                  </span>
                  <span className={cell.mango}>
                    <MangoStatus listing={listing} />
                  </span>
                </>
              );

              // Reorder mode: the line doesn't open and has no pencil; it
              // has the arrows instead.
              if (reordering)
                return (
                  <li key={row.id}>
                    <MoveForms slug={slug} id={row.id} shown={lines} />
                    <div data-list-row className={rowGrid({ reorder: true })}>
                      {firstLine}
                      {secondLine}
                      <span className={cell.end}>
                        <MoveButtons
                          id={row.id}
                          name={row.name}
                          shown={lines}
                        />
                      </span>
                    </div>
                  </li>
                );

              return (
                <li key={row.id}>
                  <details
                    data-fleet-product
                    className="group"
                    open={openAll && row.units.length > 0}
                  >
                    <summary
                      data-list-row
                      className={cn(
                        rowGrid({ chevron: true }),
                        "cursor-pointer list-none outline-none hover:bg-muted focus-visible:bg-muted [&::-webkit-details-marker]:hidden",
                      )}
                    >
                      {firstLine}
                      <span className={cell.pencil}>
                        <EditPencil
                          href={`/${slug}/products/${row.id}`}
                          name={row.name}
                        />
                      </span>
                      {secondLine}
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          cell.end,
                          "size-5 text-muted-foreground transition-transform group-open:rotate-180",
                        )}
                      />
                    </summary>
                    {row.units.length === 0 ? (
                      <p className="border-t px-4 py-3 text-sm text-muted-foreground">
                        {t("noUnits")}
                      </p>
                    ) : (
                      <ul className="divide-y border-t">
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
                    {/* "Add vehicle" is in the opened line, under its vehicles. */}
                    {manage && !row.retired && (
                      <div className="border-t px-3 py-2 sm:px-4">
                        <Link
                          href={`${base}/units/new?product=${row.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "h-11 px-3",
                          )}
                        >
                          <Plus aria-hidden />
                          {t("addUnitRow")}
                          <span className="sr-only">
                            {": "}
                            {row.name}
                          </span>
                        </Link>
                      </div>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
