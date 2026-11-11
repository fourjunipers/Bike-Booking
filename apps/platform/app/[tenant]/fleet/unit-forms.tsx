"use client";

import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxInput,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/action-form";
import { unitStatuses, workStatuses } from "@/lib/fleet";
import {
  addDowntime,
  endDowntime,
  saveFinancials,
  saveUnit,
  updateUnitWork,
} from "./actions";

type Option = { value: string; label: string };

export type UnitFormValues = {
  id?: string;
  model_id: string;
  location_id: string;
  plate: string;
  plate_pending: boolean;
  frame_number: string;
  engine_number: string;
  colour: string;
  first_registered: string;
  status: string;
  active_from: string;
  active_to: string;
  notes: string;
};

/** A bike's details: owners and managers. A new bike also takes its odometer. */
export function UnitForm({
  slug,
  values,
  models,
  locations,
  distanceUnit,
}: {
  slug: string;
  values: UnitFormValues;
  models: Option[];
  locations: Option[];
  distanceUnit: string;
}) {
  const t = useTranslations("Fleet.unit");
  const tStatus = useTranslations("Fleet.status");
  return (
    <ActionForm
      action={saveUnit}
      hidden={{ slug, ...(values.id ? { id: values.id } : {}) }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <SelectInput
          name="model_id"
          label={t("model")}
          required
          defaultValue={values.model_id}
          options={models}
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
        <TextInput
          name="first_registered"
          label={t("firstRegistered")}
          type="date"
          defaultValue={values.first_registered}
        />
        {values.id ? (
          <SelectInput
            name="status"
            label={t("status")}
            defaultValue={values.status}
            options={unitStatuses.map((s) => ({ value: s, label: tStatus(s) }))}
          />
        ) : (
          <TextInput
            name="odometer"
            label={t("initialOdometer", { unit: distanceUnit })}
            inputMode="decimal"
            defaultValue="0"
          />
        )}
        <TextInput
          name="active_from"
          label={t("activeFrom")}
          type="date"
          defaultValue={values.active_from}
        />
        <TextInput
          name="active_to"
          label={t("activeTo")}
          type="date"
          defaultValue={values.active_to}
        />
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

/** Odometer and active/maintenance: staff and mechanics too. */
export function WorkForm({
  slug,
  id,
  odometer,
  status,
  distanceUnit,
}: {
  slug: string;
  id: string;
  odometer: string;
  status: string;
  distanceUnit: string;
}) {
  const t = useTranslations("Fleet.unit");
  const tStatus = useTranslations("Fleet.status");
  const canSwitch = (workStatuses as readonly string[]).includes(status);
  return (
    <ActionForm action={updateUnitWork} hidden={{ slug, id }}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          name="odometer"
          label={t("odometer", { unit: distanceUnit })}
          help={t("workHelp")}
          inputMode="decimal"
          required
          defaultValue={odometer}
        />
        {canSwitch && (
          <SelectInput
            name="status"
            label={t("status")}
            defaultValue={status}
            options={workStatuses.map((s) => ({
              value: s,
              label: tStatus(s),
            }))}
          />
        )}
      </div>
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

export type MoneyValues = {
  purchase_date: string;
  purchase_price: string;
  purchased_from: string;
  sold_at: string;
  sale_price: string;
  sold_to: string;
};

/** Purchase and sale details; with `sell`, saving also marks the bike sold. */
export function FinancialsForm({
  slug,
  id,
  currency,
  values,
  sell,
}: {
  slug: string;
  id: string;
  currency: string;
  values: MoneyValues;
  sell?: boolean;
}) {
  const t = useTranslations("Fleet.money");
  const sale = (
    <div className="grid gap-5 md:grid-cols-3">
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
  );
  const purchase = (
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
    </div>
  );

  if (sell)
    return (
      <ActionForm
        action={saveFinancials}
        hidden={{
          slug,
          id,
          intent: "sell",
          purchase_date: values.purchase_date,
          purchase_price: values.purchase_price,
          purchased_from: values.purchased_from,
        }}
        submitLabel={t("sell")}
        confirm={t("sellConfirm")}
        destructive
      >
        {sale}
      </ActionForm>
    );
  return (
    <ActionForm action={saveFinancials} hidden={{ slug, id }}>
      {purchase}
      {sale}
    </ActionForm>
  );
}
