"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { inputBase } from "@/components/form-kit";
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
 * Row colours (owner request, 2026-11-06): green = ready for walk-ins today,
 * yellow = shown to customers but not ready, red = hidden from customers.
 */
const STATUS_CLASS = {
  ready: "border-emerald-300 bg-emerald-50",
  listed: "border-amber-300 bg-amber-50",
  hidden: "border-rose-300 bg-rose-50",
} as const;

/** How long the −1/+1 buttons wait after the last tap before saving. */
const READY_SAVE_DELAY_MS = 500;
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
        <span>
          {t("readyToday")}
          <span className="block text-xs font-normal">{t("readyHint")}</span>
        </span>
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
  // Local copies so taps show at once; the server's values win after a save.
  const [ready, setReady] = useState(row.readyCount);
  const [readyOn, setReadyOn] = useState(row.readyOn);
  const [visible, setVisible] = useState(row.visible);
  const [saved, setSaved] = useState(row);
  if (row !== saved) {
    setSaved(row);
    setReady(row.readyCount);
    setReadyOn(row.readyOn);
    setVisible(row.visible);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  function save(patch: FleetPatch) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateFleetRow(row.id, patch);
      setMessage(result.ok ? t("saved") : t(`error.${result.error}`));
    });
  }

  /** Updates the count now and saves once the taps stop. */
  function setReadyCount(n: number) {
    const v = Math.max(0, Math.min(available, n));
    if (v === ready) return;
    setReady(v);
    setReadyOn(v > 0);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(
      () => save({ ready_today_count: v, ready_today_on: v > 0 }),
      READY_SAVE_DELAY_MS,
    );
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

  const status = !visible ? "hidden" : readyOn ? "ready" : "listed";

  return (
    <li
      aria-busy={pending}
      data-ready={readyOn}
      data-status={status}
      className={`grid gap-4 rounded-lg border p-4 transition-colors lg:items-center ${COLUMNS} ${STATUS_CLASS[status]}`}
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
          className={`${inputBase} w-24`}
          onBlur={(e) => {
            const v = intOf(e.target.value);
            if (v !== row.qty) save({ qty: v });
          }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <span className="basis-full text-sm font-medium lg:sr-only">
          {t("readyToday")}{" "}
          <span className="font-normal text-muted-foreground">
            {t("readyHint")}
          </span>
        </span>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={readyOn}
            className="size-5 accent-emerald-600"
            onChange={(e) => {
              setReadyOn(e.target.checked);
              save({ ready_today_on: e.target.checked });
            }}
          />
          {readyOn ? t("on") : t("out")}
        </label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={available}
          value={ready}
          onChange={(e) => setReadyCount(intOf(e.target.value))}
          aria-label={t("readyCountFor", { model: row.label })}
          className={`${inputBase} w-16 text-center`}
        />
        <div className="inline-flex overflow-hidden rounded-md shadow-sm">
          <button
            type="button"
            className="h-11 w-12 bg-rose-600 font-semibold text-white hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:bg-slate-300"
            aria-label={t("readyMinus", { model: row.label })}
            disabled={ready <= 0}
            onClick={() => setReadyCount(ready - 1)}
          >
            −1
          </button>
          <button
            type="button"
            className="h-11 w-12 border-l border-white/40 bg-emerald-600 font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:bg-slate-300"
            aria-label={t("readyPlus", { model: row.label })}
            disabled={ready >= available}
            onClick={() => setReadyCount(ready + 1)}
          >
            +1
          </button>
        </div>
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
            checked={visible}
            className="size-5"
            onChange={(e) => {
              setVisible(e.target.checked);
              save({ visible: e.target.checked });
            }}
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
                className={`${inputBase} w-16`}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block">{t("repairBackOn")}</span>
              <input
                type="date"
                value={backOn}
                onChange={(e) => setBackOn(e.target.value)}
                aria-label={t("backOnFor", { model: row.label })}
                className={`${inputBase} w-auto`}
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
