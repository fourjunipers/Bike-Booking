import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { KindIcon } from "@/components/fleet/kind-icon";
import { Field, inputClass } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import { getFleet } from "@/lib/fleet-data";
import {
  buildProductsView,
  listingFilters,
  parseProductsView,
  productScopes,
  productsFilterCount,
} from "@/lib/products-view";
import { canManageFleet } from "@/lib/roles";
import {
  humanizeKey,
  kindTypes,
  vehicleKinds,
  type ListingStatus,
} from "@/lib/vehicle-kinds";
import { cn } from "@/lib/utils";

/** The Moto Mangos chip: the word says it, the colour helps. */
const listingClass: Record<ListingStatus, string> = {
  listed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  inReview: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  needsChanges: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  notListed: "border bg-card text-muted-foreground",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("products") };
}

/**
 * Products (docs/products-redesign.md §4.1): everything the shop rents out,
 * one row each. Stage A shows vehicles; gear, services and items for sale
 * join in stage B. Fleet, beside it, lists the same vehicles unit by unit.
 * Everyone reads; owners and managers add and change.
 */
export default async function ProductsPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/products">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireArea(slug, "products");
  const { tenant, role } = membership;
  const manage = canManageFleet(role);
  const [t, tFleet, tCommon, fleet] = await Promise.all([
    getTranslations("Products"),
    getTranslations("Fleet"),
    getTranslations("Common"),
    getFleet(tenant.id),
  ]);
  const base = `/${slug}/products`;
  const view = parseProductsView(query);
  // The Moto Mangos state is the owner's and manager's business.
  if (!manage) view.listing = "";
  const { rows, total } = buildProductsView(fleet, view);
  const filters = productsFilterCount(view);
  const categoryLabel = (key: string) =>
    tFleet.has(`category.${key}` as "category.sedan")
      ? tFleet(`category.${key}` as "category.sedan")
      : humanizeKey(key);

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro", { count: total })}
        actions={
          manage && (
            <Link
              href={`${base}/new`}
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-11 px-4",
              )}
            >
              <Plus aria-hidden />
              {t("new")}
            </Link>
          )
        }
      />

      {total > 0 && (
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
              {tFleet("view.filters", { count: filters })}
            </summary>
            <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="scope" label={t("show")}>
                <select
                  id="scope"
                  name="scope"
                  defaultValue={view.scope}
                  className={inputClass}
                >
                  {productScopes.map((scope) => (
                    <option key={scope} value={scope}>
                      {t(`scope.${scope}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="kind" label={tFleet("view.kind")}>
                <select
                  id="kind"
                  name="kind"
                  defaultValue={view.kind}
                  className={inputClass}
                >
                  <option value="">{tFleet("view.any")}</option>
                  {kindTypes.map((kind) => (
                    <option key={kind} value={kind}>
                      {tFleet(`kind.${kind}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="category" label={tFleet("view.category")}>
                <select
                  id="category"
                  name="category"
                  defaultValue={view.category}
                  className={inputClass}
                >
                  <option value="">{tFleet("view.any")}</option>
                  {vehicleKinds
                    .filter((kind) => kind.categories.length > 0)
                    .map((kind) => (
                      <optgroup
                        key={kind.type}
                        label={tFleet(`kind.${kind.type}`)}
                      >
                        {kind.categories.map((key) => (
                          <option key={key} value={key}>
                            {categoryLabel(key)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                </select>
              </Field>
              {manage && (
                <Field id="listing" label={t("motoMangos")}>
                  <select
                    id="listing"
                    name="listing"
                    defaultValue={view.listing}
                    className={inputClass}
                  >
                    <option value="">{tFleet("view.any")}</option>
                    {listingFilters.map((status) => (
                      <option key={status} value={status}>
                        {tFleet(`listing.${status}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-3">
              <Button type="submit" variant="outline" className="h-11 px-4">
                {tFleet("view.apply")}
              </Button>
              {filters > 0 && (
                <Link
                  href={base}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-11 px-4",
                  )}
                >
                  {tFleet("view.reset")}
                </Link>
              )}
            </div>
          </details>
        </form>
      )}

      {total === 0 ? (
        <p className="rounded-lg border bg-card p-5 text-muted-foreground">
          {t("empty")}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border bg-card p-5 text-muted-foreground">
          {t("noMatch")}
        </p>
      ) : (
        <>
          {rows.length !== total && (
            <p role="status" className="mb-2 text-sm text-muted-foreground">
              {t("showing", { shown: rows.length, total })}
            </p>
          )}
          <ul
            aria-label={t("list")}
            className="divide-y overflow-hidden rounded-lg border bg-card"
          >
            {rows.map((row) => {
              // Only a web address can be shown as it is; photos are uploaded
              // with the online booking page (Phase 3).
              const photo = row.photos.find((url) => /^https?:\/\//.test(url));
              return (
                <li key={row.id} className="even:bg-accent/40">
                  <Link
                    href={`${base}/${row.id}`}
                    aria-label={t("open", { name: row.name })}
                    className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-4"
                  >
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
                        <KindIcon kind={row.vehicle_type} className="size-5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 basis-40">
                      <span className="block font-semibold">{row.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {[
                          t(`type.${row.type}` as "type.vehicle"),
                          tFleet(`kind.${row.vehicle_type}` as "kind.car"),
                        ].join(" · ")}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {row.retired_at !== null && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {tFleet("listing.retired")}
                        </span>
                      )}
                      {manage && row.listing && row.retired_at === null && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            listingClass[row.listing],
                          )}
                        >
                          {tFleet(`listing.${row.listing}`)}
                        </span>
                      )}
                      {row.categories.map((key) => (
                        <span
                          key={key}
                          className="rounded-full border bg-card px-2 py-0.5 text-xs font-medium"
                        >
                          {categoryLabel(key)}
                        </span>
                      ))}
                      <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background tabular-nums">
                        {t("stock", { count: row.inFleet })}
                      </span>
                      {row.past > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {t("stockPast", { count: row.past })}
                        </span>
                      )}
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
