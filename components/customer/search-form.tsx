"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- Google's untyped objects */

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { inputClass } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { localePath, type CustomerLocale } from "@/i18n/config";
import { loadGoogleMaps } from "@/lib/google-maps";
import { BIKE_TYPES, type SearchParams } from "@/lib/search-params";

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
 * station, or an address when Google Places is set up), when, and bike type.
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
  const [fromDate, fromTime] = (initial?.from ?? "T10:00").split("T");
  const [toDate, toTime] = (initial?.to ?? "T10:00").split("T");
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

  const dated = from.date && to.date;
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

      <fieldset className="space-y-2">
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
        <div className={`grid gap-3 ${stacked ? "" : "sm:grid-cols-2"}`}>
          <DateTime
            legend={t("pickup")}
            value={from}
            onChange={setFrom}
            ids="from"
          />
          <DateTime legend={t("return")} value={to} onChange={setTo} ids="to" />
        </div>
      )}

      {!compact && (
        <fieldset className="space-y-2">
          <legend className="font-medium">{t("bikeType")}</legend>
          <div className="flex flex-wrap gap-2">
            <TypeChip value="" label={t("anyType")} initial={initial?.type} />
            {BIKE_TYPES.map((type) => (
              <TypeChip
                key={type}
                value={type}
                label={tb(`type.${type}`)}
                initial={initial?.type}
              />
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" className="h-12 px-6 text-base">
          {t("search")}
        </Button>
        <Button
          type="submit"
          name="now"
          value="1"
          size="lg"
          className="h-12 bg-emerald-700 px-6 text-base text-white hover:bg-emerald-800"
        >
          {t("getBikeNow")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("getBikeNowHint")}</p>
    </form>
  );
}

function DateTime({
  legend,
  value,
  onChange,
  ids,
}: {
  legend: string;
  value: { date: string; time: string };
  onChange: (v: { date: string; time: string }) => void;
  ids: string;
}) {
  const t = useTranslations("Search");
  return (
    <fieldset className="space-y-1">
      <legend className="font-medium">{legend}</legend>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <label>
          <span className="sr-only">{t("date")}</span>
          <input
            id={`${ids}-date`}
            type="date"
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
            className={inputClass}
          />
        </label>
        <label>
          <span className="sr-only">{t("time")}</span>
          <input
            id={`${ids}-time`}
            type="time"
            step={1800}
            value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>
    </fieldset>
  );
}

function TypeChip({
  value,
  label,
  initial,
}: {
  value: string;
  label: string;
  initial?: string;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name="type"
        value={value}
        defaultChecked={(initial ?? "") === value}
        className="peer sr-only"
      />
      <span className="inline-flex min-h-11 items-center rounded-full border border-input bg-card px-4 text-sm font-medium peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
        {label}
      </span>
    </label>
  );
}
