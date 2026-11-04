"use client";

import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxField,
  NumberField,
  SelectField,
} from "@/components/form-kit";
import { PhotoPicker } from "@/components/photo-picker";
import type { ActionState } from "@/lib/forms";
import { formatBaht } from "@/lib/money";
import { MAX_MODEL_PHOTOS, PHOTO_BUCKETS } from "@/lib/photos";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ModelForm({
  action,
  shopId,
  modelId,
  model,
  shopDeposit,
}: {
  action: Action;
  shopId: string;
  modelId: string;
  model: {
    qty: number;
    photos: string[];
    deposit_amount: number | null;
    booking_mode: "instant" | "request";
    buffer_before_h: number | null;
    buffer_after_h: number | null;
    year_from: number | null;
    year_to: number | null;
    visible: boolean;
  };
  shopDeposit: number | null;
}) {
  const t = useTranslations("Model");
  return (
    <ActionForm action={action}>
      <PhotoPicker
        label={t("photos")}
        bucket={PHOTO_BUCKETS.model}
        folder={`${shopId}/${modelId}`}
        initial={model.photos}
        max={MAX_MODEL_PHOTOS}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField name="qty" label={t("qty")} defaultValue={model.qty} />
        <NumberField
          name="deposit_amount"
          label={t("deposit")}
          hint={t("depositHint", {
            amount: shopDeposit ? formatBaht(shopDeposit) : t("none"),
          })}
          defaultValue={model.deposit_amount}
        />
        <SelectField
          name="booking_mode"
          label={t("bookingMode")}
          hint={t("bookingModeHint")}
          defaultValue={model.booking_mode}
          options={[
            { value: "request", label: t("modeRequest") },
            { value: "instant", label: t("modeInstant") },
          ]}
        />
        <div />
        <NumberField
          name="buffer_before_h"
          label={t("bufferBefore")}
          hint={t("bufferHint")}
          defaultValue={model.buffer_before_h}
        />
        <NumberField
          name="buffer_after_h"
          label={t("bufferAfter")}
          hint={t("bufferHint")}
          defaultValue={model.buffer_after_h}
        />
        <NumberField
          name="year_from"
          label={t("yearFrom")}
          defaultValue={model.year_from}
        />
        <NumberField
          name="year_to"
          label={t("yearTo")}
          defaultValue={model.year_to}
        />
      </div>
      <CheckboxField
        name="visible"
        label={t("visible")}
        hint={t("visibleHint")}
        defaultChecked={model.visible}
      />
    </ActionForm>
  );
}

export function DeleteModelForm({ action }: { action: Action }) {
  const t = useTranslations("Model");
  return (
    <ActionForm
      action={action}
      submitLabel={t("delete")}
      confirm={t("deleteConfirm")}
      className="space-y-3"
    >
      {null}
    </ActionForm>
  );
}
