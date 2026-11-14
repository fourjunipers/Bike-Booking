import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import th from "../messages/th.json";
import { dbErrorKey } from "./fleet";
import { buildFleetList, defaultFleetList } from "./fleet-list";
import {
  generalSchema,
  hasCustomOrder,
  hasStock,
  isGeneralType,
  moveTarget,
  orderIndex,
  orderProducts,
  parseProductsTab,
  parseQuantity,
  readQuantities,
  stockOf,
  stockWording,
  type StockLine,
} from "./general-products";
import { buildHistory, gearUnitHistory, type AuditRow } from "./history";
import {
  buildProductsView,
  defaultProductsView,
  type ProductInput,
} from "./products-view";
import { canManageFleet, canMarkLost, canWorkOnUnits, roles } from "./roles";

/**
 * Products, stage B: general products on the list, stock wording, the
 * General form's rules, who may do what, and the manual order.
 */

let ids = 0;
const product = (extra: Partial<ProductInput> & { name: string }) =>
  ({
    id: `p${++ids}`,
    type: "vehicle",
    vehicle_type: "motorbike",
    categories: [],
    photos: [],
    retired_at: null,
    marketplace_listed: false,
    catalog_rejected_at: null,
    entry_status: null,
    units: [],
    ...extra,
  }) satisfies ProductInput;
const general = (name: string, type: string, extra: object = {}) =>
  product({ name, type, vehicle_type: null, ...extra });

describe("the Products list tabs", () => {
  const products = [
    product({ name: "PCX", categories: ["city_scooter"] }),
    general("Helmet M", "gear", {
      stock: { inStock: 18, damaged: 1, lost: 2, available: 17 },
    }),
    general("Sticker", "sale_item"),
    general("Full cover", "service"),
    product({ name: "Yaris", vehicle_type: "car" }),
  ];
  const names = (
    tab: "all" | "vehicles" | "general",
    view: Partial<typeof defaultProductsView> = {},
  ) =>
    buildProductsView(
      products,
      { ...defaultProductsView, ...view },
      tab,
    ).rows.map((row) => row.name);

  it("All shows every type, Vehicles and General their own, and every tab counts the whole shop", () => {
    expect(names("all")).toEqual([
      "Full cover",
      "Helmet M",
      "PCX",
      "Sticker",
      "Yaris",
    ]);
    expect(names("vehicles")).toEqual(["PCX", "Yaris"]);
    expect(names("general")).toEqual(["Full cover", "Helmet M", "Sticker"]);
    expect(
      buildProductsView(products, defaultProductsView, "general").total,
    ).toBe(5);
  });

  it("the tab comes from the address; anything else is All", () => {
    expect(parseProductsTab({ tab: "general" })).toBe("general");
    expect(parseProductsTab({ tab: "vehicles" })).toBe("vehicles");
    expect(parseProductsTab({})).toBe("all");
    expect(parseProductsTab({ tab: "everything" })).toBe("all");
    expect(parseProductsTab({ tab: ["general", "vehicles"] })).toBe("all");
  });

  it("the kind, category and Moto Mangos filters are about vehicles: a general product is left out", () => {
    expect(names("all", { kind: "car" })).toEqual(["Yaris"]);
    expect(names("all", { category: "city_scooter" })).toEqual(["PCX"]);
    expect(names("all", { listing: "notListed" })).toEqual(["PCX"]);
    // The search finds any type by name.
    expect(names("all", { q: "helmet" })).toEqual(["Helmet M"]);
    expect(names("general", { q: "pcx" })).toEqual([]);
  });

  it("a general product has no Moto Mangos state and keeps its stock on its row", () => {
    const row = buildProductsView(products, defaultProductsView).rows.find(
      (r) => r.name === "Helmet M",
    )!;
    expect(row.listing).toBeNull();
    expect(row.stock).toEqual({
      inStock: 18,
      damaged: 1,
      lost: 2,
      available: 17,
    });
  });
});

