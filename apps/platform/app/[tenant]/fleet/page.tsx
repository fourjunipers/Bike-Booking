import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ChevronDown,
  FileUp,
  Pencil,
  Plus,
  Printer,
  Search,
} from "lucide-react";
import { KindIcon } from "@/components/fleet/kind-icon";
import { MakeModelPicker } from "@/components/fleet/make-model-picker";
import { UnitRow } from "@/components/fleet/unit-bits";
import { Field, inputClass } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import { transmissions, unitStatuses } from "@/lib/fleet";
import {
  getFleet,
  getLocations,
  getPurchaseDates,
  getYearBands,
} from "@/lib/fleet-data";
import {
  activeFilterCount,
  buildFleetView,
  defaultView,
  fleetViewCookie,
  groupModes,
  parseView,
  scopes,
  sortModes,
  viewQuery,
  type FleetGroup,
  type StatusCounts,
} from "@/lib/fleet-view";
import { shopModelOptions } from "@/lib/model-options";
import { canManageFleet } from "@/lib/roles";
import {
  humanizeKey,
  kindTypes,
  listingStatus,
  vehicleKinds,
  type ListingStatus,
} from "@/lib/vehicle-kinds";
import { cn } from "@/lib/utils";
import { ExpandCollapse, RememberView } from "./fleet-controls";

/** The Moto Mangos chip on a model's row: the word says it, the colour helps. */
const listingClass: Record<ListingStatus, string> = {
  listed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  inReview: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  needsChanges: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  notListed: "border bg-card text-muted-foreground",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("fleet") };
}

/**
 * Fleet (SPEC › Fleet; grouped view, owner 11 Nov 2026). Bikes grouped by
 * model and model-year band by default, or by make, location or status, with
 * filters and sorting in the address so a view can be bookmarked. Each group
 * is a native <details>: closed groups cost nothing to draw, which keeps a
 * 150-bike fleet quick on a phone. Everyone reads; owners and managers set up.
 */
