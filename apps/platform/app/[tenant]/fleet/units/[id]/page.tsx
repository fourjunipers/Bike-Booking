import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Printer, TriangleAlert } from "lucide-react";
import { ActionForm, Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { StatusBadge } from "@/components/fleet/unit-bits";
import { PageHeader } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import { formatDistance, fromKm } from "@/lib/distance";
import { hasLeftFleet } from "@/lib/fleet";
import {
  getFleet,
  getLocations,
  getUnit,
  getUnitBlocks,
  getUnitFinancials,
} from "@/lib/fleet-data";
import { moneyInputValue } from "@/lib/money";
import { qrSvg, siteOrigin, stickerUrl } from "@/lib/qr";
import { canManageFleet, canWorkOnUnits } from "@/lib/roles";
import { formatInstant, toLocalInput } from "@/lib/shop-time";
import { cn } from "@/lib/utils";
import { deleteUnit } from "../../actions";
import {
  DowntimeForm,
  EndDowntimeButton,
  FinancialsForm,
  UnitForm,
  WorkForm,
} from "../../unit-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("fleet") };
}

/**
 * One bike (SPEC › Fleet). Everyone in the shop sees its details and blocks.
 * Staff and mechanics update the odometer, switch active/maintenance and add
 * downtime. Owners and managers edit everything and see purchase and sale.
 */
