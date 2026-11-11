"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  useActionState,
  startTransition,
  useContext,
  useId,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Field, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What a server action returns to its form: field errors as message keys of
 * "FormErrors" (the key "form" is the whole-form error), or ok.
 */
export type FormState = { ok?: boolean; errors?: Record<string, string> };

export type FormAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;

const FormContext = createContext<{
  error: (field: string) => string | undefined;
  pending: boolean;
}>({ error: () => undefined, pending: false });

/**
 * A form bound to a server action: shows each field's error under it, a
 * "Saved" note, and a submit button that says it's working. Native inputs
 * throughout, so it works with a finger, a mouse or a keyboard.
 */
export function ActionForm({
  action,
  hidden,
  submitLabel,
  pendingLabel,
  confirm,
  destructive,
  className,
  children,
}: {
  action: FormAction;
  /** Hidden fields, e.g. the shop slug and the row id. */
  hidden?: Record<string, string>;
  submitLabel?: string;
  pendingLabel?: string;
  /** Ask before submitting (deletes, sales). */
  confirm?: string;
  destructive?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("FormErrors");
  const tCommon = useTranslations("Common");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const error = (field: string) => {
    const key = state.errors?.[field];
    if (!key) return undefined;
    // Keys come from the server, so they are checked at run time.
    const known = key as "saveFailed";
    return t.has(known) ? t(known) : t("saveFailed");
  };

  return (
    <FormContext.Provider value={{ error, pending }}>
      <form
        action={formAction}
        className={cn("space-y-5", className)}
        onSubmit={(event) => {
          // Submitted by hand rather than left to the browser, so the fields
          // keep what was typed when the server sends back an error. (Without
          // JavaScript the plain form action above still works.)
          event.preventDefault();
          if (confirm && !window.confirm(confirm)) return;
          const data = new FormData(
            event.currentTarget,
            (event.nativeEvent as SubmitEvent).submitter,
          );
          startTransition(() => formAction(data));
        }}
      >
        {Object.entries(hidden ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {children}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant={destructive ? "outline" : "default"}
            className={cn(
              "h-11 px-6",
              destructive && "border-destructive/40 text-destructive",
            )}
            disabled={pending}
          >
            {pending
              ? (pendingLabel ?? tCommon("saving"))
              : (submitLabel ?? tCommon("save"))}
          </Button>
          {state.ok && !pending && (
            <p role="status" className="text-sm text-muted-foreground">
              {tCommon("saved")}
            </p>
          )}
          {state.errors?.form && (
            <p role="alert" className="text-sm text-destructive">
              {error("form")}
            </p>
          )}
        </div>
      </form>
    </FormContext.Provider>
  );
}

type Labelled = { name: string; label: string; help?: string };

/** A labelled input wired to the form's errors. */
export function TextInput({
  name,
  label,
  help,
  className,
  ...props
}: Labelled & Omit<ComponentProps<"input">, "name" | "id">) {
  const { error } = useContext(FormContext);
  const message = error(name);
  return (
    <Field id={name} label={label} help={help} error={message}>
      <input
        id={name}
        name={name}
        aria-invalid={message ? true : undefined}
        aria-describedby={help ? `${name}-help` : undefined}
        autoComplete="off"
        className={cn(inputClass, className)}
        {...props}
      />
    </Field>
  );
}

export function TextArea({
  name,
  label,
  help,
  ...props
}: Labelled & Omit<ComponentProps<"textarea">, "name" | "id">) {
  const { error } = useContext(FormContext);
  const message = error(name);
  return (
    <Field id={name} label={label} help={help} error={message}>
      <textarea
        id={name}
        name={name}
        rows={3}
        aria-invalid={message ? true : undefined}
        className={cn(inputClass, "h-auto py-2")}
        {...props}
      />
    </Field>
  );
}

export function SelectInput({
  name,
  label,
  help,
  options,
  ...props
}: Labelled & {
  options: { value: string; label: string }[];
} & Omit<ComponentProps<"select">, "name" | "id">) {
  const { error } = useContext(FormContext);
  const message = error(name);
  return (
    <Field id={name} label={label} help={help} error={message}>
      <select
        id={name}
        name={name}
        aria-invalid={message ? true : undefined}
        aria-describedby={help ? `${name}-help` : undefined}
        className={inputClass}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** A checkbox with a 44 px tap target. */
export function CheckboxInput({
  name,
  label,
  help,
  ...props
}: Labelled & Omit<ComponentProps<"input">, "name" | "id" | "type">) {
  const { error } = useContext(FormContext);
  const message = error(name);
  return (
    <div className="space-y-1">
      <label
        htmlFor={name}
        className="flex min-h-11 items-center gap-3 text-sm font-medium"
      >
        <input
          id={name}
          name={name}
          type="checkbox"
          className="size-5 accent-primary"
          {...props}
        />
        {label}
      </label>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

/** A white panel with a heading, for one group of fields or one list. */
export function Panel({
  title,
  intro,
  children,
  className,
}: {
  title?: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cn("rounded-lg border bg-card p-4 sm:p-5", className)}
    >
      {title && (
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
      )}
      {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
      <div className={cn((title || intro) && "mt-4")}>{children}</div>
    </section>
  );
}
