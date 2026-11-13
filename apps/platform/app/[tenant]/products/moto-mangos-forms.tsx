"use client";

import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxInput,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/action-form";
import {
  MakeModelPicker,
  type ModelOption,
} from "@/components/fleet/make-model-picker";
import { transmissions } from "@/lib/fleet";
import {
  linkModelToPreset,
  setMarketplaceListed,
  submitModelToCatalog,
} from "../fleet/actions";

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

/**
 * Not on the list: send it to the platform admin to add or merge. Its make,
 * model, engine size and transmission are asked for here, at this moment
 * (owner, 13 Nov 2026): a product is created with a name only, and Moto
 * Mangos search needs all four for a motorbike.
 */
export function SubmitToCatalogForm({
  slug,
  id,
  again,
  values,
}: {
  slug: string;
  id: string;
  /** Its last request was turned down: this sends it for review again. */
  again?: boolean;
  /** What the product already has, or a first guess from its name. */
  values: { make: string; model: string; cc: string; transmission: string };
}) {
  const t = useTranslations("Fleet.motoMangos");
  const tFleet = useTranslations("Fleet");
  return (
    <ActionForm
      action={submitModelToCatalog}
      hidden={{ slug, id }}
      submitLabel={t(again ? "submitAgain" : "submit")}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          name="make"
          label={tFleet("what.make")}
          required
          maxLength={40}
          defaultValue={values.make}
        />
        <TextInput
          name="model"
          label={tFleet("what.model")}
          required
          maxLength={60}
          defaultValue={values.model}
        />
        <TextInput
          name="cc"
          label={tFleet("what.cc")}
          required
          inputMode="numeric"
          maxLength={5}
          defaultValue={values.cc}
        />
        <SelectInput
          name="transmission"
          label={tFleet("what.transmission")}
          required
          defaultValue={values.transmission}
          options={[
            { value: "", label: "—" },
            ...transmissions.map((value) => ({
              value,
              label: tFleet(`transmission.${value}`),
            })),
          ]}
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
