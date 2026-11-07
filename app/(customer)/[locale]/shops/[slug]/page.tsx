import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ModelCardView } from "@/components/customer/cards";
import { GoogleReviews } from "@/components/customer/google-reviews";
import { PlatformReviews, ShopInfo } from "@/components/customer/shop-info";
import {
  isCustomerLocale,
  localePath,
  type CustomerLocale,
} from "@/i18n/config";
import { languageAlternates } from "@/i18n/metadata";
import { PHOTO_BUCKETS, photoUrl, SHOP_PLACEHOLDER } from "@/lib/photos";
import { getShop, getShopReviews, searchOffers } from "@/lib/public-data";
import { groupOffers, sortCards } from "@/lib/search";
import { parseSearchParams, searchQuery } from "@/lib/search-params";
import { supabaseUrl } from "@/lib/supabase/env";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/shops/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isCustomerLocale(locale)) return {};
  const shop = await getShop(slug);
  if (!shop) return {};
  const t = await getTranslations({ locale, namespace: "Shop" });
  return {
    title: t("metaTitle", { shop: shop.name }),
    description:
      shop.about?.slice(0, 160) ?? t("metaDescription", { shop: shop.name }),
    alternates: languageAlternates(locale, `/shops/${slug}`),
  };
}

/** SPEC "Shop page": about, photos, hours, location, all models, reviews. */
export default function ShopPage({
  params,
  searchParams,
}: PageProps<"/[locale]/shops/[slug]">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
    >
      {params.then(({ locale, slug }) =>
        isCustomerLocale(locale) ? (
          <ShopView locale={locale} slug={slug} searchParams={searchParams} />
        ) : (
          notFound()
        ),
      )}
    </Suspense>
  );
}

async function ShopView({
  locale,
  slug,
  searchParams,
}: {
  locale: CustomerLocale;
  slug: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const shop = await getShop(slug);
  if (!shop) notFound();
  const t = await getTranslations({ locale, namespace: "Shop" });
  const p = parseSearchParams(await searchParams);
  const [rows, reviews] = await Promise.all([
    searchOffers(p, { shopId: shop.id }),
    getShopReviews(shop.id),
  ]);
  const cards = sortCards(groupOffers(rows), "price");
  const query = searchQuery(p);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{shop.name}</h1>
        {shop.nearest_station && (
          <p className="text-muted-foreground">
            {t("station", { station: shop.nearest_station })}
          </p>
        )}
      </header>

      <ul
        className="flex snap-x gap-3 overflow-x-auto pb-2"
        aria-label={t("photos")}
      >
        {(shop.photos.length > 0 ? shop.photos : [null]).map((photo, i) => (
          <li
            key={photo ?? "placeholder"}
            className="w-4/5 shrink-0 snap-start sm:w-96"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Storage URL, already resized */}
            <img
              src={photoUrl(
                supabaseUrl(),
                PHOTO_BUCKETS.shop,
                photo,
                SHOP_PLACEHOLDER,
              )}
              alt={t("photoN", { shop: shop.name, n: i + 1 })}
              width={1600}
              height={1200}
              loading={i === 0 ? "eager" : "lazy"}
              className="aspect-4/3 w-full rounded-xl border bg-muted object-cover"
            />
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {shop.about && (
            <section className="space-y-2 rounded-xl border bg-card p-4 shadow-sm md:p-6">
              <h2 className="text-xl font-semibold">{t("about")}</h2>
              <p className="whitespace-pre-line">{shop.about}</p>
            </section>
          )}

          <section className="space-y-3" aria-labelledby="bikes-heading">
            <h2 id="bikes-heading" className="text-xl font-semibold">
              {t("bikes", { n: cards.length })}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {cards.map((card) => (
                <ModelCardView
                  key={card.catalogId}
                  locale={locale}
                  card={card}
                  near={false}
                  href={`${localePath(locale, `/bikes/${card.slug}/${shop.slug}`)}${query}`}
                />
              ))}
            </ul>
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold">{t("reviews")}</h2>
            <PlatformReviews locale={locale} reviews={reviews} />
            {shop.google_place_id && (
              <GoogleReviews shopId={shop.id} locale={locale} />
            )}
          </section>
        </div>

        <aside>
          <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold">{t("location")}</h2>
            <ShopInfo locale={locale} shop={shop} />
          </section>
        </aside>
      </div>
    </div>
  );
}
