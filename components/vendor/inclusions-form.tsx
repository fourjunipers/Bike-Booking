"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxField,
  CheckboxGroup,
  FormSection,
  NumberField,
  SelectField,
  TextAreaField,
} from "@/components/form-kit";
import type { ActionState } from "@/lib/forms";
import {
  DEPOSIT_METHODS,
  GEAR_OPTIONS,
  HELMET_TYPES,
  LICENCE_TYPES,
  PASSPORT_POLICIES,
  USAGE_AREAS,
  type InclusionOverrides,
  type Inclusions,
} from "@/lib/inclusions";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * "What's included", deposit and documents. In "shop" mode every field has a
 * value (the shop defaults). In "model" mode each field starts on "Shop
 * default (…)" and only changed fields are stored as overrides.
 */
export function InclusionsForm({
  mode,
  action,
  shop,
  overrides,
  depositAmount,
}: {
  mode: "shop" | "model";
  action: Action;
  shop: Inclusions;
  overrides?: InclusionOverrides | null;
  /** Shop mode: the shop's default deposit. */
  depositAmount?: number | null;
}) {
  const t = useTranslations("Included");
  const te = useTranslations("Enums");
  const model = mode === "model";
  const o = overrides ?? {};

  const yesNo = (v: boolean) => (v ? t("yes") : t("no"));
  /** Options for a select; in model mode prefixed with "Shop default (…)". */
  const opts = (
    values: readonly string[],
    label: (v: string) => string,
    shopValue: string | null,
  ) => [
    ...(model
      ? [
          {
            value: "",
            label: t("shopDefault", {
              value: shopValue ? label(shopValue) : t("notSet"),
            }),
          },
        ]
      : []),
    ...values.map((v) => ({ value: v, label: label(v) })),
  ];
  const triOpts = (shopValue: boolean) => [
    { value: "", label: t("shopDefault", { value: yesNo(shopValue) }) },
    { value: "yes", label: t("yes") },
    { value: "no", label: t("no") },
  ];
  const triDefault = (v: boolean | null | undefined) =>
    v === true ? "yes" : v === false ? "no" : "";

  const bool = (
    name:
      | "phone_holder"
      | "usb_charger"
      | "top_box"
      | "side_panniers"
      | "medical_cover"
      | "experience_required",
  ) =>
    model ? (
      <SelectField
        key={name}
        name={name}
        label={t(name)}
        options={triOpts(shop[name])}
        defaultValue={triDefault(o[name])}
      />
    ) : (
      <CheckboxField
        key={name}
        name={name}
        label={t(name)}
        defaultChecked={shop[name]}
      />
    );

  const gear = (name: "gloves" | "jacket" | "rain_gear") => (
    <SelectField
      key={name}
      name={name}
      label={t(name)}
      options={opts(GEAR_OPTIONS, (v) => te(`gear.${v}`), shop[name])}
      defaultValue={model ? (o[name] ?? "") : shop[name]}
    />
  );

  const num = (
    name: "helmets" | "km_limit" | "deposit_refund_days" | "min_age",
    hint?: string,
  ) => (
    <NumberField
      key={name}
      name={name}
      label={t(name)}
      hint={
        model
          ? t("blankForDefault", { value: shop[name] ?? t("notSet") })
          : hint
      }
      defaultValue={model ? (o[name] ?? null) : shop[name]}
    />
  );

  return (
    <ActionForm action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <FormSection title={t("helmetsSection")}>
          {num("helmets")}
          <ArrayOverride
            enabled={model}
            name="helmet_types"
            legend={t("helmet_types")}
            options={HELMET_TYPES.map((v) => ({
              value: v,
              label: te(`helmet.${v}`),
            }))}
            shopValues={shop.helmet_types}
            values={o.helmet_types ?? null}
          />
        </FormSection>

        <FormSection title={t("gear")}>
          {gear("gloves")}
          {gear("jacket")}
          {gear("rain_gear")}
        </FormSection>

        <FormSection title={t("setup")}>
          {bool("phone_holder")}
          {bool("usb_charger")}
          {bool("top_box")}
          {bool("side_panniers")}
        </FormSection>

        <FormSection title={t("usage")}>
          <SelectField
            name="usage_area"
            label={t("usage_area")}
            options={opts(
              USAGE_AREAS,
              (v) => te(`usage.${v}`),
              shop.usage_area,
            )}
            defaultValue={model ? (o.usage_area ?? "") : shop.usage_area}
          />
          {num("km_limit", t("kmHint"))}
        </FormSection>

        <FormSection title={t("insurance")} description={t("thirdPartyAlways")}>
          {bool("medical_cover")}
          <p className="text-sm">
            {t("damageCoverNote")}{" "}
            <Link
              href="/vendor/extras"
              className="underline underline-offset-4"
            >
              {t("damageCoverLink")}
            </Link>
          </p>
        </FormSection>

        <FormSection title={t("deposit")}>
          {!model && (
            <NumberField
              name="deposit_amount"
              label={t("depositAmount")}
              hint={t("depositAmountHint")}
              defaultValue={depositAmount ?? null}
            />
          )}
          {model && (
            <p className="text-sm text-muted-foreground">
              {t("depositAmountOnModel")}
            </p>
          )}
          <ArrayOverride
            enabled={model}
            name="deposit_methods"
            legend={t("deposit_methods")}
            options={DEPOSIT_METHODS.map((v) => ({
              value: v,
              label: te(`deposit.${v}`),
            }))}
            shopValues={shop.deposit_methods}
            values={o.deposit_methods ?? null}
          />
          <SelectField
            name="passport"
            label={t("passport")}
            options={opts(
              PASSPORT_POLICIES,
              (v) => te(`passport.${v}`),
              shop.passport,
            )}
            defaultValue={model ? (o.passport ?? "") : shop.passport}
          />
          {num("deposit_refund_days", t("refundHint"))}
        </FormSection>

        <FormSection title={t("documents")}>
          <SelectField
            name="licence_required"
            label={t("licence_required")}
            options={opts(
              LICENCE_TYPES,
              (v) => te(`licence.${v}`),
              shop.licence_required,
            )}
            defaultValue={
              model ? (o.licence_required ?? "") : shop.licence_required
            }
          />
          {num("min_age")}
          {bool("experience_required")}
        </FormSection>

        <FormSection title={t("notes")}>
          <TextAreaField
            name="notes"
            label={t("notes")}
            hint={model ? t("notesModelHint") : t("notesHint")}
            defaultValue={model ? (o.notes ?? null) : shop.notes}
          />
        </FormSection>
      </div>
    </ActionForm>
  );
}

/** Checkbox group; in model mode behind an "override" switch. */
function ArrayOverride({
  enabled,
  name,
  legend,
  options,
  shopValues,
  values,
}: {
  enabled: boolean;
  name: "helmet_types" | "deposit_methods";
  legend: string;
  options: { value: string; label: string }[];
  shopValues: readonly string[];
  values: readonly string[] | null;
}) {
  const t = useTranslations("Included");
  const [on, setOn] = useState(values !== null);
  if (!enabled) {
    return (
      <CheckboxGroup
        name={name}
        legend={legend}
        options={options}
        defaultValues={shopValues}
      />
    );
  }
  const shopLabel =
    shopValues.length > 0
      ? options
          .filter((o) => shopValues.includes(o.value))
          .map((o) => o.label)
          .join(", ")
      : t("notSet");
  return (
    <div className="space-y-2">
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          name={`override_${name}`}
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="size-5"
        />
        {t("overrideField", { field: legend, value: shopLabel })}
      </label>
      {on && (
        <CheckboxGroup
          name={name}
          legend={legend}
          options={options}
          defaultValues={values ?? shopValues}
        />
      )}
    </div>
  );
}
