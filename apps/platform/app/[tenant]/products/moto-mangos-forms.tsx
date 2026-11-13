"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import {
  ActionForm,
  CheckboxInput,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/action-form";
import { transmissions } from "@/lib/fleet";
import { Field, inputClass } from "@/components/form";
import type { ListChoice } from "@/lib/model-options";
import {
  linkModelToPreset,
  saveListing,
  submitModelToCatalog,
} from "../fleet/actions";
import { changeListingEntry, disconnectListing } from "./actions";

/**
 * The Moto Mangos panel's forms, in the order they sit on a product's page
 * (owner, 13 Nov 2026): pick your make and model from the list; if it isn't
 * there, send its details for review; and, once a model is selected or
 * approved, the listing switch and settings.
 */

/**
 * "Select your make and model from the list": Make, then Model (with the
 * years it covers), the second filtered by the first. Selecting one takes the
 * list's details and needs no review. Native selects, so they work with a
 * finger, a mouse or a keyboard; without JavaScript the second lists every
 * model.
 */
export function ChooseFromListForm({
  slug,
  id,
  choices,
  change,
}: {
  slug: string;
  id: string;
  /** The Moto Mangos list, by make then model. */
  choices: ListChoice[];
  /** "Change model": the product is on an entry already and moves to this one. */
  change?: boolean;
}) {
  const t = useTranslations("Fleet.motoMangos");
  const tFleet = useTranslations("Fleet");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const makes = [...new Set(choices.map((choice) => choice.make))];
  const models = make ? choices.filter((choice) => choice.make === make) : [];
  return (
    <ActionForm
      action={change ? changeListingEntry : linkModelToPreset}
      hidden={{ slug, id }}
      submitLabel={t("useChosen")}
    >
      <fieldset>
        <legend className="mb-2 block text-sm font-medium">
          {t(change ? "changeModelLegend" : "selectFromList")}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="list-make" label={tFleet("what.make")}>
            <select
              id="list-make"
              value={make}
              required
              onChange={(event) => {
                setMake(event.target.value);
                setModel("");
              }}
              className={inputClass}
            >
              <option value="">—</option>
              {makes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="catalog_id" label={tFleet("what.model")}>
            <select
              id="catalog_id"
              name="catalog_id"
              value={model}
              required
              disabled={!make}
              onChange={(event) => setModel(event.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {models.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>
    </ActionForm>
  );
}

/**
 * For a product already on a Moto Mangos list entry (owner, 13 Nov 2026;
 * owners and managers only): "Change model", the same Make then Model
 * dropdowns and Select button, and "Disconnect", which switches the listing
 * off and clears the list entry after a confirmation. Neither touches a
 * booking that was already made: the line above the buttons says how many
 * there are.
 */
export function ListEntryActions({
  slug,
  id,
  choices,
  upcoming,
}: {
  slug: string;
  id: string;
  /** The Moto Mangos list without the entry the product is on. */
  choices: ListChoice[];
  /** Bookings on this product's vehicles that have not ended. */
  upcoming: number;
}) {
  const t = useTranslations("Fleet.motoMangos");
  return (
    <div className="mt-4 space-y-3">
      {upcoming > 0 && (
        <p
          role="note"
          className="rounded-md border border-highlight-border bg-highlight p-3 text-sm text-highlight-foreground"
        >
          {t("upcomingBookings", { count: upcoming })}
        </p>
      )}
      <details className="group rounded-md border">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 transition-transform group-open:rotate-180"
          />
          {t("changeModel")}
        </summary>
        <div className="border-t p-3">
          <p className="mb-3 text-sm text-muted-foreground">
            {t("changeModelHelp")}
          </p>
          <ChooseFromListForm slug={slug} id={id} choices={choices} change />
        </div>
      </details>
      <div className="rounded-md border p-3">
        <p className="mb-3 text-sm text-muted-foreground">
          {t("disconnectHelp")}
        </p>
        <ActionForm
          action={disconnectListing}
          hidden={{ slug, id }}
          submitLabel={t("disconnect")}
          confirm={t("disconnectConfirm")}
          destructive
        />
      </div>
    </div>
  );
}

/**
 * "Don't see your bike above? Send us the details and we'll get it added":
 * the line opens the review form. This is the only place on the platform
 * that asks for a make, model, engine size, transmission and year, and all
 * five are required. Nothing is sent until the form is opened, filled in and
 * its own button pressed.
 */
export function ReviewRequest({
  slug,
  id,
  again,
  open,
  values,
}: {
  slug: string;
  id: string;
  /** Its last request was turned down: this sends it for review again. */
  again?: boolean;
  /** Start opened (a rejected request being corrected). */
  open?: boolean;
  /** What was sent before, or a first guess at the make and model from the name. */
  values: { make: string; model: string; cc: string; transmission: string };
}) {
  const t = useTranslations("Fleet.motoMangos");
  const tFleet = useTranslations("Fleet");
  return (
    <details
      id="send-for-review"
      open={open}
      className="group scroll-mt-20 rounded-md border"
    >
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
        />
        {t("notInList")}
      </summary>
      <div className="border-t p-3">
        <p className="mb-3 text-sm text-muted-foreground">{t("submitHelp")}</p>
        <ActionForm
          action={submitModelToCatalog}
          hidden={{ slug, id }}
          submitLabel={t(again ? "submitAgain" : "submit")}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput
              name="make"
              label={tFleet("what.make")}
              required
              maxLength={40}
              defaultValue={values.make}
            />
            <TextInput
              name="model"
              label={tFleet("what.model")}
              required
              maxLength={60}
              defaultValue={values.model}
            />
            <TextInput
              name="cc"
              label={tFleet("what.cc")}
              required
              inputMode="numeric"
              maxLength={5}
              defaultValue={values.cc}
            />
            <SelectInput
              name="transmission"
              label={tFleet("what.transmission")}
              required
              defaultValue={values.transmission}
              options={[
                { value: "", label: "—" },
                ...transmissions.map((value) => ({
                  value,
                  label: tFleet(`transmission.${value}`),
                })),
              ]}
            />
            <TextInput
              name="year"
              label={t("bikeYear")}
              help={t("bikeYearHelp")}
              required
              inputMode="numeric"
              maxLength={4}
            />
          </div>
          <TextArea name="note" label={t("note")} maxLength={500} />
        </ActionForm>
      </div>
    </details>
  );
}

/**
 * The listing switch and settings. Usable only once the product is on an
 * approved list entry (a model selected from the list, or a request
 * approved); until then every field is disabled and a line says why.
 */
export function ListingForm({
  slug,
  id,
  enabled,
  values,
}: {
  slug: string;
  id: string;
  enabled: boolean;
  values: {
    listed: boolean;
    instant_units: string;
    request_units: string;
    ready_now: string;
  };
}) {
  const t = useTranslations("Fleet.motoMangos");
  const tModel = useTranslations("Fleet.model");
  const fields = (
    <fieldset disabled={!enabled} className="space-y-4 disabled:opacity-60">
      <legend className="sr-only">{t("listingTitle")}</legend>
      <CheckboxInput
        name="listed"
        label={t("list")}
        defaultChecked={values.listed}
      />
      {/* "Set bike quantities per booking type", then one line each. */}
      <p className="text-sm font-medium">{t("quantitiesTitle")}</p>
      <TextInput
        name="instant_units"
        label={tModel("instantUnits")}
        help={t("instantHelp")}
        inputMode="numeric"
        defaultValue={values.instant_units}
        className="max-w-28"
      />
      <TextInput
        name="request_units"
        label={tModel("requestUnits")}
        help={t("requestHelp")}
        inputMode="numeric"
        defaultValue={values.request_units}
        className="max-w-28"
      />
      <TextInput
        name="ready_now"
        label={tModel("readyNow")}
        help={t("walkinsHelp")}
        inputMode="numeric"
        defaultValue={values.ready_now}
        className="max-w-28"
      />
    </fieldset>
  );
  if (!enabled)
    return (
      <div>
        <p id="listing-locked" className="mb-3 text-sm font-medium">
          {t("listingLocked")}
        </p>
        <div aria-describedby="listing-locked">{fields}</div>
      </div>
    );
  return (
    <ActionForm action={saveListing} hidden={{ slug, id }}>
      {fields}
    </ActionForm>
  );
}
