import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { getCatalog } from "@/lib/fleet-data";
import { knownModels } from "@/lib/known-models";
import { canManageFleet } from "@/lib/roles";
import { ProductForm } from "../product-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.model");
  return { title: t("newTitle") };
}

/**
 * "+ New product": the one place a product is added to the shop
 * (docs/products-redesign.md). Stage A: vehicles. Its vehicles are added
 * afterwards, on the product's Units tab.
 */
export default async function NewProductPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/products/new">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireArea(slug, "products");
  if (!canManageFleet(membership.role)) notFound();
  const [t, tFleet, tProducts, catalog] = await Promise.all([
    getTranslations("Fleet.model"),
    getTranslations("Fleet"),
    getTranslations("Products"),
    getCatalog(),
  ]);
  // Arriving from "this is a known model": that one is already picked.
  const preset = typeof query.catalog === "string" ? query.catalog : "";
  const chosen = catalog.find((c) => c.id === preset);
  // Arriving from "Add vehicle": back there once it is saved.
  const then = query.then === "inventory" ? "inventory" : undefined;

  return (
    <>
      <BackLink
        href={then ? `/${slug}/fleet/units/new` : `/${slug}/products`}
        label={then ? tFleet("unit.newTitle") : tProducts("title")}
      />
      <PageHeader title={t("newTitle")} intro={t("newIntro")} />
      <div className="rounded-lg border bg-card p-4 sm:p-5">
        <ProductForm
          slug={slug}
          currency={membership.tenant.currency}
          then={then}
          known={knownModels(catalog)}
          what={{
            vehicle_type: "motorbike",
            catalog_id: chosen?.id ?? "",
            make: "",
            model: "",
            cc: "",
            transmission: "",
            categories: chosen ? [chosen.type] : [],
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
