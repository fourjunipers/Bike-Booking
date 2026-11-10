import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";
import { homeTab } from "@/lib/roles";
import { getMemberships, getUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Picker");
  return { title: t("title") };
}

/**
 * The app's start page (also the installed app's start_url). One shop: go
 * straight to it, on the role's home tab. Several: pick one. None: explain.
 */
export default async function StartPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const memberships = await getMemberships();

  if (memberships.length === 1) {
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
      <SignOutButton label={t("signOut")} />
    </main>
  );
}
