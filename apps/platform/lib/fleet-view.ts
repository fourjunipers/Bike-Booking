/**
 * The fleet list (owner, 11 Nov 2026): filter, group and sort the shop's
 * bikes. Pure, so it is tested without a database, and cheap: one pass over
 * the bikes per step, so 150 bikes take well under a millisecond.
 *
 * Grouped by model (the default), each model is split into the shop's own
 * model-year bands, newest first. Bikes with no model year go in an "unknown
 * year" band, bikes whose year is in no band in "other years", and a model
 * with no bands shows one group for all years.
 */

import { kindTypes } from "./vehicle-kinds";

export const groupModes = [
  "model",
  "make",
  "location",
  "status",
  "none",
] as const;
export type GroupMode = (typeof groupModes)[number];

export const sortModes = [
  "makeModel",
  "cc",
  "count",
  "plate",
  "odometer",
  "purchaseDate",
] as const;
export type SortMode = (typeof sortModes)[number];

export type ViewUnit = {
  id: string;
  model_id: string;
  location_id: string;
  plate: string | null;
  plate_pending: boolean;
  frame_number: string | null;
  engine_number: string | null;
  colour: string | null;
  model_year: number | null;
  current_odometer_km: number;
  status: string;
  /** Owners and managers only; undefined for everyone else. */
  purchase_date?: string | null;
};

export type ViewModel = {
  id: string;
  name: string;
  make: string;
  /** The catalog's model name, e.g. "PCX 160". */
  model: string;
  cc: number | null;
  transmission: string | null;
  /** The kind of vehicle (public.vehicle_types): motorbike, car, atv… */
  kind?: string;
  /** Its categories (lib/vehicle-kinds): a model can have several. */
  categories?: readonly string[];
};

export type ViewBand = { model_id: string; year_from: number; year_to: number };

export type FleetFilters = {
  q: string;
  /** Kind of vehicle: motorbike, car, atv, boat or other. */
  kind: string;
  /** A category key: models that have it among their categories. */
  category: string;
  make: string;
  model: string;
  ccMin: number | null;
  ccMax: number | null;
  transmission: string;
  status: string;
  location: string;
  year: number | null;
};

/**
 * Which bikes the list is about. "current" is the working fleet: sold and
 * retired bikes are kept, with all their history, but stay out of the way
 * until asked for ("past"), or shown together with the rest ("all").
 */
export const scopes = ["current", "past", "all"] as const;
export type Scope = (typeof scopes)[number];

const leftFleet = (status: string) => status === "sold" || status === "retired";

export type FleetViewOptions = FleetFilters & {
  group: GroupMode;
  sort: SortMode;
  scope: Scope;
};

export const defaultView: FleetViewOptions = {
  scope: "current",
  group: "model",
  sort: "makeModel",
  q: "",
  kind: "",
  category: "",
  make: "",
  model: "",
  ccMin: null,
  ccMax: null,
  transmission: "",
  status: "",
  location: "",
  year: null,
};

/** The per-device cookie that remembers a person's last fleet view in a shop. */
export const fleetViewCookie = (slug: string) => `fleetview_${slug}`;

export type StatusCounts = Record<string, number>;

export type FleetGroup = {
  /** Stable within the page; used for element ids. */
  key: string;
  kind: "band" | "make" | "location" | "status" | "all";
  /** What the group is: a model, make, location or status. */
  title: string;
  make?: string;
  model?: string;
  /** A year band's label parts; `band` says which special band it is. */
  band?: "range" | "all" | "unknown" | "other";
  yearFrom?: number;
  yearTo?: number;
  /** The status, for status groups (the page translates it). */
  status?: string;
  cc?: number | null;
  count: number;
  statusCounts: StatusCounts;
  units: ViewUnit[];
};

/** A model heading over its year bands; other groupings have one untitled section. */
export type FleetSection = {
  key: string;
  model?: ViewModel;
  count: number;
  groups: FleetGroup[];
};

