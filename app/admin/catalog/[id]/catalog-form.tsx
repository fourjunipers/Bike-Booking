"use client";

import {
  ActionForm,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/form-kit";
import { PhotoPicker } from "@/components/photo-picker";
import type { ActionState } from "@/lib/forms";
import { PHOTO_BUCKETS } from "@/lib/photos";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

type Entry = {
  make: string;
  model: string;
  generation: string | null;
  year_from: number | null;
  year_to: number | null;
  cc: number;
  type: string;
  transmission: string;
  abs: boolean | null;
  underseat_storage: boolean | null;
  usb_charger: boolean | null;
  key_type: string | null;
  description: string | null;
  slug: string;
  stock_photo: string | null;
};

const tri = (v: boolean | null | undefined) =>
  v === true ? "yes" : v === false ? "no" : "";
const triOptions = [
  { value: "", label: "Not known" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/** Admin is English only (CLAUDE.md), so labels are plain strings. */
export function CatalogForm({
  action,
  entryId,
  entry,
}: {
  action: Action;
  entryId: string | null;
  entry: Entry | null;
}) {
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="make" label="Make" defaultValue={entry?.make} />
        <TextField name="model" label="Model" defaultValue={entry?.model} />
        <TextField
          name="generation"
          label="Generation"
          hint='e.g. "New Gen", "2nd Gen"'
          defaultValue={entry?.generation}
        />
        <NumberField name="cc" label="Engine (cc)" defaultValue={entry?.cc} />
        <NumberField
          name="year_from"
          label="From year"
          defaultValue={entry?.year_from}
        />
        <NumberField
          name="year_to"
          label="To year"
          defaultValue={entry?.year_to}
        />
        <SelectField
          name="type"
          label="Type"
          defaultValue={entry?.type ?? "city_scooter"}
          options={[
            { value: "city_scooter", label: "City / scooter" },
            { value: "touring", label: "Touring" },
            { value: "adventure", label: "Adventure" },
            { value: "sport", label: "Sport" },
            { value: "classic", label: "Classic" },
            { value: "off_road", label: "Off-road" },
          ]}
        />
        <SelectField
          name="transmission"
          label="Transmission"
          defaultValue={entry?.transmission ?? "automatic"}
          options={[
            { value: "automatic", label: "Automatic" },
            { value: "semi_auto", label: "Semi-automatic" },
            { value: "manual", label: "Manual" },
          ]}
        />
        <SelectField
          name="abs"
          label="ABS"
          defaultValue={tri(entry?.abs)}
          options={triOptions}
        />
        <SelectField
          name="underseat_storage"
          label="Under-seat storage"
          defaultValue={tri(entry?.underseat_storage)}
          options={triOptions}
        />
        <SelectField
          name="usb_charger"
          label="USB charger"
          defaultValue={tri(entry?.usb_charger)}
          options={triOptions}
        />
        <SelectField
          name="key_type"
          label="Key"
          defaultValue={entry?.key_type ?? ""}
          options={[
            { value: "", label: "Not known" },
            { value: "keyless", label: "Keyless" },
            { value: "keyed", label: "Keyed" },
          ]}
        />
      </div>
      <TextAreaField
        name="description"
        label="Description"
        hint="Short and neutral, in your own words."
        defaultValue={entry?.description}
        rows={3}
      />
      <TextField
        name="slug"
        label="URL slug"
        hint="Used for SEO pages. Blank = generated from the name."
        defaultValue={entry?.slug}
      />
      {entryId ? (
        <div className="space-y-1">
          <PhotoPicker
            name="stock_photo"
            label="Stock photo"
            bucket={PHOTO_BUCKETS.catalog}
            folder={entryId}
            initial={entry?.stock_photo ? [entry.stock_photo] : []}
            max={1}
          />
          <p className="text-sm text-muted-foreground">
            Your own or licensed photo only. Never copy manufacturer or
            third-party images.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Save first, then add the stock photo.
        </p>
      )}
    </ActionForm>
  );
}
