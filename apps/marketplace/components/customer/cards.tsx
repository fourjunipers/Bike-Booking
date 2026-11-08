import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { yearRange } from "@/lib/catalog";
import { formatBaht } from "@mango/core/money";
import type { ModelCard, RankedOffer } from "@/lib/search";

/** A small coloured label: Instant, Request, Ready now, Featured. */
export function Badge({
  tone,
  children,
}: {
  tone: "instant" | "request" | "now" | "featured";
  children: React.ReactNode;
}) {
  const tones = {
    instant: "bg-emerald-100 text-emerald-900",
    request: "bg-sky-100 text-sky-900",
    now: "bg-amber-100 text-amber-900",
    featured: "bg-violet-100 text-violet-900",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** "Honda PCX 160 2026". */
export function modelName(m: {
  make: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
}) {
  const years = yearRange(m.yearFrom, m.yearTo);
  return `${m.make} ${m.model}${years ? ` ${years}` : ""}`;
}

/** Search result: one catalog model, the lowest price and how many shops. */
export async function ModelCardView({
  locale,
  card,
  href,
  near,
}: {
  locale: string;
  card: ModelCard;
  href: string;
  near: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "Search" });
  const tb = await getTranslations({ locale, namespace: "Bikes" });
  return (
    <li className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={href}
        className="flex h-full flex-col focus-visible:outline-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- already-sized image from the data adapter */}
        <img
          src={card.thumbUrl}
          alt=""
          width={480}
          height={360}
          loading="lazy"
          className="aspect-4/3 w-full bg-muted object-cover"
        />
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex flex-wrap gap-1.5">
            {card.featured && <Badge tone="featured">{t("featured")}</Badge>}
            {card.readyNow && <Badge tone="now">{t("readyNow")}</Badge>}
            {card.instant && <Badge tone="instant">{t("instant")}</Badge>}
            {card.request && <Badge tone="request">{t("request")}</Badge>}
          </div>
          <h2 className="text-lg font-semibold">{modelName(card)}</h2>
          <p className="text-sm text-muted-foreground">
            {card.cc}cc · {tb(`type.${card.type}`)} ·{" "}
            {tb(`transmission.${card.transmission}`)}
          </p>
          <p className="mt-auto flex flex-wrap items-baseline justify-between gap-2">
            <span>
              <span className="text-sm text-muted-foreground">
                {t("from")}{" "}
              </span>
              <span className="text-xl font-bold text-primary">
                {formatBaht(card.fromPerDay)}
              </span>
              <span className="text-sm text-muted-foreground">
                {" "}
                {t("perDay")}
              </span>
            </span>
            <span className="text-sm font-medium">
              {near
                ? t("shopsNear", { n: card.shops })
                : t("shops", { n: card.shops })}
            </span>
          </p>
        </div>
      </Link>
    </li>
  );
}

/** One shop's offer of a model, for the model page. */
export async function OfferCard({
  locale,
  offer,
  href,
  dated,
}: {
  locale: string;
  offer: RankedOffer;
  href: string;
  dated: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "Search" });
  return (
    <li className="rounded-xl border bg-card shadow-sm">
      <Link
        href={href}
        className="grid gap-4 p-4 focus-visible:outline-2 sm:grid-cols-[8rem_1fr_auto] sm:items-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- already-sized image from the data adapter */}
        <img
          src={offer.thumbUrl}
          alt=""
          width={480}
          height={360}
          loading="lazy"
          className="aspect-4/3 w-full rounded-md bg-muted object-cover"
        />
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1.5">
            {offer.boost === "featured" && (
              <Badge tone="featured">{t("featured")}</Badge>
            )}
            {offer.readyNow && <Badge tone="now">{t("readyNow")}</Badge>}
            {offer.mode === "instant" && (
              <Badge tone="instant">{t("instant")}</Badge>
            )}
            {offer.mode === "request" && (
              <Badge tone="request">{t("request")}</Badge>
            )}
          </div>
          <h3 className="text-lg font-semibold">{offer.shop.name}</h3>
          <p className="text-sm text-muted-foreground">
            {[
              offer.distanceKm !== null &&
                t("km", { km: offer.distanceKm.toFixed(1) }),
              offer.deposit !== null
                ? t("deposit", { amount: formatBaht(offer.deposit) })
                : t("noDeposit"),
              offer.rating !== null &&
                t("rating", {
                  rating: offer.rating.toFixed(1),
                  n: offer.reviewCount,
                }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {offer.mode === "now" && offer.walkinMaxDays !== null && (
            <p className="text-sm font-medium text-amber-800">
              {t("upToDays", { n: offer.walkinMaxDays })}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-primary">
            {formatBaht(offer.total)}
          </p>
          <p className="text-sm text-muted-foreground">
            {dated
              ? t("forDays", { n: offer.days })
              : t("perDayShort", { amount: formatBaht(offer.perDay) })}
          </p>
        </div>
      </Link>
    </li>
  );
}
