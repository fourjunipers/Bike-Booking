import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import { PrintButton } from "@/components/print-button";
import { requireArea } from "@/lib/access";
import { hasLeftFleet } from "@/lib/fleet";
import { getFleet } from "@/lib/fleet-data";
import { qrSvg, siteOrigin, stickerUrl } from "@/lib/qr";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.sticker");
  return { title: t("sheetTitle") };
}

/**
 * QR stickers to print (SPEC › Fleet): every bike in the fleet, or one with
 * ?unit=. When printed, only the stickers show: the shell hides itself
 * (print styles in globals.css).
 */
export default async function StickersPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/fleet/stickers">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { membership } = await requireArea(slug, "fleet");
  const [t, tFleet, fleet, origin] = await Promise.all([
    getTranslations("Fleet.sticker"),
    getTranslations("Fleet"),
    getFleet(membership.tenant.id),
    siteOrigin(),
  ]);
  const only = typeof query.unit === "string" ? query.unit : "";
  const units = fleet
    .flatMap((model) =>
      model.units.map((unit) => ({ ...unit, modelName: model.name })),
    )
    .filter((unit) => (only ? unit.id === only : !hasLeftFleet(unit.status)));
  const stickers = await Promise.all(
    units.map(async (unit) => ({
      unit,
      svg: await qrSvg(stickerUrl(origin, unit.qr_token)),
    })),
  );

  return (
    <>
      <div className="print:hidden">
        <BackLink
          href={only ? `/${slug}/fleet/units/${only}` : `/${slug}/fleet`}
          label={tFleet("title")}
        />
        <PageHeader
          title={t("sheetTitle")}
          intro={t("sheetIntro", { count: stickers.length })}
          actions={<PrintButton label={t("printAll")} />}
        />
      </div>
      <ul className="sticker-sheet grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stickers.map(({ unit, svg }) => (
          <li
            key={unit.id}
            className="break-inside-avoid rounded-md border bg-white p-3 text-center text-black"
          >
            <div
              role="img"
              aria-label={unit.plate ?? unit.modelName}
              className="mx-auto w-full max-w-40"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="mt-1 truncate text-base font-semibold">
              {unit.plate ?? tFleet("platePending")}
            </p>
            <p className="truncate text-xs">{unit.modelName}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
