"use client";

import { useTranslations } from "next-intl";
import {
  ActionForm,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/action-form";
import { bikeTypes, transmissions } from "@/lib/fleet";
import { requestCatalogEntry } from "../actions";

export function CatalogRequestForm({ slug }: { slug: string }) {
  const t = useTranslations("Fleet.catalogRequest");
  const tFleet = useTranslations("Fleet");
  return (
    <ActionForm
      action={requestCatalogEntry}
      hidden={{ slug }}
      submitLabel={t("submit")}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <TextInput name="make" label={t("make")} required maxLength={40} />
        <TextInput name="model" label={t("model")} required maxLength={60} />
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
        <SelectInput
          name="type"
          label={t("type")}
          options={bikeTypes.map((value) => ({
            value,
            label: tFleet(`type.${value}`),
          }))}
        />
        <SelectInput
          name="transmission"
          label={t("transmission")}
          options={transmissions.map((value) => ({
            value,
            label: tFleet(`transmission.${value}`),
          }))}
        />
        <TextInput
          name="cc"
          label={t("cc")}
          required
          inputMode="numeric"
          maxLength={4}
        />
      </div>
      <TextArea name="note" label={t("note")} maxLength={500} />
    </ActionForm>
  );
}
