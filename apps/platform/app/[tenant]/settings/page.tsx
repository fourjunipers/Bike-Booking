import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { settingsOptions } from "@/lib/tenant-settings";
import { SettingsForm } from "./settings-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("settings") };
}

/** Shop settings (SPEC › Built for any country): country, currency, zone, format. */
export default async function SettingsPage({
  params,
}: PageProps<"/[tenant]/settings">) {
  const { tenant: slug } = await params;
  const { membership } = await requireArea(slug, "settings");
  const [t, locale] = await Promise.all([
    getTranslations("Settings"),
    getLocale(),
  ]);
  const { tenant } = membership;

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <SettingsForm
        slug={slug}
        initial={{
          name: tenant.name,
          country: tenant.country,
          currency: tenant.currency,
          timezone: tenant.timezone,
          locale: tenant.locale,
        }}
        options={settingsOptions(locale)}
      />
    </>
  );
}
