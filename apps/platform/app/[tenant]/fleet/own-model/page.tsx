import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { getCatalog } from "@/lib/fleet-data";
import { canManageFleet } from "@/lib/roles";
import { OwnModelForm } from "./request-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.ownModel");
  return { title: t("title") };
}

/**
 * "Add my own": a make or model that isn't among the presets (owner, 11 Nov
 * 2026). Any vehicle, saved at once, no approval. It is the secondary path:
 * the make and model dropdowns come first. Approval only comes up later, if
 * the shop wants the model on Moto Mangos.
 */
export default async function OwnModelPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/fleet/own-model">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireArea(slug, "fleet");
  if (!canManageFleet(membership.role)) notFound();
  const [t, tFleet, catalog] = await Promise.all([
    getTranslations("Fleet.ownModel"),
    getTranslations("Fleet"),
    getCatalog(),
  ]);
  // Where to go once it's added: the bike being added, or the model's page.
  const then = query.then === "bike" ? "bike" : "model";

  return (
    <>
      <BackLink
        href={
          then === "bike"
            ? `/${slug}/fleet/units/new`
            : `/${slug}/fleet/models/new`
        }
        label={
          then === "bike" ? tFleet("unit.newTitle") : tFleet("model.newTitle")
        }
      />
      <PageHeader title={t("title")} intro={t("intro")} />
      <Panel className="max-w-3xl">
        <OwnModelForm
          slug={slug}
          then={then}
          makes={[...new Set(catalog.map((c) => c.make))].sort()}
        />
      </Panel>
    </>
  );
}
