"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Data = {
  rating: number | null;
  count: number;
  mapsUri: string | null;
  reviews: {
    rating: number | null;
    when: string;
    text: string;
    translated: boolean;
    author: string;
    authorUri: string | null;
    photo: string | null;
    uri: string | null;
  }[];
};

/**
 * The shop's Google rating and up to 5 Google reviews, kept apart from the
 * platform's own reviews. Fetched only once this block scrolls into view
 * (owner decision, 2026-11-07), because every lookup is billed. Shows Google
 * Maps attribution, each reviewer's name and photo, links to the reviews on
 * Google Maps, and how they're sorted, as Google's Places policies require.
 */
export function GoogleReviews({
  shopId,
  locale,
}: {
  shopId: string;
  locale: string;
}) {
  const t = useTranslations("Shop");
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Data | null | "none">(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      try {
        const res = await fetch(`/api/google-reviews/${shopId}?lang=${locale}`);
        setData(res.ok ? ((await res.json()) as Data) : "none");
      } catch {
        setData("none");
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [shopId, locale]);

  if (data === "none" || (data && data.rating === null)) return null;
  return (
    <div
      ref={ref}
      className="space-y-3 rounded-lg border bg-white p-4 text-[#1F1F1F]"
    >
      <p
        translate="no"
        className="font-[Roboto,Arial,sans-serif] text-sm text-[#5E5E5E]"
      >
        Google Maps
      </p>
      {!data ? (
        <p className="text-sm text-muted-foreground">{t("googleLoading")}</p>
      ) : (
        <>
          <p className="font-medium">
            {t("googleRating", {
              rating: data.rating!.toFixed(1),
              n: data.count,
            })}
          </p>
          <p className="text-xs text-[#5E5E5E]">{t("googleSorted")}</p>
          <ul className="space-y-3">
            {data.reviews.map((r, i) => (
              <li key={i} className="space-y-1 text-sm">
                <p className="flex items-center gap-2">
                  {r.photo && (
                    // eslint-disable-next-line @next/next/no-img-element -- Google-hosted author photo
                    <img
                      src={r.photo}
                      alt=""
                      width={24}
                      height={24}
                      referrerPolicy="no-referrer"
                      className="size-6 rounded-full"
                    />
                  )}
                  {r.authorUri ? (
                    <a
                      href={r.authorUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {r.author}
                    </a>
                  ) : (
                    <span className="font-medium">{r.author}</span>
                  )}
                  <span className="text-[#5E5E5E]">
                    {r.rating !== null && `${"★".repeat(r.rating)} · `}
                    {r.when}
                  </span>
                </p>
                {r.text && <p>{r.text}</p>}
                <p className="text-xs text-[#5E5E5E]">
                  {r.translated && `${t("googleTranslated")} · `}
                  {r.uri && (
                    <a
                      href={r.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      {t("googleOriginal")}
                    </a>
                  )}
                </p>
              </li>
            ))}
          </ul>
          {data.mapsUri && (
            <a
              href={data.mapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-link underline underline-offset-4"
            >
              {t("googleAll")}
            </a>
          )}
          <p className="text-xs text-[#5E5E5E]">{t("googleNotVerified")}</p>
        </>
      )}
    </div>
  );
}
