import { generalTypes } from "./general-products";
import { vehicleKinds, type ListingStatus } from "./vehicle-kinds";

/**
 * What Fleet and the Products list share on screen (owner, 14 Nov 2026):
 * the sort, the filter chips, a row's icon and its Moto Mangos mango. Pure,
 * so it can be tested.
 */

// Sort -------------------------------------------------------------------------------

/**
 * "A–Z" and "By type" are views of one list; "My order" is the shop's one
 * manual order, shared by Fleet and the Products list. The sort is in the
 * address, so sorting one list never changes the other.
 */
export const listSorts = ["mine", "az", "type"] as const;
export type ListSort = (typeof listSorts)[number];

export function parseListSort(
  query: Record<string, string | string[] | undefined>,
): ListSort {
  const sort = typeof query.sort === "string" ? query.sort : "";
  return (listSorts as readonly string[]).includes(sort)
    ? (sort as ListSort)
    : "mine";
}

/** Reorder mode is asked for in the address (?reorder=1). */
export function parseReorder(
  query: Record<string, string | string[] | undefined>,
): boolean {
  return query.reorder === "1";
}

export type Sortable = {
  id: string;
  name: string;
  /** "vehicle", or a general type: "gear", "sale_item", "service". */
  type: string;
  /** A vehicle's kind; null for a general product. */
  kind: string | null;
  categories: readonly string[];
};

const byName = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const kindOrder: readonly string[] = vehicleKinds.map((kind) => kind.type);

/**
 * "By type" is kind, then category (owner, 14 Nov 2026), in the order of the
 * one list in lib/vehicle-kinds: Motorbike (Scooter, Touring, Adventure,
 * Sport, Classic, Off-road), Car, Off-road, Boat or jet ski, Other. A product
 * with several categories goes under its first; one with none goes after its
 * kind's categories. General products come after the vehicles, as Rental
 * gear, Items for sale, then Services. Ties go A to Z.
 */
export function typeRank(row: Sortable): [number, number] {
  if (row.type !== "vehicle" || row.kind === null) {
    const general = (generalTypes as readonly string[]).indexOf(row.type);
    return [
      kindOrder.length + (general < 0 ? generalTypes.length : general),
      0,
    ];
  }
  const kindAt = kindOrder.indexOf(row.kind);
  const kind = kindAt < 0 ? kindOrder.indexOf("other") : kindAt;
  const categories: readonly string[] = vehicleKinds[kind].categories;
  const first = Math.min(
    ...row.categories
      .map((key) => categories.indexOf(key))
      .filter((at) => at >= 0),
    categories.length,
  );
  return [kind, first];
}

/**
 * The rows in the sort asked for. `rows` come in "My order" (the shop's own
 * order, or A to Z while it has none), so that sort keeps them as they are.
 */
export function sortRows<T extends Sortable>(rows: T[], sort: ListSort): T[] {
  if (sort === "mine") return rows;
  const az = (a: T, b: T) =>
    byName.compare(a.name, b.name) || a.id.localeCompare(b.id);
  if (sort === "az") return [...rows].sort(az);
  return [...rows].sort((a, b) => {
    const [ka, ca] = typeRank(a);
    const [kb, cb] = typeRank(b);
    return ka - kb || ca - cb || az(a, b);
  });
}

// Filter chips -----------------------------------------------------------------------

/** A chip filters by kind (or general type) or by category. */
export type Chip =
  { by: "kind"; key: string } | { by: "category"; key: string; kind: string };

/**
 * The chips over a list: only kinds and categories the shop has. A kind gets
 * its own chip when the list holds more than one kind (a shop of motorbikes
 * only sees Scooter, Touring, Adventure…, not "Motorbike"); each kind's
 * categories follow it. General products count as kinds: Rental gear, Item
 * for sale, Service. In the order of lib/vehicle-kinds, then general types.
 */
export function filterChips(rows: readonly Sortable[]): Chip[] {
  const kinds = new Map<string, Set<string>>();
  for (const row of rows) {
    const kind = row.type === "vehicle" ? (row.kind ?? "other") : row.type;
    const categories = kinds.get(kind) ?? new Set<string>();
    if (row.type === "vehicle")
      for (const key of row.categories) categories.add(key);
    kinds.set(kind, categories);
  }
  const order = [...kindOrder, ...generalTypes];
  const present = order.filter((kind) => kinds.has(kind));
  const chips: Chip[] = [];
  for (const kind of present) {
    if (present.length > 1) chips.push({ by: "kind", key: kind });
    const listed: readonly string[] =
      vehicleKinds.find((k) => k.type === kind)?.categories ?? [];
    for (const key of listed)
      if (kinds.get(kind)!.has(key)) chips.push({ by: "category", key, kind });
  }
  return chips;
}

// A row's icon and its mango ---------------------------------------------------------

/**
 * Which icon a row shows: a vehicle's saved kind ("other" when it has none),
 * or a general product's type. The kind is the product's own: a scooter saved
 * as a boat shows a boat (Honda Spacy on staging, 14 Nov 2026). Fix the kind
 * on the product page, not here.
 */
export function rowIcon(row: { type: string; kind: string | null }): string {
  if (row.type !== "vehicle") return row.type;
  return row.kind && kindOrder.includes(row.kind) ? row.kind : "other";
}

/**
 * The Moto Mangos mango on a motorbike's row: in colour once it is on Moto
 * Mangos, in colour with an amber dot while in review, in grey otherwise.
 * "Needs changes" (Moto Mangos turned the request down) is grey with a red
 * dot. Nothing for other products.
 */
export type Mango = {
  image: "colour" | "grey";
  dot: "amber" | "red" | null;
  label: ListingStatus;
};

export function mangoFor(listing: ListingStatus | null): Mango | null {
  switch (listing) {
    case null:
      return null;
    case "listed":
      return { image: "colour", dot: null, label: listing };
    case "inReview":
      return { image: "colour", dot: "amber", label: listing };
    case "needsChanges":
      return { image: "grey", dot: "red", label: listing };
    case "notListed":
      return { image: "grey", dot: null, label: listing };
  }
}
