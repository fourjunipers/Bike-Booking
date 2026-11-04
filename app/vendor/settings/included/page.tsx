import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { saveShopInclusions } from "@/app/vendor/actions/shop";
import { InclusionsForm } from "@/components/vendor/inclusions-form";
import { requireShopOwner } from "@/lib/auth/session";
import { INCLUSION_FIELDS, type Inclusions } from "@/lib/inclusions";
import { createClient } from "@/lib/supabase/server";
import { getVendorLocale } from "@/i18n/vendor";

export default async function ShopIncludedPage() {
  const shop = await requireShopOwner();
  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "Included",
  });
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_policies")
    .select(`deposit_amount, ${INCLUSION_FIELDS.join(", ")}`)
    .eq("shop_id", shop.id)
    .single<Inclusions & { deposit_amount: number | null }>();
  if (!data) return null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/vendor/settings"
          className="text-sm underline underline-offset-4"
        >
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>
      <InclusionsForm
        mode="shop"
        action={saveShopInclusions}
        shop={data}
        depositAmount={data.deposit_amount}
      />
    </div>
  );
}
