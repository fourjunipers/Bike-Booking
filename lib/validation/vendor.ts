/**
 * Server-side validation for the vendor dashboard and admin forms. Error
 * messages are keys under "Errors" in messages/*.json so the vendor sees them
 * in Thai or English.
 */

import { z } from "zod";
import {
  DEPOSIT_METHODS,
  GEAR_OPTIONS,
  HELMET_SIZES,
  HELMET_TYPES,
  LICENCE_TYPES,
  PASSPORT_POLICIES,
  USAGE_AREAS,
  type InclusionOverrides,
  type Inclusions,
} from "@/lib/inclusions";
import { MAX_MODEL_PHOTOS, MAX_SHOP_PHOTOS } from "@/lib/photos";
import { ANCHOR_DAYS, TABLE_DAYS, type Anchors } from "@/lib/pricing";

export type ErrorKey =
  | "required"
  | "tooLong"
  | "tooShort"
  | "invalid"
  | "range"
  | "phone"
  | "email"
  | "url"
  | "closeAfterOpen"
  | "endAfterStart"
  | "photoRequired"
  | "tooManyPhotos"
  | "dayOneRequired"
  | "dayThirtyRequired"
  | "priceRequired";

const err = (key: ErrorKey) => ({ message: key });

/** "" and whitespace-only become undefined, so optional fields can be blank. */
const blank = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const text = (max: number) =>
  z.preprocess(blank, z.string().trim().max(max, err("tooLong")).optional());

const requiredText = (min: number, max: number) =>
  z
    .string(err("required"))
    .trim()
    .min(1, err("required"))
    .min(min, err("tooShort"))
    .max(max, err("tooLong"));

const int = (min: number, max: number) =>
  z.coerce
    .number(err("invalid"))
    .int(err("invalid"))
    .min(min, err("range"))
    .max(max, err("range"));

const optionalInt = (min: number, max: number) =>
  z.preprocess(blank, int(min, max).optional());

const checkbox = z.preprocess(
  (v) => v === "on" || v === "true" || v === true,
  z.boolean(),
);

/** JSON array of strings sent from a hidden input (photo pickers). */
const jsonStrings = z.preprocess(
  (v) => {
    if (typeof v !== "string" || v === "") return [];
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  },
  z.array(z.string().max(300), err("invalid")),
);

/** "+66 85-055 0247" → "+66850550247". Empty → undefined. */
export function compactPhone(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const compact = value.replace(/[\s\-().]/g, "");
  return compact === "" ? undefined : compact;
}

const E164 = /^\+[1-9]\d{7,14}$/;
const phone = z.preprocess(
  compactPhone,
  z.string().regex(E164, err("phone")).optional(),
);

// Shop profile ---------------------------------------------------------------

export const shopProfileSchema = z.object({
  name: requiredText(2, 80),
  about: text(2000),
  photos: jsonStrings.pipe(
    z.array(z.string()).max(MAX_SHOP_PHOTOS, err("tooManyPhotos")),
  ),
  // Thailand and its neighbours, generously.
  lat: z.preprocess(
    blank,
    z.coerce.number(err("invalid")).min(5).max(21).optional(),
  ),
  lng: z.preprocess(
    blank,
    z.coerce.number(err("invalid")).min(97).max(106).optional(),
  ),
  maps_url: z.preprocess(
    blank,
    z.url(err("url")).max(500, err("tooLong")).optional(),
  ),
  nearest_station: text(80),
  google_place_id: text(300),
});

export const createShopSchema = z.object({ name: requiredText(2, 80) });

// Hours and closures -------------------------------------------------------

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type HoursRow = { weekday: number; open: string; close: string };