export type FleetView = {
  /** Bikes that pass the filters. */
  shown: number;
  /** Bikes in the chosen scope, before any filter. */
  total: number;
  /** Bikes in the working fleet, and those sold or retired, whatever is shown. */
  current: number;
  past: number;
  sections: FleetSection[];
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

function positiveInt(value: unknown, max: number): number | null {
  const n = Number(text(value));
  return Number.isInteger(n) && n > 0 && n <= max ? n : null;
}

/** The view named by the address (?group=…&make=…). Unknown values fall back to the default. */
export function parseView(
  query: Record<string, string | string[] | undefined>,
): FleetViewOptions {
  const group = text(query.group) as GroupMode;
  const sort = text(query.sort) as SortMode;
  const scope = text(query.scope) as Scope;
  return {
    scope: scopes.includes(scope) ? scope : defaultView.scope,
    group: groupModes.includes(group) ? group : defaultView.group,
    sort: sortModes.includes(sort) ? sort : defaultView.sort,
    q: text(query.q).slice(0, 60),
    kind: (kindTypes as readonly string[]).includes(text(query.kind))
      ? text(query.kind)
      : "",
    category: /^[a-z][a-z0-9_]{0,39}$/.test(text(query.category))
      ? text(query.category)
      : "",
    make: text(query.make),
    model: text(query.model),
    ccMin: positiveInt(query.ccMin, 5000),
    ccMax: positiveInt(query.ccMax, 5000),
    transmission: text(query.transmission),
    status: text(query.status),
    location: text(query.location),
    year: positiveInt(query.year, 2100),
  };
}

/** The view as an address query, leaving out whatever is at its default. */
export function viewQuery(view: FleetViewOptions): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(view)) {
    const fallback = defaultView[name as keyof FleetViewOptions];
    if (value !== null && value !== "" && value !== fallback)
      params.set(name, String(value));
  }
  return params.toString();
}

/** How many filters are switched on (the search box counts as one). */
export function activeFilterCount(view: FleetFilters): number {
  return [
    view.q,
    view.kind,
    view.category,
    view.make,
    view.model,
    view.ccMin,
    view.ccMax,
    view.transmission,
    view.status,
    view.location,
    view.year,
  ].filter((v) => v !== null && v !== "").length;
}

export function matchesText(unit: ViewUnit, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [unit.plate, unit.frame_number, unit.engine_number].some((value) =>
    value?.toLowerCase().includes(q),
  );
}

function countStatuses(units: ViewUnit[]): StatusCounts {
  const counts: StatusCounts = {};
  for (const unit of units)
    counts[unit.status] = (counts[unit.status] ?? 0) + 1;
  return counts;
}

const plateOrder = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
const byText = (a: string, b: string) => plateOrder.compare(a, b);

function sortUnits(units: ViewUnit[], sort: SortMode): ViewUnit[] {
  const byPlate = (a: ViewUnit, b: ViewUnit) =>
    // Bikes without a plate go last.
    Number(a.plate === null) - Number(b.plate === null) ||
    byText(a.plate ?? "", b.plate ?? "");
  const compare: (a: ViewUnit, b: ViewUnit) => number =
    sort === "odometer"
      ? (a, b) => b.current_odometer_km - a.current_odometer_km || byPlate(a, b)
      : sort === "purchaseDate"
        ? (a, b) =>
            // Newest purchase first; bikes with no date last.
            Number(!a.purchase_date) - Number(!b.purchase_date) ||
            (b.purchase_date ?? "").localeCompare(a.purchase_date ?? "") ||
            byPlate(a, b)
        : byPlate;
  return [...units].sort(compare);
}

