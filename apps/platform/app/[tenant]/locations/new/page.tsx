import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { LocationForm } from "../location-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Locations");
  return { title: t("newTitle") };
}

export default async function NewLocationPage({
  params,
}: PageProps<"/[tenant]/locations/new">) {
  const { tenant: slug } = await params;
  const { membership } = await requireArea(slug, "locations");
  const t = await getTranslations("Locations");

  return (
    <>
      <BackLink href={`/${slug}/locations`} label={t("title")} />
      <PageHeader title={t("newTitle")} />
      <Panel className="max-w-3xl">
        <LocationForm
          slug={slug}
          timeZones={Intl.supportedValuesOf("timeZone")}
          // A new location's zone is chosen by whoever creates it.
          canChangeZone
          values={{
            name: "",
            // Start from the main location's zone; any zone can be picked.
            timezone: membership.tenant.timezone,
            address: "",
            maps_url: "",
            phone: "",
            whatsapp: "",
            line_id: "",
            email: "",
          }}
        />
      </Panel>
    </>
  );
}
