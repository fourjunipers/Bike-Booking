import { normName } from "./catalog-match";
import type { CsvTable } from "./csv";
import { toKm, type DistanceUnit } from "./distance";
import {
  isIsoDate,
  needsEngineSize,
  needsTransmission,
  transmissions,
  vehicleTypes,
} from "./fleet";
import { parseMoney } from "./money";
import { categoriesFromText, categoryRequired } from "./vehicle-kinds";

/**
 * Checks a fleet CSV (SPEC › Team, settings and platform: CSV import for
 * models and units) and turns it into what platform.import_fleet saves.
 * One row per bike. Every problem is reported with its line and column;
 * nothing is saved unless the whole file is clean.
 *
 * A bike's model is given the way it is chosen on screen: make, then model.
 * - If the catalog has that make and model, the bike goes on that preset.
 *   Where the catalog has several generations, the bike's model year picks
 *   the one whose years include it.
 * - If it doesn't, it is one of the shop's own: an existing own model with
 *   that make and model (ignoring case and spacing), or a new one, for which
 *   the row gives the vehicle type, and for a motorbike the engine size and
 *   transmission.
 * The optional "name" column is the shop's own name for the model.
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
  "vehicle_type",
  "category",
  "cc",
  "transmission",
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
  | "ownNeedsSpecs"
  | "invalidVehicleType"
  | "invalidCategory"
  | "ownNeedsCategory"
  | "invalidTransmission"
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
  /** Models the shop already has. `catalog_id` is null for its own models. */
  models: {
    id: string;
    name: string;
    catalog_id: string | null;
    make: string;
    model: string;
  }[];
  /** The presets: approved catalog entries. */
  catalog: ImportCatalogEntry[];
  /** Plates already in the shop's fleet. */
  plates: string[];
  newId: () => string;
};

/** A model to create: on a preset (`catalog_id`), or the shop's own (the rest). */
export type ImportModel = {
  id: string;
  name: string;
  catalog_id: string | null;
  make?: string;
  model?: string;
  vehicle_type?: string;
  cc?: number | null;
  transmission?: string | null;
  /** Keys from lib/vehicle-kinds; none on a list model means the list's own. */
  categories?: string[];
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
  make: 40,
  model: 60,
  name: 120,
  plate: 30,
  frame_number: 40,
  engine_number: 40,
  colour: 40,
  purchased_from: 200,
};

