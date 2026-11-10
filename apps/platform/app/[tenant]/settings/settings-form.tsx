"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import type { TenantSettings } from "@/lib/tenant-settings";
import { saveSettings, type SettingsState } from "./actions";

type Options = {
  countries: { code: string; name: string }[];
  currencies: { code: string; name: string }[];
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
  currencyLocked,
  locationsHref,
}: {
  slug: string;
  initial: TenantSettings;
  options: Options;
  /** Money has been saved in this currency, so it can no longer change. */
  currencyLocked: boolean;
  locationsHref: string;
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
        <Field
          id="currency"
          label={t("currency")}
          help={currencyLocked ? t("currencyLockedHelp") : undefined}
          error={error("currency")}
        >
          {/* A disabled select isn't submitted, so the value rides along. */}
          {currencyLocked && (
            <input type="hidden" name="currency" value={initial.currency} />
          )}
          <select
            id="currency"
            name={currencyLocked ? undefined : "currency"}
            disabled={currencyLocked}
            aria-describedby={currencyLocked ? "currency-help" : undefined}
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
        <Field
          id="distance_unit"
          label={t("distanceUnit")}
          help={t("distanceUnitHelp")}
          error={error("distance_unit")}
        >
          <select
            id="distance_unit"
            name="distance_unit"
            defaultValue={initial.distance_unit}
            aria-invalid={invalid("distance_unit")}
            aria-describedby="distance_unit-help"
            className={inputClass}
          >
            <option value="km">{t("km")}</option>
            <option value="mi">{t("mi")}</option>
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
      <p className="text-sm text-muted-foreground">
        {t.rich("timezoneMoved", {
          link: (chunks) => (
            <Link href={locationsHref} className="font-medium underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
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
