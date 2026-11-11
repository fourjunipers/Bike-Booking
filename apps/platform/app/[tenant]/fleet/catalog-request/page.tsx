import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
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
}: PageProps<"/[tenant]/fleet/catalog-request">) {
  const { tenant: slug } = await params;
  const { membership } = await requireArea(slug, "fleet");
  if (!canManageFleet(membership.role)) notFound();
  const [t, tModel] = await Promise.all([
    getTranslations("Fleet.catalogRequest"),
    getTranslations("Fleet.model"),
  ]);

  return (
    <>
      <BackLink
        href={`/${slug}/fleet/models/new`}
        label={tModel("newTitle")}
      />
      <PageHeader title={t("title")} intro={t("intro")} />
      <Panel className="max-w-3xl">
        <CatalogRequestForm slug={slug} />
      </Panel>
    </>
  );
}
