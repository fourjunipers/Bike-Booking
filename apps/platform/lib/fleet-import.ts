import type { CsvTable } from "./csv";
import { toKm, type DistanceUnit } from "./distance";
import { isIsoDate, vehicleTypes } from "./fleet";
import { parseMoney } from "./money";
import { categoriesFromText, categoryRequired } from "./vehicle-kinds";

/**
 * Checks a fleet CSV (SPEC › Team, settings and platform: CSV import) and
 * turns it into what platform.import_fleet saves. One row per vehicle. Every
 * problem is reported with its line and column; nothing is saved unless the
 * whole file is clean.
 *
 * A vehicle's product is given by its name, the way it is on screen (owner,
 * 13 Nov 2026): no make, model, engine size or transmission.
 * - A name the shop already has (ignoring case and spacing): the vehicle goes
 *   on that product.
 * - A new name: the product is created, with the kind of vehicle from
 *   "vehicle_type" (blank means motorbike) and its "category" (required for a
 *   motorbike or a car). Later rows with the same name go on it too.
 * A shop that wants the make, model or years on record puts them in the name.
 */

export const importColumns = [
  "product",
  "vehicle_type",
  "category",
  "year",
  "plate",
  "frame_number",
  "engine_number",
  "colour",
  "odometer",
  "location",
  "purchase_date",
  "purchase_price",
  "purchased_from",
] as const;
export type ImportColumn = (typeof importColumns)[number];

export const maxImportRows = 1000;

export type ImportErrorCode =
  | "missingColumns"
  | "unknownColumn"
  | "noRows"
  | "tooManyRows"
  | "required"
  | "tooLong"
  | "invalidVehicleType"
  | "invalidCategory"
  | "ownNeedsCategory"
  | "plateDuplicateInFile"
  | "plateExists"
  | "invalidDate"
  | "invalidYear"
  | "invalidNumber"
  | "invalidMoney"
  | "locationUnknown";

export type ImportError = {
  line: number;
  column: string;
  code: ImportErrorCode;
  value?: string;
};

export type ImportContext = {
  currency: string;
  distanceUnit: DistanceUnit;
  locations: { id: string; name: string; isDefault: boolean }[];
  /** Vehicle products the shop already has. */
  products: { id: string; name: string }[];
  /** Plates already in the shop's fleet. */
  plates: string[];
  newId: () => string;
};

/** A product to create: a name, a kind of vehicle and its categories. */
export type ImportProduct = {
  id: string;
  name: string;
  vehicle_type: string;
  /** Keys from lib/vehicle-kinds. */
  categories: string[];
};
export type ImportUnit = {
  product_id: string;
  location_id: string;
  plate: string | null;
  plate_pending: boolean;
  frame_number: string | null;
  engine_number: string | null;
  colour: string | null;
  model_year: number | null;
  current_odometer_km: number;
  purchase_date: string | null;
  purchase_price: number | null;
  purchased_from: string | null;
};

export type ImportPlan = {
  errors: ImportError[];
  products: ImportProduct[];
  units: ImportUnit[];
};

const key = (text: string) => text.trim().toLowerCase();
/** A product's name as the database compares it: no case, no spacing. */
const nameKey = (text: string) => text.toLowerCase().replace(/\s+/g, "");

/**
 * "Honda PCX 160 (2026)" / "Honda CB500X (2019–2021)": a Moto Mangos list
 * entry by name. Used by the Moto Mangos panel and the catalog admin only.
 */
export function catalogName(entry: {
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
}): string {
  const years =
    entry.year_from && entry.year_to && entry.year_to !== entry.year_from
      ? ` (${entry.year_from}–${entry.year_to})`
      : entry.year_from
        ? ` (${entry.year_from})`
        : "";
  return `${entry.make} ${entry.model}${years}`;
}

const limits: Partial<Record<ImportColumn, number>> = {
  product: 120,
  plate: 30,
  frame_number: 40,
  engine_number: 40,
  colour: 40,
  purchased_from: 200,
};

/**
 * The kind of vehicle as typed in the file: the database's own words, or the
 * ones on screen ("Off-road", "Boat", "Jet ski"). Blank is a motorbike.
 */
function kindFromText(text: string): string {
  const typed = text
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    "": "motorbike",
    bike: "motorbike",
    motorcycle: "motorbike",
    scooter: "motorbike",
    auto: "car",
    off_road: "atv",
    offroad: "atv",
    utv: "atv",
    dirt_bike: "atv",
    jet_ski: "boat",
    jetski: "boat",
    boat_or_jet_ski: "boat",
  };
  return aliases[typed] ?? typed;
}

