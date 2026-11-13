"use client";

import { useState, type ReactNode } from "react";
import { useFieldError } from "@/components/action-form";
import { Field, inputClass } from "@/components/form";

export type ModelOption = {
  value: string;
  label: string;
  make: string;
  /** Shown as a group heading inside the second dropdown, e.g. "Your models". */
  group?: string;
};

/**
 * Two linked dropdowns (owner, 11 Nov 2026): make first, then the models of
 * that make. Used wherever a model is chosen: adding a vehicle or a make & model,
 * the fleet filters and the sticker list. Native selects, so they work with a
 * finger, a mouse or a keyboard. Without JavaScript the second dropdown lists
 * every model, grouped by make.
 */
export function MakeModelPicker({
  makeName,
  modelName,
  makeLabel,
  modelLabel,
  models,
  defaultMake = "",
  defaultModel = "",
  anyLabel,
  required,
  error,
  help,
  footer,
  onModelChange,
}: {
  /** Field name for the make; leave out when the form doesn't need it. */
  makeName?: string;
  modelName: string;
  makeLabel: string;
  modelLabel: string;
  models: ModelOption[];
  defaultMake?: string;
  defaultModel?: string;
  /** With a label, both dropdowns get an "any" choice (filters). */
  anyLabel?: string;
  required?: boolean;
  error?: string;
  help?: string;
  footer?: ReactNode;
  /** Called with the model's value whenever the choice changes. */
  onModelChange?: (value: string) => void;
}) {
  // A product may have no make (it is created with a name only).
  const makes = [...new Set(models.map((m) => m.make))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const startMake =
    defaultMake || models.find((m) => m.value === defaultModel)?.make || "";
  const [make, setMake] = useState(startMake);
  const [model, setModelState] = useState(defaultModel);
  const setModel = (value: string) => {
    setModelState(value);
    onModelChange?.(value);
  };
  const offered = make ? models.filter((m) => m.make === make) : models;
  const groups = [...new Set(offered.map((m) => m.group ?? ""))];
  const makeId = `${modelName}-make`;
  // Inside an ActionForm, the server's error for this field shows here.
  const formError = useFieldError(modelName);
  error ??= formError;

  return (
    <>
      <Field id={makeId} label={makeLabel}>
        <select
          id={makeId}
          name={makeName}
          value={make}
          // Only where every choice has a make: one without can't be reached
          // through this dropdown, and is chosen from the second one directly.
          required={required && models.every((m) => m.make)}
          onChange={(event) => {
            const next = event.target.value;
            setMake(next);
            // Keep the model only if it belongs to the new make.
            const kept = models.find((m) => m.value === model);
            const only = models.filter((m) => m.make === next);
            setModel(
              kept && (!next || kept.make === next)
                ? model
                : !anyLabel && only.length === 1
                  ? only[0].value
                  : "",
            );
          }}
          className={inputClass}
        >
          <option value="">{anyLabel ?? "—"}</option>
          {makes.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <div>
        <Field id={modelName} label={modelLabel} help={help} error={error}>
          <select
            id={modelName}
            name={modelName}
            value={model}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={help ? `${modelName}-help` : undefined}
            onChange={(event) => {
              const next = event.target.value;
              setModel(next);
              const picked = models.find((m) => m.value === next);
              if (picked && !make) setMake(picked.make);
            }}
            className={inputClass}
          >
            <option value="">{anyLabel ?? "—"}</option>
            {groups.map((group) => {
              const options = offered
                .filter((m) => (m.group ?? "") === group)
                .map((m) => (
                  <option key={m.value} value={m.value}>
                    {make || !m.make ? m.label : `${m.make}: ${m.label}`}
                  </option>
                ));
              return group ? (
                <optgroup key={group} label={group}>
                  {options}
                </optgroup>
              ) : (
                options
              );
            })}
          </select>
        </Field>
        {footer}
      </div>
    </>
  );
}
