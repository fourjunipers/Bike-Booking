import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { catalogName, getCatalog } from "@/lib/fleet-data";
import { catalogOptions } from "@/lib/model-options";
import { canManageFleet } from "@/lib/roles";
import { ModelForm } from "../../model-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.model");
  return { title: t("newTitle") };
}

export default async function NewModelPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/fleet/models/new">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireArea(slug, "fleet");
  if (!canManageFleet(membership.role)) notFound();
  const [t, tFleet, catalog] = await Promise.all([
    getTranslations("Fleet.model"),
    getTranslations("Fleet"),
    getCatalog(),
  ]);
  // Arriving from a catalog request: that entry is preselected.
  const preset = typeof query.catalog === "string" ? query.catalog : "";
  const chosen = catalog.find((c) => c.id === preset);

  return (
    <>
      <BackLink href={`/${slug}/fleet`} label={tFleet("title")} />
      <PageHeader title={t("newTitle")} />
      <div className="rounded-lg border bg-card p-4 sm:p-5">
        <ModelForm
          slug={slug}
          currency={membership.tenant.currency}
          requestHref={`/${slug}/fleet/own-model`}
          catalogOptions={catalogOptions(catalog)}
          values={{
            name: chosen ? catalogName(chosen) : "",
            catalog_id: chosen?.id ?? "",
            description: "",
            bookable_online: false,
            buffer_before_minutes: "",
            buffer_after_minutes: "",
            deposit: "",
            min_age: "",
            licence_class: "",
            instant_units: "0",
            request_units: "0",
            ready_now: "0",
          }}
        />
      </div>
    </>
  );
}