export function planImport(
  table: CsvTable,
  context: ImportContext,
): ImportPlan {
  const errors: ImportError[] = [];
  const known = new Set<string>(importColumns);
  for (const header of table.headers) {
    if (header && !known.has(header))
      errors.push({ line: 1, column: header, code: "unknownColumn" });
  }
  if (!table.headers.includes("product"))
    errors.push({ line: 1, column: "product", code: "missingColumns" });
  if (table.rows.length === 0)
    errors.push({ line: 1, column: "", code: "noRows" });
  if (table.rows.length > maxImportRows)
    errors.push({ line: 1, column: "", code: "tooManyRows" });
  if (errors.length > 0) return { errors, products: [], units: [] };

  const locationIds = new Map(
    context.locations.map((l) => [key(l.name), l.id]),
  );
  const defaultLocation =
    context.locations.find((l) => l.isDefault) ?? context.locations[0];
  const plates = new Set(context.plates.map(key));
  const platesInFile = new Set<string>();
  // The shop's products by name, old and about to be created.
  const byName = new Map(context.products.map((p) => [nameKey(p.name), p.id]));
  const newProducts: ImportProduct[] = [];
  const units: ImportUnit[] = [];

  for (const { line, values } of table.rows) {
    const before = errors.length;
    const get = (column: ImportColumn) => values[column] ?? "";
    const fail = (column: ImportColumn, code: ImportErrorCode) =>
      errors.push({ line, column, code, value: get(column) || undefined });
    const text = (column: ImportColumn) => {
      const value = get(column);
      const limit = limits[column];
      if (limit && value.length > limit) fail(column, "tooLong");
      return value || null;
    };
    const date = (column: ImportColumn) => {
      const value = get(column);
      if (value && !isIsoDate(value)) fail(column, "invalidDate");
      return value || null;
    };

    const yearText = get("year");
    let year: number | null = null;
    if (yearText) {
      const value = Number(yearText);
      if (!/^\d{4}$/.test(yearText) || value < 1950 || value > 2100)
        fail("year", "invalidYear");
      else year = value;
    }

    // The product, by name: one the shop has, or a new one.
    const name = text("product");
    let productId: string | undefined;
    if (!name) fail("product", "required");
    else if (errors.length === before) {
      productId = byName.get(nameKey(name));
      if (!productId) {
        const kind = kindFromText(get("vehicle_type"));
        const categories = categoriesFromText(kind, get("category"));
        if (!(vehicleTypes as readonly string[]).includes(kind))
          fail("vehicle_type", "invalidVehicleType");
        else if (!categories) fail("category", "invalidCategory");
        else if (categories.length === 0 && categoryRequired(kind))
          fail("category", "ownNeedsCategory");
        else {
          productId = context.newId();
          byName.set(nameKey(name), productId);
          newProducts.push({
            id: productId,
            name: name.replace(/\s+/g, " ").trim(),
            vehicle_type: kind,
            categories,
          });
        }
      }
    }

    const plate = text("plate");
    if (plate) {
      if (platesInFile.has(key(plate))) fail("plate", "plateDuplicateInFile");
      else if (plates.has(key(plate))) fail("plate", "plateExists");
      platesInFile.add(key(plate));
    }

    const odometerText = get("odometer").replace(/[\s,]/g, "");
    let odometerKm = 0;
    if (odometerText) {
      const value = Number(odometerText);
      if (!/^\d+(\.\d+)?$/.test(odometerText) || value > 9_999_999)
        fail("odometer", "invalidNumber");
      else odometerKm = toKm(value, context.distanceUnit);
    }

    const locationName = get("location");
    let locationId: string | undefined = defaultLocation?.id;
    if (locationName) {
      locationId = locationIds.get(key(locationName));
      if (!locationId) fail("location", "locationUnknown");
    }

    const priceText = get("purchase_price");
    let price: number | null = null;
    if (priceText) {
      price = parseMoney(priceText, context.currency);
      if (price === null) fail("purchase_price", "invalidMoney");
    }

    const unit: Omit<ImportUnit, "product_id" | "location_id"> = {
      plate,
      plate_pending: !plate,
      frame_number: text("frame_number"),
      engine_number: text("engine_number"),
      colour: text("colour"),
      model_year: year,
      current_odometer_km: odometerKm,
      purchase_date: date("purchase_date"),
      purchase_price: price,
      purchased_from: text("purchased_from"),
    };
    if (errors.length === before && productId && locationId)
      units.push({ product_id: productId, location_id: locationId, ...unit });
  }

  if (errors.length > 0) return { errors, products: [], units: [] };
  // Only the new products some vehicle actually uses.
  const used = new Set(units.map((u) => u.product_id));
  return {
    errors,
    products: newProducts.filter((p) => used.has(p.id)),
    units,
  };
}

/** A header line plus one example row, for the template download. */
export function importTemplate(): string {
  return [
    importColumns.join(","),
    "Honda PCX 160 2024,motorbike,city_scooter,2024,DEMO-0001,DEMOFRAME0001,DEMOENG0001,White,1200,,2026-01-10,95000,Demo dealer",
  ].join("\n");
}
