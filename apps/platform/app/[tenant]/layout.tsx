import Link from "next/link";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ArrowLeftRight, UserCircle } from "lucide-react";
import { SidebarLink, TabLink } from "@/components/shell/nav-link";
import type { NavItem } from "@/components/shell/nav";
import { SignOutButton } from "@/components/sign-out-button";
import { parseTabBar, tabBarCookie } from "@/lib/preferences";
import { canSeeArea, tabsFor, type AdminArea } from "@/lib/roles";
import { requireMembership } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * The app shell for one shop.
 * - Wide screens (lg, 1024 px+): a sidebar with the four staff tabs, the shop
 *   admin areas the role may open, and the account link.
 * - Phones and tablets: a header and the tab bar, at the top or the bottom
 *   per this device's setting (SPEC › Staff app: try both before choosing).
 * Both show the same pages; nothing is phone-only or desktop-only.
 */
export default async function TenantLayout({
  children,
  params,
}: LayoutProps<"/[tenant]">) {
  const { tenant: slug } = await params;
  const [{ user, membership, memberships }, cookieStore, t] = await Promise.all(
    [requireMembership(slug), cookies(), getTranslations("Nav")],
  );
  const { tenant, role } = membership;
  const tabBar = parseTabBar(cookieStore.get(tabBarCookie)?.value);

  const base = `/${tenant.slug}`;
  const tabs: NavItem[] = tabsFor(role).map((tab) => ({
    key: tab,
    href: `${base}/${tab}`,
    label: t(tab),
  }));
  const areas: NavItem[] = (["team", "settings"] as AdminArea[])
    .filter((area) => canSeeArea(role, area))
    .map((area) => ({ key: area, href: `${base}/${area}`, label: t(area) }));
  const me: NavItem = { key: "me", href: `${base}/me`, label: t("me") };

  const tabBarNav = (
    <nav
      aria-label={t("tabs")}
      className={cn(
        "z-20 flex border-border bg-card/95 backdrop-blur lg:hidden",
        tabBar === "top"
          ? "sticky top-14 border-b"
          : "fixed inset-x-0 bottom-0 border-t pb-safe",
      )}
    >
      {tabs.map((item) => (
        <TabLink key={item.key} item={item} />
      ))}
    </nav>
  );

  return (
    <NextIntlClientProvider timeZone={tenant.timezone}>
      <div className="min-h-svh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-svh flex-col gap-6 border-r bg-card px-3 py-5 lg:flex">
          <div className="px-3">
            <p className="truncate text-lg font-semibold">{tenant.name}</p>
            {memberships.length > 1 && (
              <Link
                href="/"
                className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeftRight aria-hidden className="size-3.5" />
                {t("switchShop")}
              </Link>
            )}
          </div>
          <nav
            aria-label={t("mainMenu")}
            className="flex flex-1 flex-col gap-6"
          >
            <div className="flex flex-col gap-1">
              <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("tabs")}
              </p>
              {tabs.map((item) => (
                <SidebarLink key={item.key} item={item} />
              ))}
            </div>
            {areas.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("admin")}
                </p>
                {areas.map((item) => (
                  <SidebarLink key={item.key} item={item} />
                ))}
              </div>
            )}
          </nav>
          <div className="flex flex-col gap-2">
            <SidebarLink item={me} />
            <p className="truncate px-3 text-xs text-muted-foreground">
              {user.email}
            </p>
            <SignOutButton label={t("signOut")} className="px-3" />
          </div>
        </aside>

        <div className="flex min-h-svh flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur lg:hidden">
            <div className="min-w-0">
              <p className="truncate font-semibold">{tenant.name}</p>
            </div>
            <div className="flex items-center gap-1">
              {memberships.length > 1 && (
                <Link
                  href="/"
                  aria-label={t("switchShop")}
                  className="flex size-11 items-center justify-center rounded-md hover:bg-muted"
                >
                  <ArrowLeftRight aria-hidden className="size-5" />
                </Link>
              )}
              <Link
                href={me.href}
                aria-label={me.label}
                className="flex size-11 items-center justify-center rounded-md hover:bg-muted"
              >
                <UserCircle aria-hidden className="size-6" />
              </Link>
            </div>
          </header>
          {tabBar === "top" && tabBarNav}
          <main
            className={cn(
              "mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8",
              tabBar === "bottom" && "pb-28 lg:pb-8",
            )}
          >
            {children}
          </main>
          {tabBar === "bottom" && tabBarNav}
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
