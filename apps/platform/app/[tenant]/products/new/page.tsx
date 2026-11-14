import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { requireArea } from "@/lib/access";
import { minutesToHours } from "@/lib/fleet";
import { getLocations, getModel } from "@/lib/fleet-data";
import { moneyInputValue } from "@/lib/money";
import { canManageFleet } from "@/lib/roles";
import { GeneralForm, NewProductChoice } from "../general-forms";
import { ProductForm } from "../product-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.model");
  return { title: t("newTitle") };
}

/**
 * "+ New product": the one place a product is added to the shop
 * (docs/products-redesign.md). It opens with two choices (owner, 13 Nov
 * 2026): Vehicle, the form as it was (a kind and a name; its vehicles are
 * added afterwards, on its Units tab), and General, for rental gear, items
 * for sale and services. Arriving from "Add vehicle" or "Duplicate" it is a
 * vehicle, so the choice isn't asked.
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
  // "Duplicate" on a product's page: its settings, with its name ready to
  // be changed (the year range, say). No vehicles and no Moto Mangos listing
  // come with it.
  const from = typeof query.from === "string" ? query.from : "";
  const source = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(from)
    ? await getModel(membership.tenant.id, from)
    : null;
  const text = (value: number | null) => (value === null ? "" : String(value));
  // Arriving from "Add vehicle": back there once it is saved.
  const then = query.then === "inventory" ? "inventory" : undefined;
  const locations = await getLocations(membership.tenant.id);
  const vehicleForm = (
    <ProductForm
      slug={slug}
      currency={membership.tenant.currency}
      then={then}
      focusName={Boolean(source)}
      what={{
        vehicle_type: source?.vehicle_type ?? "motorbike",
        categories: source?.categories ?? [],
      }}
      values={{
        name: source?.name ?? "",
        description: source?.description ?? "",
        bookable_online: source?.bookable_online ?? false,
        buffer_before_hours: minutesToHours(
          source?.buffer_before_minutes ?? null,
        ),
        buffer_after_hours: minutesToHours(
          source?.buffer_after_minutes ?? null,
        ),
        deposit:
          source && source.deposit !== null
            ? moneyInputValue(source.deposit, membership.tenant.currency)
            : "",
        min_age: text(source?.min_age ?? null),
        licence_class: source?.licence_class ?? "",
      }}
    />
  );

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
        {then || source ? (
          vehicleForm
        ) : (
          <NewProductChoice
            vehicle={vehicleForm}
            general={
              <GeneralForm
                slug={slug}
                locations={locations.map((l) => ({ id: l.id, name: l.name }))}
              />
            }
          />
        )}
      </section>
    </>
  );
}
