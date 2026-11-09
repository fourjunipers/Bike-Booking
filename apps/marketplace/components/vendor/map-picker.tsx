"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- Google's untyped objects */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { inputClass, TextField } from "@/components/form-kit";
import { BANGKOK, loadGoogleMaps, mapsLink } from "@/lib/google-maps";

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
// Advanced markers need a map ID. DEMO_MAP_ID works for development; set a
// real one from Google Cloud for production.
const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

/**
 * Shop location: search the shop's Google Business Profile (sets the pin,
 * Maps link and google_place_id), or drag the pin. Suggests the nearest
 * BTS/MRT station, which the vendor can edit. Without an API key it falls
 * back to plain latitude/longitude fields.
 */
export function MapPicker({
  lat,
  lng,
  mapsUrl,
  station,
  placeId,
}: {
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  station: string | null;
  placeId: string | null;
}) {
  const t = useTranslations("Location");
  const [pin, setPin] = useState(
    lat !== null && lng !== null ? { lat, lng } : null,
  );
  const [place, setPlace] = useState<{ id: string; name: string } | null>(
    placeId ? { id: placeId, name: "" } : null,
  );
  const [url, setUrl] = useState(mapsUrl ?? "");
  const [stationName, setStationName] = useState(station ?? "");
  const [failed, setFailed] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);
  const mapObj = useRef<any>(null);
  const placesLib = useRef<any>(null);

  async function suggestStation(at: { lat: number; lng: number }) {
    const Place = placesLib.current?.Place;
    if (!Place) return;
    try {
      const { places } = await Place.searchNearby({
        fields: ["displayName"],
        locationRestriction: { center: at, radius: 2000 },
        includedPrimaryTypes: [
          "subway_station",
          "train_station",
          "light_rail_station",
        ],
        maxResultCount: 1,
        rankPreference: placesLib.current.SearchNearbyRankPreference.DISTANCE,
      });
      const name = places?.[0]?.displayName;
      if (name) setStationName(String(name));
    } catch {
      // Station is optional; the vendor can type it.
    }
  }

  function movePin(at: { lat: number; lng: number }, fromSearch = false) {
    setPin(at);
    if (!fromSearch) {
      // A dragged pin no longer points at the searched business.
      setUrl(mapsLink(at.lat, at.lng));
    }
    void suggestStation(at);
  }

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const maps = await loadGoogleMaps(apiKey);
        const [{ Map }, { AdvancedMarkerElement }, places] = await Promise.all([
          maps.importLibrary("maps"),
          maps.importLibrary("marker"),
          maps.importLibrary("places"),
        ]);
        if (cancelled || !mapRef.current) return;
        placesLib.current = places;
        const start = pin ?? BANGKOK;
        const map = new Map(mapRef.current, {
          center: start,
          zoom: pin ? 17 : 12,
          mapId,
          mapTypeControl: false,
          streetViewControl: false,
        });
        mapObj.current = map;
        const marker = new AdvancedMarkerElement({
          map,
          position: pin ?? undefined,
          gmpDraggable: true,
          title: t("pin"),
        });
        markerRef.current = marker;
        marker.addListener("dragend", () => {
          const p = marker.position;
          const at = {
            lat: typeof p.lat === "function" ? p.lat() : p.lat,
            lng: typeof p.lng === "function" ? p.lng() : p.lng,
          };
          setPlace(null);
          movePin(at);
        });
        map.addListener("click", (e: any) => {
          const at = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          marker.position = at;
          setPlace(null);
          movePin(at);
        });

        const search = new places.PlaceAutocompleteElement({
          includedRegionCodes: ["th"],
        });
        search.style.width = "100%";
        searchRef.current?.replaceChildren(search);
        search.addEventListener(
          "gmp-select",
          async ({ placePrediction }: any) => {
            const found = placePrediction.toPlace();
            await found.fetchFields({
              fields: ["id", "displayName", "location", "googleMapsURI"],
            });
            const at = { lat: found.location.lat(), lng: found.location.lng() };
            marker.position = at;
            map.setCenter(at);
            map.setZoom(17);
            setPlace({ id: found.id, name: found.displayName ?? "" });
            setUrl(found.googleMapsURI ?? mapsLink(at.lat, at.lng, found.id));
            movePin(at, true);
          },
        );
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Initialise once; later pin changes come from the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showMap = apiKey !== "" && !failed;

  return (
    <div className="space-y-4">
      <input type="hidden" name="google_place_id" value={place?.id ?? ""} />
      {showMap ? (
        <>
          <input type="hidden" name="lat" value={pin?.lat ?? ""} />
          <input type="hidden" name="lng" value={pin?.lng ?? ""} />
          <div className="space-y-1">
            <p className="text-sm font-medium" id="map-search-label">
              {t("search")}
            </p>
            <div ref={searchRef} aria-labelledby="map-search-label" />
            <p className="text-sm text-muted-foreground">{t("searchHint")}</p>
          </div>
          <div
            ref={mapRef}
            className="h-72 w-full rounded-md border md:h-96"
            role="application"
            aria-label={t("map")}
          />
          <p className="text-sm text-muted-foreground">
            {pin
              ? t("pinSet", {
                  lat: pin.lat.toFixed(5),
                  lng: pin.lng.toFixed(5),
                })
              : t("noPin")}
          </p>
          {place && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                {t("linkedProfile")}
                {place.name ? `: ${place.name}` : ""}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPlace(null)}
              >
                {t("unlink")}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {failed && (
            <p className="text-sm text-destructive sm:col-span-2">
              {t("mapFailed")}
            </p>
          )}
          <TextField
            name="lat"
            label={t("lat")}
            defaultValue={pin?.lat ?? null}
            inputMode="decimal"
          />
          <TextField
            name="lng"
            label={t("lng")}
            defaultValue={pin?.lng ?? null}
            inputMode="decimal"
          />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="maps_url" className="text-sm font-medium">
            {t("mapsUrl")}
          </label>
          <input
            id="maps_url"
            name="maps_url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="nearest_station" className="text-sm font-medium">
            {t("station")}
          </label>
          <input
            id="nearest_station"
            name="nearest_station"
            value={stationName}
            onChange={(e) => setStationName(e.target.value)}
            placeholder={t("stationPlaceholder")}
            className={inputClass}
          />
          <p className="text-sm text-muted-foreground">{t("stationHint")}</p>
        </div>
      </div>
    </div>
  );
}