describe("stock", () => {
  const lines: StockLine[] = [
    {
      product_id: "h",
      location_id: "a",
      in_stock: 10,
      damaged: 1,
      lost: 2,
      available: 9,
    },
    {
      product_id: "h",
      location_id: "b",
      in_stock: 8,
      damaged: 0,
      lost: 0,
      available: 8,
    },
    {
      product_id: "s",
      location_id: "a",
      in_stock: 45,
      damaged: 0,
      lost: 0,
      available: 45,
    },
  ];

  it("adds a product's stock over its locations, or reads one location", () => {
    expect(stockOf(lines, "h")).toEqual({
      inStock: 18,
      damaged: 1,
      lost: 2,
      available: 17,
    });
    expect(stockOf(lines, "h", "b")).toEqual({
      inStock: 8,
      damaged: 0,
      lost: 0,
      available: 8,
    });
    expect(stockOf(lines, "nothing")).toEqual({
      inStock: 0,
      damaged: 0,
      lost: 0,
      available: 0,
    });
  });

  it('words it "18 in stock, 2 lost", "45 in stock", and nothing for a service', () => {
    expect(stockWording("gear", stockOf(lines, "h"))).toEqual({
      key: "inStockLost",
      inStock: 18,
      lost: 2,
    });
    expect(stockWording("sale_item", stockOf(lines, "s"))).toEqual({
      key: "inStock",
      inStock: 45,
      lost: 0,
    });
    expect(stockWording("service", stockOf(lines, "x"))).toBeNull();
    expect(en.Products.inStockLost).toBe("{inStock} in stock, {lost} lost");
    expect(en.Products.inStock).toBe("{inStock} in stock");
  });

  it("only gear and items for sale are counted", () => {
    expect(
      ["vehicle", "gear", "sale_item", "service"].filter(hasStock),
    ).toEqual(["gear", "sale_item"]);
    expect(
      ["vehicle", "gear", "sale_item", "service"].filter(isGeneralType),
    ).toEqual(["gear", "sale_item", "service"]);
  });
});

describe("the General form", () => {
  it("takes a type, a name and a description; tracking is a tick", () => {
    expect(
      generalSchema.safeParse({
        type: "gear",
        name: "  Helmet M ",
        description: "",
        track_units: "on",
      }).data,
    ).toEqual({
      type: "gear",
      name: "Helmet M",
      description: null,
      track_units: true,
    });
    expect(
      generalSchema.safeParse({ type: "service", name: "Cover" }).data,
    ).toEqual({
      type: "service",
      name: "Cover",
      description: null,
      track_units: false,
    });
  });

  it("refuses a vehicle, an unknown type and a missing name", () => {
    for (const type of ["vehicle", "bundle", ""])
      expect(generalSchema.safeParse({ type, name: "X" }).success).toBe(false);
    const blank = generalSchema.safeParse({ type: "gear", name: "  " });
    expect(blank.success).toBe(false);
    expect(
      generalSchema.safeParse({ type: "gear", name: "x".repeat(121) }).success,
    ).toBe(false);
  });

  it("has no buffers, deposit, licence class or minimum age to send", () => {
    const sneaked = generalSchema.safeParse({
      type: "gear",
      name: "Helmet",
      buffer_before_hours: "1",
    });
    expect(sneaked.success).toBe(false);
    for (const key of ["deposit", "min_age", "licence_class"])
      expect(
        generalSchema.safeParse({ type: "gear", name: "Helmet", [key]: "1" })
          .success,
      ).toBe(false);
  });

  it("a quantity is a whole number: blank is none, and there is a most", () => {
    expect(parseQuantity("", 1000)).toBe(0);
    expect(parseQuantity(" 20 ", 1000)).toBe(20);
    expect(parseQuantity("1000", 1000)).toBe(1000);
    for (const bad of ["1001", "-1", "2.5", "lots", "1e3", "1234567"])
      expect(parseQuantity(bad, 1000), bad).toBe("invalid");
  });

  it("reads one quantity per location; a service has none whatever is sent", () => {
    const fields = { "quantity:a": "20", "quantity:b": "", "quantity:c": "3" };
    expect(readQuantities("gear", fields, ["a", "b", "c"])).toEqual({
      quantities: [
        { location_id: "a", quantity: 20 },
        { location_id: "c", quantity: 3 },
      ],
    });
    expect(readQuantities("service", fields, ["a", "b", "c"])).toEqual({
      quantities: [],
    });
    expect(readQuantities("gear", { "quantity:a": "many" }, ["a"])).toEqual({
      errors: { "quantity:a": "invalidQuantity" },
    });
    // Gear is capped at 1,000 in one place; an item for sale goes higher.
    expect(readQuantities("gear", { "quantity:a": "5000" }, ["a"])).toEqual({
      errors: { "quantity:a": "invalidQuantity" },
    });
    expect(
      readQuantities("sale_item", { "quantity:a": "5000" }, ["a"]),
    ).toEqual({ quantities: [{ location_id: "a", quantity: 5000 }] });
  });
});

