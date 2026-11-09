/**
 * Bike catalog helpers: display labels and the vendor's model search.
 */

export type CatalogEntryLabel = {
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
};

/** "2019–2022", "2026", or "" when no years are known. */
export function yearRange(from: number | null, to: number | null): string {
  if (from === null && to === null) return "";
  if (from === null) return String(to);
  if (to === null) return `${from}–`;
  return from === to ? String(from) : `${from}–${to}`;
}

/** "Honda Scoopy 2025–2026". */
export function catalogLabel(entry: CatalogEntryLabel): string {
  const name = `${entry.make} ${entry.model}`;
  const years = yearRange(entry.year_from, entry.year_to);
  return `${name}${years ? ` ${years}` : ""}`;
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Entries matching every word typed, in any order ("pcx honda", "click 160").
 * Words also match across make/model without spaces ("nmax", "cb500").
 */
export function searchCatalog<T extends CatalogEntryLabel & { cc: number }>(
  entries: readonly T[],
  query: string,
): T[] {
  const words = normalise(query).split(" ").filter(Boolean);
  if (words.length === 0) return [...entries];
  return entries.filter((entry) => {
    const text = normalise(`${catalogLabel(entry)} ${entry.cc}cc`);
    const squashed = text.replace(/ /g, "");
    return words.every((w) => text.includes(w) || squashed.includes(w));
  });
}
