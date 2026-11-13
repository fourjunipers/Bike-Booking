"use client";

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
import {
  linkModelToPreset,
  setMarketplaceListed,
  submitModelToCatalog,
} from "./actions";

/** "Did you mean Honda PCX 160?": one button per close match. */
export function UsePresetButton({
  slug,
  id,
  catalogId,
  label,
}: {
  slug: string;
  id: string;
  catalogId: string;
  label: string;
}) {
  return (
    <ActionForm
      action={linkModelToPreset}
      hidden={{ slug, id, catalog_id: catalogId }}
      submitLabel={label}
      className="space-y-1"
    />
  );
}

/** No preset matches: send the model to the platform admin to add or merge. */
export function SubmitToCatalogForm({
  slug,
  id,
  again,
}: {
  slug: string;
  id: string;
  /** Its last request was turned down: this sends it for review again. */
  again?: boolean;
}) {
  const t = useTranslations("Fleet.motoMangos");
  return (
    <ActionForm
      action={submitModelToCatalog}
      hidden={{ slug, id }}
      submitLabel={t(again ? "submitAgain" : "submit")}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          name="year_from"
          label={t("yearFrom")}
          inputMode="numeric"
          maxLength={4}
        />
        <TextInput
          name="year_to"
          label={t("yearTo")}
          inputMode="numeric"
          maxLength={4}
        />
      </div>
      <TextArea name="note" label={t("note")} maxLength={500} />
    </ActionForm>
  );
}

/**
 * Any model from the Moto Mangos list, for a model of the shop's own: it
 * takes the list's make, model and specs and needs no review.
 */
export function ChoosePresetForm({
  slug,
  id,
  options,
}: {
  slug: string;
  id: string;
  options: ModelOption[];
}) {
  const t = useTranslations("Fleet");
  return (
    <ActionForm
      action={linkModelToPreset}
      hidden={{ slug, id }}
      submitLabel={t("motoMangos.useChosen")}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <MakeModelPicker
          modelName="catalog_id"
          makeLabel={t("what.make")}
          modelLabel={t("what.model")}
          models={options}
          required
        />
      </div>
    </ActionForm>
  );
}

/** The shop's switch for one model. Only a model on an approved preset has it. */
export function ListingForm({
  slug,
  id,
  listed,
}: {
  slug: string;
  id: string;
  listed: boolean;
}) {
  const t = useTranslations("Fleet.motoMangos");
  return (
    <ActionForm action={setMarketplaceListed} hidden={{ slug, id }}>
      <CheckboxInput name="listed" label={t("list")} defaultChecked={listed} />
    </ActionForm>
  );
}
