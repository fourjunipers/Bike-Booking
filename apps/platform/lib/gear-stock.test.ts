import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import th from "../messages/th.json";
import { dbErrorKey } from "./fleet";
import {
  canEditProblem,
  canGear,
  gearActions,
  gearRoles,
  problemKindsFor,
} from "./gear-permissions";
import {
  formatDay,
  gearState,
  parseDay,
  stockOf,
  unitNames,
} from "./general-products";
import { buildHistory, gearStockActions, type AuditRow } from "./history";
import { roles } from "./roles";

/**
 * Rental gear, the stock rework (owner, 14 Nov 2026): who may do what, a
 * unit's state, the days the dialog sends, the History's lines and the
 * wording, in English and Thai.
 */

describe("who may do what, in one place", () => {
  const who = (action: (typeof gearActions)[number]) =>
    roles.filter((role) => canGear(role, action));

  it("quantity, found and write off: owners and managers", () => {
    for (const action of ["set_quantity", "found", "write_off"] as const)
      expect(who(action), action).toEqual(["owner", "manager"]);
  });

  it("in repair and back in use: everyone but a driver. Lost: owners, managers and staff", () => {
    for (const action of ["mark_repair", "back_in_use"] as const)
      expect(who(action), action).toEqual([
        "owner",
        "manager",
        "staff",
        "mechanic",
      ]);
    expect(who("mark_lost")).toEqual(["owner", "manager", "staff"]);
  });

  it("a driver does nothing; every action names its roles", () => {
    for (const action of gearActions) {
      expect(canGear("driver", action), action).toBe(false);
      expect(gearRoles(action).length, action).toBeGreaterThan(0);
    }
  });

  it("the dialog offers each role only what it may report", () => {
    expect(problemKindsFor("owner")).toEqual(["repair", "lost", "damaged"]);
    expect(problemKindsFor("manager")).toEqual(["repair", "lost", "damaged"]);
    // Writing off as damaged is not for staff or mechanics.
    expect(problemKindsFor("staff")).toEqual(["repair", "lost"]);
    expect(problemKindsFor("mechanic")).toEqual(["repair"]);
    expect(problemKindsFor("driver")).toEqual([]);
  });

  it("whoever may mark a unit that way may edit its line", () => {
    expect(roles.filter((role) => canEditProblem(role, "repair"))).toEqual([
      "owner",
      "manager",
      "staff",
      "mechanic",
    ]);
    expect(roles.filter((role) => canEditProblem(role, "lost"))).toEqual([
      "owner",
      "manager",
      "staff",
    ]);
  });
});

describe("a unit's state and the counts", () => {
  it("lost by its status, in repair while downtime runs, otherwise in use", () => {
    expect(gearState({ status: "active", inRepair: false })).toBe("inUse");
    expect(gearState({ status: "active", inRepair: true })).toBe("repair");
    expect(gearState({ status: "lost", inRepair: false })).toBe("lost");
    expect(gearState({ status: "lost", inRepair: true })).toBe("lost");
  });

  it("stock is in use plus in repair; lost is beside it, not in it", () => {
    const stock = stockOf(
      [
        {
          product_id: "h",
          location_id: "a",
          in_stock: 10,
          in_repair: 2,
          lost: 1,
          available: 7,
        },
      ],
      "h",
    );
    expect(stock).toEqual({ inStock: 10, inRepair: 2, lost: 1, available: 7 });
    // In use = in stock - in repair; one of those 8 is booked right now.
    expect(stock.inStock - stock.inRepair).toBe(8);
  });

  it("a unit goes by its label, or by its place in the list", () => {
    const names = unitNames(
      [
        { id: "a", label: "GoPro 3" },
        { id: "b", label: null },
        { id: "c", label: null },
      ],
      (number) => `Unit ${number}`,
    );
    expect([...names]).toEqual([
      ["a", "GoPro 3"],
      ["b", "Unit 2"],
      ["c", "Unit 3"],
    ]);
  });
});

describe("days", () => {
  it("a date field's value is a real calendar day or nothing", () => {
    expect(parseDay("2026-11-14")).toBe("2026-11-14");
    expect(parseDay("2028-02-29")).toBe("2028-02-29");
    for (const bad of ["", "14/11/2026", "2026-02-30", "2026-13-01", "today"])
      expect(parseDay(bad), bad).toBeNull();
  });

  it("a stored day reads in the viewer's locale, the same day in any time zone", () => {
    expect(formatDay("2026-11-14", "en-GB")).toBe("14 Nov 2026");
    expect(formatDay("2026-01-01", "en-US")).toBe("Jan 1, 2026");
    expect(formatDay("2026-11-14", "th")).toMatch(/14/);
  });
});

