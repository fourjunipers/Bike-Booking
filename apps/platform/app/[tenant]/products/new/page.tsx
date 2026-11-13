import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { canManageFleet } from "@/lib/roles";
import { ProductForm } from "../product-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.model");
  return { title: t("newTitle") };
}

/**
 * "+ New product": the one place a product is added to the shop
 * (docs/products-redesign.md). Stage A: vehicles. A product is a kind and a
 * name (owner, 13 Nov 2026); its vehicles are added afterwards, on its Units
 * tab, and its make and model are asked for if it is sent to Moto Mangos.
 */
export default async function NewProductPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/products/new">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireArea(slug, "products");
  if (!canManageFleet(membership.role)) notFound();
  const [t, tFleet, tProducts] = await Promise.all([
    getTranslations("Fleet.model"),
    getTranslations("Fleet"),
    getTranslations("Products"),
  ]);
  // Arriving from "Add vehicle": back there once it is saved.
  const then = query.then === "inventory" ? "inventory" : undefined;

  return (
    <>
      <BackLink
        href={then ? `/${slug}/fleet/units/new` : `/${slug}/products`}
        label={then ? tFleet("unit.newTitle") : tProducts("title")}
      />
      <PageHeader title={t("newTitle")} intro={t("newIntro")} />
      <section
        aria-labelledby="product-details"
        className="rounded-lg border bg-card p-4 sm:p-5"
      >
        <h2 id="product-details" className="mb-4 text-lg font-semibold">
          {t("detailsTitle")}
        </h2>
        <ProductForm
          slug={slug}
          currency={membership.tenant.currency}
          then={then}
          what={{ vehicle_type: "motorbike", categories: [] }}
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
      </section>
    </>
  );
}
