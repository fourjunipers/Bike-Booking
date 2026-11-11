"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxInput,
  RadioList,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/action-form";
import {
  MakeModelPicker,
  type ModelOption,
} from "@/components/fleet/make-model-picker";
import { renewalKinds, unitStatuses, workStatuses } from "@/lib/fleet";
import {
  addDowntime,
  addRenewal,
  deleteRenewal,
  endDowntime,
  saveFinancials,
  saveUnit,
  setUnitStatus,
  updateOdometer,
} from "./actions";

type Option = { value: string; label: string };

export type UnitFormValues = {
  id?: string;
  model_choice: string;
  location_id: string;
  plate: string;
  plate_pending: boolean;
  frame_number: string;
  engine_number: string;
  colour: string;
  model_year: string;
  notes: string;
};

/**
 * A bike's details: owners and managers. The model is chosen make first, then
 * model. Status and odometer have their own controls on the bike page; a new
 * bike takes its first odometer reading here.
 */
export function UnitForm({
  slug,
  values,
  models,
  locations,
  distanceUnit,
  addModelHref,
}: {
  slug: string;
  values: UnitFormValues;
  models: ModelOption[];
  locations: Option[];
  distanceUnit: string;
  addModelHref: string;
}) {
  const t = useTranslations("Fleet.unit");
  return (
    <ActionForm
      action={saveUnit}
      hidden={{ slug, ...(values.id ? { id: values.id } : {}) }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <MakeModelPicker
          modelName="model_choice"
          makeLabel={t("make")}
          modelLabel={t("model")}
          models={models}
          defaultModel={values.model_choice}
          required
          footer={
            <Link
              href={addModelHref}
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline"
            >
              {t("makeOrModelMissing")}
            </Link>
          }
        />
        <TextInput
          name="model_year"
          label={t("modelYear")}
          help={t("modelYearHelp")}
          inputMode="numeric"
          maxLength={4}
          defaultValue={values.model_year}
        />
        <SelectInput
          name="location_id"
          label={t("location")}
          required
          defaultValue={values.location_id}
          options={locations}
        />
        <div className="space-y-2">
          <TextInput
            name="plate"
            label={t("plate")}
            maxLength={30}
            defaultValue={values.plate}
          />
          <CheckboxInput
            name="plate_pending"
            label={t("platePending")}
            defaultChecked={values.plate_pending}
          />
        </div>
        <TextInput
          name="colour"
          label={t("colour")}
          maxLength={40}
          defaultValue={values.colour}
        />
        <TextInput
          name="frame_number"
          label={t("frameNumber")}
          maxLength={40}
          defaultValue={values.frame_number}
        />
        <TextInput
          name="engine_number"
          label={t("engineNumber")}
          maxLength={40}
          defaultValue={values.engine_number}
        />
        {!values.id && (
          <TextInput
            name="odometer"
            label={t("initialOdometer", { unit: distanceUnit })}
            inputMode="decimal"
            defaultValue="0"
          />
        )}
      </div>
      <TextArea
        name="notes"
        label={t("notes")}
        maxLength={2000}
        defaultValue={values.notes}
      />
    </ActionForm>
  );
}

/**
 * The odometer. A reading lower than the current one is allowed for anyone
 * who may update it, after a confirmation; the audit log records the change.
 */
export function OdometerForm({
  slug,
  id,
  odometer,
  distanceUnit,
}: {
  slug: string;
  id: string;
  odometer: string;
  distanceUnit: string;
}) {
  const t = useTranslations("Fleet.unit");
  return (
    <ActionForm
      action={updateOdometer}
      hidden={{ slug, id }}
      confirmIf={(data) => {
        const typed = Number(
          String(data.get("odometer") ?? "").replace(/[\s,]/g, ""),
        );
        return Number.isFinite(typed) && typed < Number(odometer)
          ? t("odometerLowerConfirm", { current: odometer, unit: distanceUnit })
          : undefined;
      }}
    >
      <TextInput
        name="odometer"
        label={t("odometer", { unit: distanceUnit })}
        inputMode="decimal"
        required
        defaultValue={odometer}
        className="max-w-xs"
      />
    </ActionForm>
  );
}

/**
 * The bike's one status, each choice with a line saying whether the bike can
 * be rented. Staff and mechanics may pick only active or maintenance.
 */
export function StatusForm({
  slug,
  id,
  status,
  canRetireOrSell,
}: {
  slug: string;
  id: string;
  status: string;
  canRetireOrSell: boolean;
}) {
  const t = useTranslations("Fleet");
  const allowed: readonly string[] = canRetireOrSell
    ? unitStatuses
    : workStatuses;
  return (
    <ActionForm action={setUnitStatus} hidden={{ slug, id, was: status }}>
      <RadioList
        name="status"
        legend={t("unit.status")}
        defaultValue={status}
        options={unitStatuses
          // Someone who can't retire or sell still sees it when that's what the bike is.
          .filter((s) => allowed.includes(s) || s === status)
          .map((s) => ({
            value: s,
            label: t(`status.${s}`),
            help: t(`statusHelp.${s}`),
            disabled: !allowed.includes(s),
          }))}
      />
    </ActionForm>
  );
}

export function DowntimeForm({
  slug,
  id,
  now,
}: {
  slug: string;
  id: string;
  /** The current time at the bike's location, as a datetime-local value. */
  now: string;
}) {
  const t = useTranslations("Fleet.downtime");
  return (
    <ActionForm
      action={addDowntime}
      hidden={{ slug, id }}
      submitLabel={t("add")}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          name="from"
          label={t("from")}
          type="datetime-local"
          required
          defaultValue={now}
        />
        <TextInput
          name="until"
          label={t("until")}
          help={t("untilHelp")}
          type="datetime-local"
        />
      </div>
      <TextInput name="note" label={t("note")} maxLength={500} />
    </ActionForm>
  );
}

export function EndDowntimeButton({
  slug,
  block,
  label,
}: {
  slug: string;
  block: string;
  label: string;
}) {
  return (
    <ActionForm
      action={endDowntime}
      hidden={{ slug, block }}
      submitLabel={label}
      destructive
      className="space-y-1"
    />
  );
}

/** Add or renew a tax or insurance record. The cost field is for owners and managers. */
export function RenewalForm({
  slug,
  id,
  currency,
  showCost,
}: {
  slug: string;
  id: string;
  currency: string;
  showCost: boolean;
}) {
  const t = useTranslations("Fleet.renewals");
  return (
    <ActionForm
      action={addRenewal}
      hidden={{ slug, id }}
      submitLabel={t("add")}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectInput
          name="kind"
          label={t("kindLabel")}
          options={renewalKinds.map((kind) => ({
            value: kind,
            label: t(`kind.${kind}`),
          }))}
        />
        <TextInput name="provider" label={t("provider")} maxLength={200} />
        <TextInput name="reference_no" label={t("reference")} maxLength={100} />
        {showCost && (
          <TextInput
            name="cost"
            label={t("cost", { currency })}
            inputMode="decimal"
          />
        )}
        <TextInput name="starts_at" label={t("start")} type="date" />
        <TextInput name="expires_at" label={t("expiry")} type="date" required />
      </div>
    </ActionForm>
  );
}

export function DeleteRenewalButton({
  slug,
  renewal,
  label,
  confirm,
}: {
  slug: string;
  renewal: string;
  label: string;
  confirm: string;
}) {
  return (
    <ActionForm
      action={deleteRenewal}
      hidden={{ slug, renewal }}
      submitLabel={label}
      confirm={confirm}
      destructive
      className="space-y-1"
    />
  );
}

export type MoneyValues = {
  purchase_date: string;
  purchase_price: string;
  purchased_from: string;
  sold_at: string;
  sale_price: string;
  sold_to: string;
};

/** Purchase and sale details: the one place they are viewed, edited and saved. */
export function FinancialsForm({
  slug,
  id,
  currency,
  values,
}: {
  slug: string;
  id: string;
  currency: string;
  values: MoneyValues;
}) {
  const t = useTranslations("Fleet.money");
  return (
    <ActionForm action={saveFinancials} hidden={{ slug, id }}>
      <div className="grid gap-5 md:grid-cols-3">
        <TextInput
          name="purchase_date"
          label={t("purchaseDate")}
          type="date"
          defaultValue={values.purchase_date}
        />
        <TextInput
          name="purchase_price"
          label={t("purchasePrice", { currency })}
          inputMode="decimal"
          defaultValue={values.purchase_price}
        />
        <TextInput
          name="purchased_from"
          label={t("purchasedFrom")}
          maxLength={200}
          defaultValue={values.purchased_from}
        />
        <TextInput
          name="sold_at"
          label={t("soldAt")}
          type="date"
          defaultValue={values.sold_at}
        />
        <TextInput
          name="sale_price"
          label={t("salePrice", { currency })}
          inputMode="decimal"
          defaultValue={values.sale_price}
        />
        <TextInput
          name="sold_to"
          label={t("soldTo")}
          maxLength={200}
          defaultValue={values.sold_to}
        />
      </div>
    </ActionForm>
  );
}
