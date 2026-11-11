"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  ActionForm,
  CheckboxInput,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/action-form";
import {
  addClosure,
  deleteClosure,
  saveHours,
  saveLocation,
} from "./actions";

export type LocationValues = {
  id?: string;
  name: string;
  timezone: string;
  address: string;
  maps_url: string;
  phone: string;
  whatsapp: string;
  line_id: string;
  email: string;
};

/**
 * A location's details. Only an owner gets the time-zone field on an existing
 * location, and is asked to confirm a change: it moves every opening hour and
 * due date there.
 */
export function LocationForm({
  slug,
  values,
  timeZones,
  canChangeZone,
}: {
  slug: string;
  values: LocationValues;
  timeZones: string[];
  canChangeZone: boolean;
}) {
  const t = useTranslations("Locations");
  const [zone, setZone] = useState(values.timezone);
  const zoneChanged = !!values.id && zone !== values.timezone;
  return (
    <ActionForm
      action={saveLocation}
      hidden={{
        slug,
        ...(values.id ? { id: values.id } : {}),
        ...(canChangeZone ? {} : { timezone: values.timezone }),
      }}
      confirm={zoneChanged ? t("timezoneWarning") : undefined}
    >
      <TextInput
        name="name"
        label={t("name")}
        required
        maxLength={120}
        defaultValue={values.name}
      />
      {canChangeZone ? (
        <SelectInput
          name="timezone"
          label={t("timezone")}
          help={t("timezoneHelp")}
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          options={timeZones.map((value) => ({
            value,
            label: value.replaceAll("_", " "),
          }))}
        />
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("timezone")}</p>
          <p>{values.timezone.replaceAll("_", " ")}</p>
          <p className="text-xs text-muted-foreground">{t("timezoneOwner")}</p>
        </div>
      )}
      <TextArea
        name="address"
        label={t("address")}
        maxLength={500}
        defaultValue={values.address}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <TextInput
          name="maps_url"
          label={t("mapsUrl")}
          type="url"
          defaultValue={values.maps_url}
        />
        <TextInput
          name="email"
          label={t("email")}
          type="email"
          defaultValue={values.email}
        />
        <TextInput
          name="phone"
          label={t("phone")}
          help={t("phoneHelp")}
          type="tel"
          defaultValue={values.phone}
        />
        <TextInput
          name="whatsapp"
          label={t("whatsapp")}
          type="tel"
          defaultValue={values.whatsapp}
        />
        <TextInput
          name="line_id"
          label={t("lineId")}
          maxLength={100}
          defaultValue={values.line_id}
        />
      </div>
    </ActionForm>
  );
}

/** Seven rows, in the viewer's week order. Blank times = closed. */
export function HoursForm({
  slug,
  id,
  days,
}: {
  slug: string;
  id: string;
  days: { weekday: number; label: string; open: string; close: string }[];
}) {
  const t = useTranslations("Locations");
  return (
    <ActionForm action={saveHours} hidden={{ slug, id }}>
      <div className="space-y-3">
        {days.map((day) => (
          <fieldset
            key={day.weekday}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]"
          >
            <legend className="col-span-2 mb-1 text-sm font-medium sm:sr-only">
              {day.label}
            </legend>
            <p aria-hidden className="hidden pb-3 text-sm font-medium sm:block">
              {day.label}
            </p>
            <TextInput
              name={`open_${day.weekday}`}
              label={t("open")}
              type="time"
              defaultValue={day.open}
            />
            <TextInput
              name={`close_${day.weekday}`}
              label={t("close")}
              type="time"
              defaultValue={day.close}
            />
          </fieldset>
        ))}
      </div>
    </ActionForm>
  );
}

export function ClosureForm({ slug, id }: { slug: string; id: string }) {
  const t = useTranslations("Locations");
  return (
    <ActionForm
      action={addClosure}
      hidden={{ slug, id }}
      submitLabel={t("addClosure")}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          name="start_date"
          label={t("startDate")}
          type="date"
          required
        />
        <TextInput name="end_date" label={t("endDate")} type="date" />
      </div>
      <TextInput name="note" label={t("note")} maxLength={200} />
      <CheckboxInput name="repeats_yearly" label={t("repeatsYearly")} />
    </ActionForm>
  );
}

export function DeleteClosureButton({
  slug,
  closure,
  label,
}: {
  slug: string;
  closure: string;
  label: string;
}) {
  return (
    <ActionForm
      action={deleteClosure}
      hidden={{ slug, closure }}
      submitLabel={label}
      destructive
      className="space-y-1"
    />
  );
}
