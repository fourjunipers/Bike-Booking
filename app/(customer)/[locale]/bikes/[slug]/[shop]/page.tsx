import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Badge, modelName } from "@/components/customer/cards";
import { GoogleReviews } from "@/components/customer/google-reviews";
import { InclusionsList } from "@/components/customer/inclusions";
import { PlatformReviews, ShopInfo } from "@/components/customer/shop-info";
import {
  isCustomerLocale,
  localePath,
  type CustomerLocale,
} from "@/i18n/config";
import { languageAlternates } from "@/i18n/metadata";
import { formatBaht } from "@/lib/money";
import {
  getCatalogModel,
  getListing,
  getShopBySlug,
  listShopReviews,
} from "@/lib/data";
import { runSearch } from "@/lib/marketplace-search";
import { priceForDays } from "@/lib/pricing";
import { parseSearchParams, searchQuery } from "@/lib/search-params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/bikes/[slug]/[shop]">): Promise<Metadata> {
  const { locale, slug, shop: shopSlug } = await params;
  if (!isCustomerLocale(locale)) return {};
  const [entry, shop] = await Promise.all([
    getCatalogModel(slug),
    getShopBySlug(shopSlug),
  ]);
  if (!entry || !shop) return {};
  const t = await getTranslations({ locale, namespace: "Bike" });
  const name = modelName(entry);
  return {
    title: t("listingTitle", { name, shop: shop.name }),
    description: t("listingDescription", { name, shop: shop.name }),
    alternates: languageAlternates(locale, `/bikes/${slug}/${shopSlug}`),
  };
}

/** SPEC "Shop listing page": one shop's offer of one model. */
export default function ListingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/bikes/[slug]/[shop]">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
    >
      {params.then(({ locale, slug, shop }) =>
        isCustomerLocale(locale) ? (
          <Listing
            locale={locale}
            slug={slug}
            shopSlug={shop}
            searchParams={searchParams}
          />
        ) : (
          notFound()
        ),
      )}
    </Suspense>
  );
}

const TABLE_DAYS = [1, 3, 7, 14, 30];

