import type { CsvTable } from "./csv";
import { toKm, type DistanceUnit } from "./distance";
import { parseMoney } from "./money";

/**
 * Checks a fleet CSV (SPEC › Team, settings and platform: CSV import for
 * models and units) and turns it into what platform.import_fleet saves.
 * One row per vehicle. Every problem is reported with its line and column;
 * nothing is saved unless the whole file is clean.
 *
 * Columns: model (required), catalog, plate, frame_number, engine_number,
 * colour, first_registered, odometer, location, purchase_date,
 * purchase_price, purchased_from.
 */

export const importColumns = [
  "model",
  "catalog",
  "plate",
  "frame_number",
  "engine_number",
  "colour",
  "first_registered",
  "odometer",
  "location",
  "purchase_date",
  "purchase_price",
  "purchased_from",
] as const;
export type ImportColumn = (typeof importColumns)[number];

export const maxImportRows = 1000;

export type ImportErrorCode =
  | "missingModelColumn"
  | "unknownColumn"
  | "noRows"
  | "tooManyRows"
  | "required"
  | "tooLong"
  | "catalogNeeded"
  | "catalogUnknown"
  | "catalogMismatch"
  | "plateDuplicateInFile"
  | "plateExists"
  | "invalidDate"
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
  /** Models the shop already has. */
  models: { id: string; name: string }[];
  /** Catalog entries the shop may use: approved, or its own pending requests. */
  catalog: { id: string; slug: string }[];
  /** Plates already in the shop's fleet. */
  plates: string[];
  newId: () => string;
};

export type ImportModel = { id: string; catalog_id: string; name: string };
export type ImportUnit = {
  model_id: string;
  location_id: string;
  plate: string | null;
  plate_pending: boolean;
  frame_number: string | null;
  engine_number: string | null;
  colour: string | null;
  first_registered: string | null;
  current_odometer_km: number;
  purchase_date: string | null;
  purchase_price: number | null;
  purchased_from: string | null;
};

export type ImportPlan = {
  errors: ImportError[];
  models: ImportModel[];
  units: ImportUnit[];
};

const key = (text: string) => text.trim().toLowerCase();

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return date.getUTCMonth() === +m[2] - 1 && date.getUTCDate() === +m[3];
}

const limits: Partial<Record<ImportColumn, number>> = {
  model: 120,
  plate: 30,
  frame_number: 40,
  engine_number: 40,
  colour: 40,
  purchased_from: 200,
};

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
  if (!table.headers.includes("model"))
    errors.push({ line: 1, column: "model", code: "missingModelColumn" });
  if (table.rows.length === 0)
    errors.push({ line: 1, column: "", code: "noRows" });
  if (table.rows.length > maxImportRows)
    errors.push({ line: 1, column: "", code: "tooManyRows" });
  if (errors.length > 0) return { errors, models: [], units: [] };

  const modelIds = new Map(context.models.map((m) => [key(m.name), m.id]));
  const catalogIds = new Map(context.catalog.map((c) => [key(c.slug), c.id]));
  const locationIds = new Map(
    context.locations.map((l) => [key(l.name), l.id]),
  );
  const defaultLocation =
    context.locations.find((l) => l.isDefault) ?? context.locations[0];
  const plates = new Set(context.plates.map(key));
  const platesInFile = new Set<string>();
  const newModels = new Map<string, ImportModel>();
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

    // Model: an existing one by name, or a new one from a catalog entry.
    const modelName = text("model");
    const catalogSlug = get("catalog");
    let modelId: string | undefined;
    if (!modelName) fail("model", "required");
    else {
      modelId = modelIds.get(key(modelName));
      const catalogId = catalogSlug
        ? catalogIds.get(key(catalogSlug))
        : undefined;
      if (catalogSlug && !catalogId) fail("catalog", "catalogUnknown");
      if (!modelId) {
        const planned = newModels.get(key(modelName));
        if (planned) {
          if (catalogId && catalogId !== planned.catalog_id)
            fail("catalog", "catalogMismatch");
          modelId = planned.id;
        } else if (!catalogSlug) fail("catalog", "catalogNeeded");
        else if (catalogId) {
          modelId = context.newId();
          newModels.set(key(modelName), {
            id: modelId,
            catalog_id: catalogId,
            name: modelName,
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

    const unit: Omit<ImportUnit, "model_id" | "location_id"> = {
      plate,
      plate_pending: !plate,
      frame_number: text("frame_number"),
      engine_number: text("engine_number"),
      colour: text("colour"),
      first_registered: date("first_registered"),
      current_odometer_km: odometerKm,
      purchase_date: date("purchase_date"),
      purchase_price: price,
      purchased_from: text("purchased_from"),
    };
    if (errors.length === before && modelId && locationId)
      units.push({ model_id: modelId, location_id: locationId, ...unit });
  }

  if (errors.length > 0) return { errors, models: [], units: [] };
  return { errors, models: [...newModels.values()], units };
}

/** A header line plus one example row, for the template download. */
export function importTemplate(): string {
  return [
    importColumns.join(","),
    "Honda PCX 160,honda-pcx-160-2026,DEMO-0001,DEMOFRAME0001,DEMOENG0001,White,2026-01-15,1200,,2026-01-10,95000,Demo dealer",
  ].join("\n");
}
