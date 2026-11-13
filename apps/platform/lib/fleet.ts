import { z } from "zod";
import { isTimeZone } from "./tenant-settings";

/**
 * Form rules for the fleet and location screens (SPEC › Fleet). Each schema
 * takes the raw form fields and returns the row to save. The database checks
 * everything again; these give the form its field-by-field messages.
 * Error messages are keys of the "FormErrors" messages.
 */

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return date.getUTCMonth() === +m[2] - 1 && date.getUTCDate() === +m[3];
}

/**
 * A bike has one status. Scheduled downtime is separate (unit_blocks).
 * - active: in the fleet and rentable.
 * - maintenance: in the fleet, not rentable until set back to active.
 * - retired, sold: out of the fleet for good; history is kept.
 */
export const unitStatuses = [
  "active",
  "maintenance",
  "retired",
  "sold",
] as const;
export type UnitStatus = (typeof unitStatuses)[number];

/** Statuses staff and mechanics may switch between (units_guard in the database). */
export const workStatuses = ["active", "maintenance"] as const;

/** A unit that has left the fleet: no new blocks, hidden from availability. */
export function hasLeftFleet(status: string): boolean {
  return status === "sold" || status === "retired";
}

/** Whether a bike in this status counts as rentable stock. */
export function isRentable(status: string): boolean {
  return status === "active";
}

/** A field left blank, or not on the form at all, is "no value". */
const blankToNull = (value: unknown) =>
  value === undefined || (typeof value === "string" && value.trim() === "")
    ? null
    : value;

const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max, "tooLong").nullable());

const optionalDate = z.preprocess(
  blankToNull,
  z.string().trim().refine(isIsoDate, "invalidDate").nullable(),
);

const optionalInt = (min: number, max: number, message = "invalidNumber") =>
  z.preprocess(
    blankToNull,
    z.coerce
      .number(message)
      .int(message)
      .min(min, message)
      .max(max, message)
      .nullable(),
  );

const count = z.preprocess(
  (v) => (blankToNull(v) === null ? 0 : v),
  z.coerce
    .number("invalidNumber")
    .int("invalidNumber")
    .min(0, "invalidNumber")
    .max(9999, "invalidNumber"),
);

const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

const uuid = z.uuid("required");

const year = z.coerce
  .number("invalidYear")
  .int("invalidYear")
  .min(1950, "invalidYear")
  .max(2100, "invalidYear");

/** International phone format: + and 7 to 15 digits. Spaces and dashes are dropped. */
const optionalPhone = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const compact = v.replace(/[\s().-]/g, "");
    return compact === "" ? null : compact;
  },
  z
    .string()
    .regex(/^\+[1-9][0-9]{6,14}$/, "invalidPhone")
    .nullable(),
);

export const modelSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(120, "tooLong"),
    description: optionalText(2000),
    bookable_online: checkbox,
    min_age: optionalInt(14, 99),
    licence_class: optionalText(60),
  })
  .strict();
export type ModelInput = z.infer<typeof modelSchema>;

/**
 * Buffers are typed in hours, decimals allowed ("0.5", "1,5"), and stored in
 * minutes. Blank is null (the shop default); up to a week; to the minute.
 */
export function hoursToMinutes(text: string): number | null | "invalid" {
  const typed = text.trim().replace(",", ".");
  if (!typed) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(typed)) return "invalid";
  const minutes = Math.round(Number(typed) * 60);
  return minutes > 10080 ? "invalid" : minutes;
}

/** Stored minutes as the hours to show in the form: 30 → "0.5", 90 → "1.5". */
export function minutesToHours(minutes: number | null): string {
  if (minutes === null) return "";
  return String(Math.round((minutes / 60) * 100) / 100);
}

/** The Moto Mangos listing settings on a product's panel. */
export const listingSchema = z
  .object({
    listed: checkbox,
    instant_units: count,
    request_units: count,
    ready_now: count,
  })
  .strict();