type KnownModel = {
  id: string;
  name: string;
  catalog_id: string | null;
  make: string;
  model: string;
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
  for (const needed of ["make", "model"]) {
    if (!table.headers.includes(needed))
      errors.push({ line: 1, column: needed, code: "missingColumns" });
  }
  if (table.rows.length === 0)
    errors.push({ line: 1, column: "", code: "noRows" });
  if (table.rows.length > maxImportRows)
    errors.push({ line: 1, column: "", code: "tooManyRows" });
  if (errors.length > 0) return { errors, models: [], units: [] };

  const locationIds = new Map(
    context.locations.map((l) => [key(l.name), l.id]),
  );
  const defaultLocation =
    context.locations.find((l) => l.isDefault) ?? context.locations[0];
  const plates = new Set(context.plates.map(key));
  const platesInFile = new Set<string>();
  // The shop's models, old and about to be created.
  const models: KnownModel[] = context.models.map((m) => ({ ...m }));
  const newModels: ImportModel[] = [];
  const units: ImportUnit[] = [];

  const uniqueName = (wanted: string) => {
    let name = wanted;
    for (let n = 2; models.some((m) => key(m.name) === key(name)); n++)
      name = `${wanted} (${n})`;
    return name;
  };
  const addModel = (model: ImportModel & { make: string; model: string }) => {
    models.push({
      id: model.id,
      name: model.name,
      catalog_id: model.catalog_id,
      make: model.make,
      model: model.model,
    });
    // A preset's description comes from the catalog, so only its link (and a
    // category, if the file gave one) is sent.
    newModels.push(
      model.catalog_id
        ? {
            id: model.id,
            name: model.name,
            catalog_id: model.catalog_id,
            ...(model.categories?.length
              ? { categories: model.categories }
              : {}),
          }
        : model,
    );
    return model.id;
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
    const make = text("make");
    const modelName = text("model");
    const ownName = text("name");
    let modelId: string | undefined;
    if (!make) fail("make", "required");
    if (!modelName) fail("model", "required");
    if (make && modelName) {
      const same = (m: { make: string; model: string }) =>
        normName(m.make) === normName(make) &&
        normName(m.model) === normName(modelName);
      const presets = context.catalog.filter(same);
      const named = ownName
        ? models.find((m) => key(m.name) === key(ownName))
        : undefined;

      if (named) {
        // The shop's own name for a model it already has.
        if (!same(named)) fail("name", "nameOtherModel");
        else modelId = named.id;
      } else if (presets.length > 0) {
        let entry = presets.length === 1 ? presets[0] : undefined;
        if (!entry && modelYear !== null) {
          const inRange = presets.filter(
            (c) =>
              c.year_from !== null &&
              modelYear! >= c.year_from &&
              modelYear! <= (c.year_to ?? c.year_from),
          );
          if (inRange.length === 1) entry = inRange[0];
        }
        if (!entry) fail("model_year", "modelNeedsYear");
        else {
          const onEntry = models.filter((m) => m.catalog_id === entry.id);
          if (ownName)
            modelId = addModel({
              id: context.newId(),
              name: ownName,
              catalog_id: entry.id,
              make: entry.make,
              model: entry.model,
            });
          else if (onEntry.length > 1) fail("name", "modelNeedsName");
          else if (onEntry.length === 1) modelId = onEntry[0].id;
          else {
            // The list files it under a category already; the file may name
            // others of the motorbike categories (several, with semicolons).
            const categoryText = get("category");
            const categories = categoriesFromText("motorbike", categoryText);
            if (!categories) fail("category", "invalidCategory");
            else
              modelId = addModel({
                id: context.newId(),
                name: uniqueName(catalogName(entry)),
                catalog_id: entry.id,
                make: entry.make,
                model: entry.model,
                categories,
              });
          }
        }
      } else {
        // Not a preset: one of the shop's own, old or new.
        const own = models.find((m) => m.catalog_id === null && same(m));
        if (own) modelId = own.id;
        else {
          const typeText = kindFromText(get("vehicle_type"));
          const categoryText = get("category");
          const categories = categoriesFromText(typeText, categoryText);
          const ccText = get("cc");
          const gearText = key(get("transmission")).replace(/[\s-]+/g, "_");
          const cc = ccText ? Number(ccText) : null;
          if (!(vehicleTypes as readonly string[]).includes(typeText))
            fail("vehicle_type", "invalidVehicleType");
          if (ccText && (!/^\d{1,5}$/.test(ccText) || cc! < 1 || cc! > 20000))
            fail("cc", "invalidNumber");
          if (
            gearText &&
            !(transmissions as readonly string[]).includes(gearText)
          )
            fail("transmission", "invalidTransmission");
          // Each missing spec is reported under its own column.
          if (needsEngineSize(typeText) && !ccText) fail("cc", "ownNeedsSpecs");
          if (needsTransmission(typeText) && !gearText)
            fail("transmission", "ownNeedsSpecs");
          if (!categories) fail("category", "invalidCategory");
          else if (categories.length === 0 && categoryRequired(typeText))
            fail("category", "ownNeedsCategory");
          if (errors.length === before)
            modelId = addModel({
              id: context.newId(),
              name: uniqueName(ownName ?? `${make} ${modelName}`),
              catalog_id: null,
              make,
              model: modelName,
              vehicle_type: typeText,
              cc,
              transmission: gearText || null,
              categories: categories ?? [],
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
      model_year: modelYear,
      current_odometer_km: odometerKm,
      purchase_date: date("purchase_date"),
      purchase_price: price,
      purchased_from: text("purchased_from"),
    };
    if (errors.length === before && modelId && locationId)
      units.push({ product_id: modelId, location_id: locationId, ...unit });
  }

  if (errors.length > 0) return { errors, models: [], units: [] };
  // Only the new models some bike actually uses.
  const used = new Set(units.map((u) => u.product_id));
  return { errors, models: newModels.filter((m) => used.has(m.id)), units };
}

/** A header line plus one example row, for the template download. */
export function importTemplate(): string {
  return [
    importColumns.join(","),
    "Honda,PCX 160,2026,,DEMO-0001,DEMOFRAME0001,DEMOENG0001,White,1200,,2026-01-10,95000,Demo dealer,,,",
  ].join("\n");
}
