import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ModelCardView } from "@/components/customer/cards";
import { MapView } from "@/components/customer/map-view";
import { SearchForm } from "@/components/customer/search-form";
import { inputClass } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import {
  isCustomerLocale,
  localePath,
  type CustomerLocale,
} from "@/i18n/config";
import { languageAlternates } from "@/i18n/metadata";
import { getStations, searchOffers } from "@/lib/public-data";
import { groupOffers, sortCards } from "@/lib/search";
import {
  BIKE_TYPES,
  NEAR_KM,
  parseSearchParams,
  searchQuery,
  SORTS,
  TRANSMISSIONS,
  type SearchParams,
} from "@/lib/search-params";
import { stationOptions } from "../station-options";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/search">): Promise<Metadata> {
  const { locale } = await params;
  if (!isCustomerLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "Search" });
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: languageAlternates(locale, "/search"),
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  if (!isCustomerLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Search" });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold md:text-3xl">{t("title")}</h1>
      <Suspense
        fallback={<p className="text-muted-foreground">{t("loading")}</p>}
      >
        <Results locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({
  locale,
  searchParams,
}: {
  locale: CustomerLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations({ locale, namespace: "Search" });
  const p = parseSearchParams(await searchParams);
  const [rows, stations] = await Promise.all([searchOffers(p), getStations()]);
  const cards = sortCards(groupOffers(rows), p.sort);
  const near = p.lat !== undefined && !p.anyDistance;
  const base = localePath(locale, "/search");

  const pins = [
    ...new Map(
      rows
        .filter((r) => r.shop_lat !== null && r.shop_lng !== null)
        .map((r) => [
          r.shop_id,
          {
            id: r.shop_id,
            lat: r.shop_lat!,
            lng: r.shop_lng!,
            label: r.shop_name,
          },
        ]),
    ).values(),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <aside className="space-y-4">
        <details className="rounded-xl border bg-card p-4 shadow-sm" open>
          <summary className="min-h-11 cursor-pointer content-center font-semibold">
            {t("changeSearch")}
          </summary>
          <div className="mt-3">
            <SearchForm
              stations={stationOptions(stations, locale)}
              initial={p}
              stacked
            />
          </div>
        </details>
        <Filters locale={locale} p={p} action={base} />
      </aside>

      <section className="space-y-4" aria-labelledby="results-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="results-heading" className="text-lg font-semibold">
            {summary(t, p, cards.length)}
          </h2>
          <nav aria-label={t("view")} className="flex gap-1">
            {(["list", "map"] as const).map((view) => (
              <Link
                key={view}
                href={`${base}${searchQuery(p, { view })}`}
                aria-current={p.view === view ? "page" : undefined}
                className="inline-flex min-h-11 items-center rounded-md px-4 font-medium text-muted-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
              >
                {t(view === "list" ? "listView" : "mapView")}
              </Link>
            ))}
          </nav>
        </div>

        {p.view === "map" && (
          <MapView
            pins={pins}
            center={
              p.lat !== undefined && p.lng !== undefined
                ? { lat: p.lat, lng: p.lng }
                : undefined
            }
            className="h-[28rem]"
          />
        )}

        {cards.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <ModelCardView
                key={card.catalogId}
                locale={locale}
                card={card}
                near={near}
                href={`${localePath(locale, `/bikes/${card.slug}`)}${searchQuery(p, { view: "list", sort: "recommended" })}`}
              />
            ))}
          </ul>
        ) : (
          <div className="space-y-3 rounded-xl border bg-card p-6 shadow-sm">
            <p className="font-medium">{t("noResults")}</p>
            <p className="text-sm text-muted-foreground">
              {t("noResultsHint")}
            </p>
          </div>
        )}

        {near && (
          <p>
            <Link
              href={`${base}${searchQuery(p, { anyDistance: true })}`}
              className="font-medium text-primary underline underline-offset-4"
            >
              {t("showFurther", { km: NEAR_KM })}
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}

function summary(
  t: Awaited<ReturnType<typeof getTranslations<"Search">>>,
  p: SearchParams,
  count: number,
) {
  const parts = [t("results", { n: count })];
  if (p.place) parts.push(t("nearPlace", { place: p.place }));
  if (p.now) parts.push(t("availableNow"));
  else if (p.from && p.to)
    parts.push(
      t("dates", {
        from: p.from.replace("T", " "),
        to: p.to.replace("T", " "),
      }),
    );
  return parts.join(" · ");
}

/** Filters and sort: a plain GET form that keeps the location and dates. */
async function Filters({
  locale,
  p,
  action,
}: {
  locale: CustomerLocale;
  p: SearchParams;
  action: string;
}) {
  const t = await getTranslations({ locale, namespace: "Search" });
  const tb = await getTranslations({ locale, namespace: "Bikes" });
  return (
    <form
      action={action}
      method="get"
      className="space-y-4 rounded-xl border bg-card p-4 shadow-sm"
    >
      <h2 className="font-semibold">{t("filters")}</h2>
      {p.lat !== undefined && p.lng !== undefined && (
        <>
          <input type="hidden" name="lat" value={p.lat} />
          <input type="hidden" name="lng" value={p.lng} />
          {p.place && <input type="hidden" name="place" value={p.place} />}
        </>
      )}
      {p.from && p.to && (
        <>
          <input type="hidden" name="from" value={p.from} />
          <input type="hidden" name="to" value={p.to} />
        </>
      )}
      {p.anyDistance && <input type="hidden" name="anywhere" value="1" />}
      {p.view === "map" && <input type="hidden" name="view" value="map" />}

      <Select
        name="sort"
        label={t("sort")}
        value={p.sort}
        options={SORTS.map((s) => ({ value: s, label: t(`sortBy.${s}`) }))}
      />
      <Select
        name="type"
        label={t("bikeType")}
        value={p.type ?? ""}
        options={[
          { value: "", label: t("anyType") },
          ...BIKE_TYPES.map((v) => ({ value: v, label: tb(`type.${v}`) })),
        ]}
      />
      <Select
        name="transmission"
        label={t("transmission")}
        value={p.transmission ?? ""}
        options={[
          { value: "", label: t("any") },
          ...TRANSMISSIONS.map((v) => ({
            value: v,
            label: tb(`transmission.${v}`),
          })),
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <NumberInput name="ccMin" label={t("ccMin")} value={p.ccMin} />
        <NumberInput name="ccMax" label={t("ccMax")} value={p.ccMax} />
      </div>
      <NumberInput name="priceMax" label={t("priceMax")} value={p.priceMax} />
      <Select
        name="rating"
        label={t("minRating")}
        value={p.minRating?.toString() ?? ""}
        options={[
          { value: "", label: t("any") },
          ...["4.5", "4", "3"].map((v) => ({
            value: v,
            label: t("ratingAtLeast", { rating: v }),
          })),
        ]}
      />
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="passport"
          value="copy"
          defaultChecked={p.passportNotHeld}
          className="size-5"
        />
        {t("passportNotHeld")}
      </label>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="now"
          value="1"
          defaultChecked={p.now}
          className="size-5"
        />
        {t("getBikeNow")}
      </label>
      <Button type="submit" className="h-11 w-full">
        {t("apply")}
      </Button>
    </form>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <select name={name} defaultValue={value} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberInput({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        inputMode="numeric"
        defaultValue={value ?? ""}
        className={inputClass}
      />
    </label>
  );
}
