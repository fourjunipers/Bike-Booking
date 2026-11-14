import { hasLeftFleet } from "./fleet";

/**
 * The Fleet view (owner, 13 Nov 2026): one line per product, A to Z by name,
 * with how many vehicles it has and how many are available now. No group
 * headings, no make or model. A line opens to its vehicles. The view (search
 * and filters) lives in the address, so it can be bookmarked. Pure, so it can
 * be tested.
 */

export const fleetScopes = ["current", "past", "all"] as const;
export type FleetScope = (typeof fleetScopes)[number];

export type FleetListView = {
  /** Product name, plate, frame or engine number. */
  q: string;
  scope: FleetScope;
  product: string;
  status: string;
  location: string;
  kind: string;
  category: string;
  year: number | null;
};

export const defaultFleetList: FleetListView = {
  q: "",
  scope: "current",
  product: "",
  status: "",
  location: "",
  kind: "",
  category: "",
  year: null,
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, 100) : "";
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const statuses = ["active", "maintenance", "retired", "sold"];

/** The view asked for in the address; anything unknown falls back to the default. */
export function parseFleetList(
  query: Record<string, string | string[] | undefined>,
): FleetListView {
  const scope = text(query.scope);
  const year = Number(text(query.year));
  // "model" is the old name of "product" (links from before 13 Nov 2026).
  const product = text(query.product) || text(query.model);
  return {
    q: text(query.q),
    scope: (fleetScopes as readonly string[]).includes(scope)
      ? (scope as FleetScope)
      : "current",
    product: uuid.test(product) ? product : "",
    status: statuses.includes(text(query.status)) ? text(query.status) : "",
    location: uuid.test(text(query.location)) ? text(query.location) : "",
    kind: /^[a-z_]{1,40}$/.test(text(query.kind)) ? text(query.kind) : "",
    category: /^[a-z][a-z0-9_]{0,39}$/.test(text(query.category))
      ? text(query.category)
      : "",
    year:
      /^\d{4}$/.test(text(query.year)) && year >= 1950 && year <= 2100
        ? year
        : null,
  };
}

/** How many filters are on, the search box included. */
export function fleetFilterCount(view: FleetListView): number {
  return (
    Number(view.q !== "") +
    Number(view.scope !== "current") +
    Number(view.product !== "") +
    Number(view.status !== "") +
    Number(view.location !== "") +
    Number(view.kind !== "") +
    Number(view.category !== "") +
    Number(view.year !== null)
  );
}

export type ListUnit = {
  id: string;
  plate: string | null;
  frame_number: string | null;
  engine_number: string | null;
  status: string;
  location_id: string;
  model_year: number | null;
};

/** A vehicle found by its plate, frame number or engine number. */
export function matchesText(
  unit: Pick<ListUnit, "plate" | "frame_number" | "engine_number">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [unit.plate, unit.frame_number, unit.engine_number].some((value) =>
    value?.toLowerCase().includes(q),
  );
}

export type ListProduct<U extends ListUnit> = {
  id: string;
  name: string;
  kind: string;
  categories: string[];
  retired: boolean;
  units: U[];
};

export type FleetRow<U extends ListUnit> = {
  id: string;
  name: string;
  kind: string;
  categories: string[];
  retired: boolean;
  /** Vehicles in the fleet: active or in maintenance. */
  vehicles: number;
  /** Of those: active and not held by a block (downtime, a booking) now. */
  available: number;
  /** The vehicles this view shows under the line, by plate. */
  units: U[];
};

const plateOrder = new Intl.Collator(undefined, { numeric: true });
const nameOrder = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * One row per product, A to Z. The counts are the product's own, whatever the
 * filters; the vehicles under a row are the ones the view asks for. A product
 * with no vehicle to show is left out once a vehicle filter is on, and kept
 * (so a new product can be given its first vehicle) when none is.
 */
export function buildFleetList<U extends ListUnit>(
  products: ListProduct<U>[],
  /** Units held by a block right now. */
  blocked: ReadonlySet<string>,
  view: FleetListView,
  /**
   * Each product's place in the shop's own order (lib/general-products
   * orderIndex), shared with the Products list. Left out: A to Z.
   */
  order?: ReadonlyMap<string, number>,
): {
  rows: FleetRow<U>[];
  /** Vehicles in the fleet, and those that have left it, in the whole shop. */
  current: number;
  past: number;
  /** Vehicles the view shows. */
  shown: number;
} {
  const q = view.q.trim().toLowerCase();
  const unitFilter =
    view.status !== "" || view.location !== "" || view.year !== null;
  let current = 0;
  let past = 0;
  let shown = 0;
  const rows: FleetRow<U>[] = [];

  for (const product of products) {
    const inFleet = product.units.filter((u) => !hasLeftFleet(u.status));
    current += inFleet.length;
    past += product.units.length - inFleet.length;

    if (view.product && product.id !== view.product) continue;
    if (view.kind && product.kind !== view.kind) continue;
    if (view.category && !product.categories.includes(view.category)) continue;
    if (view.scope === "current" && product.retired) continue;

    const nameHit = q !== "" && product.name.toLowerCase().includes(q);
    const units = product.units
      .filter((unit) =>
        view.scope === "current"
          ? !hasLeftFleet(unit.status)
          : view.scope === "past"
            ? hasLeftFleet(unit.status)
            : true,
      )
      .filter((unit) => !view.status || unit.status === view.status)
      .filter((unit) => !view.location || unit.location_id === view.location)
      .filter((unit) => view.year === null || unit.model_year === view.year)
      // A search that names the product shows all its vehicles.
      .filter((unit) => nameHit || matchesText(unit, q))
      .sort((a, b) => plateOrder.compare(a.plate ?? "￿", b.plate ?? "￿"));

    // Nothing of it to show: left out when the view is about vehicles (a
    // search, a vehicle filter, or the sold and retired ones).
    if (
      units.length === 0 &&
      (unitFilter || (q !== "" && !nameHit) || view.scope === "past")
    )
      continue;

    shown += units.length;
    rows.push({
      id: product.id,
      name: product.name,
      kind: product.kind,
      categories: product.categories,
      retired: product.retired,
      vehicles: inFleet.length,
      available: inFleet.filter(
        (unit) => unit.status === "active" && !blocked.has(unit.id),
      ).length,
      units,
    });
  }
  rows.sort(
    (a, b) =>
      (order ? (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) : 0) ||
      nameOrder.compare(a.name, b.name),
  );
  return { rows, current, past, shown };
}
