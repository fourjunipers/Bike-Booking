"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import type { TenantSettings } from "@/lib/tenant-settings";
import { saveSettings, type SettingsState } from "./actions";

type Options = {
  countries: { code: string; name: string }[];
  currencies: { code: string; name: string }[];
  timeZones: string[];
};

/** Common locale tags offered as suggestions; any valid BCP 47 tag is accepted. */
const localeSuggestions = [
  "en",
  "en-GB",
  "en-US",
  "th-TH",
  "vi-VN",
  "ja-JP",
  "id-ID",
  "ms-MY",
  "zh-CN",
  "ko-KR",
];

export function SettingsForm({
  slug,
  initial,
  options,
}: {
  slug: string;
  initial: TenantSettings;
  options: Options;
}) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveSettings,
    {},
  );
  const error = (field: string) => {
    const key = state.errors?.[field];
    return key ? t(`errors.${key}`) : undefined;
  };
  const invalid = (field: string) => (state.errors?.[field] ? true : undefined);

  return (
    <form
      action={action}
      className="max-w-3xl space-y-5 rounded-lg border bg-card p-5"
    >
      <input type="hidden" name="slug" value={slug} />
      <Field id="name" label={t("name")} error={error("name")}>
        <input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={initial.name}
          aria-invalid={invalid("name")}
          className={inputClass}
        />
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="country" label={t("country")} error={error("country")}>
          <select
            id="country"
            name="country"
            defaultValue={initial.country}
            aria-invalid={invalid("country")}
            className={inputClass}
          >
            {options.countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </Field>
        <Field id="currency" label={t("currency")} error={error("currency")}>
          <select
            id="currency"
            name="currency"
            defaultValue={initial.currency}
            aria-invalid={invalid("currency")}
            className={inputClass}
          >
            {options.currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="timezone" label={t("timezone")} error={error("timezone")}>
          <select
            id="timezone"
            name="timezone"
            defaultValue={initial.timezone}
            aria-invalid={invalid("timezone")}
            className={inputClass}
          >
            {options.timeZones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="locale"
          label={t("locale")}
          help={t("localeHelp")}
          error={error("locale")}
        >
          <input
            id="locale"
            name="locale"
            required
            list="locale-suggestions"
            defaultValue={initial.locale}
            aria-invalid={invalid("locale")}
            aria-describedby="locale-help"
            autoComplete="off"
            className={inputClass}
          />
          <datalist id="locale-suggestions">
            {localeSuggestions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11 px-6" disabled={pending}>
          {tCommon(pending ? "saving" : "save")}
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
  );
}
