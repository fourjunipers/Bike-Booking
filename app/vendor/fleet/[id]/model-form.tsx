"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxField,
  FormSection,
  inputClass,
  NumberField,
  useFieldError,
} from "@/components/form-kit";
import { PhotoPicker } from "@/components/photo-picker";
import { Button } from "@/components/ui/button";
import { shrinkSplit, walkinOnlyUnits } from "@/lib/fleet";
import type { ActionState } from "@/lib/forms";
import { formatBaht } from "@/lib/money";
import { MAX_MODEL_PHOTOS, PHOTO_BUCKETS } from "@/lib/photos";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export type ShopBookingDefaults = {
  buffer_before_h: number;
  buffer_after_h: number;
  min_days_walkin: number;
  min_days_booking: number;
  notice_h: number;
};

export function ModelForm({
  action,
  shopId,
  modelId,
  model,
  shopDeposit,
  shopDefaults,
}: {
  action: Action;
  shopId: string;
  modelId: string;
  model: {
    qty: number;
    instant_qty: number;
    request_qty: number;
    photos: string[];
    deposit_amount: number | null;
    buffer_before_h: number | null;
    buffer_after_h: number | null;
    min_days_walkin: number | null;
    min_days_booking: number | null;
    notice_h: number | null;
    visible: boolean;
  };
  shopDeposit: number | null;
  shopDefaults: ShopBookingDefaults;
}) {
  const t = useTranslations("Model");
  const blank = (value: number) => t("blankForShop", { value });
  return (
    <ActionForm action={action} className="space-y-6">
      <PhotoPicker
        label={t("photos")}
        bucket={PHOTO_BUCKETS.model}
        folder={`${shopId}/${modelId}`}
        initial={model.photos}
        max={MAX_MODEL_PHOTOS}
      />

      <ModeSplit
        qty={model.qty}
        instant={model.instant_qty}
        request={model.request_qty}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <FormSection title={t("deposit")}>
          <NumberField
            name="deposit_amount"
            label={t("deposit")}
            hint={t("depositHint", {
              amount: shopDeposit ? formatBaht(shopDeposit) : t("none"),
            })}
            defaultValue={model.deposit_amount}
          />
        </FormSection>
        <FormSection title={t("rentalRules")}>
          <NumberField
            name="min_days_walkin"
            label={t("minDaysWalkin")}
            hint={blank(shopDefaults.min_days_walkin)}
            defaultValue={model.min_days_walkin}
          />
          <NumberField
            name="min_days_booking"
            label={t("minDaysBooking")}
            hint={blank(shopDefaults.min_days_booking)}
            defaultValue={model.min_days_booking}
          />
          <NumberField
            name="notice_h"
            label={t("notice")}
            hint={`${blank(shopDefaults.notice_h)} ${t("noticeHint")}`}
            defaultValue={model.notice_h}
          />
          <NumberField
            name="buffer_before_h"
            label={t("bufferBefore")}
            hint={blank(shopDefaults.buffer_before_h)}
            defaultValue={model.buffer_before_h}
          />
          <NumberField
            name="buffer_after_h"
            label={t("bufferAfter")}
            hint={blank(shopDefaults.buffer_after_h)}
            defaultValue={model.buffer_after_h}
          />
        </FormSection>
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

/**
 * Quantity split three ways (owner decision 2026-11-05): Instant units confirm
 * automatically, Request units need the shop's OK, the rest are walk-ins only.
 * The steppers keep Instant + Request within the quantity.
 */
function ModeSplit({
  qty: initialQty,
  instant: initialInstant,
  request: initialRequest,
}: {
  qty: number;
  instant: number;
  request: number;
}) {
  const t = useTranslations("Model");
  const [qty, setQty] = useState(initialQty);
  const [instant, setInstant] = useState(initialInstant);
  const [request, setRequest] = useState(initialRequest);
  const walkinOnly = walkinOnlyUnits(qty, instant, request);

  function changeQty(next: number) {
    setQty(next);
    const split = shrinkSplit(instant, request, next);
    setInstant(split.instant_qty);
    setRequest(split.request_qty);
  }

  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="px-1 font-medium">{t("split")}</legend>
      <p className="text-sm text-muted-foreground">{t("splitHint")}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stepper
          name="qty"
          label={t("qty")}
          value={qty}
          onChange={changeQty}
          max={999}
        />
        <Stepper
          name="instant_qty"
          label={t("modeInstant")}
          hint={t("modeInstantHint")}
          value={instant}
          onChange={setInstant}
          max={qty - request}
        />
        <Stepper
          name="request_qty"
          label={t("modeRequest")}
          hint={t("modeRequestHint")}
          value={request}
          onChange={setRequest}
          max={qty - instant}
        />
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("modeWalkinOnly")}</p>
          <p className="flex h-11 items-center text-lg font-semibold">
            {walkinOnly}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("modeWalkinOnlyHint")}
          </p>
        </div>
      </div>
    </fieldset>
  );
}

function Stepper({
  name,
  label,
  hint,
  value,
  onChange,
  max,
}: {
  name: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  max: number;
}) {
  const t = useTranslations("Model");
  const tErrors = useTranslations("Errors");
  const error = useFieldError(name);
  const set = (n: number) => onChange(Math.max(0, Math.min(max, n)));
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="size-11"
          aria-label={t("minusOne", { field: label })}
          disabled={value <= 0}
          onClick={() => set(value - 1)}
        >
          −
        </Button>
        <input
          id={name}
          name={name}
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isInteger(n)) set(n);
          }}
          aria-invalid={!!error}
          className={`${inputClass} w-16 text-center`}
        />
        <Button
          type="button"
          variant="outline"
          className="size-11"
          aria-label={t("plusOne", { field: label })}
          disabled={value >= max}
          onClick={() => set(value + 1)}
        >
          +
        </Button>
      </div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-sm text-destructive">
          {tErrors.has(error) ? tErrors(error) : tErrors("invalid")}
        </p>
      )}
    </div>
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
