import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { getCatalog } from "@/lib/fleet-data";
import { importColumns, importTemplate } from "@/lib/fleet-import";
import { canManageFleet } from "@/lib/roles";
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
  const [t, tFleet, catalog] = await Promise.all([
    getTranslations("Fleet.import"),
    getTranslations("Fleet"),
    getCatalog(),
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
          <Panel title={t("catalogCodes")}>
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
                {t("showCodes", { count: catalog.length })}
              </summary>
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      make
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      model
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      {t("years")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {catalog.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-1 pr-3">{entry.make}</td>
                      <td className="py-1 pr-3">{entry.model}</td>
                      <td className="py-1 text-muted-foreground">
                        {entry.year_from
                          ? entry.year_to && entry.year_to !== entry.year_from
                            ? `${entry.year_from}–${entry.year_to}`
                            : entry.year_from
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link
                href={`/${slug}/fleet/own-model`}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline"
              >
                {tFleet("unit.makeOrModelMissing")}
              </Link>
            </details>
          </Panel>
        </div>
      </div>
    </>
  );
}
