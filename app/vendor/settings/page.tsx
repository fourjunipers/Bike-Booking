import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { deleteClosure } from "@/app/vendor/actions/shop";
import { Button } from "@/components/ui/button";
import { requireShopOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getVendorLocale } from "@/i18n/vendor";
import {
  BookingSettingsForm,
  ClosureForm,
  ContactsForm,
  HoursForm,
  ProfileForm,
} from "./forms";

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
      .select(
        "name, about, photos, maps_url, nearest_station, google_place_id, cutoff_minutes, buffer_before_h, buffer_after_h, request_window_min",
      )
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Link
          href="/vendor/settings/included"
          className="underline underline-offset-4"
        >
          {t("includedLink")}
        </Link>
      </header>

      <ProfileForm
        shopId={shop.id}
        name={s.name}
        about={s.about}
        photos={s.photos}
        lat={pin?.lat ?? null}
        lng={pin?.lng ?? null}
        mapsUrl={s.maps_url}
        station={s.nearest_station}
        placeId={s.google_place_id}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <HoursForm
          hours={(hours ?? []).map((h) => ({
            ...h,
            open: h.open.slice(0, 5),
            close: h.close.slice(0, 5),
          }))}
        />
        <div className="space-y-8">
          <section
            id="closures"
            className="space-y-4 rounded-lg border p-4 md:p-6"
          >
            <h2 className="text-lg font-semibold">{t("closures")}</h2>
            {closures && closures.length > 0 ? (
              <ul className="space-y-2">
                {closures.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3">
                    <span>
                      {c.start_date} – {c.end_date}
                      {c.repeats_yearly ? ` · ${t("everyYear")}` : ""}
                      {c.note ? ` · ${c.note}` : ""}
                    </span>
                    <form action={deleteClosure}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" variant="outline" size="sm">
                        {t("remove")}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{t("noClosures")}</p>
            )}
            <ClosureForm />
          </section>
          <ContactsForm
            contacts={
              contacts ?? {
                whatsapp: null,
                phone: null,
                line_id: null,
                email: null,
              }
            }
          />
        </div>
      </div>

      <BookingSettingsForm
        cutoff={s.cutoff_minutes}
        before={s.buffer_before_h}
        after={s.buffer_after_h}
        window={s.request_window_min}
      />
      {/* TODO(phase-7): delivery settings (radius, fee, minimum rental length). */}
    </div>
  );
}
