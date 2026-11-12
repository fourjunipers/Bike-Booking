/**
 * The kinds of vehicle a shop can keep, and the categories within each kind
 * (owner, 12 Nov 2026). THE ONE LIST: change kinds' categories here and
 * nowhere else. No migration is needed (the database only checks that a
 * category is a lower-case key).
 *
 * To add or rename a category:
 *   1. Edit `categories` below. Keys are lower-case with underscores.
 *   2. Add its label under "Fleet.category" in messages/en.json and th.json.
 *      Without a label the key itself is shown ("jet_ski" as "Jet ski").
 * Removing a key leaves models that have it with a category the form no
 * longer offers; they keep it until edited.
 *
 * `type` is the database's vehicle type (public.vehicle_types). The label a
 * person sees is under "Fleet.kind" in the messages: "atv" reads "Off-road".
 *
 * Motorbike categories are the same keys Moto Mangos files a bike under
 * (public.bike_type), so a model's category is what is sent with it.
 */
export const vehicleKinds = [
  {
    type: "motorbike",
    categoryRequired: true,
    categories: [
      "city_scooter",
      "touring",
      "adventure",
      "sport",
      "classic",
      "off_road",
    ],
  },
  {
    type: "car",
    categoryRequired: true,
    categories: ["sedan", "suv", "pickup", "van", "hatchback", "convertible"],
  },
  { type: "atv", categoryRequired: false, categories: ["atv", "utv"] },
  {
    type: "boat",
    categoryRequired: false,
    categories: ["jet_ski", "speedboat", "pontoon"],
  },
  { type: "other", categoryRequired: false, categories: [] },
] as const satisfies readonly {
  type: string;
  categoryRequired: boolean;
  categories: readonly string[];
}[];

export type VehicleKind = (typeof vehicleKinds)[number]["type"];

export const kindTypes = vehicleKinds.map((kind) => kind.type) as [
  VehicleKind,
  ...VehicleKind[],
];

export function kindOf(type: string) {
  return vehicleKinds.find((kind) => kind.type === type);
}

/** The categories offered for a kind of vehicle; none for an unknown kind. */
export function categoriesFor(type: string): readonly string[] {
  return kindOf(type)?.categories ?? [];
}

export function categoryRequired(type: string): boolean {
  return kindOf(type)?.categoryRequired ?? false;
}

/**
 * Checks a category typed or chosen for a kind. Blank is "none".
 * Returns the category to store, or the error key for the form.
 */
export function checkCategory(
  type: string,
  value: unknown,
): { category: string | null } | { error: "required" | "invalidCategory" } {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text)
    return categoryRequired(type) ? { error: "required" } : { category: null };
  return categoriesFor(type).includes(text)
    ? { category: text }
    : { error: "invalidCategory" };
}

/** "jet_ski" as "Jet ski": the fallback when a category has no label yet. */
export function humanizeKey(key: string): string {
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A category as typed in a CSV file ("Jet ski", "SUV", "off-road"): its key,
 * or null when the kind has no such category.
 */
export function categoryFromText(type: string, text: string): string | null {
  const key = text
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!key) return null;
  const list = categoriesFor(type);
  // "scooter" is how people say Moto Mangos' "city scooter".
  if (type === "motorbike" && key === "scooter") return "city_scooter";
  return list.includes(key) ? key : null;
}

/** How long a "Moto Mangos added it" note stays on the dashboard and fleet list. */
export const reviewNewsDays = 14;

export type ReviewNews = "added" | "notAdded" | null;

/**
 * What to tell the shop about a model's last Moto Mangos review: "not added"
 * for as long as the rejection stands (until it is sent again or put on an
 * entry), "added" for two weeks after the approval.
 */
export function reviewNews(
  model: {
    catalog_rejected_at: string | null;
    catalog_approved_at: string | null;
  },
  now: Date,
): ReviewNews {
  if (model.catalog_rejected_at) return "notAdded";
  if (
    model.catalog_approved_at &&
    now.getTime() - Date.parse(model.catalog_approved_at) <
      reviewNewsDays * 86_400_000
  )
    return "added";
  return null;
}
