import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Leaf, SpeedLines } from "@/components/brand/logo";
import { SearchForm } from "@/components/customer/search-form";
import { isCustomerLocale, localePath } from "@/i18n/config";
import { languageAlternates } from "@/i18n/metadata";
import { listFeaturedShops, listStations } from "@/lib/data";
import { placeSearchEnabled } from "@/lib/places-server";
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
    listStations(),
    listFeaturedShops(),
  ]);

  return (
    <div className="space-y-10">
      <section className="relative space-y-6 overflow-hidden rounded-3xl bg-linear-to-br from-sun via-mango to-mango-strong px-5 py-8 text-ink md:px-10 md:py-12">
        {/* Decorative: a big soft sun and a leaf in the corner. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-white/20"
        />
        <Leaf className="pointer-events-none absolute top-5 right-5 size-12 rotate-12 md:size-16" />
        <div className="relative max-w-2xl space-y-3">
          <SpeedLines className="h-5 w-10 [&_path]:stroke-ink" />
          {/* Real text, not an image: it's the page's main heading. */}
          <h1 className="text-3xl font-black md:text-5xl">{t("title")}</h1>
          <p className="text-lg font-semibold md:text-xl">{t("subline")}</p>
        </div>
        <div className="relative rounded-2xl bg-card p-4 text-card-foreground shadow-xl md:p-6">
          <SearchForm
            stations={stationOptions(stations, locale)}
            placeSearch={placeSearchEnabled()}
          />
        </div>
      </section>

      {featured.length > 0 && (
        <section className="space-y-4">
          <SectionHeading>{ts("featuredShops")}</SectionHeading>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((shop) => (
              <li
                key={shop.slug}
                className="overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <Link
                  href={localePath(locale, `/shops/${shop.slug}`)}
                  className="block focus-visible:outline-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- already-sized image from the data adapter */}
                  <img
                    src={shop.thumbUrl}
                    alt=""
                    width={480}
                    height={360}
                    loading="lazy"
                    className="aspect-4/3 w-full bg-muted object-cover"
                  />
                  <div className="space-y-1 p-4">
                    <h3 className="text-lg font-semibold">{shop.name}</h3>
                    {shop.nearestStation && (
                      <p className="text-sm text-muted-foreground">
                        {ts("nearStation", { station: shop.nearestStation })}
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
        <SectionHeading>{ts("areas")}</SectionHeading>
        <ul className="flex flex-wrap gap-2">
          {AREAS.map((area) => (
            <li key={area}>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium text-muted-foreground">
                <Leaf className="size-4" />
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-2xl">
      <SpeedLines className="h-4 w-7 shrink-0" />
      {children}
    </h2>
  );
}
