import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { modelName, OfferCard } from "@/components/customer/cards";
import { InclusionsList } from "@/components/customer/inclusions";
import { MapView } from "@/components/customer/map-view";
import {
  isCustomerLocale,
  localePath,
  type CustomerLocale,
} from "@/i18n/config";
import { languageAlternates } from "@/i18n/metadata";
import { PHOTO_BUCKETS, photoUrl } from "@/lib/photos";
import { getCatalogEntry, getListing, searchOffers } from "@/lib/public-data";
import { sortOffers } from "@/lib/search";
import { parseSearchParams, searchQuery } from "@/lib/search-params";
import { supabaseUrl } from "@/lib/supabase/env";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/bikes/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isCustomerLocale(locale)) return {};
  const entry = await getCatalogEntry(slug);
  if (!entry) return {};
  const t = await getTranslations({ locale, namespace: "Bike" });
  const name = modelName(entry);
  return {
    title: t("metaTitle", { name }),
    description: t("metaDescription", { name, cc: entry.cc }),
    alternates: languageAlternates(locale, `/bikes/${slug}`),
  };
}

/** SPEC "Model page": specs, every shop offering the model, map. */
export default function ModelPage({
  params,
  searchParams,
}: PageProps<"/[locale]/bikes/[slug]">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
    >
      {params.then(({ locale, slug }) =>
        isCustomerLocale(locale) ? (
          <Model locale={locale} slug={slug} searchParams={searchParams} />
        ) : (
          notFound()
        ),
      )}
    </Suspense>
  );
}

async function Model({
  locale,
  slug,
  searchParams,
}: {
  locale: CustomerLocale;
  slug: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entry = await getCatalogEntry(slug);
  if (!entry) notFound();
  const t = await getTranslations({ locale, namespace: "Bike" });
  const tb = await getTranslations({ locale, namespace: "Bikes" });
  const p = parseSearchParams(await searchParams);
  const offers = sortOffers(
    await searchOffers(p, { catalogId: entry.id }),
    p.sort,
  );
  const listings = await Promise.all(
    offers.map((o) => getListing(o.shop_id, entry.id)),
  );
  const query = searchQuery(p);
  const dated = Boolean((p.from && p.to) || p.now);

  const specs = [
    [t("engine"), `${entry.cc}cc`],
    [t("type"), tb(`type.${entry.type}`)],
    [t("transmission"), tb(`transmission.${entry.transmission}`)],
    entry.abs !== null && [t("abs"), entry.abs ? t("yes") : t("no")],
    entry.underseat_storage !== null && [
      t("storage"),
      entry.underseat_storage ? t("yes") : t("no"),
    ],
    entry.usb_charger !== null && [
      t("usb"),
      entry.usb_charger ? t("yes") : t("no"),
    ],
    entry.key_type && [t("key"), t(`keyType.${entry.key_type}`)],
  ].filter(Boolean) as [string, string][];

  return (
    <div className="space-y-8">
      <Link
        href={`${localePath(locale, "/search")}${query}`}
        className="text-sm font-medium text-primary underline underline-offset-4"
      >
        {t("backToSearch")}
      </Link>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- Storage URL, already resized */}
        <img
          src={photoUrl(
            supabaseUrl(),
            PHOTO_BUCKETS.catalog,
            entry.stock_photo,
          )}
          alt={modelName(entry)}
          width={1600}
          height={1200}
          className="aspect-4/3 w-full rounded-xl border bg-muted object-cover"
        />
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">{modelName(entry)}</h1>
          {entry.description && <p>{entry.description}</p>}
          <dl className="divide-y rounded-xl border bg-card px-4 shadow-sm">
            {specs.map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[10rem_1fr] gap-3 py-2 text-sm"
              >
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">{t("stockPhotoNote")}</p>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="shops-heading">
        <h2 id="shops-heading" className="text-2xl font-semibold">
          {t("shopsOffering", { n: offers.length })}
        </h2>
        {offers.length > 0 ? (
          <ul className="space-y-3">
            {offers.map((o) => (
              <OfferCard
                key={o.bike_model_id}
                locale={locale}
                offer={o}
                dated={dated}
                href={`${localePath(locale, `/bikes/${entry.slug}/${o.shop_slug}`)}${query}`}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border bg-card p-6 text-muted-foreground shadow-sm">
            {t("noShops")}
          </p>
        )}
      </section>

      {offers.length > 0 && (
        <MapView
          pins={offers
            .filter((o) => o.shop_lat !== null && o.shop_lng !== null)
            .map((o) => ({
              id: o.shop_id,
              lat: o.shop_lat!,
              lng: o.shop_lng!,
              label: o.shop_name,
            }))}
          center={
            p.lat !== undefined && p.lng !== undefined
              ? { lat: p.lat, lng: p.lng }
              : undefined
          }
        />
      )}

      {offers.length > 0 && (
        <section className="space-y-4" aria-labelledby="compare-heading">
          <h2 id="compare-heading" className="text-2xl font-semibold">
            {t("compare")}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {offers.map((o, i) => {
              const listing = listings[i];
              if (!listing?.inclusions) return null;
              return (
                <article
                  key={o.bike_model_id}
                  className="space-y-3 rounded-xl border bg-card p-4 shadow-sm"
                >
                  <h3 className="text-lg font-semibold">{o.shop_name}</h3>
                  <InclusionsList
                    locale={locale}
                    inc={listing.inclusions}
                    deposit={listing.deposit}
                    compact
                  />
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
