import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireVendorShop } from "@/lib/auth/session";
import { catalogLabel } from "@/lib/catalog";
import { photoUrl, PHOTO_BUCKETS } from "@/lib/photos";
import { supabaseUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getVendorLocale } from "@/i18n/vendor";
import { FleetTable, type FleetRow } from "./fleet-table";

export default async function FleetPage() {
  const shop = await requireVendorShop();
  if (!shop) return null;
  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "Fleet",
  });
  const supabase = await createClient();
  const { data: models } = await supabase
    .from("bike_models")
    .select(
      "id, qty, photos, booking_mode, visible, ready_today_on, ready_today_count, ready_today_updated_at, downtime_count, downtime_until, deposit_amount, catalog:bike_catalog (make, model, generation, year_from, year_to, cc, status), price_days (day)",
    )
    .eq("shop_id", shop.id)
    .order("created_at");

  const rows: FleetRow[] = (models ?? [])
    .map((m) => ({
      id: m.id,
      label: m.catalog ? catalogLabel(m.catalog) : "—",
      cc: m.catalog?.cc ?? 0,
      catalogPending: m.catalog?.status !== "approved",
      photo: photoUrl(supabaseUrl(), PHOTO_BUCKETS.model, m.photos[0]),
      hasPhoto: m.photos.length > 0,
      hasPrices: m.price_days.length >= 30,
      bookingMode: m.booking_mode,
      visible: m.visible,
      qty: m.qty,
      readyOn: m.ready_today_on,
      readyCount: m.ready_today_count,
      readyUpdatedAt: m.ready_today_updated_at,
      downtime: m.downtime_count,
      downtimeUntil: m.downtime_until,
    }))
    .sort((a, b) => a.cc - b.cc || a.label.localeCompare(b.label));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("intro")}</p>
        </div>
        <Link
          href="/vendor/fleet/new"
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground"
        >
          {t("addModel")}
        </Link>
      </header>
      {rows.length === 0 ? <p>{t("empty")}</p> : <FleetTable rows={rows} />}
    </div>
  );
}
