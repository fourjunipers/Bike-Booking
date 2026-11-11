import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { getCatalog, getFleet, getLocations } from "@/lib/fleet-data";
import { bikeModelOptions } from "@/lib/model-options";
import { canManageFleet } from "@/lib/roles";
import { UnitForm } from "../../unit-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.unit");
  return { title: t("newTitle") };
}

/**
 * Add a bike: make, then model, from the catalog. Choosing a catalog model the
 * shop doesn't have yet creates the shop's model on save.
 */
export default async function NewUnitPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/fleet/units/new">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireArea(slug, "fleet");
  if (!canManageFleet(membership.role)) notFound();
  const { tenant } = membership;
  const [t, tFleet, fleet, catalog, locations] = await Promise.all([
    getTranslations("Fleet.unit"),
    getTranslations("Fleet"),
    getFleet(tenant.id),
    getCatalog(),
    getLocations(tenant.id),
  ]);
  const models = bikeModelOptions(fleet, catalog, {
    yours: t("yourModels"),
    catalog: t("fromCatalog"),
    pending: tFleet("model.pendingRequest"),
  });
  // Arriving from a model's page, or from adding a make or model.
  const wanted =
    typeof query.model === "string"
      ? `model:${query.model}`
      : typeof query.catalog === "string"
        ? `catalog:${query.catalog}`
        : "";
  // A catalog entry the shop already has a model for is listed as that model.
  const owned = fleet.find((m) => `catalog:${m.catalog_id}` === wanted);
  const preset = owned ? `model:${owned.id}` : wanted;

  return (
    <>
      <BackLink href={`/${slug}/fleet`} label={tFleet("title")} />
      <PageHeader title={t("newTitle")} />
      <Panel className="max-w-3xl">
        <UnitForm
          slug={slug}
          distanceUnit={tenant.distanceUnit}
          addModelHref={`/${slug}/fleet/catalog-request?then=bike`}
          models={models}
          locations={locations.map((l) => ({ value: l.id, label: l.name }))}
          values={{
            model_choice: models.some((m) => m.value === preset) ? preset : "",
            location_id: locations[0]?.id ?? "",
            plate: "",
            plate_pending: false,
            frame_number: "",
            engine_number: "",
            colour: "",
            model_year: "",
            odometer: "0",
            notes: "",
          }}
        />
      </Panel>
    </>
  );
}
