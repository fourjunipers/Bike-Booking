import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";
import { requireVendorShop } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getVendorLocale } from "@/i18n/vendor";
import { SubmitForm } from "./submit-form";

// Where each readiness item is fixed.
const fixLinks: Record<string, string> = {
  about: "/vendor/settings#profile",
  shop_photo: "/vendor/settings#profile",
  location: "/vendor/settings#location",
  hours: "/vendor/settings#hours",
  contact: "/vendor/settings#contacts",
  model: "/vendor/fleet/new",
  model_photo: "/vendor/fleet",
  model_prices: "/vendor/fleet",
};

const checklist = Object.keys(fixLinks);

// TODO(phase-4): Today screen (pickups, returns, pending requests) above setup.
export default async function VendorPage() {
  const shop = await requireVendorShop();
  if (!shop) return null; // The layout shows "create your shop".

  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "Home",
  });
  const supabase = await createClient();
  const [{ data: missing }, { data: details }] = await Promise.all([
    supabase.rpc("shop_readiness", { p_shop_id: shop.id }),
    supabase
      .from("shops")
      .select("status, review_notes, submitted_at, flagged_for_review")
      .eq("id", shop.id)
      .single(),
  ]);
  const todo = new Set(missing ?? []);
  const status = details?.status ?? shop.status;
  const owner = shop.role === "owner";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{shop.name}</h1>
        <p>
          {t(`status.${status}`)} · {t(owner ? "roleOwner" : "roleStaff")}
        </p>
      </header>

      {status === "draft" && details?.review_notes && (
        <section
          role="alert"
          className="space-y-1 rounded-lg border border-destructive p-4"
        >
          <h2 className="font-semibold">{t("returnedTitle")}</h2>
          <p className="whitespace-pre-line">{details.review_notes}</p>
        </section>
      )}

      {status === "pending" && (
        <p className="rounded-lg border p-4">{t("pendingNote")}</p>
      )}
      {status === "suspended" && (
        <p role="alert" className="rounded-lg border border-destructive p-4">
          {t("suspendedNote")}
        </p>
      )}

      {status === "draft" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t("checklistTitle")}</h2>
          <ul className="space-y-2">
            {checklist.map((code) => {
              const done = !todo.has(code);
              return (
                <li key={code} className="flex flex-wrap items-center gap-3">
                  <span
                    aria-hidden
                    className={
                      done ? "text-green-700" : "text-muted-foreground"
                    }
                  >
                    {done ? "✓" : "○"}
                  </span>
                  <span>{t(`check.${code}`)}</span>
                  <span className="text-sm text-muted-foreground">
                    {done ? t("done") : t("todo")}
                  </span>
                  {!done && (
                    <Link
                      href={fixLinks[code]}
                      className="text-sm underline underline-offset-4"
                    >
                      {t("fix")}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          {owner ? (
            <SubmitForm ready={todo.size === 0} />
          ) : (
            <p className="text-muted-foreground">{t("ownerSubmits")}</p>
          )}
        </section>
      )}

      {status === "live" && (
        <section className="space-y-2">
          <p>{t("liveNote")}</p>
          {details?.flagged_for_review && (
            <p className="text-sm text-muted-foreground">{t("flaggedNote")}</p>
          )}
        </section>
      )}

      <SignOutButton label={t("signOut")} />
    </div>
  );
}
