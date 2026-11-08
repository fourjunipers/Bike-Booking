import { getTranslations } from "next-intl/server";
import { SettingsTabs } from "@/components/vendor/settings-tabs";
import { requireShopOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getVendorLocale } from "@/i18n/vendor";
import { StoreInformationForm } from "./forms";

export default async function SettingsPage() {
  const shop = await requireShopOwner();
  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "Settings",
  });
  const supabase = await createClient();
  const [
    { data: s },
    { data: coords },
    { data: hours },
    { data: closures },
    { data: contacts },
  ] = await Promise.all([
    supabase
      .from("shops")
      .select("name, about, photos, maps_url, nearest_station, google_place_id")
      .eq("id", shop.id)
      .single(),
    supabase.rpc("shop_coordinates", { p_shop_id: shop.id }),
    supabase
      .from("shop_hours")
      .select("weekday, open, close")
      .eq("shop_id", shop.id),
    supabase
      .from("shop_closures")
      .select("id, start_date, end_date, note, repeats_yearly")
      .eq("shop_id", shop.id)
      .order("start_date"),
    supabase
      .from("shop_contacts")
      .select("whatsapp, phone, line_id, email")
      .eq("shop_id", shop.id)
      .maybeSingle(),
  ]);
  if (!s) return null;
  const pin = coords?.[0] ?? null;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <SettingsTabs active="store" />
      </header>

      <StoreInformationForm
        shopId={shop.id}
        name={s.name}
        about={s.about}
        photos={s.photos}
        lat={pin?.lat ?? null}
        lng={pin?.lng ?? null}
        mapsUrl={s.maps_url}
        station={s.nearest_station}
        placeId={s.google_place_id}
        hours={(hours ?? []).map((h) => ({
          ...h,
          open: h.open.slice(0, 5),
          close: h.close.slice(0, 5),
        }))}
        closures={closures ?? []}
        contacts={
          contacts ?? {
            whatsapp: null,
            phone: null,
            line_id: null,
            email: null,
          }
        }
      />

      {/* TODO(phase-7): delivery settings (radius, fee, minimum rental length). */}
    </div>
  );
}
