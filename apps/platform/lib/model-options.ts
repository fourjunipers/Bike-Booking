import type { ModelOption } from "@/components/fleet/make-model-picker";

/**
 * Choices for the linked make and model dropdowns (owner, 11 Nov 2026).
 * "+ Make & model" offers the Moto Mangos list (motorbikes); everything else
 * offers the makes & models the shop already has.
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
  pendingLabel?: string,
): ModelOption[] {
  return catalog.map((entry) => ({
    value: entry.id,
    make: entry.make,
    label: entryLabel(entry, pendingLabel),
  }));
}

/** A shop's model, with what it is (from the list or typed in). */
type ShopModel = {
  id: string;
  name: string;
  catalog: { id: string | null; make: string };
};

/**
 * For a vehicle: the shop's own makes & models, and nothing else. Adding to
 * the inventory never creates one (owner, 12 Nov 2026). Values are
 * "model:<id>" (lib/fleet parseModelChoice).
 */
export function inventoryModelOptions(models: ShopModel[]): ModelOption[] {
  return models.map((model) => ({
    value: `model:${model.id}`,
    make: model.catalog?.make ?? "",
    label: model.name,
  }));
}

/** For filters: the shop's models only. Values are model ids. */
export function shopModelOptions(models: ShopModel[]): ModelOption[] {
  return models.map((model) => ({
    value: model.id,
    make: model.catalog?.make ?? "",
    label: model.name,
  }));
}