describe("who may do what with stock", () => {
  it("quantity: owners and managers. Damaged: everyone but a driver. Lost: owners, managers and staff", () => {
    expect(roles.filter(canManageFleet)).toEqual(["owner", "manager"]);
    expect(roles.filter(canWorkOnUnits)).toEqual([
      "owner",
      "manager",
      "staff",
      "mechanic",
    ]);
    expect(roles.filter(canMarkLost)).toEqual(["owner", "manager", "staff"]);
    expect(canMarkLost("mechanic")).toBe(false);
  });
});

describe("the manual order", () => {
  const shop = [
    { id: "1", name: "PCX 10", sort_position: null },
    { id: "2", name: "aerox", sort_position: null },
    { id: "3", name: "PCX 2", sort_position: null },
    { id: "4", name: "Helmet M", sort_position: null },
  ];

  it("is A to Z by default, numbers in order and case ignored", () => {
    expect(hasCustomOrder(shop)).toBe(false);
    expect(orderProducts(shop).map((p) => p.name)).toEqual([
      "aerox",
      "Helmet M",
      "PCX 2",
      "PCX 10",
    ]);
  });

  it("is the saved order once there is one; a product without a position goes last", () => {
    const saved = [
      { id: "1", name: "PCX 10", sort_position: 2 },
      { id: "2", name: "aerox", sort_position: 3 },
      { id: "3", name: "PCX 2", sort_position: 1 },
      { id: "4", name: "Helmet M", sort_position: null },
      { id: "5", name: "Abc", sort_position: null },
    ];
    expect(hasCustomOrder(saved)).toBe(true);
    expect(orderProducts(saved).map((p) => p.name)).toEqual([
      "PCX 2",
      "PCX 10",
      "aerox",
      "Abc",
      "Helmet M",
    ]);
    expect(orderIndex(saved).get("3")).toBe(0);
    // The input is left as it was.
    expect(saved[0].id).toBe("1");
  });

  it("Move up goes before the line above, Move down after the line below, and the ends stay", () => {
    const shown = ["a", "b", "c"];
    expect(moveTarget(shown, "b", "up")).toEqual({
      target: "a",
      place: "before",
    });
    expect(moveTarget(shown, "b", "down")).toEqual({
      target: "c",
      place: "after",
    });
    expect(moveTarget(shown, "a", "up")).toBeNull();
    expect(moveTarget(shown, "c", "down")).toBeNull();
    expect(moveTarget(shown, "nowhere", "up")).toBeNull();
  });

  it("the Products list follows it, on every tab, and a filter keeps each row's place", () => {
    const products = [
      product({ id: "v1", name: "Aerox", sort_position: 3 }),
      general("Helmet", "gear", { id: "g1", sort_position: 1 }),
      product({ id: "v2", name: "PCX", sort_position: 2 }),
      general("Cover", "service", { id: "s1", sort_position: 4 }),
    ];
    const names = (tab: "all" | "vehicles" | "general", q = "") =>
      buildProductsView(products, { ...defaultProductsView, q }, tab).rows.map(
        (row) => row.name,
      );
    expect(names("all")).toEqual(["Helmet", "PCX", "Aerox", "Cover"]);
    expect(names("vehicles")).toEqual(["PCX", "Aerox"]);
    expect(names("general")).toEqual(["Helmet", "Cover"]);
    expect(names("all", "e")).toEqual(["Helmet", "Aerox", "Cover"]);
  });

  it("Fleet follows the same order, and is A to Z without one", () => {
    const fleet = [
      {
        id: "v1",
        name: "Aerox",
        kind: "motorbike",
        categories: [],
        retired: false,
        units: [],
      },
      {
        id: "v2",
        name: "PCX",
        kind: "motorbike",
        categories: [],
        retired: false,
        units: [],
      },
      {
        id: "v3",
        name: "Click",
        kind: "motorbike",
        categories: [],
        retired: false,
        units: [],
      },
    ];
    const names = (order?: Map<string, number>) =>
      buildFleetList(fleet, new Set(), defaultFleetList, order).rows.map(
        (row) => row.name,
      );
    expect(names()).toEqual(["Aerox", "Click", "PCX"]);
    // The order covers every product: the general ones in between are skipped.
    const order = orderIndex([
      { id: "v2", name: "PCX", sort_position: 1 },
      { id: "g1", name: "Helmet", sort_position: 2 },
      { id: "v3", name: "Click", sort_position: 3 },
      { id: "v1", name: "Aerox", sort_position: 4 },
    ]);
    expect(names(order)).toEqual(["PCX", "Click", "Aerox"]);
  });
});

