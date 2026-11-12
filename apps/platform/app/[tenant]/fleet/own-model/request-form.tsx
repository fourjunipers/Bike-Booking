"use client";

import { useTranslations } from "next-intl";
import { ActionForm, SelectInput, TextInput } from "@/components/action-form";
import { transmissions, vehicleTypes } from "@/lib/fleet";
import { addOwnModel } from "../actions";

/** The fields that describe one of the shop's own models. Shared with the model page. */
export function OwnModelFields({
  makes,
  values,
}: {
  /** Makes among the presets, offered as suggestions. */
  makes: string[];
  values?: {
    make: string;
    model: string;
    vehicle_type: string;
    cc: string;
    transmission: string;
  };
}) {
  const t = useTranslations("Fleet.ownModel");
  const tFleet = useTranslations("Fleet");
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <TextInput
          name="make"
          label={t("make")}
          help={t("makeHelp")}
          required
          maxLength={40}
          list="known-makes"
          defaultValue={values?.make}
        />
        <datalist id="known-makes">
          {makes.map((make) => (
            <option key={make} value={make} />
          ))}
        </datalist>
      </div>
      <TextInput
        name="model"
        label={t("model")}
        required
        maxLength={60}
        defaultValue={values?.model}
      />
      <SelectInput
        name="vehicle_type"
        label={t("vehicleType")}
        defaultValue={values?.vehicle_type ?? "motorbike"}
        options={vehicleTypes.map((value) => ({
          value,
          label: tFleet(`vehicleType.${value}`),
        }))}
      />
      <TextInput
        name="cc"
        label={t("cc")}
        help={t("ccHelp")}
        inputMode="numeric"
        maxLength={5}
        defaultValue={values?.cc}
      />
      <SelectInput
        name="transmission"
        label={t("transmission")}
        help={t("transmissionHelp")}
        defaultValue={values?.transmission ?? ""}
        options={[
          { value: "", label: "—" },
          ...transmissions.map((value) => ({
            value,
            label: tFleet(`transmission.${value}`),
          })),
        ]}
      />
    </div>
  );
}

export function OwnModelForm({
  slug,
  then,
  makes,
}: {
  slug: string;
  /** Where the user came from: adding a bike or adding a model. */
  then: "bike" | "model";
  makes: string[];
}) {
  const t = useTranslations("Fleet.ownModel");
  return (
    <ActionForm
      action={addOwnModel}
      hidden={{ slug, then }}
      submitLabel={t("submit")}
    >
      <OwnModelFields makes={makes} />
    </ActionForm>
  );
}
