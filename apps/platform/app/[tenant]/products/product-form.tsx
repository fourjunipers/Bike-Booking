"use client";

import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxInput,
  TextArea,
  TextInput,
} from "@/components/action-form";
import { saveModel } from "../fleet/actions";
import { CategoryField, WhatFields, type WhatValues } from "./what-fields";

export type ProductFormValues = {
  id?: string;
  name: string;
  description: string;
  bookable_online: boolean;
  /** In hours, as typed ("0.5"); stored in minutes. */
  buffer_before_hours: string;
  buffer_after_hours: string;
  deposit: string;
  min_age: string;
  licence_class: string;
};

/**
 * Add or edit a make & model (SPEC › Fleet). What it is comes first (kind,
 * make and model, category); booking modes show once it exists.
 */
export function ProductForm({
  slug,
  currency,
  values,
  what,
  locked,
  then,
  focusName,
}: {
  slug: string;
  currency: string;
  values: ProductFormValues;
  what: WhatValues;
  /** On a Moto Mangos list entry, or waiting on one: its kind is the entry's. */
  locked?: boolean;
  /** Added on the way to adding a vehicle: saving goes back to that form. */
  then?: "inventory";
  /** A copy of another product: the name is selected, ready to be changed. */
  focusName?: boolean;
}) {
  const t = useTranslations("Fleet.model");
  const isNew = !values.id;
  // The one line a product needs: what the shop calls it.
  const name = (
    <TextInput
      name="name"
      label={t("name")}
      help={t("nameHelp")}
      placeholder={t("namePlaceholder")}
      required
      maxLength={120}
      defaultValue={values.name}
      autoFocus={focusName}
      onFocus={focusName ? (event) => event.target.select() : undefined}
    />
  );
  return (
    <ActionForm
      action={saveModel}
      hidden={{
        slug,
        ...(values.id ? { id: values.id } : {}),
        ...(locked ? { locked: "1", vehicle_type: what.vehicle_type } : {}),
        ...(then ? { then } : {}),
      }}
      submitLabel={
        isNew ? t(then ? "saveThenInventory" : "saveNew") : undefined
      }
      className="max-w-3xl"
    >
      {locked ? (
        <>
          {name}
          <CategoryField
            kind={what.vehicle_type}
            defaultValue={what.categories}
          />
        </>
      ) : (
        <WhatFields values={what} showTip={isNew}>
          {name}
        </WhatFields>
      )}
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
          name="buffer_before_hours"
          label={t("bufferBefore")}
          inputMode="decimal"
          maxLength={6}
          defaultValue={values.buffer_before_hours}
        />
        <TextInput
          name="buffer_after_hours"
          label={t("bufferAfter")}
          help={t("bufferHelp")}
          inputMode="decimal"
          maxLength={6}
          defaultValue={values.buffer_after_hours}
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
      <p className="text-sm text-muted-foreground">{t("photosLater")}</p>
    </ActionForm>
  );
}
