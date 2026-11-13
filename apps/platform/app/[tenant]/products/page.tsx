import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ChevronDown,
  ConciergeBell,
  HardHat,
  Plus,
  Search,
  Tag,
} from "lucide-react";
import { KindIcon } from "@/components/fleet/kind-icon";
import {
  MoveButtons,
  MoveForms,
  OrderBar,
} from "@/components/fleet/order-controls";
import { EditPencil, ProductTags } from "@/components/fleet/product-tags";
import { Field, inputClass } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import {
  getFleet,
  getGeneralProducts,
  getProductStock,
} from "@/lib/fleet-data";
import {
  hasCustomOrder,
  parseProductsTab,
  productTabs,
  stockOf,
  stockWording,
} from "@/lib/general-products";
import {
  buildProductsView,
  listingFilters,
  parseProductsView,
  productScopes,
  productsFilterCount,
} from "@/lib/products-view";
import { canManageFleet } from "@/lib/roles";
import { humanizeKey, kindTypes, vehicleKinds } from "@/lib/vehicle-kinds";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("products") };
}

/** A general product's icon, where a vehicle shows its kind. */
const generalIcons = {
  gear: HardHat,
  sale_item: Tag,
  service: ConciergeBell,
} as const;

/**
 * Products (docs/products-redesign.md §4.1): everything the shop rents out,
 * sells or charges for, one row each, under three tabs: All, Vehicles and
 * General (rental gear, items for sale, services). A general row shows its
 * type and stock ("18 in stock, 2 lost") where a vehicle shows its kind and
 * vehicles. Fleet, beside it, lists the vehicles unit by unit. Both lists
 * share the shop's one order. Everyone reads; owners and managers add,
 * change and reorder.
 */
export default async function ProductsPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/products">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireArea(slug, "products");
  const { tenant, role } = membership;
  const manage = canManageFleet(role);
  const [t, tFleet, tCommon, fleet, general, stock] = await Promise.all([
    getTranslations("Products"),
    getTranslations("Fleet"),
    getTranslations("Common"),
    getFleet(tenant.id),
    getGeneralProducts(tenant.id),
    getProductStock(tenant.id),
  ]);
  const base = `/${slug}/products`;
  const tab = parseProductsTab(query);
  const view = parseProductsView(query);
  // The Moto Mangos state is the owner's and manager's business.
  if (!manage) view.listing = "";
  const products = [
    ...fleet,
    ...general.map((product) => ({
      ...product,
      vehicle_type: null,
      categories: [],
      marketplace_listed: false,
      catalog_rejected_at: null,
      entry_status: null,
      units: [],
      stock: stockOf(stock, product.id),
    })),
  ];
  const { rows, total } = buildProductsView(products, view, tab);
  const filters = productsFilterCount(view);
  // The order is changed on the whole list of a tab, never on a filtered one.
  const custom = hasCustomOrder(products);
  const shown = rows.map((row) => row.id);
  const reorder = manage && filters === 0 && rows.length > 1;
  const tabHref = (name: string) =>
    name === "all" ? base : `${base}?tab=${name}`;
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
        <nav
          aria-label={t("tab.label")}
          className="mb-4 flex gap-1 overflow-x-auto border-b"
        >
          {productTabs.map((name) => (
            <Link
              key={name}
              href={tabHref(name)}
              aria-current={name === tab ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                name === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {t(`tab.${name}`)}
            </Link>
          ))}
        </nav>
      )}

      {total > 0 && (
        <form
          // A new view redraws the form, so its fields show the view on screen.
          key={JSON.stringify([tab, view])}
          role="search"
          action={base}
          className="mb-4 space-y-3 rounded-lg border bg-card p-3 sm:p-4"
        >
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
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
              {/* Kind, category and Moto Mangos are about vehicles. */}
              {tab !== "general" && (
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
              )}
              {tab !== "general" && (
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
              )}
              {manage && tab !== "general" && (
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
                  href={tabHref(tab)}
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
          {manage && (
            <OrderBar slug={slug} custom={custom} filtered={filters > 0} />
          )}
          <ul
            aria-label={t("list")}
            className="divide-y overflow-hidden rounded-lg border bg-card"
          >
            {rows.map((row) => {
              // Only a web address can be shown as it is; photos are uploaded
              // with the online booking page (Phase 3).
              const photo = row.photos.find((url) => /^https?:\/\//.test(url));
              const GeneralIcon =
                generalIcons[row.type as keyof typeof generalIcons];
              const wording = row.stock
                ? stockWording(row.type, row.stock)
                : null;
              return (
                <li
                  key={row.id}
                  className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 even:bg-accent/40 sm:px-4"
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
                    ) : GeneralIcon ? (
                      <GeneralIcon aria-hidden className="size-5" />
                    ) : (
                      <KindIcon
                        kind={row.vehicle_type ?? "other"}
                        className="size-5"
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex min-w-0 items-center gap-1">
                      <Link
                        href={`${base}/${row.id}`}
                        className="min-w-0 rounded-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {row.name}
                      </Link>
                      {/* The edit pencil, beside the title. */}
                      <EditPencil href={`${base}/${row.id}`} name={row.name} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[
                        t(`type.${row.type}` as "type.vehicle"),
                        row.vehicle_type
                          ? tFleet(`kind.${row.vehicle_type}` as "kind.car")
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <ProductTags
                    name={row.name}
                    retired={row.retired_at !== null}
                    listing={manage ? row.listing : null}
                    categories={row.categories}
                  />
                  {row.type === "vehicle" ? (
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background tabular-nums">
                      {t("stock", { count: row.inFleet })}
                    </span>
                  ) : (
                    // A service has no stock: a dash, with words for a screen reader.
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background tabular-nums">
                      {wording ? (
                        t(wording.key, {
                          inStock: wording.inStock,
                          lost: wording.lost,
                        })
                      ) : (
                        <>
                          <span aria-hidden>—</span>
                          <span className="sr-only">{t("noStock")}</span>
                        </>
                      )}
                    </span>
                  )}
                  {row.past > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t("stockPast", { count: row.past })}
                    </span>
                  )}
                  {reorder && (
                    <>
                      <MoveForms slug={slug} id={row.id} shown={shown} />
                      <MoveButtons id={row.id} name={row.name} shown={shown} />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
