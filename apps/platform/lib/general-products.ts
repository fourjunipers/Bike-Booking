import { z } from "zod";

/**
 * General products (docs/products-redesign.md §5.7): rental gear, items for
 * sale, services and extras; and the one manual order Fleet and the Products
 * list share. Pure, so the rules can be tested.
 */

export const generalTypes = ["gear", "sale_item", "service"] as const;
export type GeneralType = (typeof generalTypes)[number];

export function isGeneralType(type: string): type is GeneralType {
  return (generalTypes as readonly string[]).includes(type);
}

/** Gear and items for sale are counted; a service has no stock. */
export function hasStock(type: string): boolean {
  return type === "gear" || type === "sale_item";
}

/** The Products list's tabs. */
export const productTabs = ["all", "vehicles", "general"] as const;
export type ProductsTab = (typeof productTabs)[number];

export function parseProductsTab(
  query: Record<string, string | string[] | undefined>,
): ProductsTab {
  const tab = typeof query.tab === "string" ? query.tab : "";
  return (productTabs as readonly string[]).includes(tab)
    ? (tab as ProductsTab)
    : "all";
}

// Stock -----------------------------------------------------------------------------

/** One row of platform.product_stock(): a product's stock at one location. */
export type StockLine = {
  product_id: string;
  location_id: string;
  in_stock: number;
  damaged: number;
  lost: number;
  available: number;
};

export type Stock = {
  inStock: number;
  damaged: number;
  lost: number;
  available: number;
};

export const noStock: Stock = { inStock: 0, damaged: 0, lost: 0, available: 0 };

/** A product's stock over all its locations, or at one of them. */
export function stockOf(
  lines: StockLine[],
  productId: string,
  locationId?: string,
): Stock {
  return lines
    .filter(
      (line) =>
        line.product_id === productId &&
        (locationId === undefined || line.location_id === locationId),
    )
    .reduce(
      (sum, line) => ({
        inStock: sum.inStock + line.in_stock,
        damaged: sum.damaged + line.damaged,
        lost: sum.lost + line.lost,
        available: sum.available + line.available,
      }),
      noStock,
    );
}

/**
 * Which message says a general product's stock on the Products list:
 * "18 in stock", "18 in stock, 2 lost", or nothing for a service.
 */
export function stockWording(
  type: string,
  stock: Stock,
): { key: "inStock" | "inStockLost"; inStock: number; lost: number } | null {
  if (!hasStock(type)) return null;
  return {
    key: stock.lost > 0 ? "inStockLost" : "inStock",
    inStock: stock.inStock,
    lost: stock.lost,
  };
}

// The create form ----------------------------------------------------------------------

const blankToNull = (value: unknown) =>
  value === undefined || (typeof value === "string" && value.trim() === "")
    ? null
    : value;

/** A general product: its type, a name and a description. */
export const generalSchema = z
  .object({
    type: z.enum(generalTypes, "required"),
    name: z.string().trim().min(1, "required").max(120, "tooLong"),
    description: z.preprocess(
      blankToNull,
      z.string().trim().max(2000, "tooLong").nullable(),
    ),
    // Gear only: each unit on its own row, with a label if wanted.
    track_units: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  })
  .strict();

/** The most of one gear product in one place (the database holds the same). */
export const maxGearQuantity = 1000;
export const maxSaleQuantity = 100_000;

/** A quantity as typed: blank is none; whole numbers only, up to `max`. */
export function parseQuantity(text: string, max: number): number | "invalid" {
  const typed = text.trim();
  if (!typed) return 0;
  if (!/^\d{1,6}$/.test(typed)) return "invalid";
  const quantity = Number(typed);
  return quantity > max ? "invalid" : quantity;
}

/**
 * The quantities typed on the create form, one field per location named
 * "quantity:<location id>". A service has none, whatever was sent.
 */
export function readQuantities(
  type: GeneralType,
  fields: Record<string, unknown>,
  locationIds: string[],
):
  | { quantities: { location_id: string; quantity: number }[] }
  | { errors: Record<string, string> } {
  if (type === "service") return { quantities: [] };
  const max = type === "gear" ? maxGearQuantity : maxSaleQuantity;
  const errors: Record<string, string> = {};
  const quantities: { location_id: string; quantity: number }[] = [];
  for (const id of locationIds) {
    const name = `quantity:${id}`;
    const quantity = parseQuantity(String(fields[name] ?? ""), max);
    if (quantity === "invalid") errors[name] = "invalidQuantity";
    else if (quantity > 0) quantities.push({ location_id: id, quantity });
  }
  return Object.keys(errors).length > 0 ? { errors } : { quantities };
}

// Manual order -------------------------------------------------------------------------

/** A to Z, the way both lists read it: "PCX 2" before "PCX 10", case ignored. */
const byName = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

type Orderable = { id: string; name: string; sort_position?: number | null };

/** A shop has its own order once any product has a saved position. */
export function hasCustomOrder(products: Orderable[]): boolean {
  return products.some((product) => product.sort_position != null);
}

/**
 * The shop's products in the order to show them: the saved order when there
 * is one (a product without a position goes last, by name), else A to Z.
 */
export function orderProducts<T extends Orderable>(products: T[]): T[] {
  const custom = hasCustomOrder(products);
  return [...products].sort((a, b) => {
    if (custom) {
      const left = a.sort_position ?? Number.MAX_SAFE_INTEGER;
      const right = b.sort_position ?? Number.MAX_SAFE_INTEGER;
      if (left !== right) return left - right;
    }
    return byName.compare(a.name, b.name) || a.id.localeCompare(b.id);
  });
}

/** Each product's place in the order, by id. */
export function orderIndex(products: Orderable[]): Map<string, number> {
  return new Map(
    orderProducts(products).map((product, index) => [product.id, index]),
  );
}

/**
 * "Move up" and "Move down" on a line: where the product goes, given the
 * lines on screen in order. Up is "just before the line above"; down is "just
 * after the line below". Null at the top or the bottom.
 */
export function moveTarget(
  shown: string[],
  id: string,
  direction: "up" | "down",
): { target: string; place: "before" | "after" } | null {
  const at = shown.indexOf(id);
  if (at < 0) return null;
  const neighbour = shown[direction === "up" ? at - 1 : at + 1];
  if (neighbour === undefined) return null;
  return { target: neighbour, place: direction === "up" ? "before" : "after" };
}
