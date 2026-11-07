"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ActionForm,
  FormSection,
  inputClass,
  NumberField,
  TextAreaField,
  TextField,
  useFieldError,
  useMarkDirty,
} from "@/components/form-kit";
import { PhotoPicker } from "@/components/photo-picker";
import { Button } from "@/components/ui/button";
import { InclusionsFields } from "@/components/vendor/inclusions-form";
import { MapPicker } from "@/components/vendor/map-picker";
import type { Inclusions } from "@/lib/inclusions";
import { MAX_SHOP_PHOTOS, PHOTO_BUCKETS } from "@/lib/photos";
import { saveShopDefaults, saveStoreInformation } from "../actions/shop";

// Store information ------------------------------------------------------------

export type ClosureRow = {
  id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  repeats_yearly: boolean;
};

/** Shop settings → Store information: one form, one Save button. */
export function StoreInformationForm(props: {
  shopId: string;
  name: string;
  about: string | null;
  photos: string[];
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  station: string | null;
  placeId: string | null;
  hours: { weekday: number; open: string; close: string }[];
  closures: ClosureRow[];
  contacts: {
    whatsapp: string | null;
    phone: string | null;
    line_id: string | null;
    email: string | null;
  };
}) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  return (
    <ActionForm
      action={saveStoreInformation}
      submitLabel={tCommon("saveAll")}
      className="space-y-6"
      sticky
      warnUnsaved
    >
      <FormSection id="profile" title={t("profile")}>
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

      <FormSection
        id="location"
        title={t("location")}
        description={t("locationHint")}
      >
        <MapPicker
          lat={props.lat}
          lng={props.lng}
          mapsUrl={props.mapsUrl}
          station={props.station}
          placeId={props.placeId}
        />
      </FormSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <FormSection id="hours" title={t("hours")} description={t("hoursHint")}>
          <div className="space-y-3">
            {WEEK.map((d) => (
              <DayRow
                key={d}
                day={d}
                row={props.hours.find((h) => h.weekday === d)}
              />
            ))}
          </div>
        </FormSection>

        <div className="space-y-6">
          <FormSection id="closures" title={t("closures")}>
            <Closures initial={props.closures} />
          </FormSection>
          <FormSection
            id="contacts"
            title={t("contacts")}
            description={t("contactsHint")}
          >
            <TextField
              type="tel"
              name="whatsapp"
              label={t("whatsapp")}
              hint={t("phoneHint")}
              defaultValue={props.contacts.whatsapp}
              autoComplete="tel"
            />
            <TextField
              type="tel"
              name="phone"
              label={t("phone")}
              hint={t("phoneHint")}
              defaultValue={props.contacts.phone}
            />
            <TextField
              name="line_id"
              label={t("lineId")}
              defaultValue={props.contacts.line_id}
            />
            <TextField
              type="email"
              name="email"
              label={t("email")}
              defaultValue={props.contacts.email}
              autoComplete="email"
            />
          </FormSection>
        </div>
      </div>
    </ActionForm>
  );
}

// Monday first, as Thai and English calendars show it. 0 = Sunday.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

