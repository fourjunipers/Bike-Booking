"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BANGKOK, loadGoogleMaps } from "@/lib/google-maps";

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export type MapPin = { id: string; lat: number; lng: number; label: string };

/**
 * Shop pins on a Google map. Loads Google Maps only when the map scrolls
 * into view (keeps pages fast and API use low). Without an API key it
 * renders nothing; pages always list the shops as text too.
 */
export function MapView({
  pins,
  center,
  className = "h-80",
}: {
  pins: MapPin[];
  center?: { lat: number; lng: number };
  className?: string;
}) {
  const t = useTranslations("Search");
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!apiKey || !ref.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !ref.current) return;
    let cancelled = false;
    (async () => {
      try {
        const maps = await loadGoogleMaps(apiKey);
        const [{ Map, LatLngBounds }, { AdvancedMarkerElement }] =
          await Promise.all([
            maps.importLibrary("maps"),
            maps.importLibrary("marker"),
          ]);
        if (cancelled || !ref.current) return;
        const map = new Map(ref.current, {
          center: center ?? pins[0] ?? BANGKOK,
          zoom: 13,
          mapId,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const bounds = new LatLngBounds();
        for (const p of pins) {
          new AdvancedMarkerElement({
            map,
            position: { lat: p.lat, lng: p.lng },
            title: p.label,
          });
          bounds.extend({ lat: p.lat, lng: p.lng });
        }
        if (center) bounds.extend(center);
        if (pins.length > 1 || (pins.length === 1 && center))
          map.fitBounds(bounds, 48);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, pins, center]);

  if (!apiKey || pins.length === 0) return null;
  return (
    <div
      ref={ref}
      role="region"
      aria-label={t("map")}
      className={`w-full overflow-hidden rounded-xl border bg-muted ${className}`}
    >
      {failed && (
        <p className="p-4 text-sm text-muted-foreground">{t("mapFailed")}</p>
      )}
    </div>
  );
}
