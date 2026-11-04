"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { inputClass } from "@/components/form-kit";
import { updateFleetRow, type FleetPatch } from "../actions/fleet";

export type FleetRow = {
  id: string;
  label: string;
  cc: number;
  catalogPending: boolean;
  photo: string;
  hasPhoto: boolean;
  hasPrices: boolean;
  bookingMode: "instant" | "request";
  visible: boolean;
  qty: number;
  readyOn: boolean;
  readyCount: number;
  readyUpdatedAt: string | null;
  downtime: number;
  downtimeUntil: string | null;
};

/** SPEC "Fleet page: one screen of toggles". Every change saves immediately. */
export function FleetTable({ rows }: { rows: FleetRow[] }) {
  const t = useTranslations("Fleet");
  return (
    <div className="space-y-3">
      <div
        aria-hidden
        className="hidden grid-cols-[minmax(14rem,2fr)_6rem_minmax(10rem,1.3fr)_minmax(12rem,1.5fr)_7rem] gap-4 px-4 text-sm font-medium text-muted-foreground lg:grid"
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

  function save(patch: FleetPatch) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateFleetRow(row.id, patch);
      setMessage(result.ok ? t("saved") : t(`error.${result.error}`));
    });
  }

  const intOf = (value: string) => (value === "" ? 0 : Number(value));
  const available = Math.max(row.qty - row.downtime, 0);
  const warnings = [
    !row.hasPhoto && t("warnPhoto"),
    !row.hasPrices && t("warnPrices"),
    row.catalogPending && t("warnCatalog"),
  ].filter(Boolean) as string[];

  return (
    <li
      aria-busy={pending}
      className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[minmax(14rem,2fr)_6rem_minmax(10rem,1.3fr)_minmax(12rem,1.5fr)_7rem] lg:items-center"
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
            {row.cc}cc · {t(`mode.${row.bookingMode}`)}
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
            defaultChecked={row.readyOn}
            className="size-5"
            onChange={(e) => save({ ready_today_on: e.target.checked })}
          />
          {row.readyOn ? t("on") : t("out")}
        </label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={available}
          defaultValue={row.readyCount}
          aria-label={t("readyCountFor", { model: row.label })}
          className={`${inputClass} w-20`}
          onBlur={(e) => {
            const v = intOf(e.target.value);
            if (v !== row.readyCount)
              save({ ready_today_count: v, ready_today_on: v > 0 });
          }}
        />
        <span className="basis-full text-xs text-muted-foreground">
          {row.readyUpdatedAt
            ? t("updated", {
                when: format.relativeTime(new Date(row.readyUpdatedAt)),
              })
            : t("neverUpdated")}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-28 text-sm font-medium lg:sr-only">
          {t("downtime")}
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={row.qty}
          defaultValue={row.downtime}
          aria-label={t("downtimeFor", { model: row.label })}
          className={`${inputClass} w-20`}
          onBlur={(e) => {
            const v = intOf(e.target.value);
            if (v !== row.downtime) save({ downtime_count: v });
          }}
        />
        <input
          type="date"
          defaultValue={row.downtimeUntil ?? ""}
          disabled={row.downtime === 0}
          aria-label={t("backOnFor", { model: row.label })}
          className={`${inputClass} w-auto`}
          onBlur={(e) => {
            const v = e.target.value || null;
            if (v !== row.downtimeUntil) save({ downtime_until: v });
          }}
        />
      </div>

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
