/**
 * Loads the Google Maps JavaScript API once (browser only) and exposes
 * importLibrary. Follows Google's dynamic library import: the script is added
 * with loading=async and libraries are fetched with importLibrary().
 * Types are kept minimal on purpose (no @types/google.maps dependency).
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Google's untyped global */

type GoogleMaps = { importLibrary: (name: string) => Promise<any> };

let loading: Promise<GoogleMaps> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<GoogleMaps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps loads in the browser only"));
  }
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google.maps);
  loading ??= new Promise<GoogleMaps>((resolve, reject) => {
    const callback = "__gmapsReady";
    w[callback] = () => resolve(w.google.maps);
    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      loading: "async",
      callback,
      language: document.documentElement.lang || "en",
      region: "TH",
    });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("Google Maps could not load"));
    };
    document.head.append(script);
  });
  return loading;
}

/** Bangkok, for maps with no pin yet. */
export const BANGKOK = { lat: 13.7563, lng: 100.5018 };

/** A Google Maps link that opens the place (or the pin) in the Maps app. */
export function mapsLink(
  lat: number,
  lng: number,
  placeId?: string | null,
): string {
  const params = new URLSearchParams({ api: "1", query: `${lat},${lng}` });
  if (placeId) params.set("query_place_id", placeId);
  return `https://www.google.com/maps/search/?${params}`;
}
