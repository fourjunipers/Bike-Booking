import { getTranslations } from "next-intl/server";
import type { Inclusions } from "@/lib/inclusions";
import { formatBaht } from "@mango/core/money";

/**
 * "What's included", deposit and documents for customers, in their language.
 * `compact` drops the notes, for side-by-side comparison on the model page.
 */
export async function InclusionsList({
  locale,
  inc,
  deposit,
  compact = false,
}: {
  locale: string;
  inc: Inclusions;
  deposit: number | null;
  compact?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "BikeInfo" });
  const gear = (v: Inclusions["gloves"]) =>
    v === "not_offered" ? null : t(`gear.${v}`);
  const rows: [string, string | null][] = [
    [
      t("helmets"),
      inc.helmets === 0
        ? t("none")
        : [
            t("helmetCount", { n: inc.helmets }),
            ...inc.helmet_types.map((h) => t(`helmet.${h}`)),
          ].join(" · "),
    ],
    [t("gloves"), gear(inc.gloves)],
    [t("jacket"), gear(inc.jacket)],
    [t("rainGear"), gear(inc.rain_gear)],
    [
      t("setup"),
      [
        inc.phone_holder && t("phoneHolder"),
        inc.usb_charger && t("usbCharger"),
        inc.top_box && t("topBox"),
        inc.side_panniers && t("sidePanniers"),
      ]
        .filter(Boolean)
        .join(" · ") || null,
    ],
    [
      t("usage"),
      `${t(`usageArea.${inc.usage_area}`)} · ${
        inc.km_limit === 0
          ? t("unlimitedKm")
          : t("kmLimit", { km: inc.km_limit })
      }`,
    ],
    [
      t("insurance"),
      [t("thirdParty"), inc.medical_cover && t("medical")]
        .filter(Boolean)
        .join(" · "),
    ],
  ];
  const deposits: [string, string | null][] = [
    [
      t("deposit"),
      deposit === null ? t("noMoneyDeposit") : formatBaht(deposit),
    ],
    [
      t("depositMethods"),
      inc.deposit_methods.map((m) => t(`method.${m}`)).join(" · ") || null,
    ],
    [t("passport"), t(`passportPolicy.${inc.passport}`)],
    [t("licence"), t(`licenceType.${inc.licence_required}`)],
    [t("minAge"), inc.min_age ? t("years", { n: inc.min_age }) : null],
    [t("experience"), inc.experience_required ? t("required") : null],
  ];

  const list = (items: [string, string | null][]) => (
    <dl className="divide-y">
      {items
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 py-2 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
    </dl>
  );

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h3 className="font-semibold">{t("depositAndDocuments")}</h3>
        {list(deposits)}
      </section>
      <section className="space-y-1">
        <h3 className="font-semibold">{t("included")}</h3>
        {list(rows)}
      </section>
      {!compact && inc.notes && (
        <section className="space-y-1">
          <h3 className="font-semibold">{t("notes")}</h3>
          <p className="text-sm whitespace-pre-line">{inc.notes}</p>
        </section>
      )}
    </div>
  );
}
