"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ActionForm,
  CheckboxInput,
  TextArea,
  TextInput,
  useFieldError,
  type FormAction,
} from "@/components/action-form";
import { Field, inputClass } from "@/components/form";
import { generalTypes, type GeneralType } from "@/lib/general-products";
import { cn } from "@/lib/utils";
import {
  changeGearUnit,
  createGeneralProduct,
  markDamaged,
  markLost,
  markRepaired,
  resolveLost,
  saveGeneralProduct,
  setStockQuantity,
  setUnitLabel,
} from "./actions";

/**
 * Forms for general products (owner, 13 Nov 2026): the two-choice start of
 * "New product", the General form, and the Stock tab's quantity, damaged and
 * lost forms. Native inputs throughout; every control is 44 px tall.
 */

const choiceClass = (on: boolean) =>
  cn(
    "flex min-h-14 cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
    on ? "border-primary bg-primary/5" : "bg-card hover:bg-muted",
  );

/**
 * New product opens with two choices, Vehicle and General. Vehicle is the
 * form as it was; General asks for a type, a name and a description.
 */
export function NewProductChoice({
  vehicle,
  general,
}: {
  vehicle: ReactNode;
  general: ReactNode;
}) {
  const t = useTranslations("Products.choice");
  const [choice, setChoice] = useState<"vehicle" | "general">("vehicle");
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 block text-sm font-medium">
          {t("legend")}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["vehicle", "general"] as const).map((value) => (
            <label key={value} className={choiceClass(choice === value)}>
              <input
                type="radio"
                name="product_choice"
                value={value}
                checked={choice === value}
                onChange={() => setChoice(value)}
                className="mt-0.5 size-5 accent-primary"
              />
              <span>
                <span className="block font-medium">{t(value)}</span>
                <span className="block text-sm text-muted-foreground">
                  {t(`${value}Help`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {choice === "vehicle" ? vehicle : general}
    </div>
  );
}

/**
 * A general product. Adding one: its type (Rental gear, Item for sale,
 * Service or extra), a name, a description, and a quantity per location for
 * gear and items for sale; a service has none. No licence class, minimum age,
 * buffers or deposit. Editing one: the type is fixed.
 */
export function GeneralForm({
  slug,
  locations,
  values,
}: {
  slug: string;
  /** The shop's locations, for the quantity fields (adding only). */
  locations: { id: string; name: string }[];
  /** Editing: the product as it is. */
  values?: {
    id: string;
    type: GeneralType;
    name: string;
    description: string;
    track: boolean;
  };
}) {
  const t = useTranslations("Products.general");
  const tType = useTranslations("Products.type");
  const [type, setType] = useState<GeneralType>(values?.type ?? "gear");
  const typeError = useFieldError("type");
  return (
    <ActionForm
      action={values ? saveGeneralProduct : createGeneralProduct}
      hidden={{
        slug,
        ...(values ? { id: values.id, type: values.type } : {}),
      }}
      submitLabel={values ? undefined : t("save")}
      className="max-w-3xl"
    >
      {!values && (
        <fieldset>
          <legend className="mb-2 block text-sm font-medium">
            {t("typeLegend")}
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {generalTypes.map((value) => (
              <label key={value} className={choiceClass(type === value)}>
                <input
                  type="radio"
                  name="type"
                  value={value}
                  checked={type === value}
                  onChange={() => setType(value)}
                  className="mt-0.5 size-5 accent-primary"
                />
                <span>
                  <span className="block font-medium">{tType(value)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {t(`typeHelp.${value}`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {typeError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {typeError}
            </p>
          )}
        </fieldset>
      )}
      <TextInput
        name="name"
        label={t("name")}
        help={values ? undefined : t("nameHelp")}
        placeholder={t("namePlaceholder")}
        required
        maxLength={120}
        defaultValue={values?.name}
      />
      <TextArea
        name="description"
        label={t("description")}
        maxLength={2000}
        defaultValue={values?.description}
      />
      {type === "gear" && (
        <CheckboxInput
          name="track_units"
          label={t("trackUnits")}
          help={t("trackUnitsHelp")}
          defaultChecked={values?.track}
        />
      )}
      {!values && type !== "service" && (
        <div className="grid gap-5 sm:grid-cols-2">
          {locations.map((location) => (
            <TextInput
              key={location.id}
              name={`quantity:${location.id}`}
              label={
                locations.length > 1
                  ? t("quantityAt", { location: location.name })
                  : t("quantity")
              }
              help={t("quantityHelp")}
              inputMode="numeric"
              maxLength={6}
              className="max-w-28"
            />
          ))}
        </div>
      )}
      {!values && type === "service" && (
        <p className="text-sm text-muted-foreground">{t("serviceNote")}</p>
      )}
      {!values && (
        <p className="text-sm text-muted-foreground">{t("pricesLater")}</p>
      )}
    </ActionForm>
  );
}

// The Stock tab --------------------------------------------------------------------------

/** "How many", with its own id so several forms can share a page. */
function CountField({
  id,
  label,
  help,
  defaultValue,
}: {
  id: string;
  label: string;
  help?: string;
  defaultValue?: number;
}) {
  const error = useFieldError("quantity");
  return (
    <Field id={id} label={label} help={help} error={error}>
      <input
        id={id}
        name="quantity"
        inputMode="numeric"
        maxLength={6}
        required
        autoComplete="off"
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={help ? `${id}-help` : undefined}
        className={cn(inputClass, "max-w-28")}
      />
    </Field>
  );
}

type StockTarget = {
  slug: string;
  /** The product. */
  id: string;
  /** The location. */
  location: string;
};

const hiddenOf = (target: StockTarget) => ({
  slug: target.slug,
  id: target.id,
  location: target.location,
});

/** One small form of the Stock tab: a count, perhaps a field more, a button. */
function StockForm({
  target,
  action,
  name,
  label,
  help,
  defaultValue,
  submitLabel,
  confirm,
  destructive,
  hidden,
  children,
}: {
  target: StockTarget;
  action: FormAction;
  /** Makes the field's id unique on the page. */
  name: string;
  label: string;
  help?: string;
  defaultValue?: number;
  submitLabel: string;
  confirm?: string;
  destructive?: boolean;
  hidden?: Record<string, string>;
  children?: ReactNode;
}) {
  return (
    <ActionForm
      action={action}
      hidden={{ ...hiddenOf(target), ...hidden }}
      submitLabel={submitLabel}
      confirm={confirm}
      destructive={destructive}
      className="space-y-3"
    >
      <CountField
        id={`${name}-${target.location}`}
        label={label}
        help={help}
        defaultValue={defaultValue}
      />
      {children}
    </ActionForm>
  );
}

/** "Change quantity": owners and managers. */
export function QuantityForm({
  target,
  type,
  current,
}: {
  target: StockTarget;
  type: "gear" | "sale_item";
  current: number;
}) {
  const t = useTranslations("Products.stockTab");
  return (
    <StockForm
      // A saved quantity redraws the field with it.
      key={current}
      target={target}
      action={setStockQuantity}
      name="quantity"
      label={t("quantity")}
      help={t(type === "gear" ? "quantityHelpGear" : "quantityHelpSale")}
      defaultValue={current}
      submitLabel={t("changeQuantity")}
      hidden={{ type }}
    />
  );
}

/** "Mark damaged": out of use from now, until a time if one is known. */
export function DamagedForm({
  target,
  zone,
}: {
  target: StockTarget;
  /** The location's time zone, named beside the time field. */
  zone: string;
}) {
  const t = useTranslations("Products.stockTab");
  return (
    <StockForm
      target={target}
      action={markDamaged}
      name="damaged"
      label={t("damagedHowMany")}
      submitLabel={t("markDamaged")}
    >
      <UntilField
        id={`until-${target.location}`}
        label={t("until")}
        help={t("untilHelp", { zone })}
      />
    </StockForm>
  );
}

function UntilField({
  id,
  label,
  help,
}: {
  id: string;
  label: string;
  help: string;
}) {
  const error = useFieldError("until");
  return (
    <Field id={id} label={label} help={help} error={error}>
      <input
        id={id}
        name="until"
        type="datetime-local"
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help`}
        className={cn(inputClass, "max-w-64")}
      />
    </Field>
  );
}

/** "Back in use": that many damaged units return to stock now. */
export function RepairedForm({ target }: { target: StockTarget }) {
  const t = useTranslations("Products.stockTab");
  return (
    <StockForm
      target={target}
      action={markRepaired}
      name="repaired"
      label={t("repairedHowMany")}
      submitLabel={t("backInUse")}
    />
  );
}

/** "Mark lost": owners, managers and staff. */
export function LostForm({ target }: { target: StockTarget }) {
  const t = useTranslations("Products.stockTab");
  return (
    <StockForm
      target={target}
      action={markLost}
      name="lost"
      label={t("lostHowMany")}
      submitLabel={t("markLost")}
      confirm={t("lostConfirm")}
      destructive
    />
  );
}

/** Lost units: back in stock, or removed for good. Owners and managers. */
export function ResolveLostForms({ target }: { target: StockTarget }) {
  const t = useTranslations("Products.stockTab");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StockForm
        target={target}
        action={resolveLost}
        name="restore"
        label={t("restoreHowMany")}
        submitLabel={t("restore")}
        hidden={{ resolve: "restore" }}
      />
      <StockForm
        target={target}
        action={resolveLost}
        name="remove"
        label={t("removeHowMany")}
        submitLabel={t("remove")}
        confirm={t("removeConfirm")}
        destructive
        hidden={{ resolve: "remove" }}
      />
    </div>
  );
}

// One unit of tracked gear ---------------------------------------------------------------

/** A unit's optional label. Owners and managers. */
export function UnitLabelForm({
  slug,
  unit,
  label,
}: {
  slug: string;
  unit: string;
  label: string;
}) {
  const t = useTranslations("Products.stockTab");
  return (
    <ActionForm
      action={setUnitLabel}
      hidden={{ slug, unit }}
      submitLabel={t("saveLabel")}
      className="space-y-3"
    >
      <LabelField id={`label-${unit}`} defaultValue={label} />
    </ActionForm>
  );
}

function LabelField({
  id,
  defaultValue,
}: {
  id: string;
  defaultValue: string;
}) {
  const t = useTranslations("Products.stockTab");
  const error = useFieldError("label");
  return (
    <Field id={id} label={t("label")} error={error}>
      <input
        id={id}
        name="label"
        maxLength={60}
        autoComplete="off"
        defaultValue={defaultValue}
        placeholder={t("labelPlaceholder")}
        aria-invalid={error ? true : undefined}
        className={cn(inputClass, "max-w-64")}
      />
    </Field>
  );
}

/** One button on a unit's row: damaged, back in use, lost, restore or remove. */
export function UnitButton({
  slug,
  unit,
  change,
  label,
  confirm,
  destructive,
}: {
  slug: string;
  unit: string;
  change: "damaged" | "repaired" | "lost" | "restore" | "remove";
  label: string;
  confirm?: string;
  destructive?: boolean;
}) {
  return (
    <ActionForm
      action={changeGearUnit}
      hidden={{ slug, unit, change }}
      submitLabel={label}
      confirm={confirm}
      destructive={destructive}
    />
  );
}