describe("the History, in the buttons' words", () => {
  let n = 0;
  const row = (action: string, after: object, before: object | null = null) =>
    ({
      id: ++n,
      entity: "products",
      entity_id: "p",
      action,
      actor: "u",
      before,
      after,
      at: "2026-11-14T03:00:00Z",
    }) satisfies AuditRow;
  const actions = en.Products.history.action;
  const say = (key: keyof typeof actions, count: number) =>
    actions[key]
      .replace("{who}", "Mai")
      .replace("{count}", String(count))
      .replace("{what}", "this product");

  it("every stock event has its line, with how many", () => {
    const entries = buildHistory([
      row("units_in_repair", { quantity: 1, happened_on: "2026-11-12" }),
      row("units_lost", { quantity: 1 }),
      row("units_written_off", { quantity: 1, reason: "damaged" }),
      row("units_written_off", { quantity: 1, reason: "lost" }),
      row("units_found", { quantity: 1 }),
      row("units_back_in_use", { quantity: 1 }),
    ]);
    expect(
      entries.map((e) => say(e.action as keyof typeof actions, e.quantity!)),
    ).toEqual([
      "Mai marked 1 in repair on this product",
      "Mai marked 1 lost on this product",
      "Mai removed 1 from stock as damaged on this product",
      "Mai removed 1 from stock as lost on this product",
      "Mai marked 1 found, back in use on this product",
      "Mai marked 1 back in use on this product",
    ]);
  });

  it("a write-off keeps the unit's day, notes and label", () => {
    const [entry] = buildHistory([
      row("units_written_off", {
        quantity: 1,
        reason: "damaged",
        happened_on: "2026-11-10",
        expected_back: "2026-11-20",
        notes: "Shell split",
        labels: ["GoPro 3"],
      }),
    ]);
    expect(entry.action).toBe("units_written_off_damaged");
    expect(entry.details).toEqual({
      labels: ["GoPro 3"],
      happenedOn: "2026-11-10",
      expectedBack: "2026-11-20",
      notes: "Shell split",
    });
  });

  it("an edited line lists what changed, and only that", () => {
    const [entry] = buildHistory([
      row(
        "unit_problem_edit",
        {
          state: "repair",
          happened_on: "2026-11-12",
          expected_back: "2026-11-20",
          notes: "Strap",
          label: "Cam B",
        },
        { happened_on: "2026-11-12", expected_back: null, notes: "Strap" },
      ),
    ]);
    expect(entry.action).toBe("unit_problem_edit_repair");
    expect(entry.changes).toEqual([
      { field: "expected_back", from: null, to: "2026-11-20" },
    ]);
    expect(entry.details).toEqual({ labels: ["Cam B"] });
    expect(actions.unit_problem_edit_repair).toBeTruthy();
    expect(actions.unit_problem_edit_lost).toBeTruthy();
  });

  it("what was done before the rework reads in today's words", () => {
    expect(actions.units_damaged).toBe(actions.units_in_repair);
    expect(actions.units_repaired).toBe(actions.units_back_in_use);
    expect(actions.lost_removed).toBe(actions.units_written_off_lost);
    expect(actions.unit_damaged).toBe("{who} marked {what} in repair");
    expect(actions.unit_repaired).toBe("{who} marked {what} back in use");
    const all = JSON.stringify(actions);
    expect(all).not.toMatch(/marked \{(count|what)\} damaged/);
  });

  it("every stock event's line, detail and field exists in both languages", () => {
    for (const messages of [en, th]) {
      const history = messages.Products.history;
      for (const action of gearStockActions) {
        const keys =
          action === "units_written_off"
            ? ["units_written_off_damaged", "units_written_off_lost"]
            : action === "unit_problem_edit"
              ? ["unit_problem_edit_repair", "unit_problem_edit_lost"]
              : [action];
        for (const key of keys)
          expect(history.action[key as "units_lost"], key).toContain("{who}");
      }
      expect(Object.keys(history.detail)).toEqual([
        "units",
        "happenedOn",
        "expectedBack",
        "notes",
      ]);
      expect(history.field.happened_on).toBeTruthy();
      expect(history.field.expected_back).toBeTruthy();
    }
  });
});