/** Fields per weekday d: open_d, close_d, closed_d ("on" = closed all day). */
export function parseHours(form: Record<string, unknown>): {
  rows: HoursRow[];
  errors: Partial<Record<string, ErrorKey>>;
} {
  const rows: HoursRow[] = [];
  const errors: Partial<Record<string, ErrorKey>> = {};
  for (let d = 0; d <= 6; d++) {
    if (form[`closed_${d}`] === "on") continue;
    const open = String(form[`open_${d}`] ?? "");
    const close = String(form[`close_${d}`] ?? "");
    if (!TIME.test(open) || !TIME.test(close)) {
      errors[`day_${d}`] = "invalid";
    } else if (close <= open) {
      errors[`day_${d}`] = "closeAfterOpen";
    } else {
      rows.push({ weekday: d, open, close });
    }
  }
  return { rows, errors };
}

const isoDate = z.iso.date(err("invalid"));

export const closureSchema = z
  .object({
    start_date: isoDate,
    end_date: isoDate,
    note: text(100),
  })
  .refine((v) => v.end_date >= v.start_date, {
    ...err("endAfterStart"),
    path: ["end_date"],
  });

// Contacts -----------------------------------------------------------------

export const contactsSchema = z.object({
  whatsapp: phone,
  phone,
  line_id: z.preprocess(
    blank,
    z
      .string()
      .trim()
      .max(50, err("tooLong"))
      .regex(/^@?[A-Za-z0-9._-]+$/, err("invalid"))
      .optional(),
  ),
  email: z.preprocess(blank, z.email(err("email")).max(200).optional()),
});

// Booking settings ---------------------------------------------------------

export const bookingSettingsSchema = z.object({
  cutoff_minutes: int(0, 720),
  buffer_before_h: int(0, 72),
  buffer_after_h: int(0, 72),
  request_window_min: int(15, 1440),
});

// What's included ----------------------------------------------------------

const enumOf = <T extends string>(values: readonly T[]) =>
  z.enum(values as [T, ...T[]], err("invalid"));

const sizes = z.array(z.enum(HELMET_SIZES, err("invalid")));
const methods = z.array(enumOf(DEPOSIT_METHODS));

/** Every field of the shop defaults, as submitted by the policies form. */
export const shopInclusionsSchema = z.object({
  helmets: int(0, 4),
  helmet_type: z.preprocess(blank, enumOf(HELMET_TYPES).optional()),
  helmet_sizes: sizes,
  gloves: enumOf(GEAR_OPTIONS),
  jacket: enumOf(GEAR_OPTIONS),
  rain_gear: enumOf(GEAR_OPTIONS),
  phone_holder: checkbox,
  usb_charger: checkbox,
  top_box: checkbox,
  side_panniers: checkbox,
  usage_area: enumOf(USAGE_AREAS),
  km_limit: z.preprocess((v) => blank(v) ?? 0, int(0, 100000)),
  medical_cover: checkbox,
  deposit_amount: optionalInt(1, 1000000),
  deposit_methods: methods,
  passport: enumOf(PASSPORT_POLICIES),
  deposit_refund_days: int(0, 30),
  licence_required: enumOf(LICENCE_TYPES),
  min_age: optionalInt(15, 99),
  experience_required: checkbox,
  notes: text(1000),
});

export type ShopInclusionsInput = z.infer<typeof shopInclusionsSchema>;

/** The shop form's values as a shop_policies update. */
export function toShopPolicies(
  v: ShopInclusionsInput,
): Inclusions & { deposit_amount: number | null } {
  return {
    ...v,
    helmet_type: v.helmet_type ?? null,
    deposit_amount: v.deposit_amount ?? null,
    min_age: v.min_age ?? null,
    notes: v.notes ?? null,
  };
}

/**
 * Model overrides. Every select has an "inherit" choice (empty value);
 * checkboxes come as tri-state selects ("", "yes", "no"); array fields are
 * overridden only when their "override_<field>" box is ticked.
 */
