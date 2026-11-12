import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { formatDistance, type DistanceUnit } from "@/lib/distance";
import { cn } from "@/lib/utils";

export { matchesText as matchesUnit } from "@/lib/fleet-view";

const statusClass: Record<string, string> = {
  active:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  maintenance:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  retired: "bg-muted text-muted-foreground",
  sold: "bg-muted text-muted-foreground",
};

/** A unit's status as a small label (text, not colour alone). */
export async function StatusBadge({ status }: { status: string }) {
  const t = await getTranslations("Fleet.status");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        statusClass[status] ?? statusClass.retired,
      )}
    >
      {t.has(status as "active") ? t(status as "active") : status}
    </span>
  );
}

/** What a row needs to know about a bike. */
export type RowUnit = {
  plate: string | null;
  plate_pending: boolean;
  colour: string | null;
  current_odometer_km: number;
  status: string;
};

/** One bike in a list: plate, odometer, status and where it is; the whole row opens it. */
export async function UnitRow({
  unit,
  href,
  distanceUnit,
  locale,
  detail,
}: {
  unit: RowUnit;
  href: string;
  distanceUnit: DistanceUnit;
  locale: string;
  /** Extra text under the plate: model, model year, location. */
  detail?: string;
}) {
  const t = await getTranslations("Fleet");
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{unit.plate ?? t("noPlate")}</span>
            {unit.plate_pending && (
              <span className="rounded-full bg-highlight px-2 py-0.5 text-xs font-medium text-highlight-foreground">
                {t("platePending")}
              </span>
            )}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {[
              formatDistance(unit.current_odometer_km, distanceUnit, locale),
              detail,
              unit.colour,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <StatusBadge status={unit.status} />
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />
      </Link>
    </li>
  );
}
