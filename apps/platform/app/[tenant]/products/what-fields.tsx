"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Lightbulb } from "lucide-react";
import {
  SelectInput,
  TextInput,
  useFieldError,
} from "@/components/action-form";
import { kindIcons } from "@/components/fleet/kind-icon";
import { Field, inputClass } from "@/components/form";
import { needsEngineSize, needsTransmission, transmissions } from "@/lib/fleet";
import {
  splitMakeModel,
  suggestKnown,
  type KnownModel,
} from "@/lib/known-models";
import { cn } from "@/lib/utils";
import {
  categoriesFor,
  categoryRequired,
  humanizeKey,
  kindTypes,
} from "@/lib/vehicle-kinds";

export type WhatValues = {
  vehicle_type: string;
  /** A known model's (list entry's) id; blank for a make and model typed in. */
  catalog_id: string;
  make: string;
  model: string;
  cc: string;
  transmission: string;
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
 * What a vehicle product is. The kind of vehicle comes first; then ONE
 * "make and model" field (owner, 13 Nov 2026):
 * - typing suggests known models (motorbikes: the same list Moto Mangos
 *   uses); picking one fills in make, model, engine size and transmission;
 * - if the model isn't known, the owner keeps typing in the same field and
 *   the form asks for what it could not fill in.
 * There is no second path and no button to switch between two forms.
 */
export function WhatFields({
  values,
  known,
  showTip,
}: {
  values: WhatValues;
  /** Known models, offered as suggestions. */
  known: KnownModel[];
  /** The Moto Mangos tip: on the add form only (the product page has its own panel). */
  showTip?: boolean;
}) {
  const t = useTranslations("Fleet.what");
  const tFleet = useTranslations("Fleet");
  const [kind, setKind] = useState(values.vehicle_type || "motorbike");
  const [chosen, setChosen] = useState(values.categories);
  const [picked, setPicked] = useState<KnownModel | null>(
    () => known.find((model) => model.id === values.catalog_id) ?? null,
  );

  const chooseKind = (next: string) => {
    setKind(next);
    // A category belongs to its kind, and so does a known model.
    setChosen((keys) => keys.filter((k) => categoriesFor(next).includes(k)));
    if (next !== "motorbike") setPicked(null);
  };
  // Under the make and model, motorbikes only (Moto Mangos lists motorbikes).
  const tip = showTip && kind === "motorbike" && (
    <aside
      aria-label={t("tip.label")}
      className="flex items-start gap-3 rounded-lg border border-primary/25 bg-accent p-3 text-sm text-accent-foreground"
    >
      <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0" />
      <p>
        <strong className="font-semibold">{t("tip.label")}:</strong>{" "}
        {t(picked ? "tip.fromList" : "tip.typed")}
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

      <MakeModelField
        kind={kind}
        values={values}
        // Known models are motorbikes; other kinds are always typed in.
        known={kind === "motorbike" ? known : []}
        picked={picked}
        onPick={(model) => {
          setPicked(model);
          // Filed the way the list files it, until the shop says otherwise.
          if (model && categoriesFor(kind).includes(model.type))
            setChosen([model.type]);
        }}
      />
      {tip}

      <CategoryChips kind={kind} chosen={chosen} onChange={setChosen} />
    </div>
  );
}

/**
 * The one "make and model" field: a text box with suggestions under it (the
 * ARIA combobox pattern: arrow keys move, Enter picks, Escape closes). The
 * server reads `catalog_id` when a known model was picked, and `make`,
 * `model`, `cc` and `transmission` otherwise.
 */
function MakeModelField({
  kind,
  values,
  known,
  picked,
  onPick,
}: {
  kind: string;
  values: WhatValues;
  known: KnownModel[];
  picked: KnownModel | null;
  onPick: (model: KnownModel | null) => void;
}) {
  const t = useTranslations("Fleet.what");
  const tFleet = useTranslations("Fleet");
  const listId = useId();
  const [text, setText] = useState(
    picked?.label ?? [values.make, values.model].filter(Boolean).join(" "),
  );
  // The two parts follow the text until the owner corrects one by hand.
  const [make, setMake] = useState<string | null>(values.make || null);
  const [model, setModel] = useState<string | null>(values.model || null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const catalogError = useFieldError("catalog_id");

  const suggestions = picked ? [] : suggestKnown(text, known);
  const showList = open && suggestions.length > 0;
  const split = splitMakeModel(text, [...new Set(known.map((m) => m.make))]);
  const typed = !picked && text.trim() !== "";

  const pick = (choice: KnownModel) => {
    onPick(choice);
    setText(choice.label);
    setMake(null);
    setModel(null);
    setOpen(false);
  };

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="relative md:col-span-2">
        <Field
          id="make_model"
          label={t("makeModel")}
          help={t(known.length > 0 ? "makeModelHelp" : "makeModelHelpTyped")}
          error={catalogError}
        >
          <input
            id="make_model"
            name="make_model"
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${listId}-${active}` : undefined}
            aria-describedby="make_model-help"
            aria-invalid={catalogError ? true : undefined}
            autoComplete="off"
            required
            maxLength={100}
            value={text}
            placeholder={t("makeModelPlaceholder")}
            onChange={(event) => {
              setText(event.target.value);
              // Typing on means "not that one": the choice is dropped.
              if (picked) onPick(null);
              setMake(null);
              setModel(null);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            // After a click on a suggestion has had time to land.
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(event) => {
              if (!showList) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => (i + 1) % suggestions.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive(
                  (i) => (i - 1 + suggestions.length) % suggestions.length,
                );
              } else if (event.key === "Enter") {
                // Picks the suggestion; it does not send the form.
                event.preventDefault();
                pick(suggestions[active]);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            className={inputClass}
          />
        </Field>
        <ul
          id={listId}
          role="listbox"
          aria-label={t("suggestions")}
          hidden={!showList}
          className="absolute inset-x-0 z-20 mt-1 max-h-72 overflow-auto rounded-md border bg-card py-1 shadow-lg"
        >
          {suggestions.map((choice, index) => (
            <li
              key={choice.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // Before the input's blur, so the click isn't lost.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(choice);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 px-3 py-2 text-sm",
                index === active && "bg-accent text-accent-foreground",
              )}
            >
              <span className="font-medium">{choice.label}</span>
              <span className="text-muted-foreground">
                {[
                  choice.cc ? `${choice.cc} cc` : null,
                  choice.transmission
                    ? tFleet(`transmission.${choice.transmission}`)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {picked ? (
        // A known model: everything below is filled in from the list.
        <div className="md:col-span-2">
          <input type="hidden" name="catalog_id" value={picked.id} />
          <dl
            aria-label={t("filled")}
            className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border bg-muted/40 p-3 text-sm sm:grid-cols-4"
          >
            {(
              [
                ["make", picked.make],
                ["model", picked.model],
                ["cc", picked.cc ? `${picked.cc} cc` : "—"],
                [
                  "transmission",
                  picked.transmission
                    ? tFleet(`transmission.${picked.transmission}`)
                    : "—",
                ],
              ] as const
            ).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">{t(key)}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("filledHelp")}
          </p>
        </div>
      ) : (
        typed && (
          // Not a known model (yet): the same text, split into its parts to
          // check, and the details the list would have filled in.
          <>
            {known.length > 0 && (
              <p
                role="status"
                className="text-sm text-muted-foreground md:col-span-2"
              >
                {t("notKnown")}
              </p>
            )}
            <TextInput
              name="make"
              label={t("make")}
              help={t("makeHelp")}
              required
              maxLength={40}
              value={make ?? split.make}
              onChange={(event) => setMake(event.target.value)}
            />
            <TextInput
              name="model"
              label={t("model")}
              required
              maxLength={60}
              value={model ?? split.model}
              onChange={(event) => setModel(event.target.value)}
            />
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
          </>
        )
      )}
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