export function parseInclusionOverrides(
  form: Record<string, unknown>,
  arrays: Record<"helmet_sizes" | "deposit_methods", string[]>,
): {
  overrides: InclusionOverrides;
  errors: Partial<Record<string, ErrorKey>>;
} {
  const errors: Partial<Record<string, ErrorKey>> = {};
  const overrides: InclusionOverrides = {};
  const get = (k: string) => {
    const v = form[k];
    return typeof v === "string" && v !== "" ? v : undefined;
  };
  const pick = <T extends string>(
    k: keyof InclusionOverrides,
    values: readonly T[],
  ) => {
    const v = get(k);
    if (v === undefined) return;
    if ((values as readonly string[]).includes(v))
      (overrides as Record<string, unknown>)[k] = v;
    else errors[k] = "invalid";
  };
  const tri = (k: keyof InclusionOverrides) => {
    const v = get(k);
    if (v === "yes") (overrides as Record<string, unknown>)[k] = true;
    else if (v === "no") (overrides as Record<string, unknown>)[k] = false;
    else if (v !== undefined) errors[k] = "invalid";
  };
  const num = (k: keyof InclusionOverrides, min: number, max: number) => {
    const v = get(k);
    if (v === undefined) return;
    const n = Number(v);
    if (Number.isInteger(n) && n >= min && n <= max)
      (overrides as Record<string, unknown>)[k] = n;
    else errors[k] = "range";
  };

  num("helmets", 0, 4);
  pick("helmet_type", HELMET_TYPES);
  pick("gloves", GEAR_OPTIONS);
  pick("jacket", GEAR_OPTIONS);
  pick("rain_gear", GEAR_OPTIONS);
  tri("phone_holder");
  tri("usb_charger");
  tri("top_box");
  tri("side_panniers");
  pick("usage_area", USAGE_AREAS);
  num("km_limit", 0, 100000);
  tri("medical_cover");
  pick("passport", PASSPORT_POLICIES);
  num("deposit_refund_days", 0, 30);
  pick("licence_required", LICENCE_TYPES);
  num("min_age", 15, 99);
  tri("experience_required");
  const notes = get("notes");
  if (notes !== undefined) {
    if (notes.length > 1000) errors.notes = "tooLong";
    else overrides.notes = notes.trim();
  }
  if (form.override_helmet_sizes === "on") {
    const parsed = sizes.safeParse(arrays.helmet_sizes);
    if (parsed.success) overrides.helmet_sizes = parsed.data;
    else errors.helmet_sizes = "invalid";
  }
  if (form.override_deposit_methods === "on") {
    const parsed = methods.safeParse(arrays.deposit_methods);
    if (parsed.success) overrides.deposit_methods = parsed.data;
    else errors.deposit_methods = "invalid";
  }
  return { overrides, errors };
}

// Bike models ----------------------------------------------------------------

export const modelSchema = z.object({
  qty: int(0, 999),
  deposit_amount: optionalInt(1, 1000000),
  booking_mode: z.enum(["instant", "request"], err("invalid")),
  buffer_before_h: optionalInt(0, 72),
  buffer_after_h: optionalInt(0, 72),
  year_from: optionalInt(1950, 2100),
  year_to: optionalInt(1950, 2100),
  visible: checkbox,
  photos: jsonStrings.pipe(
    z
      .array(z.string())
      .min(1, err("photoRequired"))
      .max(MAX_MODEL_PHOTOS, err("tooManyPhotos")),
  ),
});

/** Anchors (anchor_1 … anchor_30) and manual days (manual_2 … manual_29). */
export function parsePriceForm(form: Record<string, unknown>): {
  anchors: Anchors;
  manual: Record<number, number>;
  errors: Partial<Record<string, ErrorKey>>;
} {
  const anchors: Anchors = {};
  const manual: Record<number, number> = {};
  const errors: Partial<Record<string, ErrorKey>> = {};
  const read = (key: string): number | undefined | null => {
    const raw = form[key];
    if (typeof raw !== "string" || raw.trim() === "") return undefined;
    const n = Number(raw.replace(/[,\s฿]/g, ""));
    return Number.isSafeInteger(n) && n > 0 && n <= 10_000_000 ? n : null;
  };
  for (const day of ANCHOR_DAYS) {
    const v = read(`anchor_${day}`);
    if (v === null) errors[`anchor_${day}`] = "invalid";
    else if (v !== undefined) anchors[day] = v;
  }
  if (anchors[1] === undefined && !errors.anchor_1)
    errors.anchor_1 = "dayOneRequired";
  if (anchors[30] === undefined && !errors.anchor_30)
    errors.anchor_30 = "dayThirtyRequired";
  for (let day = 2; day < TABLE_DAYS; day++) {
    if ((ANCHOR_DAYS as readonly number[]).includes(day)) continue;
    const v = read(`manual_${day}`);
    if (v === null) errors[`manual_${day}`] = "invalid";
    else if (v !== undefined) manual[day] = v;
  }
  return { anchors, manual, errors };
}

