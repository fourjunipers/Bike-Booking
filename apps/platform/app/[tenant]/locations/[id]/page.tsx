import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm, Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { getLocations } from "@/lib/fleet-data";
import { createClient } from "@mango/db/platform-server";
import { deleteLocation } from "../actions";
import {
  ClosureForm,
  DeleteClosureButton,
  HoursForm,
  LocationForm,
} from "../location-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("locations") };
}

/** Sunday, 4 January 1970 was a Sunday: weekday names without a date library. */
function weekdayName(weekday: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(1970, 0, 4 + weekday)));
}

/** A calendar date ("2027-04-13") in the viewer's locale; with no year for yearly closures. */
function formatDate(date: string, locale: string, withYear: boolean): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** One location: details, opening hours and closures. */
export default async function LocationPage({
  params,
}: PageProps<"/[tenant]/locations/[id]">) {
  const { tenant: slug, id } = await params;
  const { membership } = await requireArea(slug, "locations");
  const { tenant, role } = membership;
  const supabase = await createClient();
  const [t, tCommon, locale, locations, hours, closures] = await Promise.all([
    getTranslations("Locations"),
    getTranslations("Common"),
    getLocale(),
    getLocations(tenant.id),
    supabase
      .from("location_hours")
      .select("weekday, open, close")
      .eq("tenant_id", tenant.id)
      .eq("location_id", id),
    supabase
      .from("location_closures")
      .select("id, start_date, end_date, note, repeats_yearly")
      .eq("tenant_id", tenant.id)
      .eq("location_id", id)
      .order("start_date"),
  ]);
  const location = locations.find((l) => l.id === id);
  if (!location) notFound();
  if (hours.error) throw hours.error;
  if (closures.error) throw closures.error;

  // The week starts where the viewer's locale starts it (Monday or Sunday).
  const firstDay =
    (new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
    }).getWeekInfo?.().firstDay ?? 1;
  const order = Array.from({ length: 7 }, (_, i) => (firstDay + i) % 7);
  const days = order.map((weekday) => {
    const row = hours.data.find((h) => h.weekday === weekday);
    return {
      weekday,
      label: weekdayName(weekday, locale),
      open: row?.open.slice(0, 5) ?? "",
      close: row?.close.slice(0, 5) ?? "",
    };
  });
  const text = (value: string | null) => value ?? "";

  return (
    <>
      <BackLink href={`/${slug}/locations`} label={t("title")} />
      <PageHeader
        title={location.name}
        intro={location.is_default ? t("default") : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Panel title={t("details")}>
            <LocationForm
              slug={slug}
              timeZones={Intl.supportedValuesOf("timeZone")}
              canChangeZone={role === "owner"}
              values={{
                id: location.id,
                name: location.name,
                timezone: location.timezone,
                address: text(location.address),
                maps_url: text(location.maps_url),
                phone: text(location.phone),
                whatsapp: text(location.whatsapp),
                line_id: text(location.line_id),
                email: text(location.email),
              }}
            />
            <p className="mt-5 text-sm text-muted-foreground">
              {t("market")}: {t("marketLater")}
            </p>
          </Panel>
          {!location.is_default && (
            <ActionForm
              action={deleteLocation}
              hidden={{ slug, id: location.id }}
              submitLabel={t("delete")}
              confirm={t("deleteConfirm")}
              destructive
            />
          )}
        </div>
        <div className="space-y-6">
          <Panel title={t("hours")} intro={t("hoursHelp")}>
            <HoursForm slug={slug} id={location.id} days={days} />
          </Panel>
          <Panel title={t("closures")}>
            {closures.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noClosures")}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {closures.data.map((closure) => {
                  const withYear = !closure.repeats_yearly;
                  const from = formatDate(closure.start_date, locale, withYear);
                  const to = formatDate(closure.end_date, locale, withYear);
                  return (
                    <li
                      key={closure.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {from === to ? from : `${from} – ${to}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {[
                            closure.note,
                            closure.repeats_yearly ? t("yearly") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <DeleteClosureButton
                        slug={slug}
                        closure={closure.id}
                        label={tCommon("delete")}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-5 border-t pt-5">
              <ClosureForm slug={slug} id={location.id} />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
