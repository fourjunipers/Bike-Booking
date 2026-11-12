import { describe, expect, it } from "vitest";
import {
  buildBoard,
  compareDates,
  parseDashboardTab,
  placeItem,
  sectionsByTab,
  upcomingRange,
  type DashboardItem,
} from "./dashboard";
import type { CalendarDate } from "./shop-time";

const today: CalendarDate = { year: 2026, month: 12, day: 30 };
const on = (day: number, month = 12, year = 2026): CalendarDate => ({
  year,
  month,
  day,
});

describe("placeItem", () => {
  it("puts scheduled items in Today, Tomorrow and Upcoming by date", () => {
    expect(placeItem({ kind: "pickup", date: today }, today)).toEqual({
      tab: "today",
      section: "pickups",
    });
    expect(placeItem({ kind: "return", date: on(31) }, today)).toEqual({
      tab: "tomorrow",
      section: "returns",
    });
    // Upcoming: the 7 days after tomorrow, across the new year.
    expect(
      placeItem({ kind: "delivery", date: on(1, 1, 2027) }, today),
    ).toEqual({ tab: "upcoming", section: "deliveries" });
    expect(
      placeItem({ kind: "collection", date: on(7, 1, 2027) }, today),
    ).toEqual({ tab: "upcoming", section: "deliveries" });
    expect(
      placeItem({ kind: "service", date: on(8, 1, 2027) }, today),
    ).toBeNull();
  });

  it("puts late kinds in Late whatever their date", () => {
    for (const [kind, section] of [
      ["overdueBike", "overdueBikes"],
      ["failedCharge", "failedCharges"],
      ["unpaid", "unpaid"],
    ] as const) {
      expect(placeItem({ kind }, today)).toEqual({ tab: "late", section });
      expect(placeItem({ kind, date: on(2, 1, 2027) }, today)).toEqual({
        tab: "late",
        section,
      });
    }
  });

  it("moves missed pickups, deliveries and collections to Late", () => {
    for (const kind of ["pickup", "delivery", "collection"] as const) {
      expect(placeItem({ kind, date: on(29) }, today)).toEqual({
        tab: "late",
        section: "missed",
      });
      expect(placeItem({ kind, date: on(1, 6, 2025) }, today)).toEqual({
        tab: "late",
        section: "missed",
      });
      // Due today is not missed yet.
      expect(placeItem({ kind, date: today }, today)?.tab).toBe("today");
    }
  });

  it("moves past returns, services and renewals to Late", () => {
    expect(placeItem({ kind: "return", date: on(29) }, today)).toEqual({
      tab: "late",
      section: "overdueBikes",
    });
    expect(placeItem({ kind: "service", date: on(1) }, today)).toEqual({
      tab: "late",
      section: "overdueMaintenance",
    });
    expect(placeItem({ kind: "renewal", date: on(5, 6) }, today)).toEqual({
      tab: "late",
      section: "overdueMaintenance",
    });
  });

  it("leaves out undated scheduled items", () => {
    expect(placeItem({ kind: "pickup" }, today)).toBeNull();
  });
});

describe("buildBoard", () => {
  const item = (
    id: string,
    kind: DashboardItem["kind"],
    date?: CalendarDate,
    title = id,
  ): DashboardItem => ({ id, kind, date, title, href: `/x/${id}` });

  it("counts each item once, in one tab", () => {
    const board = buildBoard(
      [
        item("a", "pickup", today),
        item("b", "return", today),
        item("a", "return", on(31)), // same id again: ignored
        item("c", "renewal", on(3, 1, 2027)),
        item("d", "overdueBike"),
        item("e", "service", on(20)),
        item("f", "pickup", on(20, 1, 2027)), // too far out
        item("g", "pickup", on(28)), // missed
        item("h", "collection", on(29)), // missed
      ],
      today,
    );
    expect(board.today.count).toBe(2);
    expect(board.tomorrow.count).toBe(0);
    expect(board.upcoming.count).toBe(1);
    expect(board.late.count).toBe(4);
    expect(board.late.sections.missed?.map((i) => i.id)).toEqual(["g", "h"]);
    expect(board.late.sections.overdueBikes?.map((i) => i.id)).toEqual(["d"]);
    expect(board.late.sections.overdueMaintenance?.map((i) => i.id)).toEqual([
      "e",
    ]);
    const all = Object.values(board).flatMap((tab) =>
      Object.values(tab.sections).flat(),
    );
    expect(all.map((i) => i.id).sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "g",
      "h",
    ]);
  });

  it("sorts each section by date, then title", () => {
    const board = buildBoard(
      [
        item("1", "pickup", on(5, 1, 2027), "Zed"),
        item("2", "pickup", on(2, 1, 2027), "Bea"),
        item("3", "pickup", on(2, 1, 2027), "Ann"),
      ],
      today,
    );
    expect(board.upcoming.sections.pickups?.map((i) => i.title)).toEqual([
      "Ann",
      "Bea",
      "Zed",
    ]);
  });

  it("is empty with no items (Phase 0)", () => {
    const board = buildBoard([], today);
    for (const tab of Object.values(board)) expect(tab.count).toBe(0);
  });
});

describe("helpers", () => {
  it("compares calendar dates", () => {
    expect(compareDates(on(1, 1, 2027), today)).toBe(1);
    expect(compareDates(today, today)).toBe(0);
    expect(compareDates(on(29), today)).toBe(-1);
  });

  it("gives Upcoming's range: 7 days starting the day after tomorrow", () => {
    expect(upcomingRange(today)).toEqual({
      from: on(1, 1, 2027),
      to: on(7, 1, 2027),
    });
  });

  it("reads ?view= and falls back to Today", () => {
    expect(parseDashboardTab("late")).toBe("late");
    expect(parseDashboardTab("upcoming")).toBe("upcoming");
    expect(parseDashboardTab("nope")).toBe("today");
    expect(parseDashboardTab(undefined)).toBe("today");
    expect(parseDashboardTab(["late"])).toBe("today");
  });

  it("lists the spec's sections per tab", () => {
    expect(sectionsByTab.today.map((s) => s.section)).toEqual([
      "pickups",
      "returns",
      "deliveries",
      "servicesDue",
      "renewalsDue",
    ]);
    expect(sectionsByTab.late.map((s) => s.section)).toEqual([
      "overdueBikes",
      "missed",
      "overdueMaintenance",
      "failedCharges",
      "unpaid",
    ]);
  });
});