describe("history of a general product", () => {
  const row = (action: string, before: unknown, after: unknown): AuditRow => ({
    id: ++ids,
    entity: "products",
    entity_id: "p",
    action,
    actor: "u",
    before,
    after,
    at: "2026-11-13T00:00:00Z",
  });

  it('reads a quantity change as "Quantity: 20 → 25" and carries how many were damaged or lost', () => {
    const [adjust, damaged, lost] = buildHistory([
      row(
        "stock_adjust",
        { quantity: 20, location_id: "l" },
        { quantity: 25, location_id: "l" },
      ),
      row("units_damaged", null, { quantity: 2, location_id: "l" }),
      row("units_lost", null, { quantity: 1, location_id: "l" }),
    ]);
    expect(adjust.changes).toEqual([{ field: "quantity", from: 20, to: 25 }]);
    expect(damaged.quantity).toBe(2);
    expect(lost.quantity).toBe(1);
    expect(en.Products.history.action.units_lost).toBe(
      "{who} marked {count} lost on {what}",
    );
  });

  it("a move in the shop's order is not part of a product's history", () => {
    expect(
      buildHistory([
        row("update", { sort_position: null }, { sort_position: 3 }),
      ]),
    ).toEqual([]);
  });
});

describe("refusals and wording", () => {
  it("each database refusal has a message in both languages", () => {
    for (const raised of [
      "units_blocked",
      "not_enough_free",
      "not_enough_damaged",
      "not_enough_lost",
      "quantity_out_of_range",
      "until_in_past",
      "label_needs_tracking",
      "tracked_units_have_records",
      "stock_below_zero",
      "product_has_stock",
      "not_on_list",
      "same_model",
      "request_pending",
    ]) {
      const key = dbErrorKey({ code: "P0001", message: raised });
      expect(key).toBe(raised);
      expect(en.FormErrors[key as "units_blocked"], raised).toBeTruthy();
      expect(th.FormErrors[key as "units_blocked"], raised).toBeTruthy();
    }
    expect(dbErrorKey({ code: "23505", message: "units_label_idx" })).toBe(
      "labelExists",
    );
    // A role the database turns away reads as "You can't make that change."
    expect(dbErrorKey({ code: "42501", message: "role_not_allowed" })).toBe(
      "notAllowed",
    );
  });

  it("the three general types are named as the owner named them", () => {
    expect(en.Products.type).toMatchObject({
      gear: "Rental gear",
      sale_item: "Item for sale",
      service: "Service or extra",
    });
    expect(en.Products.tab).toMatchObject({
      all: "All",
      vehicles: "Vehicles",
      general: "General",
    });
    expect(en.Products.order).toMatchObject({
      up: "Move up",
      down: "Move down",
      reset: "Reset to A–Z",
    });
    expect(en.Fleet.motoMangos.changeModel).toBe("Change model");
    expect(en.Fleet.motoMangos.disconnect).toBe("Disconnect");
  });
});

