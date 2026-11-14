"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ActionForm,
  SelectInput,
  TextArea,
  TextInput,
  useFieldError,
} from "@/components/action-form";
import { Field, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import type { OutState, ProblemKind } from "@/lib/gear-permissions";
import { maxGearQuantity } from "@/lib/general-products";
import { cn } from "@/lib/utils";
import {
  reportProblem,
  resolveProblem,
  setStockQuantity,
  updateProblem,
} from "./actions";

/**
 * Rental gear's stock on the Details tab (owner, 14 Nov 2026): the quantity
 * stepper, "Report a problem" and the buttons on a line of "Out of service".
 * Native inputs and a native dialog; every control is 44 px tall.
 */

type StockTarget = {
  slug: string;
  /** The product. */
  id: string;
  /** The location. */
  location: string;
};

// A dialog, a bottom sheet on a phone -------------------------------------------------------

/**
 * A modal dialog: a sheet rising from the bottom edge on a phone, a centred
 * box from 640 px. Closes with its button, Escape or a tap outside. What is
 * inside is drawn only while it is open, so a form starts fresh each time.
 */
function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const t = useTranslations("Products.gearStock");
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={heading}
      onClose={onClose}
      onClick={(event) => {
        // The dialog itself is only hit on its backdrop.
        if (event.target === ref.current) onClose();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t-2xl border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/50 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-lg sm:rounded-xl"
    >
      {open && (
        <div className="p-4 pb-6 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3 border-b pb-3">
            <h2 id={heading} className="text-lg font-semibold">
              {title}
            </h2>
            <Button
              type="button"
              variant="ghost"
              className="-mt-1 -mr-2 h-11 px-3"
              onClick={onClose}
            >
              {t("close")}
            </Button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// Change quantity ---------------------------------------------------------------------------

const stepClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-input bg-card text-xl font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

function StepperField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("Products.gearStock");
  const error = useFieldError("quantity");
  const number = /^\d{1,6}$/.test(value) ? Number(value) : null;
  const step = (by: number) =>
    onChange(
      String(Math.min(maxGearQuantity, Math.max(0, (number ?? 0) + by))),
    );
  return (
    <Field id={id} label={t("quantity")} help={t("quantityHelp")} error={error}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t("fewer")}
          disabled={number === null || number <= 0}
          onClick={() => step(-1)}
          className={stepClass}
        >
          −
        </button>
        <input
          id={id}
          name="quantity"
          inputMode="numeric"
          maxLength={6}
          required
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help`}
          className={cn(inputClass, "w-24 text-center tabular-nums")}
        />
        <button
          type="button"
          aria-label={t("more")}
          disabled={number !== null && number >= maxGearQuantity}
          onClick={() => step(1)}
          className={stepClass}
        >
          +
        </button>
      </div>
    </Field>
  );
}

/**
 * "Change quantity": − and + beside a number field. "Save quantity" shows
 * once the number differs from what is saved. Owners and managers.
 */
export function QuantityStepper({
  target,
  current,
}: {
  target: StockTarget;
  current: number;
}) {
  const t = useTranslations("Products.gearStock");
  const [value, setValue] = useState(String(current));
  return (
    <ActionForm
      action={setStockQuantity}
      hidden={{ ...target, type: "gear" }}
      submitLabel={t("saveQuantity")}
      showSubmit={value.trim() !== String(current)}
    >
      <StepperField
        id={`quantity-${target.location}`}
        value={value}
        onChange={setValue}
      />
    </ActionForm>
  );
}

// Report a problem --------------------------------------------------------------------------

function CountField({ free }: { free: number }) {
  const t = useTranslations("Products.gearStock");
  const error = useFieldError("quantity");
  return (
    <Field
      id="report-quantity"
      label={t("howMany")}
      help={t("howManyHelp", { count: free })}
      error={error}
    >
      <input
        id="report-quantity"
        name="quantity"
        type="number"
        inputMode="numeric"
        min={1}
        max={free}
        required
        defaultValue={1}
        aria-invalid={error ? true : undefined}
        aria-describedby="report-quantity-help"
        className={cn(inputClass, "max-w-28")}
      />
    </Field>
  );
}

/**
 * One button and one dialog for everything that can go wrong with a unit in
 * use: in repair, lost, or damaged for good. Counted gear asks how many;
 * tracked gear asks which unit. The choices are the ones this person's role
 * allows.
 */
export function ReportProblem({
  target,
  kinds,
  units,
  free,
  today,
}: {
  target: StockTarget;
  /** What this person may report, in order. */
  kinds: ProblemKind[];
  /** Tracked gear: the units in use and free, with the name each goes by. */
  units?: { id: string; name: string }[];
  /** How many units are in use and free. */
  free: number;
  /** Today at the location, "2026-11-14". */
  today: string;
}) {
  const t = useTranslations("Products.gearStock");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ProblemKind>(kinds[0]);
  const [happened, setHappened] = useState(today);
  const start = () => {
    setKind(kinds[0]);
    setHappened(today);
    setOpen(true);
  };
  return (
    <>
      <Button
        type="button"
        className="h-11 px-6"
        disabled={free === 0}
        onClick={start}
      >
        {t("reportButton")}
      </Button>
      {free === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">{t("reportNone")}</p>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("reportTitle")}
      >
        <ActionForm
          action={reportProblem}
          hidden={{ ...target }}
          submitLabel={t(`submit.${kind}`)}
          destructive={kind === "damaged"}
          confirmIf={() =>
            kind === "damaged" ? t("writeOffConfirm") : undefined
          }
          onOk={() => setOpen(false)}
        >
          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium">
              {t("what")}
            </legend>
            <div className="space-y-2">
              {kinds.map((value) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 has-checked:border-primary has-checked:bg-highlight has-focus-visible:ring-2 has-focus-visible:ring-ring"
                >
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                    className="mt-0.5 size-5 accent-primary"
                  />
                  <span>
                    <span className="block font-medium">
                      {t(`kind.${value}`)}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {t(`kindHelp.${value}`)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {units ? (
            <SelectInput
              name="unit"
              label={t("whichUnit")}
              required
              options={units.map((unit) => ({
                value: unit.id,
                label: unit.name,
              }))}
            />
          ) : (
            <CountField free={free} />
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput
              name="happened_on"
              label={t("happenedOn")}
              type="date"
              required
              max={today}
              value={happened}
              onChange={(event) => setHappened(event.target.value)}
            />
            {kind === "repair" && (
              <TextInput
                name="expected_back"
                label={t("expectedBack")}
                type="date"
                min={happened || undefined}
              />
            )}
          </div>
          <TextArea name="notes" label={t("notes")} maxLength={500} />
        </ActionForm>
      </Sheet>
    </>
  );
}

// A line of "Out of service" ----------------------------------------------------------------

/**
 * What can be done with one unit out of service. In repair: "Back in use",
 * and "Write off as damaged" for owners and managers. Lost: "Found, back in
 * use" and "Write off", both for owners and managers. "Edit" opens the
 * line's date, expected-back date and notes. None of these is the card's
 * main button, so all are outlined.
 */
export function ProblemActions({
  slug,
  unit,
  state,
  name,
  can,
  values,
  today,
}: {
  slug: string;
  unit: string;
  state: OutState;
  /** Tracked gear: the unit's name, said after each button's label. */
  name?: string;
  can: { backInUse: boolean; found: boolean; writeOff: boolean; edit: boolean };
  values: { happenedOn: string; expectedBack: string; notes: string };
  today: string;
}) {
  const t = useTranslations("Products.gearStock");
  const [editing, setEditing] = useState(false);
  const [happened, setHappened] = useState(values.happenedOn);
  const says = (label: string) => (name ? `${label}: ${name}` : label);
  const resolve = (
    action: "back_in_use" | "found" | "write_off",
    label: string,
    confirm?: string,
  ) => (
    <ActionForm
      action={resolveProblem}
      hidden={{ slug, unit, resolve: action }}
      submitLabel={says(label)}
      confirm={confirm}
      destructive={action === "write_off"}
      quiet
    />
  );
  return (
    <div className="flex flex-wrap items-start gap-2">
      {state === "repair" &&
        can.backInUse &&
        resolve("back_in_use", t("backInUse"))}
      {state === "lost" && can.found && resolve("found", t("found"))}
      {can.edit && (
        <Button
          type="button"
          variant="outline"
          className="h-11 px-6"
          onClick={() => {
            setHappened(values.happenedOn);
            setEditing(true);
          }}
        >
          {says(t("edit"))}
        </Button>
      )}
      {can.writeOff &&
        resolve(
          "write_off",
          t(state === "repair" ? "writeOffDamaged" : "writeOff"),
          t("writeOffConfirm"),
        )}
      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title={name ? `${t("editTitle")}: ${name}` : t("editTitle")}
      >
        <ActionForm
          action={updateProblem}
          hidden={{ slug, unit, state }}
          onOk={() => setEditing(false)}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput
              name="happened_on"
              label={t("happenedOn")}
              type="date"
              required
              max={today}
              value={happened}
              onChange={(event) => setHappened(event.target.value)}
            />
            {state === "repair" && (
              <TextInput
                name="expected_back"
                label={t("expectedBack")}
                type="date"
                min={happened || undefined}
                defaultValue={values.expectedBack}
              />
            )}
          </div>
          <TextArea
            name="notes"
            label={t("notes")}
            maxLength={500}
            defaultValue={values.notes}
          />
        </ActionForm>
      </Sheet>
    </div>
  );
}
