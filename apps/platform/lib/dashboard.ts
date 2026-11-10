/**
 * Dashboard tabs (SPEC › Staff app 1): Today, Tomorrow, Upcoming (the next 7
 * days after tomorrow) and Late. Each item lands in exactly one tab and one
 * section. Dates are calendar dates in the shop's time zone (lib/shop-time).
 * Phase 0 has no items yet; each phase feeds its own kinds in here.
 */
import { addCalendarDays, type CalendarDate } from "./shop-time";

export const dashboardTabs = ["today", "tomorrow", "upcoming", "late"] as const;
export type DashboardTab = (typeof dashboardTabs)[number];

/** Upcoming covers this many days, starting the day after tomorrow. */
export const upcomingDays = 7;

/** Things due on a date: in Today, Tomorrow or Upcoming, or Late once past. */
export type ScheduledKind =
  | "pickup"
  | "return"
  | "delivery"
  | "collection"
  | "service"
  | "renewal";
/** Things that are late by nature, whatever their date. */
export type LateKind = "overdueBike" | "failedCharge" | "unpaid";

export type DashboardItem = {
  id: string;
  kind: ScheduledKind | LateKind;
  /** Due date in the shop's zone. Late kinds may leave it out. */
  date?: CalendarDate;
  title: string;
  /** The order or bike the item opens. */
  href: string;
};

export type DashboardSection =
  | "pickups"
  | "returns"
  | "deliveries"
  | "servicesDue"
  | "renewalsDue"
  | "overdueBikes"
  | "missed"
  | "overdueMaintenance"
  | "failedCharges"
  | "unpaid";

/** The sections each tab shows, in order, with the phase that fills them. */
export const sectionsByTab: Record<
  DashboardTab,
  readonly { section: DashboardSection; phase: number }[]
> = {
  today: scheduledSections(),
  tomorrow: scheduledSections(),
  upcoming: scheduledSections(),
  late: [
    { section: "overdueBikes", phase: 3 },
    { section: "missed", phase: 3 },
    { section: "overdueMaintenance", phase: 1 },
    { section: "failedCharges", phase: 7 },
    { section: "unpaid", phase: 3 },
  ],
};

function scheduledSections() {
  return [
    { section: "pickups", phase: 3 },
    { section: "returns", phase: 3 },
    { section: "deliveries", phase: 8 },
    { section: "servicesDue", phase: 1 },
    { section: "renewalsDue", phase: 1 },
  ] as const;
}

/** -1, 0 or 1 as `a` is before, the same as, or after `b`. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  const ka = a.year * 10_000 + a.month * 100 + a.day;
  const kb = b.year * 10_000 + b.month * 100 + b.day;
  return Math.sign(ka - kb);
}

/** The first and last day of Upcoming. */
export function upcomingRange(today: CalendarDate) {
  return {
    from: addCalendarDays(today, 2),
    to: addCalendarDays(today, 1 + upcomingDays),
  };
}

/**
 * Where an item goes, or null when it isn't on the dashboard (scheduled items
 * further out than Upcoming). Callers pass only items still to do, so a
 * scheduled item whose date has passed is late: a return is an overdue bike,
 * a pickup, delivery or collection is missed, a service or renewal is overdue.
 */
export function placeItem(
  item: Pick<DashboardItem, "kind" | "date">,
  today: CalendarDate,
): { tab: DashboardTab; section: DashboardSection } | null {
  switch (item.kind) {
    case "overdueBike":
      return { tab: "late", section: "overdueBikes" };
    case "failedCharge":
      return { tab: "late", section: "failedCharges" };
    case "unpaid":
      return { tab: "late", section: "unpaid" };
  }
  if (!item.date) return null;

  const order = compareDates(item.date, today);
  if (order < 0) {
    switch (item.kind) {
      case "return":
        return { tab: "late", section: "overdueBikes" };
      case "pickup":
      case "delivery":
      case "collection":
        return { tab: "late", section: "missed" };
      case "service":
      case "renewal":
        return { tab: "late", section: "overdueMaintenance" };
    }
  }

  const section = scheduledSection(item.kind);
  if (order === 0) return { tab: "today", section };
  if (compareDates(item.date, addCalendarDays(today, 1)) === 0)
    return { tab: "tomorrow", section };
  if (compareDates(item.date, upcomingRange(today).to) <= 0)
    return { tab: "upcoming", section };
  return null;
}

function scheduledSection(kind: ScheduledKind): DashboardSection {
  switch (kind) {
    case "pickup":
      return "pickups";
    case "return":
      return "returns";
    case "delivery":
    case "collection":
      return "deliveries";
    case "service":
      return "servicesDue";
    case "renewal":
      return "renewalsDue";
  }
}

export type DashboardBoard = Record<
  DashboardTab,
  { count: number; sections: Partial<Record<DashboardSection, DashboardItem[]>> }
>;

/**
 * Sorts items into the four tabs, each item once (a repeated id is kept the
 * first time only). Within a section: by date, undated first, then by title.
 */
export function buildBoard(
  items: readonly DashboardItem[],
  today: CalendarDate,
): DashboardBoard {
  const board = Object.fromEntries(
    dashboardTabs.map((tab) => [tab, { count: 0, sections: {} }]),
  ) as DashboardBoard;
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) continue;
    const place = placeItem(item, today);
    if (!place) continue;
    seen.add(item.id);
    const tab = board[place.tab];
    (tab.sections[place.section] ??= []).push(item);
    tab.count++;
  }

  for (const tab of dashboardTabs) {
    for (const list of Object.values(board[tab].sections)) {
      list.sort(
        (a, b) =>
          (a.date && b.date
            ? compareDates(a.date, b.date)
            : a.date
              ? 1
              : b.date
                ? -1
                : 0) || a.title.localeCompare(b.title),
      );
    }
  }
  return board;
}

/** The tab named in `?view=`, or Today. */
export function parseDashboardTab(value: unknown): DashboardTab {
  return dashboardTabs.includes(value as DashboardTab)
    ? (value as DashboardTab)
    : "today";
}
