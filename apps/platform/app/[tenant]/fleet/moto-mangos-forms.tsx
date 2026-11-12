"use client";

import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxInput,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/action-form";
import { bikeTypes } from "@/lib/fleet";
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
}: {
  slug: string;
  id: string;
}) {
  const t = useTranslations("Fleet.motoMangos");
  const tFleet = useTranslations("Fleet");
  return (
    <ActionForm
      action={submitModelToCatalog}
      hidden={{ slug, id }}
      submitLabel={t("submit")}
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <SelectInput
          name="type"
          label={t("bikeType")}
          options={bikeTypes.map((value) => ({
            value,
            label: tFleet(`type.${value}`),
          }))}
        />
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
