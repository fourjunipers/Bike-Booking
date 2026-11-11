import type { CsvTable } from "./csv";
import { toKm, type DistanceUnit } from "./distance";
import { isIsoDate } from "./fleet";
import { parseMoney } from "./money";

/**
 * Checks a fleet CSV (SPEC › Team, settings and platform: CSV import for
 * models and units) and turns it into what platform.import_fleet saves.
 * One row per bike. Every problem is reported with its line and column;
 * nothing is saved unless the whole file is clean.
 *
 * A bike's model is given the way it is chosen on screen: make, then model,
 * from the catalog. Where the catalog has several entries for one make and
 * model (generations), the bike's model year picks the one whose years include
 * it. The optional "name" column is the shop's own name for the model, for
 * shops that keep several models on one catalog entry.
 */

export const importColumns = [
  "make",
  "model",
  "model_year",
  "name",
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
  | "makeUnknown"
  | "modelUnknown"
  | "modelNeedsYear"
  | "modelNeedsName"
  | "nameOtherModel"
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

export type ImportCatalogEntry = {
  id: string;
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
};

export type ImportContext = {
  currency: string;
  distanceUnit: DistanceUnit;
  locations: { id: string; name: string; isDefault: boolean }[];
  /** Models the shop already has. */
  models: { id: string; name: string; catalog_id: string }[];
  /** Catalog entries the shop may use: approved, or its own pending requests. */
  catalog: ImportCatalogEntry[];
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
  model_year: number | null;
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

/** "Honda PCX 160 (2026)" / "Honda CB500X (2019–2021)": the default name of a model. */
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
  name: 120,
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
  for (const needed of ["make", "model"]) {
    if (!table.headers.includes(needed))
      errors.push({ line: 1, column: needed, code: "missingColumns" });
  }
  if (table.rows.length === 0)
    errors.push({ line: 1, column: "", code: "noRows" });
  if (table.rows.length > maxImportRows)
    errors.push({ line: 1, column: "", code: "tooManyRows" });
  if (errors.length > 0) return { errors, models: [], units: [] };

  const makes = new Set(context.catalog.map((c) => key(c.make)));
  const locationIds = new Map(
    context.locations.map((l) => [key(l.name), l.id]),
  );
  const defaultLocation =
    context.locations.find((l) => l.isDefault) ?? context.locations[0];
  const plates = new Set(context.plates.map(key));
  const platesInFile = new Set<string>();
  // The shop's models, old and about to be created, by name and by catalog entry.
  const models: ImportModel[] = context.models.map((m) => ({ ...m }));
  const newModels: ImportModel[] = [];
  const units: ImportUnit[] = [];

  const addModel = (catalogId: string, name: string) => {
    const model = { id: context.newId(), catalog_id: catalogId, name };
    models.push(model);
    newModels.push(model);
    return model;
  };

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

    const yearText = get("model_year");
    let modelYear: number | null = null;
    if (yearText) {
      const value = Number(yearText);
      if (!/^\d{4}$/.test(yearText) || value < 1950 || value > 2100)
        fail("model_year", "invalidYear");
      else modelYear = value;
    }

    // Make, then model, as on screen; then which of the shop's models it is.
    const make = get("make");
    const modelName = get("model");
    const ownName = text("name");
    let modelId: string | undefined;
    if (!make) fail("make", "required");
    if (!modelName) fail("model", "required");
    if (make && modelName) {
      const candidates = context.catalog.filter(
        (c) => key(c.make) === key(make) && key(c.model) === key(modelName),
      );
      let entry = candidates.length === 1 ? candidates[0] : undefined;
      if (candidates.length > 1 && modelYear !== null) {
        const inRange = candidates.filter(
          (c) =>
            c.year_from !== null &&
            modelYear! >= c.year_from &&
            modelYear! <= (c.year_to ?? c.year_from),
        );
        if (inRange.length === 1) entry = inRange[0];
      }
      if (candidates.length === 0)
        fail(
          makes.has(key(make)) ? "model" : "make",
          makes.has(key(make)) ? "modelUnknown" : "makeUnknown",
        );
      else if (!entry) fail("model_year", "modelNeedsYear");
      else {
        const onEntry = models.filter((m) => m.catalog_id === entry.id);
        if (ownName) {
          const named = models.find((m) => key(m.name) === key(ownName));
          if (named && named.catalog_id !== entry.id)
            fail("name", "nameOtherModel");
          else modelId = (named ?? addModel(entry.id, ownName)).id;
        } else if (onEntry.length > 1) fail("name", "modelNeedsName");
        else if (onEntry.length === 1) modelId = onEntry[0].id;
        else {
          // A new model takes the catalog's name, unless that name is taken.
          let name = catalogName(entry);
          for (let n = 2; models.some((m) => key(m.name) === key(name)); n++)
            name = `${catalogName(entry)} (${n})`;
          modelId = addModel(entry.id, name).id;
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
      model_year: modelYear,
      current_odometer_km: odometerKm,
      purchase_date: date("purchase_date"),
      purchase_price: price,
      purchased_from: text("purchased_from"),
    };
    if (errors.length === before && modelId && locationId)
      units.push({ model_id: modelId, location_id: locationId, ...unit });
  }

  if (errors.length > 0) return { errors, models: [], units: [] };
  // Only the new models some bike actually uses.
  const used = new Set(units.map((u) => u.model_id));
  return { errors, models: newModels.filter((m) => used.has(m.id)), units };
}

/** A header line plus one example row, for the template download. */
export function importTemplate(): string {
  return [
    importColumns.join(","),
    "Honda,PCX 160,2026,,DEMO-0001,DEMOFRAME0001,DEMOENG0001,White,1200,,2026-01-10,95000,Demo dealer",
  ].join("\n");
}
