/**
 * Matching a shop's own make and model to the catalog's presets (owner,
 * 11 Nov 2026). Used to stop a preset being added a second time under
 * another spelling, and to suggest "Did you mean Honda PCX 160?" when a shop
 * wants one of its own models on Moto Mangos.
 */

export type MatchEntry = {
  id: string;
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
};

/** Ignoring case and spacing, as the database does (platform_private.norm). */
export function normName(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

/** Letters and digits only: "PCX-160", "pcx 160" and "PCX160" are alike. */
const bare = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const tokens = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** The same make and model, ignoring case and spacing. */
export function sameMakeModel(
  a: { make: string; model: string },
  b: { make: string; model: string },
): boolean {
  return (
    normName(a.make) === normName(b.make) &&
    normName(a.model) === normName(b.model)
  );
}

/** How many single-character edits turn `a` into `b`. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = row;
  }
  return previous[b.length];
}

/** 0 to 1: how alike two names are. 1 = the same letters and digits. */
function likeness(a: string, b: string): number {
  const x = bare(a);
  const y = bare(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  // One written inside the other: "PCX" and "PCX 160".
  if (x.includes(y) || y.includes(x))
    return (
      0.6 + 0.3 * (Math.min(x.length, y.length) / Math.max(x.length, y.length))
    );
  // A typo or two: "Clikc 160".
  const distance = editDistance(x, y);
  const longest = Math.max(x.length, y.length);
  if (distance <= 2 && longest >= 4) return 0.85 - 0.1 * distance;
  // Shared words: "ADV 160 ABS" and "ADV 160".
  const tx = new Set(tokens(a));
  const ty = tokens(b);
  const shared = ty.filter((t) => tx.has(t)).length;
  return shared === 0 ? 0 : 0.5 * (shared / Math.max(tx.size, ty.length));
}

/**
 * The presets most like a make and model, best first. The make has to be
 * roughly right (the same, a typo away, or blank) for a model to be offered.
 */
export function suggestCatalog<T extends MatchEntry>(
  make: string,
  model: string,
  entries: readonly T[],
  limit = 3,
): T[] {
  const scored: { entry: T; score: number }[] = [];
  for (const entry of entries) {
    const makeScore = make.trim() ? likeness(make, entry.make) : 0.7;
    if (makeScore < 0.6) continue;
    const modelScore = likeness(model, entry.model);
    if (modelScore < 0.5) continue;
    scored.push({ entry, score: makeScore * 0.4 + modelScore * 0.6 });
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        // Newest generation first among equals.
        (b.entry.year_from ?? 0) - (a.entry.year_from ?? 0),
    )
    .slice(0, limit)
    .map((s) => s.entry);
}

/** Presets that are this make and model exactly (ignoring case and spacing). */
export function exactPresets<T extends MatchEntry>(
  make: string,
  model: string,
  entries: readonly T[],
): T[] {
  return entries.filter((entry) => sameMakeModel(entry, { make, model }));
}
