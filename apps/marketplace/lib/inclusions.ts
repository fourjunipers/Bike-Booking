/**
 * "What's included", deposit and documents (SPEC "Vendor onboarding and shop
 * setup"). The shop sets defaults (shop_policies); any bike model can override
 * any field (bike_model_policies, null = shop default). The deposit amount
 * override lives on bike_models.deposit_amount.
 */

import type { Database } from "@mango/db/database.types";

type Enums = Database["public"]["Enums"];
type ShopPolicies = Database["public"]["Tables"]["shop_policies"]["Row"];

export const INCLUSION_FIELDS = [
  "helmets",
  "helmet_types",
  "gloves",
  "jacket",
  "rain_gear",
  "phone_holder",
  "usb_charger",
  "top_box",
  "side_panniers",
  "usage_area",
  "km_limit",
  "medical_cover",
  "deposit_methods",
  "passport",
  "licence_required",
  "min_age",
  "experience_required",
  "notes",
] as const satisfies readonly (keyof ShopPolicies)[];

export type InclusionField = (typeof INCLUSION_FIELDS)[number];

/** The shop defaults: every field has a value (null where the column allows). */
export type Inclusions = Pick<ShopPolicies, InclusionField>;

/** A model's overrides: null or missing = use the shop default. */
export type InclusionOverrides = {
  [K in InclusionField]?: Inclusions[K] | null;
};

export type EffectiveInclusions = Inclusions & {
  /** Fields where the model differs from the shop default. */
  overridden: InclusionField[];
};

export const GEAR_OPTIONS: Enums["gear_option"][] = [
  "included",
  "paid_extra",
  "not_offered",
];
export const HELMET_TYPES: Enums["helmet_type"][] = [
  "full_face",
  "three_quarter",
  "half",
];
export const USAGE_AREAS: Enums["usage_area"][] = [
  "bangkok",
  "province",
  "thailand",
  "cross_border",
];
export const DEPOSIT_METHODS: Enums["deposit_method"][] = [
  "cash",
  "card_authorisation",
  "bank_transfer",
];
export const PASSPORT_POLICIES: Enums["passport_policy"][] = [
  "copy_only",
  "held",
];
export const LICENCE_TYPES: Enums["licence_type"][] = [
  "none",
  "car",
  "motorbike",
  "international_permit",
];

/** Field groups as shown on model pages, shop listings and in the editors. */
export const INCLUSION_GROUPS: { group: string; fields: InclusionField[] }[] = [
  { group: "helmets", fields: ["helmets", "helmet_types"] },
  { group: "gear", fields: ["gloves", "jacket", "rain_gear"] },
  {
    group: "setup",
    fields: ["phone_holder", "usb_charger", "top_box", "side_panniers"],
  },
  { group: "usage", fields: ["usage_area", "km_limit"] },
  { group: "insurance", fields: ["medical_cover"] },
  {
    group: "deposit",
    fields: ["deposit_methods", "passport"],
  },
  {
    group: "documents",
    fields: ["licence_required", "min_age", "experience_required"],
  },
  { group: "notes", fields: ["notes"] },
];

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

/** Shop defaults with the model's overrides applied. */
export function effectiveInclusions(
  shop: Inclusions,
  overrides: InclusionOverrides | null | undefined,
): EffectiveInclusions {
  const result = { ...shop } as Inclusions;
  const overridden: InclusionField[] = [];
  for (const field of INCLUSION_FIELDS) {
    const value = overrides?.[field];
    if (value === null || value === undefined) continue;
    (result as Record<InclusionField, unknown>)[field] = value;
    if (!sameValue(value, shop[field])) overridden.push(field);
  }
  return { ...result, overridden };
}

/** The deposit shown for a model: its own amount, else the shop default. */
export function effectiveDeposit(
  shopDeposit: number | null,
  modelDeposit: number | null,
): number | null {
  return modelDeposit ?? shopDeposit;
}

/**
 * Overrides worth storing: drops fields equal to the shop default, so a model
 * keeps following the shop when the shop changes later.
 */
export function minimalOverrides(
  shop: Inclusions,
  overrides: InclusionOverrides,
): InclusionOverrides {
  const out: InclusionOverrides = {};
  for (const field of INCLUSION_FIELDS) {
    const value = overrides[field];
    if (value === null || value === undefined) continue;
    if (sameValue(value, shop[field])) continue;
    (out as Record<InclusionField, unknown>)[field] = value;
  }
  return out;
}
