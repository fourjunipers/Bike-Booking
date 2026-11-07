import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SearchForm } from "@/components/customer/search-form";
import { isCustomerLocale, localePath } from "@/i18n/config";
import { languageAlternates } from "@/i18n/metadata";
import { getFeaturedShops, getStations } from "@/lib/public-data";
import { PHOTO_BUCKETS, SHOP_PLACEHOLDER, thumbUrl } from "@/lib/photos";
import { supabaseUrl } from "@/lib/supabase/env";
import { stationOptions } from "./station-options";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isCustomerLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "Customer" });
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: languageAlternates(locale, "/"),
  };
}

// TODO(phase-7): real area pages (Sukhumvit, Silom, Khao San, …).
const AREAS = ["Sukhumvit", "Silom", "Khao San", "Ari", "Thonglor"];

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isCustomerLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Customer" });
  const ts = await getTranslations({ locale, namespace: "Search" });
  const [stations, featured] = await Promise.all([
    getStations(),
    getFeaturedShops(),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-6 rounded-2xl bg-primary px-5 py-8 text-primary-foreground md:px-10 md:py-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
          <p className="max-w-2xl text-lg text-primary-foreground/90">
            {t("intro")}
          </p>
        </div>
        <div className="rounded-xl bg-card p-4 text-card-foreground shadow-lg md:p-6">
          <SearchForm stations={stationOptions(stations, locale)} />
        </div>
      </section>

      {featured.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{ts("featuredShops")}</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((shop) => (
              <li
                key={shop.slug}
                className="overflow-hidden rounded-xl border bg-card shadow-sm"
              >
                <Link
                  href={localePath(locale, `/shops/${shop.slug}`)}
                  className="block focus-visible:outline-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Storage thumbnail, already resized */}
                  <img
                    src={thumbUrl(
                      supabaseUrl(),
                      PHOTO_BUCKETS.shop,
                      shop.photos[0],
                      SHOP_PLACEHOLDER,
                    )}
                    alt=""
                    width={480}
                    height={360}
                    loading="lazy"
                    className="aspect-4/3 w-full bg-muted object-cover"
                  />
                  <div className="space-y-1 p-4">
                    <h3 className="text-lg font-semibold">{shop.name}</h3>
                    {shop.nearest_station && (
                      <p className="text-sm text-muted-foreground">
                        {ts("nearStation", { station: shop.nearest_station })}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">{ts("areas")}</h2>
        <ul className="flex flex-wrap gap-2">
          {AREAS.map((area) => (
            <li key={area}>
              <span className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm text-muted-foreground">
                {area}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{ts("areasSoon")}</p>
      </section>
    </div>
  );
}
