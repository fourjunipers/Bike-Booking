"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm, inputClass, useFieldError } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/forms";
import { formatBaht } from "@/lib/money";
import {
  ANCHOR_DAYS,
  fillDays,
  priceForDays,
  pricingWarnings,
  type AnchorDay,
  type Anchors,
  type ManualDays,
} from "@/lib/pricing";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * SPEC "Pricing": anchors at the top, the 30-day table below filled live by
 * lib/pricing.ts (the server recalculates on save). Hand-edited days are
 * highlighted and can be reset to the autofill.
 */
export function PriceEditor({
  action,
  initialAnchors,
  initialManual,
}: {
  action: Action;
  initialAnchors: Anchors;
  initialManual: ManualDays;
}) {
  const t = useTranslations("Pricing");
  const [anchors, setAnchors] = useState<Record<AnchorDay, string>>(
    () =>
      Object.fromEntries(
        ANCHOR_DAYS.map((d) => [d, initialAnchors[d]?.toString() ?? ""]),
      ) as Record<AnchorDay, string>,
  );
  const [manual, setManual] = useState<Record<number, number>>(
    Object.fromEntries(
      Object.entries(initialManual).filter(([, v]) => v !== undefined),
    ) as Record<number, number>,
  );

  const parsedAnchors = useMemo(() => {
    const out: Anchors = {};
    for (const d of ANCHOR_DAYS) {
      const n = Number(anchors[d].replace(/[,\s฿]/g, ""));
      if (anchors[d].trim() !== "" && Number.isSafeInteger(n) && n > 0)
        out[d] = n;
    }
    return out;
  }, [anchors]);

  // Manual values on days that are now anchors don't apply.
  const activeManual = useMemo(() => {
    const out: ManualDays = {};
    for (const [day, v] of Object.entries(manual)) {
      if (parsedAnchors[Number(day) as AnchorDay] === undefined)
        out[Number(day)] = v;
    }
    return out;
  }, [manual, parsedAnchors]);

  const table = useMemo(() => {
    if (parsedAnchors[1] === undefined || parsedAnchors[30] === undefined)
      return null;
    try {
      return fillDays(parsedAnchors, activeManual);
    } catch {
      return null;
    }
  }, [parsedAnchors, activeManual]);

  const autofill = useMemo(() => {
    if (!table) return null;
    try {
      return fillDays(parsedAnchors);
    } catch {
      return null;
    }
  }, [parsedAnchors, table]);

  const warnings = table ? pricingWarnings(table) : [];
  const warnDays = new Set(warnings.map((w) => w.day));

  return (
    <ActionForm action={action} submitLabel={t("save")}>
      <fieldset className="space-y-2">
        <legend className="font-medium">{t("anchors")}</legend>
        <p className="text-sm text-muted-foreground">{t("anchorsHint")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {ANCHOR_DAYS.map((d) => (
            <AnchorInput
              key={d}
              day={d}
              value={anchors[d]}
              required={d === 1 || d === 30}
              onChange={(v) => setAnchors((a) => ({ ...a, [d]: v }))}
            />
          ))}
        </div>
      </fieldset>

      {Object.entries(activeManual).map(([day, v]) => (
        <input key={day} type="hidden" name={`manual_${day}`} value={v} />
      ))}

      {table ? (
        <div className="space-y-3">
          <h3 className="font-medium">{t("table")}</h3>
          <ol className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
            {table.map((row) => (
              <li
                key={row.day}
                className={`space-y-1 rounded-md border p-2 ${row.isManual ? "border-amber-500 bg-amber-50" : ""} ${warnDays.has(row.day) ? "border-destructive" : ""}`}
              >
                <label
                  htmlFor={`day_${row.day}`}
                  className="block text-xs text-muted-foreground"
                >
                  {t("dayN", { n: row.day })}
                  {row.isAnchor && ` · ${t("anchor")}`}
                  {row.isManual && ` · ${t("edited")}`}
                </label>
                {row.isAnchor ? (
                  <p id={`day_${row.day}`} className="font-semibold">
                    {formatBaht(row.total)}
                  </p>
                ) : (
                  <input
                    id={`day_${row.day}`}
                    inputMode="numeric"
                    key={`${row.day}-${row.total}`}
                    defaultValue={row.total}
                    className="h-9 w-full rounded border bg-background px-2"
                    onBlur={(e) => {
                      const n = Number(e.target.value.replace(/[,\s฿]/g, ""));
                      if (!Number.isSafeInteger(n) || n <= 0) return;
                      const auto = autofill?.[row.day - 1].total;
                      setManual((m) => {
                        const next = { ...m };
                        if (n === auto) delete next[row.day];
                        else next[row.day] = n;
                        return next;
                      });
                    }}
                  />
                )}
                {row.isManual && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-1 text-xs"
                    onClick={() =>
                      setManual((m) => {
                        const next = { ...m };
                        delete next[row.day];
                        return next;
                      })
                    }
                  >
                    {t("reset")}
                  </Button>
                )}
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            {t("over30", { price: formatBaht(priceForDays(table, 45)) })}
          </p>
          {warnings.length > 0 && (
            <ul role="alert" className="space-y-1 text-sm text-destructive">
              {warnings.map((w) => (
                <li key={`${w.kind}-${w.day}`}>
                  {w.kind === "below_day_one"
                    ? t("warnBelowDayOne", { day: w.day })
                    : t("warnCheaper", { day: w.day, shorter: w.shorterDay })}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("needAnchors")}</p>
      )}
    </ActionForm>
  );
}

function AnchorInput({
  day,
  value,
  required,
  onChange,
}: {
  day: AnchorDay;
  value: string;
  required: boolean;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("Pricing");
  const tErrors = useTranslations("Errors");
  const error = useFieldError(`anchor_${day}`);
  return (
    <div className="space-y-1">
      <label htmlFor={`anchor_${day}`} className="text-sm font-medium">
        {t("days", { n: day })}
        {required ? ` (${t("required")})` : ""}
      </label>
      <input
        id={`anchor_${day}`}
        name={`anchor_${day}`}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `anchor_${day}-error` : undefined}
        className={inputClass}
      />
      {error && (
        <p id={`anchor_${day}-error`} className="text-sm text-destructive">
          {tErrors(error)}
        </p>
      )}
    </div>
  );
}