export default async function UnitPage({
  params,
}: PageProps<"/[tenant]/fleet/units/[id]">) {
  const { tenant: slug, id } = await params;
  const { membership } = await requireArea(slug, "fleet");
  const { tenant, role } = membership;
  const manage = canManageFleet(role);
  const work = canWorkOnUnits(role);

  const [t, tFleet, locale, unit, fleet, locations, blocks, money, origin] =
    await Promise.all([
      getTranslations("Fleet"),
      getTranslations("Fleet.unit"),
      getLocale(),
      getUnit(tenant.id, id),
      getFleet(tenant.id),
      getLocations(tenant.id),
      getUnitBlocks(tenant.id, id),
      manage ? getUnitFinancials(tenant.id, id) : null,
      siteOrigin(),
    ]);
  if (!unit) notFound();
  const model = fleet.find((m) => m.id === unit.model_id);
  const location = locations.find((l) => l.id === unit.location_id);
  const zone = location?.timezone ?? tenant.timezone;
  const svg = await qrSvg(stickerUrl(origin, unit.qr_token));
  const base = `/${slug}/fleet`;
  const now = new Date();
  const gone = hasLeftFleet(unit.status);
  const current = blocks.filter((b) => !b.to || b.to > now);
  const past = blocks.filter((b) => b.to && b.to <= now).slice(0, 5);
  const text = (value: string | null) => value ?? "";
  const amount = (value: number | null | undefined) =>
    value === null || value === undefined
      ? ""
      : moneyInputValue(value, tenant.currency);
  const moneyValues = {
    purchase_date: text(money?.purchase_date ?? null),
    purchase_price: amount(money?.purchase_price),
    purchased_from: text(money?.purchased_from ?? null),
    sold_at: text(money?.sold_at ?? null),
    sale_price: amount(money?.sale_price),
    sold_to: text(money?.sold_to ?? null),
  };
  const facts: [string, string | null][] = [
    [tFleet("model"), model?.name ?? null],
    [tFleet("location"), location?.name ?? null],
    [tFleet("colour"), unit.colour],
    [tFleet("frameNumber"), unit.frame_number],
    [tFleet("engineNumber"), unit.engine_number],
    [tFleet("firstRegistered"), unit.first_registered],
    [
      tFleet("odometerNow"),
      formatDistance(unit.current_odometer_km, tenant.distanceUnit, locale),
    ],
    [tFleet("notes"), unit.notes],
  ];

  return (
    <>
      <BackLink href={base} label={t("title")} />
      <PageHeader
        title={unit.plate ?? t("noPlate")}
        intro={
          <span className="flex flex-wrap items-center gap-2">
            {model && (
              <Link
                href={`${base}/models/${model.id}`}
                className="hover:underline"
              >
                {model.name}
              </Link>
            )}
            <StatusBadge status={unit.status} />
          </span>
        }
      />
      {unit.plate_pending && (
        <p
          role="note"
          className="mb-6 flex items-start gap-2 rounded-lg border border-highlight-border bg-highlight p-3 text-sm text-highlight-foreground"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {tFleet("platePendingWarning")}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          {manage ? (
            <Panel title={tFleet("details")}>
              <UnitForm
                slug={slug}
                distanceUnit={tenant.distanceUnit}
                models={fleet.map((m) => ({ value: m.id, label: m.name }))}
                locations={locations.map((l) => ({
                  value: l.id,
                  label: l.name,
                }))}
                values={{
                  id: unit.id,
                  model_id: unit.model_id,
                  location_id: unit.location_id,
                  plate: text(unit.plate),
                  plate_pending: unit.plate_pending,
                  frame_number: text(unit.frame_number),
                  engine_number: text(unit.engine_number),
                  colour: text(unit.colour),
                  first_registered: text(unit.first_registered),
                  status: unit.status,
                  active_from: text(unit.active_from),
                  active_to: text(unit.active_to),
                  notes: text(unit.notes),
                }}
              />
            </Panel>
          ) : (
            <Panel
              title={tFleet("details")}
              intro={work ? undefined : tFleet("readOnly")}
            >
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {facts
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-medium break-words">{value}</dd>
                    </div>
                  ))}
              </dl>
            </Panel>
          )}

          {work && !gone && (
            <Panel title={tFleet("work")}>
              <WorkForm
                slug={slug}
                id={unit.id}
                status={unit.status}
                distanceUnit={tenant.distanceUnit}
                odometer={String(
                  fromKm(unit.current_odometer_km, tenant.distanceUnit),
                )}
              />
            </Panel>
          )}

          <Panel
            title={t("downtime.title")}
            intro={t("downtime.intro", { zone: zone.replaceAll("_", " ") })}
          >
            {current.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("downtime.none")}
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {current.map((block) => (
                  <li
                    key={block.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {t(
                          `downtime.kind.${block.kind}` as "downtime.kind.downtime",
                        )}
                        {block.note ? `: ${block.note}` : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("downtime.range", {
                          from: formatInstant(block.from, zone, locale),
                          to: block.to
                            ? formatInstant(block.to, zone, locale)
                            : t("downtime.openEnded"),
                        })}
                      </p>
                    </div>
                    {work && block.kind === "downtime" && (
                      <EndDowntimeButton
                        slug={slug}
                        block={block.id}
                        label={
                          block.from > now
                            ? t("downtime.remove")
                            : t("downtime.end")
                        }
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {work && !gone && (
              <div className="mt-5 border-t pt-5">
                <DowntimeForm
                  slug={slug}
                  id={unit.id}
                  now={toLocalInput(now, zone)}
                />
              </div>
            )}
            {past.length > 0 && (
              <details className="mt-5 text-sm">
                <summary className="min-h-11 cursor-pointer py-2 font-medium">
                  {t("downtime.past")}
                </summary>
                <ul className="space-y-1 text-muted-foreground">
                  {past.map((block) => (
                    <li key={block.id}>
                      {t("downtime.range", {
                        from: formatInstant(block.from, zone, locale),
                        to: formatInstant(block.to!, zone, locale),
                      })}
                      {block.note ? ` · ${block.note}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Panel>

          {manage && (
            <Panel title={t("money.title")} intro={t("money.intro")}>
              <FinancialsForm
                slug={slug}
                id={unit.id}
                currency={tenant.currency}
                values={moneyValues}
              />
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title={t("sticker.title")} intro={t("sticker.help")}>
            {/* The code is a link: the same address a phone camera opens. */}
            <a
              href={stickerUrl(origin, unit.qr_token)}
              aria-label={t("sticker.title")}
              className="mx-auto block w-44 rounded-md border bg-white p-2"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <Link
              href={`${base}/stickers?unit=${unit.id}`}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-4 h-11 w-full",
              )}
            >
              <Printer aria-hidden />
              {t("sticker.print")}
            </Link>
          </Panel>

          {manage && !gone && (
            <Panel title={t("money.sellTitle")} intro={t("money.sellHelp")}>
              <FinancialsForm
                slug={slug}
                id={unit.id}
                currency={tenant.currency}
                values={moneyValues}
                sell
              />
            </Panel>
          )}
          {manage && (
            <ActionForm
              action={deleteUnit}
              hidden={{ slug, id: unit.id }}
              submitLabel={tFleet("delete")}
              confirm={tFleet("deleteConfirm")}
              destructive
            />
          )}
        </div>
      </div>
    </>
  );
}
