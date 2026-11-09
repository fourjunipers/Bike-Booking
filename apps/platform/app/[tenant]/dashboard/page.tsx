import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, PlannedCard } from "@/components/page";
import { RefreshButton } from "@/components/refresh-button";
import { requireTab } from "@/lib/access";
import {
  addCalendarDays,
  dateInZone,
  formatCalendarDate,
} from "@/lib/shop-time";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("dashboard") };
}

/**
 * Dashboard tab (SPEC › Staff app 1): today and tomorrow at a glance. Phase 0
 * lays out the sections; each fills in with its phase.
 */
export default async function DashboardPage({
  params,
}: PageProps<"/[tenant]/dashboard">) {
  const { tenant: slug } = await params;
  const { membership } = await requireTab(slug, "dashboard");
  const { tenant } = membership;
  const [t, locale] = await Promise.all([
    getTranslations("Dashboard"),
    getLocale(),
  ]);

  // Rendered on the server only, in the shop's zone, so it can't mismatch.
  const now = new Date();
  const today = dateInZone(now, tenant.timezone);
  const days = [
    { key: "today", label: t("today"), date: today },
    { key: "tomorrow", label: t("tomorrow"), date: addCalendarDays(today, 1) },
  ] as const;
  const shopTime = new Intl.DateTimeFormat(locale, {
    timeZone: tenant.timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("shopTime", { time: shopTime, zone: tenant.timezone })}
        actions={<RefreshButton />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {days.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`}>
            <h2 id={`day-${day.key}`} className="mb-3 text-lg font-semibold">
              {day.label}{" "}
              <span className="font-normal text-muted-foreground">
                · {formatCalendarDate(day.date, locale)}
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <PlannedCard title={t("pickups")} phase={3} />
              <PlannedCard title={t("returns")} phase={3} />
              <PlannedCard title={t("deliveries")} phase={8} />
              {day.key === "today" && (
                <PlannedCard title={t("overdue")} phase={3} />
              )}
            </div>
          </section>
        ))}
      </div>
      <h2 className="mt-8 mb-3 text-lg font-semibold">{t("alerts")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <PlannedCard title={t("servicesDue")} phase={1} />
        <PlannedCard title={t("renewalsDue")} phase={1} />
        <PlannedCard title={t("failedCharges")} phase={7} />
      </div>
    </>
  );
}