/** A bike's details. Its status and odometer have their own controls. */
export const unitSchema = z
  .object({
    location_id: uuid,
    plate: optionalText(30),
    plate_pending: checkbox,
    frame_number: optionalText(40),
    engine_number: optionalText(40),
    colour: optionalText(40),
    model_year: optionalInt(1950, 2100, "invalidYear"),
    notes: optionalText(2000),
  })
  .strict()
  .superRefine((unit, ctx) => {
    if (!unit.plate && !unit.plate_pending)
      ctx.addIssue({
        code: "custom",
        path: ["plate"],
        message: "plateOrPending",
      });
  })
  // A unit with a plate isn't waiting for one.
  .transform((unit) => ({
    ...unit,
    plate_pending: unit.plate ? false : unit.plate_pending,
  }));
export type UnitInput = z.infer<typeof unitSchema>;

/**
 * The model chosen for a bike: one of the shop's models, or a catalog entry
 * the shop has no model for yet (a model is created from it on save).
 */
export function parseModelChoice(value: unknown): { id: string } | null {
  const m = /^model:([0-9a-f-]{36})$/.exec(String(value ?? ""));
  return m ? { id: m[1] } : null;
}

/** One of a model's year bands, e.g. 2020 to 2023. */
export const yearBandSchema = z
  .object({ year_from: year, year_to: year })
  .strict()
  .superRefine((band, ctx) => {
    if (band.year_to < band.year_from)
      ctx.addIssue({
        code: "custom",
        path: ["year_to"],
        message: "endBeforeStart",
      });
  });

export const locationSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(120, "tooLong"),
    timezone: z.string().trim().refine(isTimeZone, "invalidTimezone"),
    address: optionalText(500),
    maps_url: z.preprocess(
      blankToNull,
      z
        .string()
        .trim()
        .max(500, "tooLong")
        .refine((v) => /^https:\/\/\S+$/.test(v), "invalidUrl")
        .nullable(),
    ),
    phone: optionalPhone,
    whatsapp: optionalPhone,
    line_id: optionalText(100),
    email: z.preprocess(
      blankToNull,
      z.email("invalidEmail").max(200, "tooLong").nullable(),
    ),
  })
  .strict();
export type LocationInput = z.infer<typeof locationSchema>;

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalidTime");

/** One weekday's hours; closed days are simply left out. */
export const hoursSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    open: clock,
    close: clock,
  })
  .refine((h) => h.close > h.open, {
    path: ["close"],
    message: "endBeforeStart",
  });

export const closureSchema = z
  .object({
    start_date: z.string().trim().refine(isIsoDate, "invalidDate"),
    end_date: z.string().trim().refine(isIsoDate, "invalidDate"),
    note: optionalText(200),
    repeats_yearly: checkbox,
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.end_date < c.start_date)
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "endBeforeStart",
      });
  });

/** Catalog values, as the shared catalog defines them. */
export const bikeTypes = [
  "city_scooter",
  "touring",
  "adventure",
  "sport",
  "classic",
  "off_road",
] as const;
export const transmissions = ["automatic", "semi_auto", "manual"] as const;

/** Kinds of vehicle a shop can keep (public.vehicle_types). */
export const vehicleTypes = [
  "motorbike",
  "car",
  "atv",
  "boat",
  "other",
] as const;
export type VehicleType = (typeof vehicleTypes)[number];

/**
 * Which specs a vehicle must have (owner, 11 Nov 2026). The database holds
 * the same rule (models_required_specs_check).
 *   vehicle type   always
 *   transmission   motorbikes only
 *   engine size    motorbikes only
 * For cars, ATVs, boats and "other" both are optional.
 */
export function needsEngineSize(vehicleType: string): boolean {
  return vehicleType === "motorbike";
}
export function needsTransmission(vehicleType: string): boolean {
  return vehicleType === "motorbike";
}

/** A shop's own make and model: anything it rents, with no approval. */
export const ownModelSchema = z
  .object({
    make: z.string().trim().min(1, "required").max(40, "tooLong"),
    model: z.string().trim().min(1, "required").max(60, "tooLong"),
    vehicle_type: z.enum(vehicleTypes, "required"),
    cc: optionalInt(1, 20000, "ccRange"),
    transmission: z.preprocess(
      blankToNull,
      z.enum(transmissions, "required").nullable(),
    ),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (needsEngineSize(m.vehicle_type) && m.cc === null)
      ctx.addIssue({ code: "custom", path: ["cc"], message: "required" });
    if (needsTransmission(m.vehicle_type) && m.transmission === null)
      ctx.addIssue({
        code: "custom",
        path: ["transmission"],
        message: "required",
      });
  });
