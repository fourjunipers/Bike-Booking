import type { StationOption } from "@/components/customer/search-form";
import type { Station } from "@/lib/public-data";

const LINE_LABELS: Record<string, string> = {
  BTS_SUKHUMVIT: "BTS",
  BTS_SILOM: "BTS",
  BTS_GOLD: "BTS Gold",
  MRT_BLUE: "MRT",
  MRT_PURPLE: "MRT Purple",
  MRT_YELLOW: "MRT Yellow",
  MRT_PINK: "MRT Pink",
  ARL: "ARL",
  SRT_DARK_RED: "SRT Red",
  SRT_LIGHT_RED: "SRT Red",
};

/** Station choices in the customer's language: "Asok (BTS)", "อโศก (BTS)". */
export function stationOptions(
  stations: Station[],
  locale: string,
): StationOption[] {
  return stations
    .map((s) => {
      const lines = [...new Set(s.lines.map((l) => LINE_LABELS[l] ?? l))];
      const name = locale === "th" && s.name_th ? s.name_th : s.name_en;
      return {
        id: s.id,
        name: `${name} (${lines.join(", ")})`,
        lat: s.lat,
        lng: s.lng,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
