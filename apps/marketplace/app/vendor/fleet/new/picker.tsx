"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ActionForm,
  inputClass,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { searchCatalog } from "@/lib/catalog";
import { addModel, requestCatalogModel } from "../../actions/fleet";

type Entry = {
  id: string;
  label: string;
  make: string;
  model: string;
  year_from: number | null;
  year_to: number | null;
  cc: number;
  type: string;
  transmission: string;
  status: "requested" | "approved" | "rejected";
};

export function CatalogPicker({ entries }: { entries: Entry[] }) {
  const t = useTranslations("NewModel");
  const te = useTranslations("Enums");
  const searchId = useId();
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchCatalog(entries, query).slice(0, 50),
    [entries, query],
  );

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <label htmlFor={searchId} className="text-sm font-medium">
          {t("search")}
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className={inputClass}
        />
      </div>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {t("results", { count: results.length })}
      </p>
      <ul className="divide-y rounded-lg border">
        {results.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-3 p-3"
          >
            <div>
              <p className="font-medium">{e.label}</p>
              <p className="text-sm text-muted-foreground">
                {e.cc}cc · {te(`type.${e.type}`)} ·{" "}
                {te(`transmission.${e.transmission}`)}
                {e.status === "requested" && ` · ${t("pendingRequest")}`}
              </p>
            </div>
            <form action={addModel}>
              <input type="hidden" name="catalog_id" value={e.id} />
              <Button
                type="submit"
                variant="outline"
                className="h-11"
                aria-label={t("addThis", { model: e.label })}
              >
                {t("add")}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RequestModelForm() {
  const t = useTranslations("NewModel");
  const te = useTranslations("Enums");
  return (
    <ActionForm action={requestCatalogModel} submitLabel={t("requestSubmit")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="make" label={t("make")} placeholder="Honda" />
        <TextField name="model" label={t("model")} placeholder="PCX 160" />
        <NumberField name="cc" label={t("cc")} />
        <NumberField name="year_from" label={t("yearFrom")} />
        <NumberField name="year_to" label={t("yearTo")} />
        <SelectField
          name="type"
          label={t("type")}
          defaultValue="city_scooter"
          options={[
            "city_scooter",
            "touring",
            "adventure",
            "sport",
            "classic",
            "off_road",
          ].map((v) => ({
            value: v,
            label: te(`type.${v}`),
          }))}
        />
        <SelectField
          name="transmission"
          label={t("transmission")}
          defaultValue="automatic"
          options={["automatic", "semi_auto", "manual"].map((v) => ({
            value: v,
            label: te(`transmission.${v}`),
          }))}
        />
      </div>
      <TextAreaField name="request_note" label={t("note")} rows={3} />
    </ActionForm>
  );
}