export function buildFleetView(
  data: {
    units: ViewUnit[];
    models: ViewModel[];
    bands: ViewBand[];
    locations: { id: string; name: string }[];
  },
  view: FleetViewOptions,
): FleetView {
  const models = new Map(data.models.map((m) => [m.id, m]));
  const locations = new Map(data.locations.map((l) => [l.id, l.name]));

  const past = data.units.filter((unit) => leftFleet(unit.status)).length;
  // Asking for a status by name (say, Sold) overrides the scope.
  const inScope = (unit: ViewUnit) =>
    view.status !== "" ||
    view.scope === "all" ||
    leftFleet(unit.status) === (view.scope === "past");

  const units = data.units.filter((unit) => {
    const model = models.get(unit.model_id);
    if (!inScope(unit)) return false;
    if (!matchesText(unit, view.q)) return false;
    if (view.kind && (model?.kind ?? "motorbike") !== view.kind) return false;
    if (view.category && !model?.categories?.includes(view.category))
      return false;
    if (view.make && model?.make !== view.make) return false;
    if (view.model && unit.model_id !== view.model) return false;
    if (view.ccMin !== null && (model?.cc ?? 0) < view.ccMin) return false;
    if (view.ccMax !== null && (model?.cc ?? Infinity) > view.ccMax)
      return false;
    if (view.transmission && model?.transmission !== view.transmission)
      return false;
    if (view.status && unit.status !== view.status) return false;
    if (view.location && unit.location_id !== view.location) return false;
    if (view.year !== null && unit.model_year !== view.year) return false;
    return true;
  });

  const group = (
    key: string,
    kind: FleetGroup["kind"],
    title: string,
    members: ViewUnit[],
    extra: Partial<FleetGroup> = {},
  ): FleetGroup => ({
    key,
    kind,
    title,
    count: members.length,
    statusCounts: countStatuses(members),
    units: sortUnits(members, view.sort),
    ...extra,
  });

  const bucket = <K>(keyOf: (unit: ViewUnit) => K) => {
    const map = new Map<K, ViewUnit[]>();
    for (const unit of units) {
      const key = keyOf(unit);
      const list = map.get(key);
      if (list) list.push(unit);
      else map.set(key, [unit]);
    }
    return map;
  };

  /** Groups in the chosen order; ties and bike-level sorts fall back to the title. */
  const sortGroups = (groups: FleetGroup[]) =>
    groups.sort(
      (a, b) =>
        (view.sort === "count"
          ? b.count - a.count
          : view.sort === "cc"
            ? (a.cc ?? Infinity) - (b.cc ?? Infinity)
            : 0) || byText(a.title, b.title),
    );

  let sections: FleetSection[];
  if (view.group === "model") {
    const byModel = bucket((u) => u.model_id);
    sections = [...byModel.entries()].map(([modelId, members]) => {
      const model = models.get(modelId);
      const title = model?.name ?? "";
      const naming = { make: model?.make, model: model?.model, cc: model?.cc };
      const bands = data.bands
        .filter((b) => b.model_id === modelId)
        .sort((a, b) => b.year_from - a.year_from);
      const groups: FleetGroup[] = [];
      if (bands.length === 0) {
        groups.push(
          group(`${modelId}-all`, "band", title, members, {
            ...naming,
            band: "all",
          }),
        );
      } else {
        const rest = new Set(members);
        for (const band of bands) {
          const inBand = members.filter(
            (u) =>
              u.model_year !== null &&
              u.model_year >= band.year_from &&
              u.model_year <= band.year_to,
          );
          for (const unit of inBand) rest.delete(unit);
          // An empty band is still shown: it is the shop's own list.
          groups.push(
            group(`${modelId}-${band.year_from}`, "band", title, inBand, {
              ...naming,
              band: "range",
              yearFrom: band.year_from,
              yearTo: band.year_to,
            }),
          );
        }
        const other = [...rest].filter((u) => u.model_year !== null);
        const unknown = [...rest].filter((u) => u.model_year === null);
        if (other.length > 0)
          groups.push(
            group(`${modelId}-other`, "band", title, other, {
              ...naming,
              band: "other",
            }),
          );
        if (unknown.length > 0)
          groups.push(
            group(`${modelId}-unknown`, "band", title, unknown, {
              ...naming,
              band: "unknown",
            }),
          );
      }
      return { key: modelId, model, count: members.length, groups };
    });
    // With no filters on (or only the kind of vehicle and the category), a
    // make & model that has no vehicles yet is still listed, so it can be
    // given some.
    if (
      activeFilterCount({ ...view, kind: "", category: "" }) === 0 &&
      view.scope !== "past"
    ) {
      for (const model of data.models) {
        if (byModel.has(model.id)) continue;
        if (view.kind && (model.kind ?? "motorbike") !== view.kind) continue;
        if (view.category && !model.categories?.includes(view.category))
          continue;
        sections.push({
          key: model.id,
          model,
          count: 0,
          groups: [
            group(`${model.id}-all`, "band", model.name, [], {
              make: model.make,
              model: model.model,
              cc: model.cc,
              band: "all",
            }),
          ],
        });
      }
    }
    sections.sort(
      (a, b) =>
        (view.sort === "count"
          ? b.count - a.count
          : view.sort === "cc"
            ? (a.model?.cc ?? Infinity) - (b.model?.cc ?? Infinity)
            : 0) ||
        byText(
          `${a.model?.make} ${a.model?.model} ${a.model?.name}`,
          `${b.model?.make} ${b.model?.model} ${b.model?.name}`,
        ),
    );
  } else {
    let groups: FleetGroup[];
    if (view.group === "make") {
      groups = [
        ...bucket((u) => models.get(u.model_id)?.make ?? "").entries(),
      ].map(([make, members]) => group(`make-${make}`, "make", make, members));
    } else if (view.group === "location") {
      groups = [...bucket((u) => u.location_id).entries()].map(
        ([id, members]) =>
          group(`location-${id}`, "location", locations.get(id) ?? "", members),
      );
    } else if (view.group === "status") {
      groups = [...bucket((u) => u.status).entries()].map(([status, members]) =>
        group(`status-${status}`, "status", status, members, { status }),
      );
    } else {
      groups = units.length > 0 ? [group("all", "all", "", units)] : [];
    }
    sections = [
      { key: "all", count: units.length, groups: sortGroups(groups) },
    ];
  }

  return {
    shown: units.length,
    total: data.units.filter(inScope).length,
    current: data.units.length - past,
    past,
    sections: sections.filter((s) => s.groups.length > 0),
  };
}
