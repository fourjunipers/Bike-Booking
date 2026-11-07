"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/forms";

/**
 * Dashboard forms. Submits with startTransition instead of the form `action`
 * prop so React doesn't reset the fields after a failed save; every field
 * reads its error from context and shows it translated, linked by
 * aria-describedby (CLAUDE.md accessibility rules).
 *
 * A settings page is one form with one Save button (owner request,
 * 2026-11-06): `sticky` keeps the Save bar at the bottom of the screen and
 * `warnUnsaved` asks before leaving with unsaved edits.
 */

type FormContextValue = {
  errors: Partial<Record<string, string>>;
  /** For changes that aren't typing, e.g. a photo added or a −/+ tap. */
  markDirty: () => void;
};
const FormContext = createContext<FormContextValue>({
  errors: {},
  markDirty: () => {},
});

/** Input look without a width, for inputs that set their own (e.g. w-16). */
export const inputBase =
  "block h-11 rounded-md border border-input bg-card px-3 aria-invalid:border-destructive";
export const inputClass = `${inputBase} w-full`;
export const textareaClass =
  "block min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 aria-invalid:border-destructive";

export function ActionForm({
  action,
  children,
  submitLabel,
  className = "space-y-5",
  confirm,
  onSaved,
  sticky = false,
  warnUnsaved = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  /** Renders after a save that returned a notice (e.g. an invite link). */
  onSaved?: (notice: string) => React.ReactNode;
  submitLabel?: string;
  className?: string;
  /** Asks before submitting (e.g. deleting). */
  confirm?: string;
  /** Keeps the Save bar stuck to the bottom of the screen. */
  sticky?: boolean;
  /** Asks before leaving the page with unsaved edits. */
  warnUnsaved?: boolean;
}) {
  const t = useTranslations("Common");
  const [state, dispatch, pending] = useActionState(action, { status: "idle" });
  const errors = state.status === "invalid" ? state.errors : {};
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);

  // A successful save clears the unsaved flag.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "saved") setDirty(false);
  }

  useUnsavedWarning(warnUnsaved && dirty, t("leaveConfirm"));

  return (
    <FormContext.Provider value={{ errors, markDirty }}>
      <form
        className={className}
        noValidate
        onInput={markDirty}
        onChange={markDirty}
        onSubmit={(event) => {
          event.preventDefault();
          if (confirm && !window.confirm(confirm)) return;
          const formData = new FormData(event.currentTarget);
          startTransition(() => dispatch(formData));
        }}
      >
        {children}
        <div
          className={
            sticky
              ? "sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t bg-card/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur md:mx-0 md:rounded-lg md:border"
              : "flex flex-wrap items-center gap-3"
          }
        >
          <Button
            type="submit"
            size="lg"
            className="h-11 px-6"
            disabled={pending}
          >
            {pending ? t("saving") : (submitLabel ?? t("save"))}
          </Button>
          <p role="status" aria-live="polite" className="text-sm">
            {warnUnsaved && dirty && !pending && state.status !== "invalid" && (
              <span className="font-medium text-amber-700">{t("unsaved")}</span>
            )}
            {state.status === "saved" && !state.notice && !dirty && t("saved")}
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

/** Marks the surrounding form as changed (for edits that aren't typing). */
export function useMarkDirty(): () => void {
  return useContext(FormContext).markDirty;
}

/**
 * While `active`, asks before the page is closed or reloaded, and before an
 * in-app link is followed. (The browser's own Back button can't be stopped.)
 */
function useUnsavedWarning(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank")
        return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, message]);
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
  id,
  title,
  description,
  children,
}: {
  /** Anchor for links from the setup checklist, e.g. "hours". */
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="space-y-1 border-b bg-section px-4 py-3 md:px-6">
        <h2 className="text-lg font-semibold text-section-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-4 p-4 md:p-6">{children}</div>
    </section>
  );
}