export type OwnModelInput = z.infer<typeof ownModelSchema>;

/** Sending one of the shop's own models to Moto Mangos for a catalog entry. */
export const catalogSubmitSchema = z
  .object({
    // Asked for at this moment (owner, 13 Nov 2026): a product is created
    // with a name only, and Moto Mangos search needs all four.
    make: z.string().trim().min(1, "required").max(40, "tooLong"),
    model: z.string().trim().min(1, "required").max(60, "tooLong"),
    cc: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce
        .number("ccRange")
        .int("ccRange")
        .min(1, "ccRange")
        .max(20000, "ccRange")
        .optional(),
    ),
    transmission: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.enum(transmissions, "required").optional(),
    ),
    // The year of the shop's own bike. The range of years the list entry
    // covers is the reviewer's to set at approval.
    year: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce
        .number("invalidYear")
        .int("invalidYear")
        .min(1950, "invalidYear")
        .max(2100, "invalidYear")
        .optional(),
    ),
    note: optionalText(500),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.year === undefined)
      ctx.addIssue({ code: "custom", path: ["year"], message: "required" });
    if (c.cc === undefined)
      ctx.addIssue({ code: "custom", path: ["cc"], message: "required" });
    if (c.transmission === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["transmission"],
        message: "required",
      });
  });

/** Tax and insurance records (SPEC › Fleet › Tax and insurance log). */
export const renewalKinds = [
  "road_tax",
  "compulsory_insurance",
  "voluntary_insurance",
  "inspection",
] as const;
export type RenewalKind = (typeof renewalKinds)[number];

export const renewalSchema = z
  .object({
    kind: z.enum(renewalKinds, "required"),
    provider: optionalText(200),
    reference_no: optionalText(100),
    starts_at: optionalDate,
    expires_at: z.string().trim().refine(isIsoDate, "invalidDate"),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.starts_at && r.expires_at < r.starts_at)
      ctx.addIssue({
        code: "custom",
        path: ["expires_at"],
        message: "endBeforeStart",
      });
  });

/** Collects the first message key per field from a failed parse. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}

/**
 * Maps a database error to a message key. The database is the real check
 * (constraints, triggers, RLS); the names are the ones the migrations raise.
 */
export function dbErrorKey(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return "saveFailed";
  const message = error.message ?? "";
  if (message.includes("product_year_bands_no_overlap")) return "bandOverlap";
  // The availability lock: two blocks of one unit overlap.
  if (error.code === "23P01") return "blockOverlap";
  if (message.includes("units_plate_idx")) return "plateExists";
  if (message.includes("products_name_idx")) return "nameExists";
  if (message.includes("products_own_make_model_idx")) return "ownModelExists";
  // Engine size outside 1 to 20000 cc, on a model or on the catalog entry made from it.
  if (/(products|bike_catalog)_cc_check/.test(message)) return "ccRange";
  if (message.includes("locations_name_idx")) return "nameExists";
  // A row other rows still point at (a model with units, a unit with blocks).
  if (error.code === "23503") return "inUse";
  for (const known of [
    "unit_has_future_blocks",
    "unit_not_in_fleet",
    "more_units_than_active",
    "catalog_entry_not_usable",
    "not_listable",
    "already_linked",
    "only_motorbikes",
    "merge_target_not_approved",
    "only_owner_or_manager",
    "currency_locked",
    "model_has_active_units",
    "model_retired",
    "specs_required",
  ])
    if (message.includes(known)) return known;
  if (message.includes("time zone")) return "timezoneOwnerOnly";
  if (message.includes("default location")) return "keepDefaultLocation";
  if (error.code === "42501") return "notAllowed";
  return "saveFailed";
}

/**
 * A filter value for "this block is running at `now`": a one-instant range to
 * test a block's period against with `overlaps`. Used when ending downtime, so
 * a block that already ended is never written again from a stale page.
 */
export function runningAt(now: Date): string {
  const at = now.toISOString();
  return `[${at},${at}]`;
}

/**
 * The start of the minute `at` falls in. Downtime is typed to the minute, so
 * "now" is kept to the minute too: a block ended at 10:30:45 would otherwise
 * still cover a new one typed as starting 10:30.
 */
export function wholeMinute(at: Date): Date {
  return new Date(Math.floor(at.getTime() / 60_000) * 60_000);
}
