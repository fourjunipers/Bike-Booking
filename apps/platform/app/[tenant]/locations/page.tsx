import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import { getFleet, getLocations } from "@/lib/fleet-data";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("locations") };
}

/** Locations (SPEC › Review decisions › Locations): owners and managers. */
export default async function LocationsPage({
  params,
}: PageProps<"/[tenant]/locations">) {
  const { tenant: slug } = await params;
  const { membership } = await requireArea(slug, "locations");
  const [t, locations, fleet] = await Promise.all([
    getTranslations("Locations"),
    getLocations(membership.tenant.id),
    getFleet(membership.tenant.id),
  ]);
  const units = fleet.flatMap((model) => model.units);

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={
          <Link
            href={`/${slug}/locations/new`}
            className={cn(buttonVariants(), "h-11 px-4")}
          >
            <Plus aria-hidden />
            {t("add")}
          </Link>
        }
      />
      <ul className="divide-y overflow-hidden rounded-lg border bg-card">
        {locations.map((location) => (
          <li key={location.id}>
            <Link
              href={`/${slug}/locations/${location.id}`}
              className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {location.name}
                  {location.is_default && (
                    <span className="rounded-full bg-highlight px-2 py-0.5 text-xs font-medium text-highlight-foreground">
                      {t("default")}
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {[
                    location.timezone.replaceAll("_", " "),
                    t("unitCount", {
                      count: units.filter((u) => u.location_id === location.id)
                        .length,
                    }),
                  ].join(" · ")}
                </p>
              </div>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
