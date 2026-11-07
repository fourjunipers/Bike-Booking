import { getTranslations } from "next-intl/server";
import { mapsLink } from "@/lib/google-maps";
import type { PublicShop } from "@/lib/public-data";
import { MapView } from "./map-view";

// Monday first, as calendars in Thailand show it. 0 = Sunday.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Address, map, nearest station and opening hours. */
export async function ShopInfo({
  locale,
  shop,
}: {
  locale: string;
  shop: PublicShop;
}) {
  const t = await getTranslations({ locale, namespace: "Shop" });
  const days = await getTranslations({ locale, namespace: "Days" });
  const directions =
    shop.lat !== null && shop.lng !== null
      ? (shop.maps_url ?? mapsLink(shop.lat, shop.lng, shop.google_place_id))
      : shop.maps_url;
  return (
    <div className="space-y-4">
      {shop.lat !== null && shop.lng !== null && (
        <MapView
          pins={[
            { id: shop.id, lat: shop.lat, lng: shop.lng, label: shop.name },
          ]}
          className="h-64"
        />
      )}
      <ul className="space-y-1 text-sm">
        {shop.nearest_station && (
          <li>{t("station", { station: shop.nearest_station })}</li>
        )}
        {directions && (
          <li>
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4"
            >
              {t("directions")}
            </a>
          </li>
        )}
      </ul>
      <section className="space-y-1">
        <h3 className="font-semibold">{t("hours")}</h3>
        <dl className="text-sm">
          {WEEK.map((d) => {
            const h = shop.hours.find((x) => x.weekday === d);
            return (
              <div key={d} className="grid grid-cols-[8rem_1fr] gap-2 py-0.5">
                <dt className="text-muted-foreground">{days(String(d))}</dt>
                <dd>{h ? `${h.open}–${h.close}` : t("closed")}</dd>
              </div>
            );
          })}
        </dl>
      </section>
    </div>
  );
}

/** Platform reviews (Google reviews are a separate block). */
export async function PlatformReviews({
  locale,
  reviews,
}: {
  locale: string;
  reviews: { rating: number; text: string | null; created_at: string }[];
}) {
  const t = await getTranslations({ locale, namespace: "Shop" });
  if (reviews.length === 0)
    return <p className="text-muted-foreground">{t("noReviews")}</p>;
  const average =
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return (
    <div className="space-y-3">
      <p className="font-medium">
        {t("ratingSummary", {
          rating: average.toFixed(1),
          n: reviews.length,
        })}
      </p>
      <ul className="space-y-3">
        {reviews.map((r, i) => (
          <li key={i} className="rounded-lg bg-muted/60 p-3 text-sm">
            <p aria-label={t("stars", { n: r.rating })}>
              {"★".repeat(r.rating)}
              <span className="text-muted-foreground">
                {"★".repeat(5 - r.rating)}
              </span>
            </p>
            {r.text && <p className="mt-1">{r.text}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
