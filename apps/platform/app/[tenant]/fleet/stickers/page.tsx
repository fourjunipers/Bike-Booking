import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { MakeModelPicker } from "@/components/fleet/make-model-picker";
import { Field, inputClass } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import { hasLeftFleet } from "@/lib/fleet";
import { getFleet } from "@/lib/fleet-data";
import { shopModelOptions } from "@/lib/model-options";
import { qrSvg, siteOrigin, stickerUrl } from "@/lib/qr";
import { StickerPicker } from "./sticker-picker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fleet.sticker");
  return { title: t("sheetTitle") };
}

/**
 * Print QR stickers (SPEC › Fleet; owner 11 Nov 2026): a list of bikes with a
 * checkbox each, select-all for what the filter shows, filters for make and
 * model, newest bikes first. Printing shows only the ticked stickers. Opened
 * from a bike's page (?unit=) that bike is already ticked.
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
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const only = text(query.unit);
  const make = text(query.make);
  const model = text(query.model);
  const sort = text(query.sort) === "plate" ? "plate" : "recent";

  const units = fleet
    .flatMap((m) =>
      m.units.map((unit) => ({
        ...unit,
        modelName: m.name,
        make: m.catalog?.make ?? "",
      })),
    )
    .filter(
      (unit) =>
        // A bike opened by its own link is listed even when sold or retired.
        (unit.id === only || !hasLeftFleet(unit.status)) &&
        (!make || unit.make === make) &&
        (!model || unit.model_id === model),
    )
    .sort((a, b) =>
      sort === "plate"
        ? (a.plate ?? "￿").localeCompare(b.plate ?? "￿", undefined, {
            numeric: true,
          })
        : b.created_at.localeCompare(a.created_at) ||
          (a.plate ?? "").localeCompare(b.plate ?? ""),
    );
  const items = await Promise.all(
    units.map(async (unit) => ({
      id: unit.id,
      plate: unit.plate ?? tFleet("platePending"),
      detail: [unit.modelName, unit.model_year].filter(Boolean).join(" · "),
      svg: await qrSvg(stickerUrl(origin, unit.qr_token)),
    })),
  );
  const base = `/${slug}/fleet`;

  return (
    <>
      <div className="print:hidden">
        <BackLink
          href={only ? `${base}/units/${only}` : base}
          label={tFleet("title")}
        />
        <PageHeader title={t("sheetTitle")} intro={t("sheetIntro")} />
        <form
          action={`${base}/stickers`}
          className="mb-4 grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4"
        >
          <MakeModelPicker
            makeName="make"
            modelName="model"
            makeLabel={tFleet("unit.make")}
            modelLabel={tFleet("unit.model")}
            anyLabel={tFleet("view.any")}
            models={shopModelOptions(fleet)}
            defaultMake={make}
            defaultModel={model}
          />
          <Field id="sort" label={tFleet("view.sortBy")}>
            <select
              id="sort"
              name="sort"
              defaultValue={sort}
              className={inputClass}
            >
              <option value="recent">{t("sortRecent")}</option>
              <option value="plate">{tFleet("view.sort.plate")}</option>
            </select>
          </Field>
          <div className="flex items-end gap-3">
            <Button type="submit" variant="outline" className="h-11 px-5">
              {tFleet("view.apply")}
            </Button>
            <Link
              href={`${base}/stickers`}
              className="inline-flex min-h-11 items-center text-sm font-medium underline"
            >
              {tFleet("view.reset")}
            </Link>
          </div>
        </form>
      </div>
      <StickerPicker
        // A new list (other filter or order) starts from its own selection.
        key={`${make}|${model}|${sort}|${only}`}
        items={items}
        preselected={only ? [only] : []}
      />
    </>
  );
}