describe("the Stock tab's three states, in the same words everywhere", () => {
  const tab = en.Products.stockTab;
  const actions = en.Products.history.action;

  it("names each action for what happens", () => {
    expect(tab.markDamaged).toBe("Mark damaged");
    expect(tab.backInUse).toBe("Back in use");
    expect(tab.markLost).toBe("Mark lost");
    expect(tab.found).toBe("Found, back in use");
    expect(tab.writeOff).toBe("Write off");
    // The old labels are gone, from every text.
    const all = JSON.stringify({ en, th });
    for (const old of ["Remove for good", "Back in stock"])
      expect(all).not.toContain(old);
    expect(Object.keys(tab)).not.toContain("restore");
    expect(Object.keys(tab)).not.toContain("remove");
    expect(Object.keys(tab)).not.toContain("removeConfirm");
  });

  it("has one line of help under each state's heading, in both languages", () => {
    expect(Object.keys(tab.state)).toEqual(["inUse", "damaged", "lost"]);
    expect(tab.state.inUse.help).toMatch(/^In use: available to rent\./);
    expect(tab.state.damaged.help).toMatch(/^Damaged: not available to rent/);
    expect(tab.state.lost.help).toBe(
      "Lost: not available to rent and not counted in your stock. Mark it found to put it back in use, or write it off to remove it permanently.",
    );
    for (const state of ["inUse", "damaged", "lost"] as const) {
      expect(th.Products.stockTab.state[state].help).toBeTruthy();
      expect(th.Products.stockTab.state[state].title).toContain("{count}");
    }
  });

  it("Write off says it can't be undone, what it changes, and that History keeps a record", () => {
    expect(tab.writeOffConfirm).toMatch(/cannot be undone/);
    expect(tab.writeOffConfirm).toMatch(/leaves this product’s stock counts/);
    expect(tab.writeOffConfirm).toMatch(/History keeps a record/);
    expect(th.Products.stockTab.writeOffConfirm).toBeTruthy();
  });

  it("History uses the buttons' words, for counted gear and for one unit", () => {
    expect(actions.units_damaged).toContain("marked {count} damaged");
    expect(actions.units_repaired).toContain("back in use");
    expect(actions.units_lost).toContain("marked {count} lost");
    expect(actions.lost_restored).toContain("found, back in use");
    expect(actions.lost_removed).toContain("wrote off {count}");
    expect(actions.unit_damaged).toBe("{who} marked {what} damaged");
    expect(actions.unit_repaired).toBe("{who} put {what} back in use");
    expect(actions.unit_lost).toBe("{who} marked {what} lost");
    expect(actions.unit_found).toBe("{who} marked {what} found, back in use");
    expect(actions.unit_written_off).toBe("{who} wrote off {what}");
  });
});

