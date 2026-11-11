import type { ModelOption } from "@/components/fleet/make-model-picker";

/**
 * Choices for the linked make and model dropdowns (owner, 11 Nov 2026).
 * Makes and models come from the shared catalog; a shop adds its own through a
 * catalog request, which it can use straight away.
 */

type Entry = {
  id: string;
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
  status: string;
};

/** "PCX 160 (2026)" / "CB500X (2019–2021)": a catalog entry without its make. */
export function entryLabel(entry: Entry, pendingLabel?: string): string {
  const years =
    entry.year_from && entry.year_to && entry.year_to !== entry.year_from
      ? ` (${entry.year_from}–${entry.year_to})`
      : entry.year_from
        ? ` (${entry.year_from})`
        : "";
  const pending =
    entry.status === "requested" && pendingLabel ? ` · ${pendingLabel}` : "";
  return `${entry.model}${years}${pending}`;
}

/** Catalog entries, for choosing what a model is. Values are catalog ids. */
export function catalogOptions(
  catalog: Entry[],
  pendingLabel: string,
): ModelOption[] {
  return catalog.map((entry) => ({
    value: entry.id,
    make: entry.make,
    label: entryLabel(entry, pendingLabel),
  }));
}

/**
 * For a bike: the shop's own models first, then catalog entries it has no
 * model for yet (choosing one creates the model). Values are "model:<id>" or
 * "catalog:<id>" (lib/fleet parseModelChoice).
 */
export function bikeModelOptions(
  models: { id: string; name: string; catalog?: Entry }[],
  catalog: Entry[],
  labels: { yours: string; catalog: string; pending: string },
): ModelOption[] {
  const used = new Set(models.map((m) => m.catalog?.id));
  return [
    ...models.map((model) => ({
      value: `model:${model.id}`,
      make: model.catalog?.make ?? "",
      label: model.name,
      group: labels.yours,
    })),
    ...catalog
      .filter((entry) => !used.has(entry.id))
      .map((entry) => ({
        value: `catalog:${entry.id}`,
        make: entry.make,
        label: entryLabel(entry, labels.pending),
        group: labels.catalog,
      })),
  ];
}

/** For filters: the shop's models only. Values are model ids. */
export function shopModelOptions(
  models: { id: string; name: string; catalog?: Entry }[],
): ModelOption[] {
  return models.map((model) => ({
    value: model.id,
    make: model.catalog?.make ?? "",
    label: model.name,
  }));
}
