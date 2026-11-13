/**
 * Choices for the dropdowns that pick a product or a Moto Mangos list entry.
 * A product is known by its name alone on the platform (owner, 13 Nov 2026:
 * no make or model anywhere but the Moto Mangos review form), so every list
 * of products is one dropdown, A to Z by name.
 */

export type Option = { value: string; label: string };

const byLabel = (a: Option, b: Option) =>
  a.label.localeCompare(b.label, undefined, { numeric: true });

type Entry = {
  id: string;
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
};

/** "Honda PCX 160 (2026)" / "Honda CB500X (2019–2021)": a Moto Mangos list entry. */
export function entryLabel(entry: Entry): string {
  const years =
    entry.year_from && entry.year_to && entry.year_to !== entry.year_from
      ? ` (${entry.year_from}–${entry.year_to})`
      : entry.year_from
        ? ` (${entry.year_from})`
        : "";
  return `${entry.make} ${entry.model}${years}`;
}

/**
 * The Moto Mangos list, for "Select your make and model from the list" on a
 * product's Moto Mangos panel. Values are list entry ids.
 */
export function catalogOptions(catalog: Entry[]): Option[] {
  return catalog
    .map((entry) => ({ value: entry.id, label: entryLabel(entry) }))
    .sort(byLabel);
}

type ShopProduct = { id: string; name: string; retired_at?: string | null };

/**
 * For a vehicle: the shop's own products, and nothing else. Values are
 * "model:<id>" (lib/fleet parseModelChoice).
 */
export function inventoryModelOptions(products: ShopProduct[]): Option[] {
  return products
    .map((product) => ({ value: `model:${product.id}`, label: product.name }))
    .sort(byLabel);
}

/**
 * For filters: the shop's products in use. A retired product is left out
 * (owner, 13 Nov 2026). Values are product ids.
 */
export function shopModelOptions(products: ShopProduct[]): Option[] {
  return products
    .filter((product) => !product.retired_at)
    .map((product) => ({ value: product.id, label: product.name }))
    .sort(byLabel);
}