describe("wording", () => {
  const gear = en.Products.gearStock;

  it("the tiles, the dialog's choices and the buttons are named as the owner named them", () => {
    expect(gear.tile).toEqual({
      inStock: "In stock",
      available: "Available now",
      inRepair: "In repair",
      lost: "Lost",
    });
    expect(gear.reportButton).toBe("Report a problem");
    expect(gear.what).toBe("What happened");
    expect(gear.kind).toEqual({
      repair: "In repair",
      lost: "Lost",
      damaged: "Damaged for good",
    });
    expect(gear.happenedOn).toBe("Date it happened");
    expect(gear.expectedBack).toMatch(/^Expected back/);
    expect(gear.outTitle).toBe("Out of service");
    expect(gear.backInUse).toBe("Back in use");
    expect(gear.writeOffDamaged).toBe("Remove from stock");
    expect(gear.submit.damaged).toBe("Remove from stock");
    expect(gear.found).toBe("Found, back in use");
    expect(gear.writeOff).toBe("Remove from stock");
  });

  it("Remove from stock asks first, in the owner's words", () => {
    expect(gear.writeOffConfirm).toBe(
      "Remove from stock? This cannot be undone. The unit is removed from this product for good and can’t be marked found again. The History keeps a record.",
    );
    expect(th.Products.gearStock.writeOffConfirm).toBeTruthy();
  });

  it("no button or line says “write off” any more; the dates carry their note", () => {
    const texts = (value: unknown): string[] =>
      typeof value === "string"
        ? [value]
        : Object.values(value as object).flatMap(texts);
    expect(
      texts([en.Products.gearStock, en.Products.history.action]).join(" | "),
    ).not.toMatch(/wr(i|o)te(s)? (it )?off/i);
    expect(gear.dateHelp).toBe(
      "For information only. It does not affect stock quantities.",
    );
    expect(th.Products.gearStock.dateHelp).toBeTruthy();
  });

  it("nothing says “damaged” for a unit that can still come back", () => {
    // Every text, without its key.
    const texts = (value: unknown): string[] =>
      typeof value === "string"
        ? [value]
        : Object.values(value as object).flatMap(texts);
    const shown = texts([
      en.Products.stockTab,
      gear,
      en.FormErrors.units_blocked,
      en.FormErrors.not_enough_free,
    ]).join(" | ");
    // What is left is for good: "Damaged for good".
    expect(shown.replace(/damaged for good/gi, "")).not.toMatch(/damaged/i);
    expect(en.Products.stockTab.status).toEqual({
      inUse: "In use",
      repair: "In repair",
      lost: "Lost",
    });
  });

  it("English and Thai have the same keys, with the same placeholders", () => {
    const shape = (value: unknown, path = ""): string[] =>
      typeof value === "string"
        ? [`${path} ${(value.match(/\{\w+/g) ?? []).sort().join("")}`]
        : Object.entries(value as object).flatMap(([key, inner]) =>
            shape(inner, `${path}.${key}`),
          );
    expect(shape(th.Products.gearStock)).toEqual(shape(en.Products.gearStock));
    expect(shape(th.Products.stockTab)).toEqual(shape(en.Products.stockTab));
    expect(shape(th.Products.history)).toEqual(shape(en.Products.history));
  });

  it("each new refusal has a message in both languages", () => {
    for (const raised of [
      "date_in_future",
      "expected_before_happened",
      "notes_too_long",
      "unit_not_free",
      "unit_not_found",
      "not_in_repair",
      "not_lost",
      "not_out_of_service",
    ]) {
      const key = dbErrorKey({ code: "P0001", message: raised });
      expect(key).toBe(raised);
      expect(en.FormErrors[key as "not_lost"], raised).toBeTruthy();
      expect(th.FormErrors[key as "not_lost"], raised).toBeTruthy();
    }
    // The count-by-count refusals went with the forms that raised them.
    const errors: Record<string, string> = en.FormErrors;
    for (const gone of [
      "not_enough_damaged",
      "not_enough_lost",
      "notEnoughToLose",
    ])
      expect(errors[gone], gone).toBeUndefined();
  });
});
