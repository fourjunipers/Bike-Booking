"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bike, Car, Mountain, Sailboat, Shapes } from "lucide-react";
import {
  SelectInput,
  TextInput,
  useFieldError,
} from "@/components/action-form";
import { MotoMangosMark } from "@/components/brand/moto-mangos-mark";
import {
  MakeModelPicker,
  type ModelOption,
} from "@/components/fleet/make-model-picker";
import { Field, inputClass } from "@/components/form";
import { needsEngineSize, needsTransmission, transmissions } from "@/lib/fleet";
import { cn } from "@/lib/utils";
import {
  categoriesFor,
  categoryRequired,
  humanizeKey,
  kindTypes,
  type VehicleKind,
} from "@/lib/vehicle-kinds";

const kindIcons: Record<VehicleKind, typeof Bike> = {
  motorbike: Bike,
  car: Car,
  atv: Mountain,
  boat: Sailboat,
  other: Shapes,
};

export type WhatValues = {
  vehicle_type: string;
  /** A list (catalog) entry's id; blank for a make and model typed in. */
  catalog_id: string;
  make: string;
  model: string;
  cc: string;
  transmission: string;
  category: string;
};

/** A category's label, or its key made readable when it has no label yet. */
export function useCategoryLabel() {
  const t = useTranslations("Fleet");
  return (key: string) =>
    t.has(`category.${key}` as "category.sedan")
      ? t(`category.${key}` as "category.sedan")
      : humanizeKey(key);
}

/**
 * What a make & model is (owner, 12 Nov 2026). The kind of vehicle comes
 * first and the rest of the form follows it:
 * - a motorbike is picked from the Moto Mangos list, or typed in;
 * - anything else is typed in;
 * - each kind has its own categories (lib/vehicle-kinds.ts).
 */
export function WhatFields({
  values,
  listOptions,
  listTypes,
  makes,
  showCard,
}: {
  values: WhatValues;
  /** The Moto Mangos list: make, then model. */
  listOptions: ModelOption[];
  /** How the list files each entry (entry id to motorbike category). */
  listTypes: Record<string, string>;
  /** Makes on the list, offered as suggestions when typing one in. */
  makes: string[];
  /** The Moto Mangos card: on the add form only (the model page has its own). */
  showCard?: boolean;
}) {
  const t = useTranslations("Fleet.what");
  const tFleet = useTranslations("Fleet");
  const categoryLabel = useCategoryLabel();
  const [kind, setKind] = useState(values.vehicle_type || "motorbike");
  // A motorbike starts on the list unless it was typed in before.
  const [typed, setTyped] = useState(!values.catalog_id && values.make !== "");
  const [entry, setEntry] = useState(values.catalog_id);
  const [category, setCategory] = useState(values.category);
  const categoryError = useFieldError("category");

  const fromList = kind === "motorbike" && !typed;
  const categories = categoriesFor(kind);
  const chooseKind = (next: string) => {
    setKind(next);
    // A category belongs to its kind.
    if (!categoriesFor(next).includes(category)) setCategory("");
  };

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 block text-sm font-medium">
          {t("kindLegend")}
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {kindTypes.map((type) => {
            const Icon = kindIcons[type];
            return (
              <label
                key={type}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                  kind === type
                    ? "border-primary bg-primary/5 text-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <input
                  type="radio"
                  name="vehicle_type"
                  value={type}
                  checked={kind === type}
                  onChange={() => chooseKind(type)}
                  className="sr-only"
                />
                <Icon aria-hidden className="size-5 shrink-0" />
                {tFleet(`kind.${type}`)}
              </label>
            );
          })}
        </div>
      </fieldset>

      {fromList ? (
        <div className="grid gap-5 md:grid-cols-2">
          <MakeModelPicker
            modelName="catalog_id"
            makeLabel={t("make")}
            modelLabel={t("model")}
            help={t("listHelp")}
            models={listOptions}
            defaultModel={values.catalog_id}
            required
            onModelChange={(id) => {
              setEntry(id);
              // Filed the way the list files it, until the shop says otherwise.
              if (listTypes[id]) setCategory(listTypes[id]);
            }}
            footer={
              <button
                type="button"
                onClick={() => setTyped(true)}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline"
              >
                {t("typeIt")}
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <TextInput
              name="make"
              label={t("make")}
              help={t("makeHelp")}
              required
              maxLength={40}
              list="known-makes"
              defaultValue={values.make}
            />
            <datalist id="known-makes">
              {makes.map((make) => (
                <option key={make} value={make} />
              ))}
            </datalist>
          </div>
          <div>
            <TextInput
              name="model"
              label={t("model")}
              required
              maxLength={60}
              defaultValue={values.model}
            />
            {kind === "motorbike" && (
              <button
                type="button"
                onClick={() => setTyped(false)}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline"
              >
                {t("useList")}
              </button>
            )}
          </div>
          <TextInput
            name="cc"
            label={t("cc")}
            help={needsEngineSize(kind) ? undefined : t("optional")}
            required={needsEngineSize(kind)}
            inputMode="numeric"
            maxLength={5}
            defaultValue={values.cc}
          />
          <SelectInput
            name="transmission"
            label={t("transmission")}
            help={needsTransmission(kind) ? undefined : t("optional")}
            required={needsTransmission(kind)}
            defaultValue={values.transmission}
            options={[
              { value: "", label: "—" },
              ...transmissions.map((value) => ({
                value,
                label: tFleet(`transmission.${value}`),
              })),
            ]}
          />
        </div>
      )}

      {categories.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            id="category"
            label={t("category")}
            help={t(
              categoryRequired(kind) ? "categoryHelp" : "categoryOptional",
            )}
            error={categoryError}
          >
            <select
              id="category"
              name="category"
              value={category}
              required={categoryRequired(kind)}
              aria-invalid={categoryError ? true : undefined}
              aria-describedby="category-help"
              onChange={(event) => setCategory(event.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {categories.map((key) => (
                <option key={key} value={key}>
                  {categoryLabel(key)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {showCard && kind === "motorbike" && (
        <aside
          aria-label="Moto Mangos"
          className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4"
        >
          <MotoMangosMark className="size-10 shrink-0" />
          <div className="min-w-0 text-sm">
            <p className="font-medium">Moto Mangos</p>
            <p className="text-muted-foreground">{t("card.intro")}</p>
            <p className="mt-2">
              {t(
                fromList && entry
                  ? "card.onList"
                  : fromList
                    ? "card.pick"
                    : "card.notOnList",
              )}
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}

/** The category alone, for a model whose make and model can't be edited now. */
export function CategoryField({
  kind,
  defaultValue,
}: {
  kind: string;
  defaultValue: string;
}) {
  const t = useTranslations("Fleet.what");
  const categoryLabel = useCategoryLabel();
  const categories = categoriesFor(kind);
  if (categories.length === 0) return null;
  return (
    <SelectInput
      name="category"
      label={t("category")}
      help={t(categoryRequired(kind) ? "categoryHelp" : "categoryOptional")}
      required={categoryRequired(kind)}
      defaultValue={defaultValue}
      options={[
        { value: "", label: "—" },
        ...categories.map((key) => ({ value: key, label: categoryLabel(key) })),
      ]}
    />
  );
}
