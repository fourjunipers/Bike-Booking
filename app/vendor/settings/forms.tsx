"use client";

import { useTranslations } from "next-intl";
import {
  ActionForm,
  FormSection,
  inputClass,
  NumberField,
  TextAreaField,
  TextField,
  useFieldError,
} from "@/components/form-kit";
import { PhotoPicker } from "@/components/photo-picker";
import { MapPicker } from "@/components/vendor/map-picker";
import { MAX_SHOP_PHOTOS, PHOTO_BUCKETS } from "@/lib/photos";
import {
  addClosure,
  saveBookingSettings,
  saveContacts,
  saveHours,
  saveProfile,
} from "../actions/shop";

export function ProfileForm(props: {
  shopId: string;
  name: string;
  about: string | null;
  photos: string[];
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  station: string | null;
  placeId: string | null;
}) {
  const t = useTranslations("Settings");
  return (
    <ActionForm action={saveProfile} className="space-y-6">
      <div id="profile">
        <FormSection title={t("profile")}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <TextField
                name="name"
                label={t("name")}
                defaultValue={props.name}
              />
              <TextAreaField
                name="about"
                label={t("about")}
                hint={t("aboutHint")}
                defaultValue={props.about}
                rows={6}
              />
            </div>
            <PhotoPicker
              label={t("photos")}
              bucket={PHOTO_BUCKETS.shop}
              folder={props.shopId}
              initial={props.photos}
              max={MAX_SHOP_PHOTOS}
            />
          </div>
        </FormSection>
      </div>
      <div id="location">
        <FormSection title={t("location")} description={t("locationHint")}>
          <MapPicker
            lat={props.lat}
            lng={props.lng}
            mapsUrl={props.mapsUrl}
            station={props.station}
            placeId={props.placeId}
          />
        </FormSection>
      </div>
    </ActionForm>
  );
}

// Monday first, as Thai and English calendars show it. 0 = Sunday.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function HoursForm({
  hours,
}: {
  hours: { weekday: number; open: string; close: string }[];
}) {
  const t = useTranslations("Settings");
  const tDays = useTranslations("Weekdays");
  return (
    <section id="hours" className="rounded-lg border p-4 md:p-6">
      <ActionForm action={saveHours}>
        <h2 className="text-lg font-semibold">{t("hours")}</h2>
        <p className="text-sm text-muted-foreground">{t("hoursHint")}</p>
        <div className="space-y-3">
          {WEEK.map((d) => {
            const row = hours.find((h) => h.weekday === d);
            return (
              <DayRow key={d} day={d} label={tDays(String(d))} row={row} />
            );
          })}
        </div>
      </ActionForm>
    </section>
  );
}

function DayRow({
  day,
  label,
  row,
}: {
  day: number;
  label: string;
  row?: { open: string; close: string };
}) {
  const t = useTranslations("Settings");
  const tErrors = useTranslations("Errors");
  const error = useFieldError(`day_${day}`);
  return (
    <fieldset className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2 sm:grid-cols-[7rem_1fr_1fr_auto]">
      <legend className="sr-only">{label}</legend>
      <span className="font-medium" aria-hidden>
        {label}
      </span>
      <label className="sr-only" htmlFor={`open_${day}`}>
        {t("opens", { day: label })}
      </label>
      <input
        id={`open_${day}`}
        name={`open_${day}`}
        type="time"
        defaultValue={row?.open ?? "10:00"}
        aria-invalid={!!error}
        className={inputClass}
      />
      <label className="sr-only" htmlFor={`close_${day}`}>
        {t("closes", { day: label })}
      </label>
      <input
        id={`close_${day}`}
        name={`close_${day}`}
        type="time"
        defaultValue={row?.close ?? "18:00"}
        aria-invalid={!!error}
        className={inputClass}
      />
      <label className="col-span-3 flex min-h-11 items-center gap-2 sm:col-span-1">
        <input
          type="checkbox"
          name={`closed_${day}`}
          defaultChecked={!row}
          className="size-5"
        />
        {t("closedAllDay")}
      </label>
      {error && (
        <p className="col-span-full text-sm text-destructive">
          {tErrors(error)}
        </p>
      )}
    </fieldset>
  );
}

export function ClosureForm() {
  const t = useTranslations("Settings");
  return (
    <ActionForm
      action={addClosure}
      submitLabel={t("addClosure")}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField type="date" name="start_date" label={t("from")} />
        <TextField type="date" name="end_date" label={t("to")} />
      </div>
      <TextField
        name="note"
        label={t("closureNote")}
        placeholder={t("closureNoteHint")}
      />
    </ActionForm>
  );
}

export function ContactsForm({
  contacts,
}: {
  contacts: {
    whatsapp: string | null;
    phone: string | null;
    line_id: string | null;
    email: string | null;
  };
}) {
  const t = useTranslations("Settings");
  return (
    <section id="contacts" className="rounded-lg border p-4 md:p-6">
      <ActionForm action={saveContacts}>
        <h2 className="text-lg font-semibold">{t("contacts")}</h2>
        <p className="text-sm text-muted-foreground">{t("contactsHint")}</p>
        <TextField
          type="tel"
          name="whatsapp"
          label={t("whatsapp")}
          hint={t("phoneHint")}
          defaultValue={contacts.whatsapp}
          autoComplete="tel"
        />
        <TextField
          type="tel"
          name="phone"
          label={t("phone")}
          hint={t("phoneHint")}
          defaultValue={contacts.phone}
        />
        <TextField
          name="line_id"
          label={t("lineId")}
          defaultValue={contacts.line_id}
        />
        <TextField
          type="email"
          name="email"
          label={t("email")}
          defaultValue={contacts.email}
          autoComplete="email"
        />
      </ActionForm>
    </section>
  );
}

export function BookingSettingsForm(props: {
  cutoff: number;
  before: number;
  after: number;
  window: number;
}) {
  const t = useTranslations("Settings");
  return (
    <section id="booking" className="rounded-lg border p-4 md:p-6">
      <ActionForm action={saveBookingSettings}>
        <h2 className="text-lg font-semibold">{t("bookingSettings")}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <NumberField
            name="cutoff_minutes"
            label={t("cutoff")}
            hint={t("cutoffHint")}
            defaultValue={props.cutoff}
          />
          <NumberField
            name="buffer_before_h"
            label={t("bufferBefore")}
            hint={t("hoursUnit")}
            defaultValue={props.before}
          />
          <NumberField
            name="buffer_after_h"
            label={t("bufferAfter")}
            hint={t("hoursUnit")}
            defaultValue={props.after}
          />
          <NumberField
            name="request_window_min"
            label={t("requestWindow")}
            hint={t("minutesUnit")}
            defaultValue={props.window}
          />
        </div>
      </ActionForm>
    </section>
  );
}