// Extras -----------------------------------------------------------------------

export const extraSchema = z
  .object({
    name: requiredText(1, 80),
    description: text(500),
    terms: text(2000),
    price_kind: z.enum(["rental", "time"], err("invalid")),
    price_rental: optionalInt(1, 1000000),
    price_1d: optionalInt(1, 1000000),
    price_7d: optionalInt(1, 1000000),
    price_30d: optionalInt(1, 10000000),
    all_models: checkbox,
    active: checkbox,
  })
  .superRefine((v, ctx) => {
    if (v.price_kind === "rental" && v.price_rental === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["price_rental"],
        ...err("priceRequired"),
      });
    }
    if (v.price_kind === "time" && v.price_1d === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["price_1d"],
        ...err("dayOneRequired"),
      });
    }
  })
  .transform((v) =>
    v.price_kind === "rental"
      ? {
          ...v,
          price_1d: null,
          price_7d: null,
          price_30d: null,
          price_rental: v.price_rental!,
        }
      : {
          ...v,
          price_rental: null,
          price_1d: v.price_1d!,
          price_7d: v.price_7d ?? null,
          price_30d: v.price_30d ?? null,
        },
  );

// Catalog ------------------------------------------------------------------

const catalogBase = {
  make: requiredText(1, 40),
  model: requiredText(1, 60),
  generation: text(40),
  year_from: optionalInt(1950, 2100),
  year_to: optionalInt(1950, 2100),
  cc: int(50, 2500),
  type: z.enum(
    ["city_scooter", "touring", "adventure", "sport", "classic", "off_road"],
    err("invalid"),
  ),
  transmission: z.enum(["automatic", "semi_auto", "manual"], err("invalid")),
};

const yearsInOrder = <T extends { year_from?: number; year_to?: number }>(
  v: T,
) =>
  v.year_from === undefined ||
  v.year_to === undefined ||
  v.year_to >= v.year_from;

export const catalogRequestSchema = z
  .object({ ...catalogBase, request_note: text(500) })
  .refine(yearsInOrder, { ...err("endAfterStart"), path: ["year_to"] });

const triState = z.preprocess(
  (v) => (v === "yes" ? true : v === "no" ? false : null),
  z.boolean().nullable(),
);

export const catalogEntrySchema = z
  .object({
    ...catalogBase,
    abs: triState,
    underseat_storage: triState,
    usb_charger: triState,
    key_type: z.preprocess(
      blank,
      z.enum(["keyless", "keyed"], err("invalid")).optional(),
    ),
    description: text(1000),
    slug: z.preprocess(
      blank,
      z
        .string()
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, err("invalid"))
        .max(120, err("tooLong"))
        .optional(),
    ),
  })
  .refine(yearsInOrder, { ...err("endAfterStart"), path: ["year_to"] });

// Helpers ------------------------------------------------------------------------

/** First error key per field from a failed zod parse. */
export function fieldErrors(
  error: z.ZodError,
): Partial<Record<string, ErrorKey>> {
  const out: Partial<Record<string, ErrorKey>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    out[field] ??= (issue.message as ErrorKey) || "invalid";
  }
  return out;
}

/** FormData → plain object (first value per key). */
export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !(key in out)) out[key] = value;
  }
  return out;
}
