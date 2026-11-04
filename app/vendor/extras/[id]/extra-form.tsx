"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxField,
  NumberField,
  TextAreaField,
  TextField,
  useFieldError,
} from "@/components/form-kit";
import type { ActionState } from "@/lib/forms";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

type Extra = {
  name: string;
  description: string | null;
  terms: string | null;
  price_kind: "rental" | "time";
  price_rental: number | null;
  price_1d: number | null;
  price_7d: number | null;
  price_30d: number | null;
  all_models: boolean;
  active: boolean;
  shop_extra_models: { bike_model_id: string }[];
};

export function ExtraForm({
  action,
  extra,
  models,
}: {
  action: Action;
  extra: Extra | null;
  models: { id: string; label: string }[];
}) {
  const t = useTranslations("Extras");
  const [kind, setKind] = useState<"rental" | "time">(
    extra?.price_kind ?? "time",
  );
  const [all, setAll] = useState(extra?.all_models ?? true);
  const chosen = new Set(
    extra?.shop_extra_models.map((m) => m.bike_model_id) ?? [],
  );

  return (
    <ActionForm action={action}>
      <TextField
        name="name"
        label={t("name")}
        defaultValue={extra?.name}
        placeholder={t("namePlaceholder")}
      />
      <TextAreaField
        name="description"
        label={t("description")}
        defaultValue={extra?.description}
        rows={2}
      />
      <TextAreaField
        name="terms"
        label={t("terms")}
        hint={t("termsHint")}
        defaultValue={extra?.terms}
        rows={3}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("pricing")}</legend>
        {(["time", "rental"] as const).map((k) => (
          <label key={k} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="price_kind"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
              className="size-5"
            />
            {t(`kind.${k}`)}
          </label>
        ))}
      </fieldset>

      {kind === "rental" ? (
        <NumberField
          name="price_rental"
          label={t("priceRental")}
          defaultValue={extra?.price_rental}
        />
      ) : (
        <div className="space-y-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              name="price_1d"
              label={t("price1d")}
              defaultValue={extra?.price_1d}
            />
            <NumberField
              name="price_7d"
              label={t("price7d")}
              hint={t("optional")}
              defaultValue={extra?.price_7d}
            />
            <NumberField
              name="price_30d"
              label={t("price30d")}
              hint={t("optional")}
              defaultValue={extra?.price_30d}
            />
          </div>
          <p className="text-sm text-muted-foreground">{t("timeHint")}</p>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("appliesTo")}</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            name="all_models"
            checked={all}
            onChange={(e) => setAll(e.target.checked)}
            className="size-5"
          />
          {t("allModels")}
        </label>
        {!all && <ModelChecklist models={models} chosen={chosen} />}
      </fieldset>

      <CheckboxField
        name="active"
        label={t("activeLabel")}
        defaultChecked={extra?.active ?? true}
      />
    </ActionForm>
  );
}

function ModelChecklist({
  models,
  chosen,
}: {
  models: { id: string; label: string }[];
  chosen: Set<string>;
}) {
  const tErrors = useTranslations("Errors");
  const error = useFieldError("model_ids");
  return (
    <div className="space-y-1">
      <div className="grid gap-x-6 sm:grid-cols-2">
        {models.map((m) => (
          <label key={m.id} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="model_ids"
              value={m.id}
              defaultChecked={chosen.has(m.id)}
              className="size-5"
            />
            {m.label}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{tErrors(error)}</p>}
    </div>
  );
}

export function DeleteExtraForm({ action }: { action: Action }) {
  const t = useTranslations("Extras");
  return (
    <ActionForm
      action={action}
      submitLabel={t("delete")}
      confirm={t("deleteConfirm")}
      className="space-y-3"
    >
      <p className="text-sm text-muted-foreground">{t("deleteHint")}</p>
    </ActionForm>
  );
}
