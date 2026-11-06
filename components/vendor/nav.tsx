import { getTranslations } from "next-intl/server";
import { setVendorLocale } from "@/app/vendor/actions/shop";
import { NavLink } from "@/components/nav-link";
import { getMyShops } from "@/lib/auth/session";
import { getVendorLocale } from "@/i18n/vendor";

/** Dashboard navigation and the Thai/English toggle. */
export async function VendorNav() {
  const locale = await getVendorLocale();
  const t = await getTranslations({ locale, namespace: "Nav" });
  const [shop] = await getMyShops();
  const owner = shop?.role === "owner";

  const links = shop
    ? [
        { href: "/vendor", label: t("home"), exact: true },
        { href: "/vendor/fleet", label: t("fleet") },
        { href: "/vendor/extras", label: t("extras") },
        ...(owner
          ? [
              { href: "/vendor/settings", label: t("settings") },
              { href: "/vendor/team", label: t("team") },
            ]
          : []),
      ]
    : [];

  return (
    <div className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1 px-2 py-1 text-sm">
        <nav aria-label={t("label")} className="flex flex-wrap">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} exact={l.exact}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <form
          action={setVendorLocale}
          className="ml-auto flex items-center gap-1"
        >
          <span className="sr-only">{t("language")}</span>
          {(["th", "en"] as const).map((l) => (
            <button
              key={l}
              type="submit"
              name="locale"
              value={l}
              aria-pressed={locale === l}
              className="min-h-11 rounded-md px-3 text-muted-foreground aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-accent-foreground"
            >
              {l === "th" ? "ไทย" : "English"}
            </button>
          ))}
        </form>
      </div>
    </div>
  );
}
