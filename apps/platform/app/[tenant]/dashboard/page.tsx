import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader, PlannedCard } from "@/components/page";
import { MotoMangosMark } from "@/components/brand/moto-mangos-mark";
import { RefreshButton } from "@/components/refresh-button";
import { canManageFleet } from "@/lib/roles";
import { reviewNews } from "@/lib/vehicle-kinds";
import { requireTab } from "@/lib/access";
import {
  getFleet,
  getFleetRenewals,
  getReminderSettings,
} from "@/lib/fleet-data";
import { hasLeftFleet } from "@/lib/fleet";
import { parseIsoDate, renewalsToShow } from "@/lib/renewals";
import {
  buildBoard,
  dashboardTabs,
  parseDashboardTab,
  sectionsByTab,
  upcomingRange,
  type DashboardItem,
  type DashboardTab,
} from "@/lib/dashboard";
import {
  addCalendarDays,
  dateInZone,
  formatCalendarDate,
  type CalendarDate,
} from "@/lib/shop-time";
import { DashboardTabs, type DashboardTabView } from "./dashboard-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("dashboard") };
}

/**
 * Dashboard tab (SPEC › Staff app 1): Today, Tomorrow, Upcoming and Late, in
 * the shop's time zone. Phase 0 has no items; each section shows the phase
 * that fills it.
 */
export default async function DashboardPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/dashboard">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireTab(slug, "dashboard");
  const { tenant } = membership;
  const [t, tFleet, locale, fleet, renewals, reminders] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("Fleet"),
    getLocale(),
    getFleet(tenant.id),
    getFleetRenewals(tenant.id),
    getReminderSettings(tenant.id),
  ]);

  // Rendered on the server only, in the shop's zone, so it can't mismatch.
  const now = new Date();
  // What Moto Mangos decided about the shop's requests, for the people who
  // sent them: a rejection until it is dealt with, an approval for two weeks.
  const reviews = canManageFleet(membership.role)
    ? fleet.flatMap((model) => {
        const news = reviewNews(model, now);
        return news ? [{ model, news }] : [];
      })
    : [];
  const today = dateInZone(now, tenant.timezone);
  // Each phase adds its items here (orders, bikes, charges).
  // Tax and insurance: the current record of each kind per bike, from the
  // shop's first reminder day until it is renewed. Expired ones go under Late.
  const bikes = new Map(
    fleet.flatMap((model) =>
      model.units
        .filter((unit) => !hasLeftFleet(unit.status))
        .map((unit) => [unit.id, unit] as const),
    ),
  );
  const items: DashboardItem[] = renewalsToShow(
    renewals.filter((r) => bikes.has(r.unit_id)),
    today,
    reminders.renewal_reminder_days,
  ).map((renewal) => ({
    id: `renewal-${renewal.id}`,
    kind: "renewal",
    date: parseIsoDate(renewal.expires_at),
    title: `${bikes.get(renewal.unit_id)?.plate ?? tFleet("noPlate")} · ${tFleet(`renewals.kind.${renewal.kind}`)}`,
    href: `/${slug}/fleet/units/${renewal.unit_id}`,
  }));
  const board = buildBoard(items, today);

  const shortDate = (date: CalendarDate) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
  const range = upcomingRange(today);
  const when: Record<DashboardTab, string> = {
    today: formatCalendarDate(today, locale),
    tomorrow: formatCalendarDate(addCalendarDays(today, 1), locale),
    upcoming: t("range", {
      from: shortDate(range.from),
      to: shortDate(range.to),
    }),
    late: t("lateIntro"),
  };
  const shopTime = new Intl.DateTimeFormat(locale, {
    timeZone: tenant.timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  const tabs: DashboardTabView[] = dashboardTabs.map((key) => {
    const { count, sections } = board[key];
    return {
      key,
      label: t(key),
      count,
      countLabel: t("count", { count }),
      alert: key === "late" && count > 0,
      panel: (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{when[key]}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sectionsByTab[key].map(({ section, phase }) => {
              const list = sections[section] ?? [];
              const title = t(`sections.${section}`);
              // Renewals are built (Phase 1a follow-up): an empty list is
              // good news, not "arrives later". Overdue services join the
              // same Late section in Phase 1b.
              if (list.length === 0 && section === "renewalsDue")
                return (
                  <section
                    key={section}
                    aria-label={title}
                    className="rounded-lg border bg-card p-4"
                  >
                    <h3 className="font-medium">{title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("noRenewals")}
                    </p>
                  </section>
                );
              return list.length === 0 ? (
                <PlannedCard key={section} title={title} phase={phase} />
              ) : (
                <section
                  key={section}
                  aria-label={title}
                  className={
                    key === "late"
                      ? "rounded-lg border border-highlight-border bg-highlight p-4 text-highlight-foreground"
                      : "rounded-lg border bg-card p-4"
                  }
                >
                  <h3 className="font-medium">
                    {title} · {list.length}
                  </h3>
                  <ul className="mt-2 divide-y">
                    {list.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="flex min-h-11 items-center justify-between gap-3 py-2 hover:underline"
                        >
                          <span className="min-w-0 truncate">{item.title}</span>
                          {item.date &&
                            (key === "upcoming" || key === "late") && (
                              <span className="shrink-0 text-sm">
                                {shortDate(item.date)}
                              </span>
                            )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      ),
    };
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("shopTime", { time: shopTime, zone: tenant.timezone })}
        actions={<RefreshButton />}
      />
      {reviews.length > 0 && (
        <section
          aria-labelledby="moto-mangos-news"
          className="mb-5 rounded-lg border bg-card p-4"
        >
          <h2
            id="moto-mangos-news"
            className="mb-2 flex items-center gap-2 font-semibold"
          >
            <MotoMangosMark className="size-6" />
            {t("motoMangos.title")}
          </h2>
          <ul className="divide-y">
            {reviews.map(({ model, news }) => (
              <li key={model.id}>
                <Link
                  href={`/${slug}/fleet/models/${model.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 py-2 text-sm hover:underline"
                >
                  <span className="font-medium">{model.name}</span>
                  <span
                    className={
                      news === "added" ? "text-emerald-800" : "text-amber-800"
                    }
                  >
                    {t(`motoMangos.${news}`)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <DashboardTabs
        tabs={tabs}
        initial={parseDashboardTab(query.view)}
        label={t("tabsLabel")}
      />
    </>
  );
}
