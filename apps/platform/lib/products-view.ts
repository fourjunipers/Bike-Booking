import {
  orderProducts,
  type ProductsTab,
  type Stock,
} from "./general-products";
import { listingStatus, type ListingStatus } from "./vehicle-kinds";

/**
 * The Products list (docs/products-redesign.md §4.1): one row per product,
 * with what it is, how many units it has and where it stands on Moto Mangos.
 * Products and Fleet are two views of the same rows; this one counts units,
 * Fleet lists them. Pure functions, so the filters can be tested.
 */

export const productScopes = ["current", "retired", "all"] as const;
export type ProductScope = (typeof productScopes)[number];

export const listingFilters = [
  "listed",
  "inReview",
  "needsChanges",
  "notListed",
] as const satisfies readonly ListingStatus[];

export type ProductsView = {
  q: string;
  scope: ProductScope;
  kind: string;
  category: string;
  listing: ListingStatus | "";
};

export const defaultProductsView: ProductsView = {
  q: "",
  scope: "current",
  kind: "",
  category: "",
  listing: "",
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, 100) : "";

/** The view asked for in the address; anything unknown falls back to the default. */
export function parseProductsView(
  query: Record<string, string | string[] | undefined>,
): ProductsView {
  const scope = text(query.scope);
  const listing = text(query.listing);
  return {
    q: text(query.q),
    scope: (productScopes as readonly string[]).includes(scope)
      ? (scope as ProductScope)
      : "current",
    kind: /^[a-z_]{1,40}$/.test(text(query.kind)) ? text(query.kind) : "",
    category: /^[a-z][a-z0-9_]{0,39}$/.test(text(query.category))
      ? text(query.category)
      : "",
    listing: (listingFilters as readonly string[]).includes(listing)
      ? (listing as ListingStatus)
      : "",
  };
}

/** How many filters are on, the search box included. */
export function productsFilterCount(view: ProductsView): number {
  return (
    Number(view.q !== "") +
    Number(view.scope !== "current") +
    Number(view.kind !== "") +
    Number(view.category !== "") +
    Number(view.listing !== "")
  );
}

export type ProductInput = {
  id: string;
  name: string;
  type: string;
  /** Null for a general product. */
  vehicle_type: string | null;
  categories: string[];
  photos: string[];
  retired_at: string | null;
  marketplace_listed: boolean;
  catalog_rejected_at: string | null;
  /** The status of the list entry it is on, if any. */
  entry_status: string | null;
  units: { status: string }[];
  /** Its place in the shop's own order, if the shop has one. */
  sort_position?: number | null;
  /** A general product's stock (gear and items for sale). */
  stock?: Stock;
};

export type ProductRow = ProductInput & {
  /** Units that are in the fleet: active or in maintenance. */
  inFleet: number;
  /** Units that have left it: sold or retired. */
  past: number;
  /** Null for anything Moto Mangos doesn't list (not a motorbike). */
  listing: ListingStatus | null;
};

const plain = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Every product as a row, then the ones the tab and the view ask for, in the
 * shop's order (its own, or A to Z). The kind, category and Moto Mangos
 * filters are about vehicles: with one on, a general product is left out.
 */
export function buildProductsView(
  products: ProductInput[],
  view: ProductsView,
  tab: ProductsTab = "all",
): { rows: ProductRow[]; total: number } {
  const rows = products.map((product) => {
    const past = product.units.filter(
      (unit) => unit.status === "sold" || unit.status === "retired",
    ).length;
    return {
      ...product,
      inFleet: product.units.length - past,
      past,
      listing: listingStatus(
        { ...product, vehicle_type: product.vehicle_type ?? "" },
        product.entry_status,
      ),
    };
  });
  const words = plain(view.q).split(" ").filter(Boolean);
  const shown = rows.filter((row) => {
    if (tab === "vehicles" && row.type !== "vehicle") return false;
    if (tab === "general" && row.type === "vehicle") return false;
    const retired = row.retired_at !== null;
    if (view.scope === "current" && retired) return false;
    if (view.scope === "retired" && !retired) return false;
    if (view.kind && row.vehicle_type !== view.kind) return false;
    if (view.category && !row.categories.includes(view.category)) return false;
    if (view.listing && row.listing !== view.listing) return false;
    // By name: a product has no make or model on the platform.
    const haystack = plain(row.name);
    return words.every((word) => haystack.includes(word));
  });
  // The order is the whole shop's: a filtered list keeps each row's place.
  const place = new Map(
    orderProducts(rows).map((row, index) => [row.id, index]),
  );
  shown.sort((a, b) => place.get(a.id)! - place.get(b.id)!);
  return { rows: shown, total: rows.length };
}
