"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Lightbulb } from "lucide-react";
import {
  SelectInput,
  TextInput,
  useFieldError,
} from "@/components/action-form";
import { kindIcons } from "@/components/fleet/kind-icon";
import {
  MakeModelPicker,
  type ModelOption,
} from "@/components/fleet/make-model-picker";
import { Button } from "@/components/ui/button";
import { needsEngineSize, needsTransmission, transmissions } from "@/lib/fleet";
import { cn } from "@/lib/utils";
import {
  categoriesFor,
  categoryRequired,
  humanizeKey,
  kindTypes,
} from "@/lib/vehicle-kinds";

/** Outlined in Moto Mangos leaf green; 44 px tall. AA: see globals.css. */
const leafButton =
  "h-11 border-leaf bg-card px-4 text-leaf hover:bg-leaf-soft hover:text-leaf dark:border-leaf dark:bg-card dark:hover:bg-leaf-soft";

export type WhatValues = {
  vehicle_type: string;
  /** A list (catalog) entry's id; blank for a make and model typed in. */
  catalog_id: string;
  make: string;
  model: string;
  cc: string;
  transmission: string;
  /** Keys from lib/vehicle-kinds; a model can have several. */
  categories: string[];
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
  showTip,
}: {
  values: WhatValues;
  /** The Moto Mangos list: make, then model. */
  listOptions: ModelOption[];
  /** How the list files each entry (entry id to motorbike category). */
  listTypes: Record<string, string>;
  /** Makes on the list, offered as suggestions when typing one in. */
  makes: string[];
  /** The Moto Mangos tip: on the add form only (the model page has its own panel). */
  showTip?: boolean;
}) {
  const t = useTranslations("Fleet.what");
  const tFleet = useTranslations("Fleet");
  const [kind, setKind] = useState(values.vehicle_type || "motorbike");
  // A motorbike starts on the list unless it was typed in before.
  const [typed, setTyped] = useState(!values.catalog_id && values.make !== "");
  const [chosen, setChosen] = useState(values.categories);

  const fromList = kind === "motorbike" && !typed;
  const chooseKind = (next: string) => {
    setKind(next);
    // A category belongs to its kind.
    setChosen((keys) => keys.filter((k) => categoriesFor(next).includes(k)));
  };
  // Beside the make and model, motorbikes only (Moto Mangos lists motorbikes).
  const tip = showTip && kind === "motorbike" && (
    <aside
      aria-label={t("tip.label")}
      className="flex items-start gap-3 rounded-lg border border-primary/25 bg-accent p-3 text-sm text-accent-foreground md:col-span-2"
    >
      <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0" />
      <p>
        <strong className="font-semibold">{t("tip.label")}:</strong>{" "}
        {t(fromList ? "tip.fromList" : "tip.typed")}
      </p>
    </aside>
  );

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
            models={listOptions}
            defaultModel={values.catalog_id}
            required
            onModelChange={(id) => {
              // Filed the way the list files it, until the shop says otherwise.
              if (listTypes[id]) setChosen([listTypes[id]]);
            }}
            footer={
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-sm text-muted-foreground">
                  {t("notInList")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTyped(true)}
                  className={leafButton}
                >
                  {t("typeIt")}
                </Button>
              </div>
            }
          />
          {tip}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setTyped(false)}
                className={cn("mt-3", leafButton)}
              >
                {t("useList")}
              </Button>
            )}
          </div>
          {tip}
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

      <CategoryChips kind={kind} chosen={chosen} onChange={setChosen} />
    </div>
  );
}

/**
 * A kind's categories as chips to tick: a model can have several ("Adventure"
 * and "Touring"). Real checkboxes, so they work with a keyboard and a screen
 * reader; each chip is 44 px tall.
 */
function CategoryChips({
  kind,
  chosen,
  onChange,
}: {
  kind: string;
  chosen: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("Fleet.what");
  const categoryLabel = useCategoryLabel();
  const error = useFieldError("category");
  const categories = categoriesFor(kind);
  if (categories.length === 0) return null;
  return (
    <fieldset
      aria-describedby={
        error ? "category-help category-error" : "category-help"
      }
    >
      <legend className="mb-1 block text-sm font-medium">
        {t("category")}
      </legend>
      <p id="category-help" className="mb-2 text-xs text-muted-foreground">
        {t(categoryRequired(kind) ? "categoryHelp" : "categoryOptional")}
      </p>
      <div className="flex flex-wrap gap-2">
        {categories.map((key) => {
          const on = chosen.includes(key);
          return (
            <label
              key={key}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background",
                on
                  ? "border-primary bg-primary/5 text-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <input
                type="checkbox"
                name="category"
                value={key}
                checked={on}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...chosen, key]
                      : chosen.filter((k) => k !== key),
                  )
                }
                className="sr-only"
              />
              {on && <Check aria-hidden className="size-4 shrink-0" />}
              {categoryLabel(key)}
            </label>
          );
        })}
      </div>
      {error && (
        <p
          id="category-error"
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** The categories alone, for a model whose make and model can't be edited now. */
export function CategoryField({
  kind,
  defaultValue,
}: {
  kind: string;
  defaultValue: string[];
}) {
  const [chosen, setChosen] = useState(defaultValue);
  return <CategoryChips kind={kind} chosen={chosen} onChange={setChosen} />;
}
