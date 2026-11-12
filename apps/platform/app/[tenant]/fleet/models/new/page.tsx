import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { getCatalog } from "@/lib/fleet-data";
import { catalogOptions } from "@/lib/model-options";
import { canManageFleet } from "@/lib/roles";
import { ModelForm } from "../../model-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.model");
  return { title: t("newTitle") };
}

/**
 * "+ Make & model": the one place a kind of vehicle is added to the shop
 * (owner, 12 Nov 2026). Vehicles of it are added afterwards, with
 * "+ Add to inventory".
 */
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
  // Arriving from "this is already on the list": that entry is preselected.
  const preset = typeof query.catalog === "string" ? query.catalog : "";
  const chosen = catalog.find((c) => c.id === preset);
  // Arriving from "+ Add to inventory": back there once it is saved.
  const then = query.then === "inventory" ? "inventory" : undefined;

  return (
    <>
      <BackLink
        href={then ? `/${slug}/fleet/units/new` : `/${slug}/fleet`}
        label={then ? tFleet("unit.newTitle") : tFleet("title")}
      />
      <PageHeader title={t("newTitle")} intro={t("newIntro")} />
      <div className="rounded-lg border bg-card p-4 sm:p-5">
        <ModelForm
          slug={slug}
          currency={membership.tenant.currency}
          then={then}
          listOptions={catalogOptions(catalog)}
          listTypes={Object.fromEntries(catalog.map((c) => [c.id, c.type]))}
          makes={[...new Set(catalog.map((c) => c.make))].sort()}
          what={{
            vehicle_type: "motorbike",
            catalog_id: chosen?.id ?? "",
            make: "",
            model: "",
            cc: "",
            transmission: "",
            category: chosen?.type ?? "",
          }}
          values={{
            name: "",
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
