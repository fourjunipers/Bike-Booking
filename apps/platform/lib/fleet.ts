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
export const unitStatuses = ["active", "maintenance", "retired", "sold"] as const;
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
    catalog_id: uuid,
    description: optionalText(2000),
    bookable_online: checkbox,
    buffer_before_minutes: optionalInt(0, 10080),
    buffer_after_minutes: optionalInt(0, 10080),
    min_age: optionalInt(14, 99),
    licence_class: optionalText(60),
    instant_units: count,
    request_units: count,
    ready_now: count,
  })
  .strict();
export type ModelInput = z.infer<typeof modelSchema>;

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
export function parseModelChoice(
  value: unknown,
): { kind: "model" | "catalog"; id: string } | null {
  const m = /^(model|catalog):([0-9a-f-]{36})$/.exec(String(value ?? ""));
  return m ? { kind: m[1] as "model" | "catalog", id: m[2] } : null;
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
  .object({ weekday: z.number().int().min(0).max(6), open: clock, close: clock })
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

export const catalogRequestSchema = z
  .object({
    make: z.string().trim().min(1, "required").max(40, "tooLong"),
    model: z.string().trim().min(1, "required").max(60, "tooLong"),
    year_from: optionalInt(1950, 2100, "invalidYear"),
    year_to: optionalInt(1950, 2100, "invalidYear"),
    type: z.enum(bikeTypes, "required"),
    transmission: z.enum(transmissions, "required"),
    cc: z.coerce
      .number("invalidNumber")
      .int("invalidNumber")
      .min(50, "invalidNumber")
      .max(2500, "invalidNumber"),
    note: optionalText(500),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.year_from && c.year_to && c.year_to < c.year_from)
      ctx.addIssue({
        code: "custom",
        path: ["year_to"],
        message: "endBeforeStart",
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
  if (message.includes("model_year_bands_no_overlap")) return "bandOverlap";
  // The availability lock: two blocks of one unit overlap.
  if (error.code === "23P01") return "blockOverlap";
  if (message.includes("units_plate_idx")) return "plateExists";
  if (message.includes("models_name_idx")) return "nameExists";
  if (message.includes("locations_name_idx")) return "nameExists";
  // A row other rows still point at (a model with units, a unit with blocks).
  if (error.code === "23503") return "inUse";
  for (const known of [
    "unit_has_future_blocks",
    "unit_not_in_fleet",
    "more_units_than_active",
    "catalog_entry_not_usable",
    "only_owner_or_manager",
    "currency_locked",
  ])
    if (message.includes(known)) return known;
  if (message.includes("time zone")) return "timezoneOwnerOnly";
  if (message.includes("default location")) return "keepDefaultLocation";
  if (error.code === "42501") return "notAllowed";
  return "saveFailed";
}