async function Listing({
  locale,
  slug,
  shopSlug,
  searchParams,
}: {
  locale: CustomerLocale;
  slug: string;
  shopSlug: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [entry, shop] = await Promise.all([
    getCatalogModel(slug),
    getShopBySlug(shopSlug),
  ]);
  if (!entry || !shop) notFound();
  const listing = await getListing(shop.id, entry.id);
  if (!listing || listing.dayPrices.length < 30) notFound();
  const t = await getTranslations({ locale, namespace: "Bike" });
  const ts = await getTranslations({ locale, namespace: "Search" });
  const p = parseSearchParams(await searchParams);
  const [offer] = await runSearch(p, {
    catalogId: entry.id,
    shopId: shop.id,
  });
  const reviews = await listShopReviews(shop.id);
  const name = modelName(entry);
  const dated = Boolean((p.from && p.to) || p.now);

  return (
    <div className="space-y-8">
      <Link
        href={`${localePath(locale, `/bikes/${entry.slug}`)}${searchQuery(p)}`}
        className="text-sm font-medium text-primary underline underline-offset-4"
      >
        {t("allShops", { name })}
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{name}</h1>
        <p className="text-lg">
          <Link
            href={localePath(locale, `/shops/${shop.slug}`)}
            className="font-medium text-primary underline underline-offset-4"
          >
            {shop.name}
          </Link>
          {shop.nearestStation && (
            <span className="text-muted-foreground">
              {" "}
              · {ts("nearStation", { station: shop.nearestStation })}
            </span>
          )}
        </p>
      </header>

      <section aria-label={t("photos")}>
        <ul className="flex snap-x gap-3 overflow-x-auto pb-2">
          {listing.photoUrls.map((photo, i) => (
            <li key={photo} className="w-4/5 shrink-0 snap-start sm:w-96">
              {/* eslint-disable-next-line @next/next/no-img-element -- already-sized image from the data adapter */}
              <img
                src={photo}
                alt={t("photoN", { name, n: i + 1 })}
                width={1600}
                height={1200}
                loading={i === 0 ? "eager" : "lazy"}
                className="aspect-4/3 w-full rounded-xl border bg-muted object-cover"
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="space-y-3 rounded-xl border-2 border-primary/40 bg-card p-4 shadow-sm md:p-6">
            <InclusionsList
              locale={locale}
              inc={listing.inclusions!}
              deposit={listing.deposit}
            />
          </section>

          {listing.extras.length > 0 && (
            <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm md:p-6">
              <h2 className="text-xl font-semibold">{t("extras")}</h2>
              <p className="text-sm text-muted-foreground">{t("extrasHint")}</p>
              <ul className="divide-y">
                {listing.extras.map((e) => (
                  <li key={e.id} className="space-y-1 py-3">
                    <p className="flex flex-wrap justify-between gap-2 font-medium">
                      <span>{e.name}</span>
                      <span>
                        {e.price.kind === "rental"
                          ? t("perRental", {
                              price: formatBaht(e.price.amount),
                            })
                          : t("perDayExtra", {
                              price: formatBaht(e.price.perDay),
                            })}
                      </span>
                    </p>
                    {e.description && (
                      <p className="text-sm text-muted-foreground">
                        {e.description}
                      </p>
                    )}
                    {e.terms && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-primary">
                          {t("terms")}
                        </summary>
                        <p className="mt-1 whitespace-pre-line">{e.terms}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold">{t("reviews")}</h2>
            <PlatformReviews locale={locale} reviews={reviews} />
            {shop.googlePlaceId && (
              <GoogleReviews shopId={shop.id} locale={locale} />
            )}
          </section>
        </div>

        <aside className="order-first space-y-6 lg:order-none">
          <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm md:p-6">
            {offer ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {offer.readyNow && <Badge tone="now">{ts("readyNow")}</Badge>}
                  {offer.mode === "instant" && (
                    <Badge tone="instant">{ts("instant")}</Badge>
                  )}
                  {offer.mode === "request" && (
                    <Badge tone="request">{ts("request")}</Badge>
                  )}
                </div>
                <p className="text-3xl font-bold text-primary">
                  {formatBaht(offer.total)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {dated
                    ? ts("forDays", { n: offer.days })
                    : ts("perDayShort", { amount: formatBaht(offer.perDay) })}
                </p>
                {offer.mode === "now" && offer.walkinMaxDays !== null && (
                  <p className="text-sm font-medium text-amber-800">
                    {ts("upToDays", { n: offer.walkinMaxDays })}
                  </p>
                )}
              </div>
            ) : (
              <p className="font-medium">{t("notAvailable")}</p>
            )}
            <div className="space-y-1">
              <button
                type="button"
                disabled
                className="h-12 w-full rounded-md bg-primary/50 font-semibold text-primary-foreground"
              >
                {t("book")}
              </button>
              <p className="text-center text-sm text-muted-foreground">
                {t("bookingSoon")}
              </p>
            </div>
            <table className="w-full text-sm">
              <caption className="pb-1 text-left font-semibold">
                {t("priceTable")}
              </caption>
              <tbody className="divide-y">
                {TABLE_DAYS.map((d) => (
                  <tr key={d}>
                    <th
                      scope="row"
                      className="py-1.5 text-left font-normal text-muted-foreground"
                    >
                      {ts("forDays", { n: d })}
                    </th>
                    <td className="py-1.5 text-right font-medium">
                      {formatBaht(
                        priceForDays(
                          listing.dayPrices,
                          d,
                          listing.pricePerDayAfter30 ?? undefined,
                        ),
                      )}
                    </td>
                  </tr>
                ))}
                {listing.pricePerDayAfter30 !== null && (
                  <tr>
                    <th
                      scope="row"
                      className="py-1.5 text-left font-normal text-muted-foreground"
                    >
                      {t("after30")}
                    </th>
                    <td className="py-1.5 text-right font-medium">
                      {ts("perDayShort", {
                        amount: formatBaht(listing.pricePerDayAfter30),
                      })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold">{shop.name}</h2>
            <ShopInfo locale={locale} shop={shop} />
          </section>

          <section className="space-y-2 rounded-xl border bg-card p-4 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold">{t("cancellation")}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>{t("cancelFree")}</li>
              <li>{t("cancelLate")}</li>
              <li>{t("cancelVendor")}</li>
              <li>{t("cancelDeclined")}</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
