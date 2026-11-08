import { getFormatter, getTranslations } from "next-intl/server";
import { cancelInvite, removeMember } from "@/app/vendor/actions/team";
import { Button } from "@/components/ui/button";
import { getCurrentUser, requireShopOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { now } from "@/lib/time";
import { getVendorLocale } from "@/i18n/vendor";
import { InviteForm } from "./invite-form";

/** Owners only: staff get a 404 (BUILD_PLAN: staff cannot see Team). */
export default async function TeamPage() {
  const shop = await requireShopOwner();
  const locale = await getVendorLocale();
  const t = await getTranslations({ locale, namespace: "Team" });
  const format = await getFormatter({ locale });
  const me = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("shop_members")
      .select("user_id, role, created_at, profile:profiles (name, email)")
      .eq("shop_id", shop.id)
      .order("role")
      .order("created_at"),
    supabase
      .from("shop_invites")
      .select("id, created_at, expires_at, used_at")
      .eq("shop_id", shop.id)
      .is("used_at", null)
      .gt("expires_at", now().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("members")}</h2>
        <ul className="divide-y rounded-xl border bg-card shadow-sm">
          {(members ?? []).map((m) => (
            <li
              key={m.user_id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div>
                <p className="font-medium">
                  {m.profile?.name ?? m.profile?.email ?? t("unnamed")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(m.role === "owner" ? "owner" : "staff")}
                  {m.profile?.email ? ` · ${m.profile.email}` : ""}
                </p>
              </div>
              {m.role === "staff" && m.user_id !== me?.id && (
                <form action={removeMember}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <Button type="submit" variant="outline" className="h-11">
                    {t("remove")}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("inviteTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("inviteIntro")}</p>
        <InviteForm shopName={shop.name} />
        {invites && invites.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium">{t("openInvites")}</h3>
            <ul className="space-y-2">
              {invites.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-3 text-sm"
                >
                  <span>
                    {t("inviteExpires", {
                      date: format.dateTime(new Date(i.expires_at), {
                        dateStyle: "medium",
                      }),
                    })}
                  </span>
                  <form action={cancelInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <Button type="submit" variant="outline" size="sm">
                      {t("cancel")}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
