/**
 * The "make and model" type-ahead on the new-product form (owner, 13 Nov
 * 2026): one field. As the owner types, known models are suggested; picking
 * one fills in make, model, engine size and transmission. If the model isn't
 * known, the owner keeps typing in the same field and the form asks for the
 * rest. Pure functions here, so they can be tested without a browser.
 */

export type KnownModel = {
  /** The list entry's id. */
  id: string;
  /** "Honda PCX 160 (2021–2024)". */
  label: string;
  make: string;
  model: string;
  cc: number | null;
  transmission: "automatic" | "semi_auto" | "manual" | null;
  /** How the list files it: one of the motorbike categories. */
  type: string;
};

type Entry = {
  id: string;
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
  cc: number | null;
  transmission: KnownModel["transmission"];
  type: string;
};

function years(entry: Entry): string {
  if (entry.year_from && entry.year_to && entry.year_to !== entry.year_from)
    return ` (${entry.year_from}–${entry.year_to})`;
  return entry.year_from ? ` (${entry.year_from})` : "";
}

/** The approved list entries, as the type-ahead offers them. */
export function knownModels(catalog: Entry[]): KnownModel[] {
  return catalog.map((entry) => ({
    id: entry.id,
    label: `${entry.make} ${entry.model}${years(entry)}`,
    make: entry.make,
    model: entry.model,
    cc: entry.cc,
    transmission: entry.transmission,
    type: entry.type,
  }));
}

/** Lower case, no accents, one space between words. */
function plain(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Too little typed to guess from. */
export const suggestFrom = 2;

/**
 * Known models matching what has been typed so far: every typed word must
 * appear somewhere in the label ("pcx hon" finds "Honda PCX 160"). Models
 * whose label starts with the text come first, then by label.
 */
export function suggestKnown(
  text: string,
  known: KnownModel[],
  limit = 8,
): KnownModel[] {
  const typed = plain(text);
  if (typed.length < suggestFrom) return [];
  const words = typed.split(" ");
  // Ignoring spaces too, so "pcx160" finds "PCX 160".
  const squeezed = typed.replace(/ /g, "");
  return known
    .map((model) => {
      const label = plain(model.label);
      const hit =
        words.every((word) => label.includes(word)) ||
        label.replace(/ /g, "").includes(squeezed);
      return { model, label, hit };
    })
    .filter((row) => row.hit)
    .sort(
      (a, b) =>
        Number(b.label.startsWith(typed)) - Number(a.label.startsWith(typed)) ||
        a.label.localeCompare(b.label),
    )
    .slice(0, limit)
    .map((row) => row.model);
}

/**
 * A typed "make and model" split into its two parts: the first word is the
 * make, the rest is the model ("Royal Enfield Classic" needs a hand, which is
 * why the form shows both parts to check). A make from the list that the
 * text starts with wins over the first word.
 */
export function splitMakeModel(
  text: string,
  makes: string[] = [],
): { make: string; model: string } {
  const typed = text.replace(/\s+/g, " ").trim();
  if (!typed) return { make: "", model: "" };
  const known = makes
    .filter((make) => plain(typed).startsWith(plain(make) + " "))
    .sort((a, b) => b.length - a.length)[0];
  if (known) return { make: known, model: typed.slice(known.length).trim() };
  const space = typed.indexOf(" ");
  return space === -1
    ? { make: typed, model: "" }
    : { make: typed.slice(0, space), model: typed.slice(space + 1) };
}
