import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { settingsOptions } from "@/lib/tenant-settings";
import { createClient } from "@mango/db/platform-server";
import { Panel } from "@/components/action-form";
import { getReminderSettings } from "@/lib/fleet-data";
import { RemindersForm } from "./reminders-form";
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
  const { tenant } = membership;
  const supabase = await createClient();
  const [t, locale, { data: currencyLocked }] = await Promise.all([
    getTranslations("Settings"),
    getLocale(),
    supabase.rpc("currency_locked", { p_tenant_id: tenant.id }),
  ]);
  const reminders = await getReminderSettings(tenant.id);

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <SettingsForm
        slug={slug}
        initial={{
          name: tenant.name,
          country: tenant.country,
          currency: tenant.currency,
          distance_unit: tenant.distanceUnit,
          locale: tenant.locale,
        }}
        options={settingsOptions(locale)}
        currencyLocked={currencyLocked === true}
        locationsHref={`/${slug}/locations`}
      />
      <Panel
        title={t("reminders.title")}
        intro={t("reminders.intro")}
        className="mt-6 max-w-3xl"
      >
        <RemindersForm
          slug={slug}
          days={reminders.renewal_reminder_days}
          digestDay={reminders.renewal_digest_day}
        />
      </Panel>
    </>
  );
}