function DayRow({
  day,
  row,
}: {
  day: number;
  row?: { open: string; close: string };
}) {
  const t = useTranslations("Settings");
  const tDays = useTranslations("Weekdays");
  const tErrors = useTranslations("Errors");
  const error = useFieldError(`day_${day}`);
  const label = tDays(String(day));
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

type NewClosure = Omit<ClosureRow, "id">;

/**
 * Holiday closures, saved with the page's Save button: the list goes to the
 * server as JSON (ids kept, new entries), and removed ones are deleted there.
 */
function Closures({ initial }: { initial: ClosureRow[] }) {
  const t = useTranslations("Settings");
  const tErrors = useTranslations("Errors");
  const markDirty = useMarkDirty();
  const error = useFieldError("closures");
  const [kept, setKept] = useState(initial);
  const [added, setAdded] = useState<NewClosure[]>([]);
  const [draft, setDraft] = useState<NewClosure>({
    start_date: "",
    end_date: "",
    note: "",
    repeats_yearly: false,
  });
  const [draftError, setDraftError] = useState<string | null>(null);

  // A save refreshes the page with the stored list: start from it again.
  const [saved, setSaved] = useState(initial);
  if (initial !== saved) {
    setSaved(initial);
    setKept(initial);
    setAdded([]);
  }

  function add() {
    if (!draft.start_date || !draft.end_date) {
      setDraftError("required");
      return;
    }
    if (draft.end_date < draft.start_date) {
      setDraftError("endAfterStart");
      return;
    }
    setDraftError(null);
    setAdded((a) => [...a, { ...draft, note: draft.note?.trim() || null }]);
    setDraft({ start_date: "", end_date: "", note: "", repeats_yearly: false });
    markDirty();
  }

  const rows = [
    ...kept.map((c) => ({ ...c, key: c.id, isNew: false })),
    ...added.map((c, i) => ({ ...c, key: `new-${i}`, isNew: true })),
  ];

  return (
    <div className="space-y-4">
      <input
        type="hidden"
        name="closures"
        value={JSON.stringify({ keep: kept.map((c) => c.id), add: added })}
      />
      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li
              key={c.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2"
            >
              <span>
                {c.start_date} – {c.end_date}
                {c.repeats_yearly ? ` · ${t("everyYear")}` : ""}
                {c.note ? ` · ${c.note}` : ""}
                {c.isNew && (
                  <span className="ml-2 text-xs font-medium text-amber-700">
                    {t("notSavedYet")}
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  markDirty();
                  if (c.isNew)
                    setAdded((a) => a.filter((_, i) => `new-${i}` !== c.key));
                  else setKept((k) => k.filter((x) => x.id !== c.key));
                }}
              >
                {t("remove")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t("noClosures")}</p>
      )}

      <fieldset className="space-y-3 rounded-md border border-dashed p-3">
        <legend className="px-1 text-sm font-medium">{t("addClosure")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="block font-medium">{t("from")}</span>
            <input
              type="date"
              value={draft.start_date}
              onChange={(e) =>
                setDraft({ ...draft, start_date: e.target.value })
              }
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="block font-medium">{t("to")}</span>
            <input
              type="date"
              value={draft.end_date}
              onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
              className={inputClass}
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="block font-medium">{t("closureNote")}</span>
          <input
            value={draft.note ?? ""}
            placeholder={t("closureNoteHint")}
            maxLength={100}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={draft.repeats_yearly}
            onChange={(e) =>
              setDraft({ ...draft, repeats_yearly: e.target.checked })
            }
            className="size-5"
          />
          <span>
            {t("repeatsYearly")}
            <span className="block text-muted-foreground">
              {t("repeatsYearlyHint")}
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={add}
          >
            {t("addToList")}
          </Button>
          {(draftError ?? error) && (
            <p className="text-sm text-destructive">
              {tErrors(draftError ?? error ?? "invalid")}
            </p>
          )}
        </div>
      </fieldset>
    </div>
  );
}

// Default settings ---------------------------------------------------------------

/** Shop settings → Default settings: booking rules and "What's included". */
export function ShopDefaultsForm(props: {
  cutoff: number;
  before: number;
  after: number;
  window: number;
  minDaysWalkin: number;
  minDaysBooking: number;
  notice: number;
  policies: Inclusions & { deposit_amount: number | null };
}) {
  const t = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  return (
    <ActionForm
      action={saveShopDefaults}
      submitLabel={tCommon("saveAll")}
      className="space-y-6"
      sticky
      warnUnsaved
    >
      <FormSection id="booking" title={t("bookingSettings")}>
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
            hint={t("requestWindowHint")}
            defaultValue={props.window}
          />
          <NumberField
            name="min_days_walkin"
            label={t("minDaysWalkin")}
            hint={t("modelsCanOverride")}
            defaultValue={props.minDaysWalkin}
          />
          <NumberField
            name="min_days_booking"
            label={t("minDaysBooking")}
            hint={t("modelsCanOverride")}
            defaultValue={props.minDaysBooking}
          />
          <NumberField
            name="notice_h"
            label={t("notice")}
            hint={t("noticeHint")}
            defaultValue={props.notice}
          />
        </div>
      </FormSection>
      <InclusionsFields
        mode="shop"
        shop={props.policies}
        depositAmount={props.policies.deposit_amount}
      />
    </ActionForm>
  );
}
