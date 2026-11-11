import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { matchesUnit, UnitRow } from "@/components/fleet/unit-bits";
import { inputClass } from "@/components/form";
import { PageHeader, PlannedCard } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireTab } from "@/lib/access";
import { getFleet } from "@/lib/fleet-data";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("maintenance") };
}

/**
 * Maintenance tab (SPEC › Staff app 4): find a bike by plate or frame number,
 * or scan its QR sticker with the phone camera (the sticker is a link). The
 * bike page has the odometer, status and downtime. The due list arrives with
 * service schedules and renewals in Phase 1b.
 */
export default async function MaintenancePage({
  params,
  searchParams,
}: PageProps<"/[tenant]/maintenance">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireTab(slug, "maintenance");
  const { tenant } = membership;
  const [t, tCommon, locale, fleet] = await Promise.all([
    getTranslations("Maintenance"),
    getTranslations("Common"),
    getLocale(),
    getFleet(tenant.id),
  ]);
  const plate = typeof query.plate === "string" ? query.plate.trim() : "";
  const all = fleet.flatMap((model) =>
    model.units.map((unit) => ({ unit, modelName: model.name })),
  );
  // With no search: the bikes in maintenance, which is what a mechanic opens this for.
  const shown = plate
    ? all.filter(({ unit }) => matchesUnit(unit, plate))
    : all.filter(({ unit }) => unit.status === "maintenance");

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="find-bike" className="space-y-3">
          <h2 id="find-bike" className="text-lg font-semibold">
            {t("searchLabel")}
          </h2>
          <form
            role="search"
            action={`/${slug}/maintenance`}
            className="flex gap-2"
          >
            <label htmlFor="plate" className="sr-only">
              {t("searchPlaceholder")}
            </label>
            <input
              id="plate"
              name="plate"
              type="search"
              defaultValue={plate}
              placeholder={t("searchPlaceholder")}
              autoComplete="off"
              className={cn(inputClass, "flex-1")}
            />
            <Button type="submit" className="h-11 px-4">
              <Search aria-hidden />
              <span className="max-sm:sr-only">{tCommon("search")}</span>
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">{t("searchHelp")}</p>

          {plate && shown.length === 0 && (
            <p className="rounded-lg border bg-card p-4 text-muted-foreground">
              {t("noMatch", { query: plate })}
            </p>
          )}
          {shown.length > 0 && (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {shown.slice(0, 50).map(({ unit, modelName }) => (
                <UnitRow
                  key={unit.id}
                  unit={unit}
                  href={`/${slug}/fleet/units/${unit.id}`}
                  distanceUnit={tenant.distanceUnit}
                  locale={locale}
                  detail={modelName}
                />
              ))}
            </ul>
          )}
          <Link
            href={`/${slug}/fleet`}
            className="inline-flex min-h-11 items-center font-medium underline"
          >
            {t("openFleet")}
          </Link>
        </section>
        <section aria-labelledby="due-list" className="space-y-3">
          <h2 id="due-list" className="text-lg font-semibold">
            {t("due")}
          </h2>
          <PlannedCard title={t("due")} phase={1}>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("dueLater")}
            </p>
          </PlannedCard>
        </section>
      </div>
    </>
  );
}
