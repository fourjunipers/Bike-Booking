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
 * Checks the categories ticked or typed for a kind. A model can have several
 * (owner, 12 Nov 2026: "Adventure and Touring"); none is fine unless the kind
 * requires one. Returns them without repeats, in the list's own order, or the
 * error key for the form.
 */
export function checkCategories(
  type: string,
  values: readonly unknown[],
): { categories: string[] } | { error: "required" | "invalidCategory" } {
  const chosen = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (chosen.length === 0)
    return categoryRequired(type) ? { error: "required" } : { categories: [] };
  const list = categoriesFor(type);
  if (chosen.some((key) => !list.includes(key)))
    return { error: "invalidCategory" };
  return { categories: list.filter((key) => chosen.includes(key)) };
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

/**
 * The category cell of a CSV file: one category, or several separated by a
 * semicolon ("adventure; touring"). Returns the keys without repeats, in the
 * list's own order; null when any of them isn't a category of the kind.
 */
export function categoriesFromText(
  type: string,
  text: string,
): string[] | null {
  const keys: string[] = [];
  for (const part of text.split(";")) {
    if (!part.trim()) continue;
    const key = categoryFromText(type, part);
    if (!key) return null;
    keys.push(key);
  }
  return categoriesFor(type).filter((key) => keys.includes(key));
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

/** Where a motorbike model stands with Moto Mangos, for the chip on the Fleet list. */
export type ListingStatus =
  "listed" | "inReview" | "needsChanges" | "notListed";

/**
 * - needsChanges: its last request was not added (until it is sent again or
 *   put on a list entry);
 * - inReview: sent, waiting for the reviewer;
 * - listed: on an approved entry and switched on;
 * - notListed: everything else.
 * Null for anything but a motorbike: Moto Mangos lists motorbikes only.
 */
export function listingStatus(
  model: {
    vehicle_type: string;
    marketplace_listed: boolean;
    catalog_rejected_at: string | null;
  },
  /** The status of the catalog entry the model is on, if any. */
  entryStatus: string | null,
): ListingStatus | null {
  if (model.vehicle_type !== "motorbike") return null;
  if (model.catalog_rejected_at) return "needsChanges";
  if (entryStatus === "requested") return "inReview";
  if (entryStatus === "approved" && model.marketplace_listed) return "listed";
  return "notListed";
}
