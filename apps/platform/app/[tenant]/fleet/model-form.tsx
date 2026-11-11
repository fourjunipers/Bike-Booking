"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxInput,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/action-form";
import { saveModel } from "./actions";

export type ModelFormValues = {
  id?: string;
  name: string;
  catalog_id: string;
  description: string;
  bookable_online: boolean;
  buffer_before_minutes: string;
  buffer_after_minutes: string;
  deposit: string;
  min_age: string;
  licence_class: string;
  instant_units: string;
  request_units: string;
  ready_now: string;
};

/** Add or edit a model (SPEC › Fleet). Booking modes show once the model exists. */
export function ModelForm({
  slug,
  currency,
  values,
  catalogOptions,
  requestHref,
}: {
  slug: string;
  currency: string;
  values: ModelFormValues;
  catalogOptions: { value: string; label: string }[];
  requestHref: string;
}) {
  const t = useTranslations("Fleet.model");
  return (
    <ActionForm
      action={saveModel}
      hidden={{ slug, ...(values.id ? { id: values.id } : {}) }}
      className="max-w-3xl"
    >
      <TextInput
        name="name"
        label={t("name")}
        help={t("nameHelp")}
        required
        maxLength={120}
        defaultValue={values.name}
      />
      <div>
        <SelectInput
          name="catalog_id"
          label={t("catalog")}
          help={t("catalogHelp")}
          required
          defaultValue={values.catalog_id}
          options={[{ value: "", label: "—" }, ...catalogOptions]}
        />
        <Link
          href={requestHref}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline"
        >
          {t("catalogMissing")}
        </Link>
      </div>
      <TextArea
        name="description"
        label={t("description")}
        maxLength={2000}
        defaultValue={values.description}
      />
      <CheckboxInput
        name="bookable_online"
        label={t("bookableOnline")}
        defaultChecked={values.bookable_online}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <TextInput
          name="buffer_before_minutes"
          label={t("bufferBefore")}
          inputMode="numeric"
          defaultValue={values.buffer_before_minutes}
        />
        <TextInput
          name="buffer_after_minutes"
          label={t("bufferAfter")}
          help={t("bufferHelp")}
          inputMode="numeric"
          defaultValue={values.buffer_after_minutes}
        />
        <TextInput
          name="deposit"
          label={t("deposit", { currency })}
          help={t("depositHelp")}
          inputMode="decimal"
          defaultValue={values.deposit}
        />
        <TextInput
          name="min_age"
          label={t("minAge")}
          inputMode="numeric"
          defaultValue={values.min_age}
        />
        <TextInput
          name="licence_class"
          label={t("licenceClass")}
          maxLength={60}
          defaultValue={values.licence_class}
        />
      </div>
      {values.id && (
        <fieldset className="space-y-3 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">{t("modes")}</legend>
          <p className="text-sm text-muted-foreground">{t("modesHelp")}</p>
          <div className="grid gap-5 md:grid-cols-3">
            <TextInput
              name="instant_units"
              label={t("instantUnits")}
              inputMode="numeric"
              defaultValue={values.instant_units}
            />
            <TextInput
              name="request_units"
              label={t("requestUnits")}
              inputMode="numeric"
              defaultValue={values.request_units}
            />
            <TextInput
              name="ready_now"
              label={t("readyNow")}
              inputMode="numeric"
              defaultValue={values.ready_now}
            />
          </div>
        </fieldset>
      )}
      <p className="text-sm text-muted-foreground">{t("photosLater")}</p>
    </ActionForm>
  );
}
