import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { getFleet, getLocations } from "@/lib/fleet-data";
import { canManageFleet } from "@/lib/roles";
import { UnitForm } from "../../unit-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.unit");
  return { title: t("newTitle") };
}

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
  // A bike belongs to a model, so the model comes first.
  if (fleet.length === 0) redirect(`/${slug}/fleet/models/new`);
  const preset = typeof query.model === "string" ? query.model : "";
  const model = fleet.find((m) => m.id === preset) ?? fleet[0];

  return (
    <>
      <BackLink href={`/${slug}/fleet/models/${model.id}`} label={model.name} />
      <PageHeader title={t("newTitle")} />
      <Panel className="max-w-3xl">
        <UnitForm
          slug={slug}
          distanceUnit={tenant.distanceUnit}
          models={fleet.map((m) => ({ value: m.id, label: m.name }))}
          locations={locations.map((l) => ({ value: l.id, label: l.name }))}
          values={{
            model_id: model.id,
            location_id: locations[0]?.id ?? "",
            plate: "",
            plate_pending: false,
            frame_number: "",
            engine_number: "",
            colour: "",
            first_registered: "",
            status: "active",
            active_from: "",
            active_to: "",
            notes: "",
          }}
        />
        <p className="mt-4 text-sm text-muted-foreground">
          {tFleet("sticker.help")}
        </p>
      </Panel>
    </>
  );
}
