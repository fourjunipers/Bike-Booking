import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";
import { homeTab } from "@/lib/roles";
import { getMemberships, getUser } from "@/lib/session";
import { createClient } from "@mango/db/platform-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Picker");
  return { title: t("title") };
}

/**
 * The app's start page (also the installed app's start_url). One shop: go
 * straight to it, on the role's home tab. Several: pick one. None: explain.
 * A platform admin (Mango Works staff) goes to the admin page, or gets a link
 * to it beside their shops.
 */
export default async function StartPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const [memberships, { data: adminRow }] = await Promise.all([
    getMemberships(),
    // RLS shows a user only their own row, so any row means "platform admin".
    supabase.from("platform_admins").select("user_id").maybeSingle(),
  ]);
  const isAdmin = !!adminRow;

  if (isAdmin && memberships.length === 0) redirect("/admin/catalog");
  if (memberships.length === 1 && !isAdmin) {
    const [only] = memberships;
    redirect(`/${only.tenant.slug}/${homeTab(only.role)}`);
  }

  const t = await getTranslations("Picker");
  const tRoles = await getTranslations("Roles");

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      {memberships.length === 0 ? (
        <>
          <h1 className="text-2xl font-semibold">{t("noShopTitle")}</h1>
          <p className="text-muted-foreground">
            {t("noShopBody", { email: user.email ?? "" })}
          </p>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("intro")}</p>
          </div>
          <ul className="divide-y rounded-lg border bg-card">
            {memberships.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/${m.tenant.slug}/${homeTab(m.role)}`}
                  className="flex min-h-14 items-center justify-between gap-4 px-4 py-3 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="font-medium">{m.tenant.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {tRoles(m.role)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {isAdmin && (
        <Link
          href="/admin/catalog"
          className="inline-flex min-h-11 items-center font-medium underline"
        >
          {t("admin")}
        </Link>
      )}
      <SignOutButton label={t("signOut")} />
    </main>
  );
}
