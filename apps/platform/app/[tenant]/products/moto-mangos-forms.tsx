"use client";

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
import type { Option } from "@/lib/model-options";
import {
  linkModelToPreset,
  saveListing,
  submitModelToCatalog,
} from "../fleet/actions";

/**
 * The Moto Mangos panel's forms, in the order they sit on a product's page
 * (owner, 13 Nov 2026): pick your make and model from the list; if it isn't
 * there, send its details for review; and, once a model is selected or
 * approved, the listing switch and settings.
 */

/** "Select your make and model from the list": takes the list's details, no review. */
export function ChooseFromListForm({
  slug,
  id,
  options,
}: {
  slug: string;
  id: string;
  /** The Moto Mangos list, A to Z. */
  options: Option[];
}) {
  const t = useTranslations("Fleet.motoMangos");
  return (
    <ActionForm
      action={linkModelToPreset}
      hidden={{ slug, id }}
      submitLabel={t("useChosen")}
    >
      <SelectInput
        name="catalog_id"
        label={t("selectFromList")}
        required
        defaultValue=""
        options={[{ value: "", label: "—" }, ...options]}
      />
    </ActionForm>
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
      <p className="text-sm text-muted-foreground">{tModel("modesHelp")}</p>
      <div className="grid gap-5 sm:grid-cols-3">
        <TextInput
          name="instant_units"
          label={tModel("instantUnits")}
          inputMode="numeric"
          defaultValue={values.instant_units}
        />
        <TextInput
          name="request_units"
          label={tModel("requestUnits")}
          inputMode="numeric"
          defaultValue={values.request_units}
        />
        <TextInput
          name="ready_now"
          label={tModel("readyNow")}
          inputMode="numeric"
          defaultValue={values.ready_now}
        />
      </div>
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
