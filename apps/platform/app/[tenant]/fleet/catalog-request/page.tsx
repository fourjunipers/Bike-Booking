import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { getCatalog } from "@/lib/fleet-data";
import { canManageFleet } from "@/lib/roles";
import { CatalogRequestForm } from "./request-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.catalogRequest");
  return { title: t("title") };
}

/**
 * Ask for a catalog entry that's missing (SPEC › Built for any country: a
 * model can't be saved without one). The shop can use its own request at once;
 * a platform admin approves it for everyone.
 */
export default async function CatalogRequestPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/fleet/catalog-request">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireArea(slug, "fleet");
  if (!canManageFleet(membership.role)) notFound();
  const [t, tFleet, catalog] = await Promise.all([
    getTranslations("Fleet.catalogRequest"),
    getTranslations("Fleet"),
    getCatalog(),
  ]);
  // Where to go back to once it's added: the bike or the model being set up.
  const then = query.then === "bike" ? "bike" : "model";

  return (
    <>
      <BackLink
        href={
          then === "bike"
            ? `/${slug}/fleet/units/new`
            : `/${slug}/fleet/models/new`
        }
        label={then === "bike" ? tFleet("unit.newTitle") : tFleet("model.newTitle")}
      />
      <PageHeader title={t("title")} intro={t("intro")} />
      <Panel className="max-w-3xl">
        <CatalogRequestForm
          slug={slug}
          then={then}
          makes={[...new Set(catalog.map((c) => c.make))].sort()}
        />
      </Panel>
    </>
  );
}