export default async function FleetPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/fleet">) {
  const [{ tenant: slug }, query, cookieStore] = await Promise.all([
    params,
    searchParams,
    cookies(),
  ]);
  const base = `/${slug}/fleet`;

  // No view asked for: bring back this person's last one on this device.
  if (Object.keys(query).length === 0) {
    const saved = cookieStore.get(fleetViewCookie(slug))?.value;
    if (saved) {
      const remembered = viewQuery(
        parseView(Object.fromEntries(new URLSearchParams(saved))),
      );
      if (remembered) redirect(`${base}?${remembered}`);
    }
  }

  const { membership } = await requireArea(slug, "fleet");
  const { tenant, role } = membership;
  const manage = canManageFleet(role);
  const [t, tCommon, locale, fleet, bands, locations, purchaseDates] =
    await Promise.all([
      getTranslations("Fleet"),
      getTranslations("Common"),
      getLocale(),
      getFleet(tenant.id),
      getYearBands(tenant.id),
      getLocations(tenant.id),
      manage ? getPurchaseDates(tenant.id) : new Map<string, string | null>(),
    ]);

  const view = query.reset === "1" ? defaultView : parseView(query);
  // Purchase dates are owner and manager data; nobody else can sort by them.
  if (!manage && view.sort === "purchaseDate") view.sort = defaultView.sort;

  const units = fleet.flatMap((model) =>
    model.units.map((unit) => ({
      ...unit,
      purchase_date: purchaseDates.get(unit.id),
    })),
  );
  const modelOf = new Map(fleet.map((model) => [model.id, model]));
  const locationNames = new Map(locations.map((l) => [l.id, l.name]));
  const result = buildFleetView(
    {
      units,
      bands,
      locations,
      models: fleet.map((model) => ({
        id: model.id,
        name: model.name,
        make: model.catalog?.make ?? "",
        model: model.catalog?.model ?? model.name,
        cc: model.catalog?.cc ?? null,
        transmission: model.catalog?.transmission ?? null,
        kind: model.vehicle_type,
        categories: model.categories,
        retired: model.retired_at !== null,
      })),
    },
    view,
  );

  const filters = activeFilterCount(view);
  const groupCount = result.sections.reduce((n, s) => n + s.groups.length, 0);
  // Open by default only when there is little to scroll past.
  const openAll = view.group === "none" || view.q !== "" || result.shown <= 12;
  const link = (variant: "default" | "outline") =>
    cn(buttonVariants({ variant }), "h-11 px-4");

  const breakdown = (counts: StatusCounts) =>
    unitStatuses
      .filter((status) => counts[status])
      .map((status) =>
        t("statusCount", {
          count: counts[status],
          status: t(`status.${status}`).toLowerCase(),
        }),
      )
      .join(", ");
  const bandLabel = (group: FleetGroup) =>
    group.band === "range"
      ? group.yearFrom === group.yearTo
        ? String(group.yearFrom)
        : t("bands.range", { from: group.yearFrom!, to: group.yearTo! })
      : group.band === "unknown"
        ? t("bands.unknown")
        : group.band === "other"
          ? t("bands.other")
          : t("bands.all");
  const groupTitle = (group: FleetGroup) =>
    group.kind === "band"
      ? `${group.make} ${group.model} · ${bandLabel(group)}`
      : group.kind === "status"
        ? t(`status.${group.status}` as "status.active")
        : group.kind === "all"
          ? t("allBikes")
          : group.title;
  const categoryLabel = (key: string) =>
    t.has(`category.${key}` as "category.sedan")
      ? t(`category.${key}` as "category.sedan")
      : humanizeKey(key);
  const options = <T extends string>(
    values: readonly T[],
    label: (v: T) => string,
  ) =>
    values.map((value) => (
      <option key={value} value={value}>
        {label(value)}
      </option>
    ));

  return (
    <>
      <RememberView slug={slug} query={viewQuery(view)} />
      <PageHeader
        title={t("title")}
        intro={
          <>
            {t("intro", { units: result.current, models: fleet.length })}
            {result.past > 0 && view.scope === "current" && (
              <>
                {" "}
                <Link
                  href={`${base}?scope=past`}
                  className="font-medium underline"
                >
                  {t("view.pastLink", { count: result.past })}
                </Link>
              </>
            )}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {result.total > 0 && (
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
                <Link href={`${base}/models/new`} className={link("default")}>
                  <Plus aria-hidden />
                  {t("addModel")}
                </Link>
              </>
            )}
          </div>
        }
      />

      <form
        // A new view (a filter applied, or "Reset view") redraws the form, so
        // its fields always show the view on screen, not the one before.
        key={viewQuery(view)}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field id="scope" label={t("view.show")}>
            <select
              id="scope"
              name="scope"
              defaultValue={view.scope}
              className={inputClass}
            >
              {options(scopes, (scope) => t(`view.scope.${scope}`))}
            </select>
          </Field>
          <Field id="group" label={t("view.groupBy")}>
            <select
              id="group"
              name="group"
              defaultValue={view.group}
              className={inputClass}
            >
              {options(
                // Grouping by location is for shops with more than one.
                groupModes.filter(
                  (mode) => mode !== "location" || locations.length > 1,
                ),
                (mode) => t(`view.group.${mode}`),
              )}
            </select>
          </Field>
          <Field id="sort" label={t("view.sortBy")}>
            <select
              id="sort"
              name="sort"
              defaultValue={view.sort}
              className={inputClass}
            >
              {options(
                sortModes.filter((mode) => manage || mode !== "purchaseDate"),
                (mode) => t(`view.sort.${mode}`),
              )}
            </select>
          </Field>
        </div>
        <details open={filters > (view.q ? 1 : 0)}>
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
            <ChevronDown aria-hidden className="size-4" />
            {t("view.filters", { count: filters })}
          </summary>
          <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="kind" label={t("view.kind")}>
              <select
                id="kind"
                name="kind"
                defaultValue={view.kind}
                className={inputClass}
              >
                <option value="">{t("view.any")}</option>
                {options(kindTypes, (kind) => t(`kind.${kind}`))}
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
                      {options(kind.categories, categoryLabel)}
                    </optgroup>
                  ))}
              </select>
            </Field>
            <MakeModelPicker
              makeName="make"
              modelName="model"
              makeLabel={t("unit.make")}
              modelLabel={t("unit.model")}
              anyLabel={t("view.any")}
              models={shopModelOptions(fleet)}
              defaultMake={view.make}
              defaultModel={view.model}
            />
            <Field id="status" label={t("unit.status")}>
              <select
                id="status"
                name="status"
                defaultValue={view.status}
                className={inputClass}
              >
                <option value="">{t("view.any")}</option>
                {options(unitStatuses, (status) => t(`status.${status}`))}
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
            <Field id="transmission" label={t("what.transmission")}>
              <select
                id="transmission"
                name="transmission"
                defaultValue={view.transmission}
                className={inputClass}
              >
                <option value="">{t("view.any")}</option>
                {options(transmissions, (value) => t(`transmission.${value}`))}
              </select>
            </Field>
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
            <Field id="ccMin" label={t("view.ccMin")}>
              <input
                id="ccMin"
                name="ccMin"
                inputMode="numeric"
                maxLength={4}
                defaultValue={view.ccMin ?? ""}
                className={inputClass}
              />
            </Field>
            <Field id="ccMax" label={t("view.ccMax")}>
              <input
                id="ccMax"
                name="ccMax"
                inputMode="numeric"
                maxLength={4}
                defaultValue={view.ccMax ?? ""}
                className={inputClass}
              />
            </Field>
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="outline" className="h-11 px-5">
            {t("view.apply")}
          </Button>
          <Link
            href={`${base}?reset=1`}
            className="inline-flex min-h-11 items-center text-sm font-medium underline"
          >
            {t("view.reset")}
          </Link>
        </div>
      </form>

      {fleet.length === 0 && (
        <p className="rounded-lg border bg-card p-5 text-muted-foreground">
          {t("empty")}
        </p>
      )}
      {(result.total > 0 || (manage && fleet.length > 0)) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {result.total > 0 && (
              <p role="status" className="text-sm text-muted-foreground">
                {result.shown === result.total
                  ? t("unitCount", { count: result.total })
                  : t("view.showing", {
                      shown: result.shown,
                      total: result.total,
                    })}
              </p>
            )}
          </div>
          {groupCount > 1 && (
            <ExpandCollapse
              expandLabel={t("view.expandAll")}
              collapseLabel={t("view.collapseAll")}
            />
          )}
        </div>
      )}
      {result.total > 0 && result.shown === 0 && (
        <p className="rounded-lg border bg-card p-5 text-muted-foreground">
          {view.q && filters === 1
            ? t("noMatch", { query: view.q })
            : t("view.noneMatch")}
        </p>
      )}

      <div className="space-y-4">
        {result.sections.map((section) => {
          const model = section.model ? modelOf.get(section.model.id) : null;
          const status =
            manage && model ? listingStatus(model, model.entry_status) : null;
          // Only a web address can be shown as it is; photos are uploaded
          // with the online booking page (Phase 3).
          const photo = model?.photos.find((url) => /^https?:\/\//.test(url));
          return (
            <section
              key={section.key}
              aria-labelledby={`section-${section.key}`}
              className="overflow-hidden rounded-lg border bg-card"
            >
              {section.model && (
                // The header row: a light mango tint (dark text on it is AA).
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-accent px-3 py-2 sm:px-4">
                  {/* A fixed box, so the row doesn't move when a photo loads. */}
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-card text-muted-foreground">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a shop's own photo address, not ours to optimise
                      <img
                        src={photo}
                        alt=""
                        width={44}
                        height={44}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <KindIcon
                        kind={model?.vehicle_type ?? "motorbike"}
                        className="size-5"
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex min-w-0 items-center gap-1">
                      <h2
                        id={`section-${section.key}`}
                        className="min-w-0 text-lg font-semibold"
                      >
                        {/* No underline at rest (owner, 12 Nov 2026): the
                            pencil beside it says it can be opened. */}
                        <Link
                          href={`${base}/models/${section.model.id}`}
                          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-accent"
                        >
                          {section.model.name}
                        </Link>
                      </h2>
                      <Link
                        href={`${base}/models/${section.model.id}`}
                        aria-label={`${t("editModel")}: ${section.model.name}`}
                        title={t("editModel")}
                        // A plain icon: no box until hovered or focused. 44 px
                        // to tap; the negative margin keeps the row's height.
                        className="-my-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-accent"
                      >
                        <Pencil aria-hidden className="size-4" />
                      </Link>
                    </div>
                    {(section.model.cc || section.model.transmission) && (
                      <p className="text-sm text-muted-foreground">
                        {[
                          section.model.cc ? `${section.model.cc} cc` : null,
                          section.model.transmission
                            ? t(
                                `transmission.${section.model.transmission}` as "transmission.manual",
                              )
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <ul
                    aria-label={t("modelFacts", { name: section.model.name })}
                    className="flex flex-wrap items-center gap-1.5"
                  >
                    {section.model.retired && (
                      <li className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {t("listing.retired")}
                      </li>
                    )}
                    {status && !section.model.retired && (
                      <li
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          listingClass[status],
                        )}
                      >
                        {t(`listing.${status}`)}
                      </li>
                    )}
                    {/* Every category the model has. */}
                    {(section.model.categories ?? []).map((key) => (
                      <li
                        key={key}
                        className="rounded-full border bg-card px-2 py-0.5 text-xs font-medium"
                      >
                        {categoryLabel(key)}
                      </li>
                    ))}
                    <li className="rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background tabular-nums">
                      {t("unitCount", { count: section.count })}
                    </li>
                  </ul>
                </div>
              )}
              <div className="divide-y">
                {section.groups.map((group) => (
                  <details
                    key={group.key}
                    data-fleet-group
                    open={openAll && group.count > 0}
                    // A very light cream on every other row.
                    className="group even:bg-accent/40"
                  >
                    <summary className="flex min-h-14 cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none sm:px-4">
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="font-medium">{groupTitle(group)}</p>
                        <p className="text-sm text-muted-foreground">
                          {group.count === 0
                            ? t("unitCount", { count: 0 })
                            : `${t("unitCount", { count: group.count })}: ${breakdown(group.statusCounts)}`}
                        </p>
                      </div>
                      {manage && section.model && !section.model.retired && (
                        // A labelled button, not a bare plus (owner, 12 Nov
                        // 2026). Its name starts with what is on it.
                        <Link
                          href={`${base}/units/new?model=${section.model.id}`}
                          title={t("addUnit")}
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "-my-1 h-11 bg-card px-3",
                          )}
                        >
                          <Plus aria-hidden />
                          {t("addUnitRow")}
                          <span className="sr-only">
                            {": "}
                            {section.model.name}
                          </span>
                        </Link>
                      )}
                      <ChevronDown
                        aria-hidden
                        className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      />
                    </summary>
                    {group.count > 0 && (
                      <ul className="divide-y border-t bg-card [&>li:nth-child(even)]:bg-accent/40">
                        {group.units.map((unit) => (
                          <UnitRow
                            key={unit.id}
                            unit={unit}
                            href={`${base}/units/${unit.id}`}
                            distanceUnit={tenant.distanceUnit}
                            locale={locale}
                            detail={
                              [
                                group.kind === "band"
                                  ? null
                                  : modelOf.get(unit.model_id)?.name,
                                unit.model_year,
                                locationNames.get(unit.location_id),
                              ]
                                .filter(Boolean)
                                .join(" · ") || undefined
                            }
                          />
                        ))}
                      </ul>
                    )}
                  </details>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
