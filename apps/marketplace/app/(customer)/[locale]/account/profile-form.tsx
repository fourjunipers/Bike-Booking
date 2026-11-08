"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateProfile, type ProfileFormState } from "./actions";

type Props = {
  name: string;
  email: string;
  whatsapp: string;
  notify: "email" | "email_whatsapp";
};

const inputClass = "block h-11 w-full rounded-md border bg-background px-3";

export function ProfileForm(profile: Props) {
  const t = useTranslations("Account");
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(
    updateProfile,
    { status: "idle" },
  );
  const errors = state.status === "invalid" ? state.errors : {};
  // After a submit, show what was submitted (React resets the form fields).
  const values = ("values" in state && state.values) || profile;
  // Validation errors are message keys (lib/validation/profile.ts).
  const message = (key?: string) =>
    key ? (t.has(key) ? t(key) : key) : undefined;

  return (
    <form action={action} className="space-y-5" noValidate>
      <Field id="name" label={t("name")} error={message(errors.name)}>
        <input
          id="name"
          name="name"
          autoComplete="name"
          defaultValue={values.name}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          className={inputClass}
        />
      </Field>

      <Field id="email" label={t("email")}>
        <input
          id="email"
          value={profile.email}
          readOnly
          className={`${inputClass} text-muted-foreground`}
        />
      </Field>

      <Field
        id="whatsapp"
        label={t("whatsapp")}
        hint={t("whatsappHint")}
        error={message(errors.whatsapp)}
      >
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          autoComplete="tel"
          defaultValue={values.whatsapp}
          aria-invalid={!!errors.whatsapp}
          aria-describedby={
            errors.whatsapp ? "whatsapp-error" : "whatsapp-hint"
          }
          className={inputClass}
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("updates")}</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="notify"
            value="email"
            defaultChecked={values.notify !== "email_whatsapp"}
          />
          {t("emailOnly")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="notify"
            value="email_whatsapp"
            defaultChecked={values.notify === "email_whatsapp"}
          />
          {t("emailWhatsapp")}
        </label>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" className="h-11" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
        <p role="status" className="text-sm">
          {state.status === "saved" && t("saved")}
          {state.status === "error" && t("saveFailed")}
        </p>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
