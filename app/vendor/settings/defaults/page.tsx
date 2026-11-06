import { getTranslations } from "next-intl/server";
import { SettingsTabs } from "@/components/vendor/settings-tabs";
import { requireShopOwner } from "@/lib/auth/session";
import { INCLUSION_FIELDS, type Inclusions } from "@/lib/inclusions";
import { createClient } from "@/lib/supabase/server";
import { getVendorLocale } from "@/i18n/vendor";
import { ShopDefaultsForm } from "../forms";

/** Shop settings → Default settings: booking rules and "What's included". */
export default async function ShopDefaultsPage() {
  const shop = await requireShopOwner();
  const locale = await getVendorLocale();
  const t = await getTranslations({ locale, namespace: "Settings" });
  const supabase = await createClient();
  const [{ data: s }, { data: policies }] = await Promise.all([
    supabase
      .from("shops")
      .select(
        "cutoff_minutes, buffer_before_h, buffer_after_h, request_window_min, min_days_walkin, min_days_booking, notice_h",
      )
      .eq("id", shop.id)
      .single(),
    supabase
      .from("shop_policies")
      .select(`deposit_amount, ${INCLUSION_FIELDS.join(", ")}`)
      .eq("shop_id", shop.id)
      .single<Inclusions & { deposit_amount: number | null }>(),
  ]);
  if (!s || !policies) return null;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <SettingsTabs active="defaults" />
        <p className="text-muted-foreground">{t("defaultsIntro")}</p>
      </header>

      <ShopDefaultsForm
        cutoff={s.cutoff_minutes}
        before={s.buffer_before_h}
        after={s.buffer_after_h}
        window={s.request_window_min}
        minDaysWalkin={s.min_days_walkin}
        minDaysBooking={s.min_days_booking}
        notice={s.notice_h}
        policies={policies}
      />
    </div>
  );
}
