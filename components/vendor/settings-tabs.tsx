import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getVendorLocale } from "@/i18n/vendor";

const TABS = [
  { key: "store", href: "/vendor/settings" },
  { key: "defaults", href: "/vendor/settings/defaults" },
] as const;

/**
 * Shop settings tabs (owner request, 2026-11-05): store information first,
 * then the defaults every bike model starts from. Each tab is its own page,
 * so the tabs are links.
 */
export async function SettingsTabs({
  active,
}: {
  active: (typeof TABS)[number]["key"];
}) {
  const t = await getTranslations({
    locale: await getVendorLocale(),
    namespace: "Settings",
  });
  return (
    <nav aria-label={t("title")} className="border-b">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-4 font-medium whitespace-nowrap ${current ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t(`tab.${tab.key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
