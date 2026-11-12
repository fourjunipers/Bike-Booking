"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- Google's untyped objects */

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { inputClass } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { localePath, type CustomerLocale } from "@/i18n/config";
import { loadGoogleMaps } from "@/lib/google-maps";
import {
  addDays,
  BIKE_TYPES,
  DEFAULT_TIME,
  timeOptions,
  type BikeType,
  type SearchParams,
} from "@/lib/search-params";

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export type StationOption = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type Point = { lat: number; lng: number; place: string };

/**
 * Home and search form (SPEC "Customer screens"): where (GPS, a BTS/MRT
 * station, or an address when Google Places is set up), when (Book ahead with
 * dates, or Ride today for bikes ready now), and bike types (any number).
 * A plain GET form, so every search is a shareable /search URL.
 */
export function SearchForm({
  stations,
  initial,
  compact = false,
  stacked = false,
}: {
  stations: StationOption[];
  initial?: Partial<SearchParams>;
  compact?: boolean;
  /** One column, for the narrow sidebar on the search page. */
  stacked?: boolean;
}) {
  const t = useTranslations("Search");
  const tb = useTranslations("Bikes");
  // The customer layout only renders for customer languages.
  const locale = useLocale() as CustomerLocale;
  const [point, setPoint] = useState<Point | null>(
    initial?.lat !== undefined && initial?.lng !== undefined
      ? { lat: initial.lat, lng: initial.lng, place: initial.place ?? "" }
      : null,
  );
  const [gpsState, setGpsState] = useState<"idle" | "busy" | "failed">("idle");
  const [mode, setMode] = useState<"ahead" | "today">(
    initial?.now ? "today" : "ahead",
  );
  const [types, setTypes] = useState<BikeType[]>(initial?.types ?? []);
  const [fromDate, fromTime] = (initial?.from ?? `T${DEFAULT_TIME}`).split("T");
  const [toDate, toTime] = (initial?.to ?? `T${DEFAULT_TIME}`).split("T");
  const [from, setFrom] = useState({ date: fromDate, time: fromTime });
  const [to, setTo] = useState({ date: toDate, time: toTime });
  const addressRef = useRef<HTMLDivElement>(null);

  // Address search with Google Places, when a key is configured.
  useEffect(() => {
    if (!apiKey || !addressRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const maps = await loadGoogleMaps(apiKey);
        const places = await maps.importLibrary("places");
        if (cancelled || !addressRef.current) return;
        const box = new places.PlaceAutocompleteElement({
          includedRegionCodes: ["th"],
        });
        box.style.width = "100%";
        addressRef.current.replaceChildren(box);
        box.addEventListener("gmp-select", async ({ placePrediction }: any) => {
          const found = placePrediction.toPlace();
          await found.fetchFields({ fields: ["displayName", "location"] });
          setPoint({
            lat: found.location.lat(),
            lng: found.location.lng(),
            place: String(found.displayName ?? ""),
          });
        });
      } catch {
        // Without Places, the station list and GPS still work.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

      <fieldset className="min-w-0 space-y-2">
        <legend className="font-medium">{t("where")}</legend>
        <div
          className={`grid gap-2 ${stacked ? "" : "sm:grid-cols-[1fr_auto]"}`}
        >
          <label className="block">
            <span className="sr-only">{t("station")}</span>
            <select
              value={stationValue}
              onChange={(e) => {
                const s = stations.find((x) => x.id === e.target.value);
                setPoint(s ? { lat: s.lat, lng: s.lng, place: s.name } : null);
              }}
              className={inputClass}
            >
              <option value="">
                {point && !stationValue ? point.place : t("chooseStation")}
              </option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
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
        {apiKey && <div ref={addressRef} aria-label={t("address")} />}
        {gpsState === "failed" && (
          <p role="alert" className="text-sm text-destructive">
            {t("gpsFailed")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t("stationsCredit")}</p>
      </fieldset>

      {!compact && (
        <fieldset className="min-w-0 space-y-3">
          <legend className="font-medium">{t("when")}</legend>
          <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            {(["ahead", "today"] as const).map((m) => (
              <label key={m} className="cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  // Not sent: the hidden "now" field carries the choice.
                  form="search-mode-unsent"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  className="peer sr-only"
                />
                <span className="flex min-h-11 items-center justify-center rounded-full px-3 text-center text-sm font-bold text-muted-foreground peer-checked:bg-navy peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                  {t(m === "ahead" ? "bookAhead" : "rideToday")}
                </span>
              </label>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {t(mode === "ahead" ? "bookAheadHint" : "rideTodayHint")}
          </p>
          {mode === "ahead" && (
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
          )}
        </fieldset>
      )}

      {!compact && (
        <fieldset className="min-w-0 space-y-2">
          <legend className="font-medium">{t("bikeType")}</legend>
          <p id="types-hint" className="text-sm text-muted-foreground">
            {t("typesHint")}
          </p>
          <div className="flex flex-wrap gap-2" aria-describedby="types-hint">
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
                        ? BIKE_TYPES.filter(
                            (x) => x === type || types.includes(x),
                          )
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
      )}

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full px-6 text-base sm:w-auto"
      >
        {t("search")}
      </Button>
    </form>
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

/** A type toggle: navy on mango when on, with a tick so colour isn't the only signal. */
function chipClass(on: boolean, peer = false) {
  const focus = peer
    ? "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
    : "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return `inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-2 px-4 text-sm font-semibold ${focus} ${
    on
      ? "border-mango bg-mango text-navy"
      : "border-input bg-card text-foreground hover:border-mango"
  }`;
}
