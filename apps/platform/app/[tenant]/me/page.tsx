import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { setPreference } from "@/app/actions";
import { PageHeader } from "@/components/page";
import { SignOutButton } from "@/components/sign-out-button";
import { localeNames, locales } from "@/i18n/config";
import {
  parseTabBar,
  parseTheme,
  tabBarCookie,
  tabBarPositions,
  themeCookie,
  themes,
} from "@/lib/preferences";
import { canSeeArea, type AdminArea } from "@/lib/roles";
import { requireMembership } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("me") };
}

/**
 * One choice group. Each option is a submit button carrying the preference,
 * so it works with a tap, a click or the keyboard, even before JavaScript.
 */
function Choice({
  label,
  name,
  current,
  options,
  help,
}: {
  label: string;
  name: string;
  current: string;
  options: { value: string; label: string }[];
  help?: string;
}) {
  const id = `pref-${name}`;
  return (
    <fieldset
      className="space-y-2"
      aria-describedby={help ? `${id}-help` : undefined}
    >
      <legend className="text-sm font-medium">{label}</legend>
      <form action={setPreference} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === current;
          return (
            <button
              key={option.value}
              type="submit"
              name={name}
              value={option.value}
              aria-pressed={selected}
              className={cn(
                "h-11 min-w-24 rounded-md border px-4 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selected &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </form>
      {help && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
    </fieldset>
  );
}

export default async function MePage({ params }: PageProps<"/[tenant]/me">) {
  const { tenant: slug } = await params;
  const [{ user, membership }, cookieStore, locale, t, tNav, tRoles] =
    await Promise.all([
      requireMembership(slug),
      cookies(),
      getLocale(),
      getTranslations("Me"),
      getTranslations("Nav"),
      getTranslations("Roles"),
    ]);
  const theme = parseTheme(cookieStore.get(themeCookie)?.value);
  const tabBar = parseTabBar(cookieStore.get(tabBarCookie)?.value);
  const areas = (["team", "settings"] as AdminArea[]).filter((a) =>
    canSeeArea(membership.role, a),
  );

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">{t("account")}</h2>
          <p className="break-words">
            {t("signedInAs", { email: user.email ?? "" })}
          </p>
          <p className="text-muted-foreground">
            {t("roleHere", { role: tRoles(membership.role) })}
          </p>
          {areas.length > 0 && (
            // On phones the admin pages have no tab; they're reached from here.
            <div className="lg:hidden">
              <h3 className="mb-2 text-sm font-medium">{t("adminLinks")}</h3>
              <ul className="divide-y rounded-md border">
                {areas.map((area) => (
                  <li key={area}>
                    <Link
                      href={`/${slug}/${area}`}
                      className="flex min-h-12 items-center justify-between px-3 hover:bg-muted"
                    >
                      {tNav(area)}
                      <ChevronRight aria-hidden className="size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SignOutButton label={tNav("signOut")} className="max-w-xs" />
        </section>

        <section className="space-y-5 rounded-lg border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">{t("device")}</h2>
            <p className="text-sm text-muted-foreground">{t("deviceIntro")}</p>
          </div>
          <Choice
            label={t("language")}
            name="locale"
            current={locale}
            options={locales.map((l) => ({ value: l, label: localeNames[l] }))}
          />
          <Choice
            label={t("theme")}
            name="theme"
            current={theme}
            options={themes.map((value) => ({
              value,
              label: t(
                value === "system"
                  ? "themeSystem"
                  : value === "light"
                    ? "themeLight"
                    : "themeDark",
              ),
            }))}
          />
          <Choice
            label={t("tabBar")}
            name="tabbar"
            current={tabBar}
            help={t("tabBarHelp")}
            options={tabBarPositions.map((value) => ({
              value,
              label: t(value === "top" ? "tabBarTop" : "tabBarBottom"),
            }))}
          />
          <div>
            <h3 className="text-sm font-medium">{t("install")}</h3>
            <p className="text-sm text-muted-foreground">{t("installHelp")}</p>
          </div>
        </section>
      </div>
    </>
  );
}