describe("history of tracked gear, one unit at a time", () => {
  let n = 0;
  const at = (minute: number) =>
    `2026-11-14T00:${String(minute).padStart(2, "0")}:00Z`;
  const row = (
    entity: string,
    entity_id: string,
    action: string,
    minute: number,
    before: unknown,
    after: unknown,
  ): AuditRow => ({
    id: ++n,
    entity,
    entity_id,
    action,
    actor: "u",
    before,
    after,
    at: at(minute),
  });
  const unit = { product_id: "p", status: "active", label: null };

  it("turns unit and downtime rows into the buttons' actions, and keeps a written-off unit's name", () => {
    const { rows, names } = gearUnitHistory([
      row("units", "u1", "insert", 0, null, unit),
      row("units", "u1", "update", 1, { label: null }, { label: "GoPro 3" }),
      // Mark damaged, Back in use.
      row("unit_blocks", "b1", "insert", 2, null, {
        unit_id: "u1",
        kind: "downtime",
      }),
      row(
        "unit_blocks",
        "b1",
        "update",
        3,
        { period: "[a,)" },
        { period: "[a,b)" },
      ),
      // Damaged again, then lost: the downtime ends with it, in the same moment.
      row("unit_blocks", "b2", "insert", 4, null, {
        unit_id: "u1",
        kind: "downtime",
      }),
      row(
        "unit_blocks",
        "b2",
        "update",
        5,
        { period: "[c,)" },
        { period: "[c,d)" },
      ),
      row("units", "u1", "update", 5, { status: "active" }, { status: "lost" }),
      // Found, lost again, written off.
      row("units", "u1", "update", 6, { status: "lost" }, { status: "active" }),
      row("units", "u1", "update", 7, { status: "active" }, { status: "lost" }),
      row(
        "units",
        "u1",
        "delete",
        8,
        { ...unit, status: "lost", label: "GoPro 3" },
        null,
      ),
    ]);
    expect(rows.map((r) => [r.action, r.entity, r.entity_id])).toEqual([
      ["update", "units", "u1"],
      ["unit_damaged", "units", "u1"],
      ["unit_repaired", "units", "u1"],
      ["unit_damaged", "units", "u1"],
      ["unit_lost", "units", "u1"],
      ["unit_found", "units", "u1"],
      ["unit_lost", "units", "u1"],
      ["unit_written_off", "units", "u1"],
    ]);
    expect(names.get("u1")).toBe("GoPro 3");
    // The label change reads "Label: (empty) → GoPro 3".
    expect(buildHistory(rows)[0].changes).toEqual([
      { field: "label", from: null, to: "GoPro 3" },
    ]);
  });

  it("leaves units added or removed by a quantity change to that change's own line", () => {
    const { rows } = gearUnitHistory([
      row("units", "u1", "insert", 0, null, unit),
      row("units", "u2", "insert", 0, null, unit),
      // Lowered from 2 to 1: a unit that was never lost is simply gone.
      row("unit_blocks", "b9", "insert", 1, null, {
        unit_id: "u2",
        kind: "downtime",
      }),
      row(
        "unit_blocks",
        "b9",
        "delete",
        2,
        { unit_id: "u2", kind: "downtime" },
        null,
      ),
      row("units", "u2", "delete", 2, unit, null),
    ]);
    expect(rows.map((r) => r.action)).toEqual(["unit_damaged"]);
  });

  it("a lost unit with bookings on record is retired, and that reads as written off too", () => {
    const { rows } = gearUnitHistory([
      row("units", "u1", "update", 1, { status: "active" }, { status: "lost" }),
      row(
        "units",
        "u1",
        "update",
        2,
        { status: "lost" },
        { status: "retired" },
      ),
    ]);
    expect(rows.map((r) => r.action)).toEqual([
      "unit_lost",
      "unit_written_off",
    ]);
  });

  it("ignores blocks that aren't downtime and block changes it can't place", () => {
    const { rows } = gearUnitHistory([
      row("unit_blocks", "b1", "insert", 1, null, {
        unit_id: "u1",
        kind: "allocation",
      }),
      row("unit_blocks", "b2", "update", 2, { period: "x" }, { period: "y" }),
    ]);
    expect(rows).toEqual([]);
  });
});
