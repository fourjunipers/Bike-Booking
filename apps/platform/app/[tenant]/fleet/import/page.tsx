import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";

import { importColumns, importTemplate } from "@/lib/fleet-import";
import { canManageFleet } from "@/lib/roles";
import { vehicleKinds } from "@/lib/vehicle-kinds";
import { ImportForm } from "./import-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.import");
  return { title: t("title") };
}

/** CSV import (SPEC › Team, settings and platform): owners and managers. */
export default async function ImportPage({
  params,
}: PageProps<"/[tenant]/fleet/import">) {
  const { tenant: slug } = await params;
  const { membership } = await requireArea(slug, "fleet");
  if (!canManageFleet(membership.role)) notFound();
  const { tenant } = membership;
  const [t, tFleet] = await Promise.all([
    getTranslations("Fleet.import"),
    getTranslations("Fleet"),
  ]);
  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(importTemplate())}`;

  return (
    <>
      <BackLink href={`/${slug}/fleet`} label={tFleet("title")} />
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel>
          <ImportForm slug={slug} fleetHref={`/${slug}/fleet`} />
        </Panel>
        <div className="space-y-6">
          <Panel
            title={t("columns")}
            intro={t("columnsHelp", {
              unit: tenant.distanceUnit,
              currency: tenant.currency,
            })}
          >
            <p className="font-mono text-sm break-words">
              {importColumns.join(", ")}
            </p>
            <a
              href={template}
              download="fleet-template.csv"
              className="mt-3 inline-flex min-h-11 items-center font-medium underline"
            >
              {t("template")}
            </a>
          </Panel>
          <Panel title={t("categories")} intro={t("categoriesHelp")}>
            <dl className="space-y-2 text-sm">
              {vehicleKinds
                .filter((kind) => kind.categories.length > 0)
                .map((kind) => (
                  <div key={kind.type}>
                    <dt className="font-medium">
                      {tFleet(`kind.${kind.type}`)}{" "}
                      <span className="font-mono font-normal text-muted-foreground">
                        ({kind.type})
                      </span>
                    </dt>
                    <dd className="font-mono break-words">
                      {kind.categories
                        .map((key) =>
                          key === "city_scooter" ? "scooter" : key,
                        )
                        .join(", ")}
                    </dd>
                  </div>
                ))}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
