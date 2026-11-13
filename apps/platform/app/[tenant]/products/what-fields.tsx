"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, Lightbulb } from "lucide-react";
import { useFieldError } from "@/components/action-form";
import { kindIcons } from "@/components/fleet/kind-icon";
import { cn } from "@/lib/utils";
import {
  categoriesFor,
  categoryRequired,
  humanizeKey,
  kindTypes,
} from "@/lib/vehicle-kinds";

export type WhatValues = {
  vehicle_type: string;
  /** Keys from lib/vehicle-kinds; a product can have several. */
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
 * What kind of product it is, and its categories. The name is the form's own
 * field (owner, 13 Nov 2026: a product is a kind and a name; make, model,
 * engine size and transmission are asked for when it is sent to Moto Mangos).
 * `children` sits between the two: the name, on the product form.
 */
export function WhatFields({
  values,
  showTip,
  children,
}: {
  values: WhatValues;
  /** The Moto Mangos tip: on the add form only (the product page has its own panel). */
  showTip?: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations("Fleet.what");
  const tFleet = useTranslations("Fleet");
  const [kind, setKind] = useState(values.vehicle_type || "motorbike");
  const [chosen, setChosen] = useState(values.categories);
  const kindError = useFieldError("vehicle_type");

  const chooseKind = (next: string) => {
    setKind(next);
    // A category belongs to its kind.
    setChosen((keys) => keys.filter((k) => categoriesFor(next).includes(k)));
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
        {kindError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {kindError}
          </p>
        )}
      </fieldset>

      {children}

      {/* Motorbikes only: Moto Mangos lists motorbikes. */}
      {showTip && kind === "motorbike" && (
        <aside
          aria-label={t("tip.label")}
          className="flex items-start gap-3 rounded-lg border border-primary/25 bg-accent p-3 text-sm text-accent-foreground"
        >
          <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p>
            <strong className="font-semibold">{t("tip.label")}:</strong>{" "}
            {t("tip.text")}
          </p>
        </aside>
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
