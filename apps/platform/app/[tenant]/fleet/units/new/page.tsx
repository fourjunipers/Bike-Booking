import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import { getFleet, getLocations } from "@/lib/fleet-data";
import { inventoryModelOptions } from "@/lib/model-options";
import { canManageFleet } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { UnitForm } from "../../unit-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.unit");
  return { title: t("newTitle") };
}

/**
 * "+ Add to inventory": one vehicle of a make & model the shop already has.
 * It never creates a make & model (owner, 12 Nov 2026); when the one wanted
 * isn't there, a link goes to "+ Make & model" and comes back here.
 */
export default async function NewUnitPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/fleet/units/new">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireArea(slug, "fleet");
  if (!canManageFleet(membership.role)) notFound();
  const { tenant } = membership;
  const [t, tFleet, fleet, locations] = await Promise.all([
    getTranslations("Fleet.unit"),
    getTranslations("Fleet"),
    getFleet(tenant.id),
    getLocations(tenant.id),
  ]);
  const models = inventoryModelOptions(fleet);
  // Arriving from a model's row or page, or from adding a make & model.
  const wanted = typeof query.model === "string" ? `model:${query.model}` : "";
  const addModelHref = `/${slug}/fleet/models/new?then=inventory`;

  return (
    <>
      <BackLink href={`/${slug}/fleet`} label={tFleet("title")} />
      <PageHeader title={t("newTitle")} intro={t("newIntro")} />
      {models.length === 0 ? (
        <Panel className="max-w-3xl">
          <p className="mb-4 text-sm">{t("noModelsYet")}</p>
          <Link
            href={addModelHref}
            className={cn(buttonVariants({ variant: "default" }), "h-11 px-4")}
          >
            <Plus aria-hidden />
            {tFleet("addModel")}
          </Link>
        </Panel>
      ) : (
        <Panel className="max-w-3xl">
          <UnitForm
            slug={slug}
            distanceUnit={tenant.distanceUnit}
            addModelHref={addModelHref}
            models={models}
            locations={locations.map((l) => ({ value: l.id, label: l.name }))}
            values={{
              model_choice: models.some((m) => m.value === wanted)
                ? wanted
                : "",
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
      )}
    </>
  );
}
