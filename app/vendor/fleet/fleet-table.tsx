"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { inputClass } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { walkinOnlyUnits } from "@/lib/fleet";
import {
  addRepair,
  removeRepair,
  updateFleetRow,
  type FleetPatch,
} from "../actions/fleet";

export type RepairEntry = { id: string; units: number; back_on: string | null };

export type FleetRow = {
  id: string;
  label: string;
  cc: number;
  catalogPending: boolean;
  photo: string;
  hasPhoto: boolean;
  hasPrices: boolean;
  instantQty: number;
  requestQty: number;
  visible: boolean;
  qty: number;
  readyOn: boolean;
  readyCount: number;
  readyUpdatedAt: string | null;
  /** Repair entries still in force today. */
  repairs: RepairEntry[];
};

const COLUMNS =
  "lg:grid-cols-[minmax(14rem,2fr)_6rem_minmax(12rem,1.4fr)_minmax(13rem,1.5fr)_7rem]";

/**
 * SPEC "Fleet page: one screen of toggles". Every change saves immediately.
 * Bikes not ready for walk-ins today are shown lighter, so today's walk-in
 * stock stands out (owner request, 2026-11-05).
 */
export function FleetTable({ rows }: { rows: FleetRow[] }) {
  const t = useTranslations("Fleet");
  return (
    <div className="space-y-3">
      <div
        aria-hidden
        className={`hidden gap-4 px-4 text-sm font-medium text-muted-foreground lg:grid ${COLUMNS}`}
      >
        <span>{t("model")}</span>
        <span>{t("qty")}</span>
        <span>{t("readyToday")}</span>
        <span>{t("downtime")}</span>
        <span>{t("visible")}</span>
      </div>
      <ul className="space-y-3">
        {rows.map((row) => (
          <FleetRowItem key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

function FleetRowItem({ row }: { row: FleetRow }) {
  const t = useTranslations("Fleet");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(row.readyCount);
  // Follow the saved count after a refresh (e.g. ticking Ready sets it to 1).
  const [savedCount, setSavedCount] = useState(row.readyCount);
  if (row.readyCount !== savedCount) {
    setSavedCount(row.readyCount);
    setReady(row.readyCount);
  }

  function save(patch: FleetPatch) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateFleetRow(row.id, patch);
      setMessage(result.ok ? t("saved") : t(`error.${result.error}`));
    });
  }

  function setReadyCount(n: number) {
    const v = Math.max(0, Math.min(available, n));
    if (v === ready) return;
    setReady(v);
    save({ ready_today_count: v, ready_today_on: v > 0 });
  }

  const intOf = (value: string) => (value === "" ? 0 : Number(value));
  const inRepair = row.repairs.reduce((sum, r) => sum + r.units, 0);
  const available = Math.max(row.qty - inRepair, 0);
  const walkinOnly = walkinOnlyUnits(row.qty, row.instantQty, row.requestQty);
  const split = [
    row.instantQty > 0 && t("splitInstant", { n: row.instantQty }),
    row.requestQty > 0 && t("splitRequest", { n: row.requestQty }),
    walkinOnly > 0 && t("splitWalkin", { n: walkinOnly }),
  ].filter(Boolean) as string[];
  const warnings = [
    !row.hasPhoto && t("warnPhoto"),
    !row.hasPrices && t("warnPrices"),
    row.catalogPending && t("warnCatalog"),
  ].filter(Boolean) as string[];

  return (
    <li
      aria-busy={pending}
      data-ready={row.readyOn}
      className={`grid gap-4 rounded-lg border p-4 transition-opacity lg:items-center ${COLUMNS} ${row.readyOn ? "" : "bg-muted/40 opacity-60 focus-within:opacity-100 hover:opacity-100"}`}
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- Storage URL, already resized */}
        <img
          src={row.photo}
          alt=""
          className="size-14 shrink-0 rounded-md border object-cover"
        />
        <div className="min-w-0 space-y-1">
          <Link
            href={`/vendor/fleet/${row.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {row.label}
          </Link>
          <p className="text-sm text-muted-foreground">
            {row.cc}cc{split.length > 0 && ` · ${split.join(" · ")}`}
          </p>
          {warnings.map((w) => (
            <p key={w} className="text-sm text-destructive">
              {w}
            </p>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 lg:block">
        <span className="w-28 text-sm font-medium lg:sr-only">{t("qty")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={row.qty}
          aria-label={t("qtyFor", { model: row.label })}
          className={`${inputClass} w-24`}
          onBlur={(e) => {
            const v = intOf(e.target.value);
            if (v !== row.qty) save({ qty: v });
          }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 text-sm font-medium lg:sr-only">
          {t("readyToday")}
        </span>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={row.readyOn}
            className="size-5"
            onChange={(e) => save({ ready_today_on: e.target.checked })}
          />
          {row.readyOn ? t("on") : t("out")}
        </label>
        <Button
          type="button"
          variant="outline"
          className="size-11"
          aria-label={t("readyMinus", { model: row.label })}
          disabled={ready <= 0 || pending}
          onClick={() => setReadyCount(ready - 1)}
        >
          −1
        </Button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={available}
          key={row.readyCount}
          defaultValue={row.readyCount}
          aria-label={t("readyCountFor", { model: row.label })}
          className={`${inputClass} w-16 text-center`}
          onBlur={(e) => setReadyCount(intOf(e.target.value))}
        />
        <Button
          type="button"
          variant="outline"
          className="size-11"
          aria-label={t("readyPlus", { model: row.label })}
          disabled={ready >= available || pending}
          onClick={() => setReadyCount(ready + 1)}
        >
          +1
        </Button>
        <span className="basis-full text-xs text-muted-foreground">
          {row.readyUpdatedAt
            ? t("updated", {
                when: format.relativeTime(new Date(row.readyUpdatedAt)),
              })
            : t("neverUpdated")}
        </span>
      </div>

      <Repairs row={row} inRepair={inRepair} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            defaultChecked={row.visible}
            className="size-5"
            onChange={(e) => save({ visible: e.target.checked })}
          />
          <span>{t("visible")}</span>
        </label>
        <p role="status" aria-live="polite" className="basis-full text-xs">
          {pending ? t("saving") : message}
        </p>
      </div>
    </li>
  );
}

/** Repair entries: each with its own count and optional back-in-service date. */
function Repairs({ row, inRepair }: { row: FleetRow; inRepair: number }) {
  const t = useTranslations("Fleet");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();
  const [units, setUnits] = useState("1");
  const [backOn, setBackOn] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);

  function add() {
    setMessage(null);
    startTransition(async () => {
      const result = await addRepair(row.id, {
        units: Number(units),
        back_on: backOn || undefined,
      });
      if (result.ok) {
        setUnits("1");
        setBackOn("");
        setConflicts(result.conflicts);
        setMessage(t("saved"));
      } else {
        setMessage(t(`error.${result.error}`));
      }
    });
  }

  function remove(id: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await removeRepair(row.id, id);
      setConflicts([]);
      setMessage(result.ok ? t("saved") : t(`error.${result.error}`));
    });
  }

  return (
    <div className="space-y-2" aria-busy={pending}>
      <span className="text-sm font-medium lg:sr-only">{t("downtime")}</span>
      <details>
        <summary className="min-h-11 cursor-pointer content-center">
          {inRepair > 0 ? t("inRepair", { n: inRepair }) : t("noneInRepair")}
        </summary>
        <div className="mt-2 space-y-3">
          {row.repairs.length > 0 && (
            <ul className="space-y-2 text-sm">
              {row.repairs.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    {t("repairEntry", { n: r.units })} ·{" "}
                    {r.back_on
                      ? t("backOn", {
                          date: format.dateTime(
                            new Date(`${r.back_on}T00:00:00`),
                            {
                              day: "numeric",
                              month: "short",
                            },
                          ),
                        })
                      : t("noBackDate")}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => remove(r.id)}
                  >
                    {t("backInService")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-sm">
              <span className="block">{t("repairUnits")}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={Math.max(row.qty - inRepair, 1)}
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                aria-label={t("downtimeFor", { model: row.label })}
                className={`${inputClass} w-16`}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block">{t("repairBackOn")}</span>
              <input
                type="date"
                value={backOn}
                onChange={(e) => setBackOn(e.target.value)}
                aria-label={t("backOnFor", { model: row.label })}
                className={`${inputClass} w-auto`}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={pending || inRepair >= row.qty}
              onClick={add}
            >
              {t("addRepair")}
            </Button>
          </div>
          {conflicts.length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              {t("repairConflicts", { codes: conflicts.join(", ") })}
            </p>
          )}
          <p role="status" aria-live="polite" className="text-xs">
            {pending ? t("saving") : message}
          </p>
        </div>
      </details>
    </div>
  );
}
