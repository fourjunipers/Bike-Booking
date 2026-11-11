import { z } from "zod";
import { isIsoDate } from "./fleet-import";
import { isTimeZone } from "./tenant-settings";

/**
 * Form rules for the fleet and location screens (SPEC › Fleet). Each schema
 * takes the raw form fields and returns the row to save. The database checks
 * everything again; these give the form its field-by-field messages.
 * Error messages are keys of the "Fleet.errors" messages.
 */

export const unitStatuses = [
  "active",
  "maintenance",
  "borrowed",
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

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    blankToNull,
    z.coerce
      .number("invalidNumber")
      .int("invalidNumber")
      .min(min, "invalidNumber")
      .max(max, "invalidNumber")
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

export const unitSchema = z
  .object({
    model_id: uuid,
    location_id: uuid,
    plate: optionalText(30),
    plate_pending: checkbox,
    frame_number: optionalText(40),
    engine_number: optionalText(40),
    colour: optionalText(40),
    first_registered: optionalDate,
    status: z.enum(unitStatuses, "required"),
    active_from: optionalDate,
    active_to: optionalDate,
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
    if (unit.active_from && unit.active_to && unit.active_to < unit.active_from)
      ctx.addIssue({
        code: "custom",
        path: ["active_to"],
        message: "endBeforeStart",
      });
  })
  // A unit with a plate isn't waiting for one.
  .transform((unit) => ({
    ...unit,
    plate_pending: unit.plate ? false : unit.plate_pending,
  }));
export type UnitInput = z.infer<typeof unitSchema>;

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
    year_from: optionalInt(1950, 2100),
    year_to: optionalInt(1950, 2100),
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
    "odometer_lower_needs_manager",
    "only_owner_or_manager",
    "currency_locked",
  ])
    if (message.includes(known)) return known;
  if (message.includes("time zone")) return "timezoneOwnerOnly";
  if (message.includes("default location")) return "keepDefaultLocation";
  if (error.code === "42501") return "notAllowed";
  return "saveFailed";
}
