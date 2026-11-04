"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useId,
} from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/forms";

/**
 * Dashboard forms. Submits with startTransition instead of the form `action`
 * prop so React doesn't reset the fields after a failed save; every field
 * reads its error from context and shows it translated, linked by
 * aria-describedby (CLAUDE.md accessibility rules).
 */

type FormContextValue = { errors: Partial<Record<string, string>> };
const FormContext = createContext<FormContextValue>({ errors: {} });

export const inputClass =
  "block h-11 w-full rounded-md border bg-background px-3 aria-invalid:border-destructive";
export const textareaClass =
  "block min-h-24 w-full rounded-md border bg-background px-3 py-2 aria-invalid:border-destructive";

export function ActionForm({
  action,
  children,
  submitLabel,
  className = "space-y-5",
  confirm,
  onSaved,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  /** Renders after a save that returned a notice (e.g. an invite link). */
  onSaved?: (notice: string) => React.ReactNode;
  submitLabel?: string;
  className?: string;
  /** Asks before submitting (e.g. deleting). */
  confirm?: string;
}) {
  const t = useTranslations("Common");
  const [state, dispatch, pending] = useActionState(action, { status: "idle" });
  const errors = state.status === "invalid" ? state.errors : {};

  return (
    <FormContext.Provider value={{ errors }}>
      <form
        className={className}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (confirm && !window.confirm(confirm)) return;
          const formData = new FormData(event.currentTarget);
          startTransition(() => dispatch(formData));
        }}
      >
        {children}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" className="h-11" disabled={pending}>
            {pending ? t("saving") : (submitLabel ?? t("save"))}
          </Button>
          <p role="status" aria-live="polite" className="text-sm">
            {state.status === "saved" && !state.notice && t("saved")}
            {state.status === "invalid" && (
              <span className="text-destructive">
                {errors.form ? (
                  <ErrorText code={errors.form} />
                ) : (
                  t("fixErrors")
                )}
              </span>
            )}
            {state.status === "error" && (
              <span className="text-destructive">
                {state.notice ? (
                  <ErrorText code={state.notice} />
                ) : (
                  t("saveFailed")
                )}
              </span>
            )}
          </p>
        </div>
        {state.status === "saved" && state.notice && onSaved?.(state.notice)}
      </form>
    </FormContext.Provider>
  );
}

export function useFieldError(name: string): string | undefined {
  return useContext(FormContext).errors[name];
}

function ErrorText({ code }: { code: string }) {
  const t = useTranslations("Errors");
  return <>{t.has(code) ? t(code) : t("invalid")}</>;
}

/** Label, control, hint and error for one field. */
export function Field({
  name,
  label,
  hint,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  children: (props: {
    id: string;
    name: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}) {
  const id = useId();
  const error = useFieldError(name);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        name,
        "aria-invalid": !!error,
        "aria-describedby": describedBy,
      })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          <ErrorText code={error} />
        </p>
      )}
    </div>
  );
}

export function TextField({
  name,
  label,
  hint,
  defaultValue,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | number | null;
  type?: "text" | "email" | "tel" | "url" | "number" | "date" | "time";
  inputMode?: "numeric" | "decimal" | "tel" | "email" | "url" | "text";
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <Field name={name} label={label} hint={hint}>
      {(props) => (
        <input
          {...props}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          defaultValue={defaultValue ?? ""}
          className={inputClass}
        />
      )}
    </Field>
  );
}

export function NumberField(props: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: number | null;
  placeholder?: string;
}) {
  return <TextField {...props} inputMode="numeric" />;
}

export function TextAreaField({
  name,
  label,
  hint,
  defaultValue,
  rows = 4,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
  rows?: number;
}) {
  return (
    <Field name={name} label={label} hint={hint}>
      {(props) => (
        <textarea
          {...props}
          rows={rows}
          defaultValue={defaultValue ?? ""}
          className={textareaClass}
        />
      )}
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
}) {
  return (
    <Field name={name} label={label} hint={hint}>
      {(props) => (
        <select
          {...props}
          defaultValue={defaultValue ?? ""}
          className={inputClass}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex min-h-11 items-center gap-3">
        <input
          id={id}
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          aria-invalid={!!error}
          className="size-5"
        />
        <span>{label}</span>
      </label>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-sm text-destructive">
          <ErrorText code={error} />
        </p>
      )}
    </div>
  );
}

/** Several checkboxes sharing one name (FormData.getAll). */
export function CheckboxGroup({
  name,
  legend,
  options,
  defaultValues,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  defaultValues: readonly string[];
}) {
  const error = useFieldError(name);
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-5">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={defaultValues.includes(o.value)}
              className="size-5"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && (
        <p className="text-sm text-destructive">
          <ErrorText code={error} />
        </p>
      )}
    </fieldset>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border p-4 md:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
