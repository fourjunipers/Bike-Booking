"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxInput,
  TextArea,
  TextInput,
} from "@/components/action-form";
import {
  MakeModelPicker,
  type ModelOption,
} from "@/components/fleet/make-model-picker";
import { addYearBand, deleteYearBand, saveModel } from "./actions";
import { OwnModelFields } from "./own-model/request-form";

export type OwnValues = {
  make: string;
  model: string;
  vehicle_type: string;
  cc: string;
  transmission: string;
};

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
  own,
  waiting,
  makes = [],
}: {
  slug: string;
  currency: string;
  values: ModelFormValues;
  catalogOptions: ModelOption[];
  requestHref: string;
  /** One of the shop's own models: its make, model and specs are edited here. */
  own?: OwnValues;
  /** Sent to Moto Mangos and not yet reviewed: its description stays as it is. */
  waiting?: boolean;
  makes?: string[];
}) {
  const t = useTranslations("Fleet.model");
  return (
    <ActionForm
      action={saveModel}
      hidden={{
        slug,
        ...(values.id ? { id: values.id } : {}),
        ...(waiting ? { waiting: "1" } : {}),
      }}
      className="max-w-3xl"
    >
      {waiting ? null : own ? (
        <OwnModelFields makes={makes} values={own} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <MakeModelPicker
            modelName="catalog_id"
            makeLabel={t("make")}
            modelLabel={t("catalog")}
            help={t("catalogHelp")}
            models={catalogOptions}
            defaultModel={values.catalog_id}
            required
            footer={
              <Link
                href={requestHref}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline"
              >
                {t("catalogMissing")}
              </Link>
            }
          />
        </div>
      )}
      <TextInput
        name="name"
        label={t("name")}
        help={t("nameHelp")}
        required
        maxLength={120}
        defaultValue={values.name}
      />
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

/** Add one year band to a model, e.g. 2020 to 2023. */
export function YearBandForm({ slug, id }: { slug: string; id: string }) {
  const t = useTranslations("Fleet.bands");
  return (
    <ActionForm
      action={addYearBand}
      hidden={{ slug, id }}
      submitLabel={t("add")}
    >
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          name="year_from"
          label={t("from")}
          inputMode="numeric"
          maxLength={4}
          required
        />
        <TextInput
          name="year_to"
          label={t("to")}
          inputMode="numeric"
          maxLength={4}
          required
        />
      </div>
    </ActionForm>
  );
}

export function DeleteYearBandButton({
  slug,
  band,
  label,
}: {
  slug: string;
  band: string;
  label: string;
}) {
  return (
    <ActionForm
      action={deleteYearBand}
      hidden={{ slug, band }}
      submitLabel={label}
      destructive
      className="space-y-1"
    />
  );
}
