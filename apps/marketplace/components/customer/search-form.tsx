"use client";

import { useCallback, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { inputClass } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { localePath, type CustomerLocale } from "@/i18n/config";
import { PlaceSearch } from "./place-search";
import {
  addDays,
  BIKE_TYPES,
  DEFAULT_TIME,
  timeOptions,
  type BikeType,
  type SearchParams,
} from "@/lib/search-params";

export type StationOption = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type Point = { lat: number; lng: number; place: string };

type Mode = "ahead" | "today";
const MODES: readonly Mode[] = ["ahead", "today"];

/** Each path has its own card tint: Book ahead leaf green, Ride today mango. */
const PANEL_TINT: Record<Mode, string> = {
  ahead: "border-leaf/50 bg-leaf-soft",
  today: "border-mango/60 bg-mango-soft",
};

/**
 * Home and search form (SPEC "Customer screens"): where (a place search with
 * suggestions when Google Places is set up, GPS, or optionally a train
 * station), when (Book ahead with
 * dates, or Ride today for bikes ready now), and bike types (any number).
 * A plain GET form, so every search is a shareable /search URL.
 */
export function SearchForm({
  stations,
  placeSearch,
  initial,
  compact = false,
  stacked = false,
}: {
  stations: StationOption[];
  /** The server has a Places key: show the place search. */
  placeSearch: boolean;
  initial?: Partial<SearchParams>;
  compact?: boolean;
  /** One column, for the narrow sidebar on the search page. */
  stacked?: boolean;
}) {
  const t = useTranslations("Search");
  const tb = useTranslations("Bikes");
  const uid = useId();
  // The customer layout only renders for customer languages.
  const locale = useLocale() as CustomerLocale;
  const [point, setPoint] = useState<Point | null>(
    initial?.lat !== undefined && initial?.lng !== undefined
      ? { lat: initial.lat, lng: initial.lng, place: initial.place ?? "" }
      : null,
  );
  const [gpsState, setGpsState] = useState<"idle" | "busy" | "failed">("idle");
  const [mode, setMode] = useState<Mode>(
    initial?.now ? "today" : "ahead",
  );
  const [types, setTypes] = useState<BikeType[]>(initial?.types ?? []);
  const [fromDate, fromTime] = (initial?.from ?? `T${DEFAULT_TIME}`).split("T");
  const [toDate, toTime] = (initial?.to ?? `T${DEFAULT_TIME}`).split("T");
  const [from, setFrom] = useState({ date: fromDate, time: fromTime });
  const [to, setTo] = useState({ date: toDate, time: toTime });
  const [placesFailed, setPlacesFailed] = useState(false);
  const onPlacesFail = useCallback(() => setPlacesFailed(true), []);
  const showPlaceSearch = placeSearch && !placesFailed;

  function useGps() {
    if (!navigator.geolocation) {
      setGpsState("failed");
      return;
    }
    setGpsState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          place: t("myLocation"),
        });
        setGpsState("idle");
      },
      () => setGpsState("failed"),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  const dated = mode === "ahead" && from.date && to.date;
  const stationValue =
    stations.find(
      (s) =>
        point &&
        Math.abs(s.lat - point.lat) < 1e-5 &&
        Math.abs(s.lng - point.lng) < 1e-5,
    )?.id ?? "";

  const where = (
    <fieldset className="min-w-0 space-y-2">
      <legend className="font-medium">{t("where")}</legend>
      <div className={`grid gap-2 ${stacked ? "" : "sm:grid-cols-[1fr_auto]"}`}>
        {showPlaceSearch ? (
          <PlaceSearch onChoose={setPoint} onFail={onPlacesFail} />
        ) : (
          <StationSelect
            stations={stations}
            value={stationValue}
            point={point}
            onChange={setPoint}
          />
        )}
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={useGps}
          disabled={gpsState === "busy"}
        >
          {gpsState === "busy" ? t("locating") : t("useMyLocation")}
        </Button>
      </div>
      {placesFailed && (
        <p role="alert" className="text-sm text-destructive">
          {t("placeUnavailable")}
        </p>
      )}
      {gpsState === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {t("gpsFailed")}
        </p>
      )}
      {point && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-card px-3 py-1 font-medium text-leaf-ink ring-1 ring-leaf/40">
            {t("placeChosen", { place: point.place })}
          </span>
          <button
            type="button"
            onClick={() => setPoint(null)}
            className="min-h-11 px-2 font-medium text-link underline underline-offset-4"
          >
            {t("clearPlace")}
          </button>
        </p>
      )}
      {/* Optional when the place search works; the main picker otherwise. */}
      {showPlaceSearch && (
        <details
          className="rounded-xl border bg-card/70 px-3"
          open={stationValue !== ""}
        >
          <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
            {t("stationFilter")}
          </summary>
          <div className="pb-3">
            <StationSelect
              stations={stations}
              value={stationValue}
              point={point}
              onChange={setPoint}
            />
          </div>
        </details>
      )}
      <p className="text-xs text-muted-foreground">{t("stationsCredit")}</p>
    </fieldset>
  );

  const dates = mode === "ahead" && (
    <fieldset className="min-w-0 space-y-2">
      <legend className="sr-only">{t("when")}</legend>
      <div className={`grid gap-3 ${stacked ? "" : "sm:grid-cols-2"}`}>
        <DateTime
          legend={t("pickup")}
          value={from}
          onChange={(v) => {
            setFrom(v);
            // Keep the return after the pickup: default to the next day.
            if (v.date && (!to.date || to.date <= v.date))
              setTo({ ...to, date: addDays(v.date, 1) });
          }}
          ids="from"
        />
        <DateTime
          legend={t("return")}
          value={to}
          onChange={setTo}
          ids="to"
          minDate={from.date || undefined}
        />
      </div>
    </fieldset>
  );

  const bikeTypes = (
    <fieldset className="min-w-0 space-y-2">
      <legend className="font-medium">{t("bikeType")}</legend>
      <p id={`${uid}-types-hint`} className="text-sm text-muted-foreground">
        {t("typesHint")}
      </p>
      <div
        className="flex flex-wrap gap-2"
        aria-describedby={`${uid}-types-hint`}
      >
        <button
          type="button"
          aria-pressed={types.length === 0}
          onClick={() => setTypes([])}
          className={chipClass(types.length === 0)}
        >
          <Tick on={types.length === 0} />
          {t("anyType")}
        </button>
        {BIKE_TYPES.map((type) => (
          <label key={type} className="cursor-pointer">
            <input
              type="checkbox"
              name="type"
              value={type}
              checked={types.includes(type)}
              onChange={(e) =>
                setTypes(
                  e.target.checked
                    ? BIKE_TYPES.filter((x) => x === type || types.includes(x))
                    : types.filter((x) => x !== type),
                )
              }
              className="peer sr-only"
            />
            <span className={chipClass(types.includes(type), true)}>
              <Tick on={types.includes(type)} />
              {tb(`type.${type}`)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  const submit = (
    <Button
      type="submit"
      size="lg"
      className="h-12 w-full px-6 text-base sm:w-auto"
    >
      {t("search")}
    </Button>
  );

  /** Tabs pattern: arrows, Home and End move between the two tabs. */
  function onTabKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const i = MODES.indexOf(mode);
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? MODES[(i + 1) % MODES.length]
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? MODES[(i + MODES.length - 1) % MODES.length]
          : e.key === "Home"
            ? MODES[0]
            : e.key === "End"
              ? MODES[MODES.length - 1]
              : null;
    if (!next) return;
    e.preventDefault();
    setMode(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  }

  return (
    <form
      action={localePath(locale, "/search")}
      method="get"
      className="space-y-4"
    >
      {point && (
        <>
          <input type="hidden" name="lat" value={point.lat.toFixed(5)} />
          <input type="hidden" name="lng" value={point.lng.toFixed(5)} />
          <input type="hidden" name="place" value={point.place} />
        </>
      )}
      {mode === "today" && <input type="hidden" name="now" value="1" />}
      {dated && (
        <>
          <input
            type="hidden"
            name="from"
            value={`${from.date}T${from.time}`}
          />
          <input type="hidden" name="to" value={`${to.date}T${to.time}`} />
        </>
      )}

      {compact ? (
        <>
          {where}
          {submit}
        </>
      ) : (
        <div className="space-y-0">
          <p id={`${uid}-when`} className="mb-2 font-medium">
            {t("when")}
          </p>
          <div
            role="tablist"
            aria-labelledby={`${uid}-when`}
            className="grid grid-cols-2 gap-2"
          >
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                id={`${uid}-tab-${m}`}
                aria-selected={mode === m}
                aria-controls={`${uid}-panel`}
                tabIndex={mode === m ? 0 : -1}
                onClick={() => setMode(m)}
                onKeyDown={onTabKey}
                className={tabClass(m, mode === m)}
              >
                {t(m === "ahead" ? "bookAhead" : "rideToday")}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`${uid}-panel`}
            aria-labelledby={`${uid}-tab-${mode}`}
            data-mode={mode}
            className={`mt-3 space-y-4 rounded-2xl border-2 p-4 md:p-5 ${PANEL_TINT[mode]}`}
          >
            <p className="text-sm font-medium">
              {t(mode === "ahead" ? "bookAheadHint" : "rideTodayHint")}
            </p>
            {where}
            {dates}
            {bikeTypes}
            {submit}
          </div>
        </div>
      )}
    </form>
  );
}

/** Train stations: the optional filter, and the fallback when Places fails. */
function StationSelect({
  stations,
  value,
  point,
  onChange,
}: {
  stations: StationOption[];
  value: string;
  point: Point | null;
  onChange: (p: Point | null) => void;
}) {
  const t = useTranslations("Search");
  return (
    <label className="block">
      <span className="sr-only">{t("station")}</span>
      <select
        value={value}
        onChange={(e) => {
          const s = stations.find((x) => x.id === e.target.value);
          onChange(s ? { lat: s.lat, lng: s.lng, place: s.name } : null);
        }}
        className={inputClass}
      >
        <option value="">
          {point && !value ? point.place : t("chooseStation")}
        </option>
        {stations.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateTime({
  legend,
  value,
  onChange,
  ids,
  minDate,
}: {
  legend: string;
  value: { date: string; time: string };
  onChange: (v: { date: string; time: string }) => void;
  ids: string;
  minDate?: string;
}) {
  const t = useTranslations("Search");
  return (
    <fieldset className="min-w-0 space-y-1">
      <legend className="font-medium">{legend}</legend>
      {/* min-w-0: a fieldset is min-content wide by default, wider than a phone. */}
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <label>
          <span className="sr-only">{t("date")}</span>
          <input
            id={`${ids}-date`}
            type="date"
            value={value.date}
            min={minDate}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
            className={inputClass}
          />
        </label>
        <label>
          <span className="sr-only">{t("time")}</span>
          {/* A list, not <input type="time">: always 24-hour, any language. */}
          <select
            id={`${ids}-time`}
            value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
            className={inputClass}
          >
            {timeOptions(value.time).map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

/** The tick on a chosen chip; hidden from screen readers (the state is). */
function Tick({ on }: { on: boolean }) {
  return on ? <span aria-hidden>✓</span> : null;
}

/**
 * A path tab: filled with its colour when chosen, outlined when not. The
 * chosen one also gets a notch pointing at its card and heavier text, so
 * colour isn't the only signal.
 */
function tabClass(m: Mode, on: boolean) {
  const base =
    "relative flex min-h-14 items-center justify-center rounded-xl border-2 px-3 text-center text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:text-lg";
  const notch =
    "after:absolute after:-bottom-2 after:left-1/2 after:size-3.5 after:-translate-x-1/2 after:rotate-45 after:bg-inherit";
  if (m === "ahead")
    return `${base} ${on ? `border-leaf bg-leaf font-black text-white ${notch}` : "border-leaf bg-card text-leaf-ink hover:bg-leaf-soft"}`;
  return `${base} ${on ? `border-mango bg-mango font-black text-ink ${notch}` : "border-mango bg-card text-ink hover:bg-mango-soft"}`;
}

/** A type toggle: near-black on mango when on, with a tick so colour isn't the only signal. */
function chipClass(on: boolean, peer = false) {
  const focus = peer
    ? "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
    : "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return `inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-2 px-4 text-sm font-semibold ${focus} ${
    on
      ? "border-mango bg-mango text-ink"
      : "border-input bg-card text-foreground hover:border-mango"
  }`;
}
