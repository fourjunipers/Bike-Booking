import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Printer, TriangleAlert } from "lucide-react";
import { ActionForm, Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { StatusBadge } from "@/components/fleet/unit-bits";
import { PageHeader } from "@/components/page";
import { ScrollTo } from "@/components/scroll-to";
import { buttonVariants } from "@/components/ui/button";
import { requireArea } from "@/lib/access";
import { formatDistance, fromKm } from "@/lib/distance";
import { hasLeftFleet, type RenewalKind } from "@/lib/fleet";
import {
  getFleet,
  getLocations,
  getReminderSettings,
  getRenewalCosts,
  getUnit,
  getUnitBlocks,
  getUnitFinancials,
  getUnitRenewals,
} from "@/lib/fleet-data";
import { inventoryModelOptions } from "@/lib/model-options";
import { formatMoney, moneyInputValue } from "@/lib/money";
import { qrSvg, siteOrigin, stickerUrl } from "@/lib/qr";
import {
  currentRenewals,
  daysUntil,
  parseIsoDate,
  renewalState,
} from "@/lib/renewals";
import { canManageFleet, canWorkOnUnits } from "@/lib/roles";
import { dateInZone, formatInstant } from "@/lib/shop-time";
import { cn } from "@/lib/utils";
import { deleteUnit } from "../../actions";
import {
  DeleteRenewalButton,
  DowntimeForm,
  EndDowntimeButton,
  FinancialsForm,
  OdometerForm,
  RenewalForm,
  SetStatusButton,
  StatusForm,
  UnitForm,
} from "../../unit-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("fleet") };
}

/**
 * One bike (SPEC › Fleet). Everyone in the shop sees its details, blocks and
 * tax and insurance dates. Staff and mechanics update the odometer, switch
 * active/maintenance, add downtime and record renewals. Owners and managers
 * edit everything; purchase and sale sit in one section at the bottom.
 */
export default async function UnitPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/fleet/units/[id]">) {
  const [{ tenant: slug, id }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const { membership } = await requireArea(slug, "fleet");
  const { tenant, role } = membership;
  const manage = canManageFleet(role);
  const work = canWorkOnUnits(role);

  const [
    t,
    tUnit,
    locale,
    unit,
    fleet,
    locations,
    blocks,
    renewals,
    reminders,
    money,
    origin,
  ] = await Promise.all([
    getTranslations("Fleet"),
    getTranslations("Fleet.unit"),
    getLocale(),
    getUnit(tenant.id, id),
    getFleet(tenant.id),
    getLocations(tenant.id),
    getUnitBlocks(tenant.id, id),
    getUnitRenewals(tenant.id, id),
    getReminderSettings(tenant.id),
    manage ? getUnitFinancials(tenant.id, id) : null,
    siteOrigin(),
  ]);
  if (!unit) notFound();
  const model = fleet.find((m) => m.id === unit.model_id);
  const location = locations.find((l) => l.id === unit.location_id);
  const zone = location?.timezone ?? tenant.timezone;
  const [svg, costs] = await Promise.all([
    qrSvg(stickerUrl(origin, unit.qr_token)),
    manage
      ? getRenewalCosts(
          tenant.id,
          renewals.map((r) => r.id),
        )
      : new Map<string, number>(),
  ]);
  const base = `/${slug}/fleet`;
  const now = new Date();
  const today = dateInZone(now, zone);
  const gone = hasLeftFleet(unit.status);
  const current = blocks.filter((b) => !b.to || b.to > now);
  const past = blocks.filter((b) => b.to && b.to <= now).slice(0, 5);
  const text = (value: string | null) => value ?? "";
  const amount = (value: number | null | undefined) =>
    value === null || value === undefined
      ? ""
      : moneyInputValue(value, tenant.currency);
  const longDate = (iso: string) => {
    const d = parseIsoDate(iso);
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      dateStyle: "medium",
    }).format(new Date(Date.UTC(d.year, d.month - 1, d.day)));
  };

  const facts: [string, string | null][] = [
    [tUnit("make"), model?.catalog?.make ?? null],
    [tUnit("model"), model?.name ?? null],
    [tUnit("modelYear"), unit.model_year ? String(unit.model_year) : null],
    [tUnit("colour"), unit.colour],
    [tUnit("frameNumber"), unit.frame_number],
    [tUnit("engineNumber"), unit.engine_number],
    [tUnit("location"), location?.name ?? null],
    [tUnit("notes"), unit.notes],
  ];

  // The two dates everyone needs: road tax and insurance, from the latest record of each.
  const latest = currentRenewals(renewals).get(unit.id) ?? {};
  const headline: RenewalKind[] = ["road_tax", "compulsory_insurance"];
  if (latest.voluntary_insurance) headline.push("voluntary_insurance");
  if (latest.inspection) headline.push("inspection");

  return (
    <>
      {query.sold === "1" && <ScrollTo id="purchase-sale" />}
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
            {unit.model_year && <span>· {unit.model_year}</span>}
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
          {tUnit("platePendingWarning")}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          {manage ? (
            <Panel title={tUnit("details")}>
              <UnitForm
                slug={slug}
                distanceUnit={tenant.distanceUnit}
                addModelHref={`${base}/models/new`}
                models={inventoryModelOptions(fleet)}
                locations={locations.map((l) => ({
                  value: l.id,
                  label: l.name,
                }))}
                values={{
                  id: unit.id,
                  updated_at: unit.updated_at,
                  model_choice: `model:${unit.model_id}`,
                  location_id: unit.location_id,
                  plate: text(unit.plate),
                  plate_pending: unit.plate_pending,
                  frame_number: text(unit.frame_number),
                  engine_number: text(unit.engine_number),
                  colour: text(unit.colour),
                  model_year: unit.model_year ? String(unit.model_year) : "",
                  odometer: String(
                    fromKm(unit.current_odometer_km, tenant.distanceUnit),
                  ),
                  notes: text(unit.notes),
                }}
              />
            </Panel>
          ) : (
            <Panel
              title={tUnit("details")}
              intro={work ? undefined : tUnit("readOnly")}
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

          <Panel title={tUnit("status")} intro={tUnit("statusIntro")}>
            {work ? (
              <>
                <StatusForm
                  slug={slug}
                  id={unit.id}
                  status={unit.status}
                  canRetireOrSell={manage}
                />
                {manage && unit.status === "retired" && (
                  <div className="mt-5 border-t pt-5">
                    <p className="mb-3 text-sm text-muted-foreground">
                      {tUnit("restoreHelp")}
                    </p>
                    <SetStatusButton
                      slug={slug}
                      id={unit.id}
                      was={unit.status}
                      status="active"
                      label={tUnit("restore")}
                    />
                  </div>
                )}
              </>
            ) : (
              <p>
                <StatusBadge status={unit.status} />{" "}
                <span className="text-sm text-muted-foreground">
                  {t(`statusHelp.${unit.status}` as "statusHelp.active")}
                </span>
              </p>
            )}
          </Panel>

          {/* Owners and managers have the odometer in Details, above. */}
          {!manage && (
            <Panel title={tUnit("odometerNow")}>
              {work && !gone ? (
                <OdometerForm
                  slug={slug}
                  id={unit.id}
                  distanceUnit={tenant.distanceUnit}
                  odometer={String(
                    fromKm(unit.current_odometer_km, tenant.distanceUnit),
                  )}
                />
              ) : (
                <p className="font-medium">
                  {formatDistance(
                    unit.current_odometer_km,
                    tenant.distanceUnit,
                    locale,
                  )}
                </p>
              )}
            </Panel>
          )}

          <Panel
            title={t("downtime.title")}
            intro={t("downtime.intro", { zone: zone.replaceAll("_", " ") })}
          >
            {query.downtime === "gone" && (
              <p
                role="status"
                className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
              >
                {t("downtime.alreadyEnded")}
              </p>
            )}
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
                        unit={unit.id}
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
                <DowntimeForm slug={slug} id={unit.id} />
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

          <Panel title={t("renewals.title")} intro={t("renewals.intro")}>
            <dl className="grid gap-3 sm:grid-cols-2">
              {headline.map((kind) => {
                const record = latest[kind];
                const state = record
                  ? renewalState(
                      record.expires_at,
                      today,
                      reminders.renewal_reminder_days,
                    )
                  : "none";
                const days = record ? daysUntil(record.expires_at, today) : 0;
                return (
                  <div
                    key={kind}
                    className={cn(
                      "rounded-md border p-3",
                      state === "expired" &&
                        "border-destructive/40 bg-destructive/5",
                      state === "due" &&
                        "border-highlight-border bg-highlight text-highlight-foreground",
                    )}
                  >
                    <dt className="text-sm font-medium">
                      {t(`renewals.expires.${kind}`)}
                    </dt>
                    <dd className="mt-1 text-lg font-semibold">
                      {record
                        ? longDate(record.expires_at)
                        : t("renewals.none")}
                    </dd>
                    {record && state !== "ok" && (
                      <dd className="text-sm">
                        {state === "expired"
                          ? t("renewals.expiredAgo", { days: -days })
                          : t("renewals.dueIn", { days })}
                      </dd>
                    )}
                  </div>
                );
              })}
            </dl>

            {renewals.length > 0 && (
              <details className="mt-5">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
                  {t("renewals.history", { count: renewals.length })}
                </summary>
                <ul className="divide-y rounded-md border">
                  {renewals.map((record) => {
                    const cost = costs.get(record.id);
                    return (
                      <li
                        key={record.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3"
                      >
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">
                            {t(`renewals.kind.${record.kind}`)}
                            {" · "}
                            {record.starts_at
                              ? `${longDate(record.starts_at)} – ${longDate(record.expires_at)}`
                              : longDate(record.expires_at)}
                          </p>
                          <p className="text-muted-foreground">
                            {[
                              record.provider,
                              record.reference_no,
                              cost === undefined
                                ? null
                                : formatMoney(cost, tenant.currency, locale),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        {manage && (
                          <DeleteRenewalButton
                            slug={slug}
                            renewal={record.id}
                            label={t("renewals.delete")}
                            confirm={t("renewals.deleteConfirm")}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
            {work && !gone && (
              <div className="mt-5 border-t pt-5">
                <h3 className="mb-3 font-medium">{t("renewals.addTitle")}</h3>
                <RenewalForm
                  slug={slug}
                  id={unit.id}
                  currency={tenant.currency}
                  showCost={manage}
                />
              </div>
            )}
          </Panel>

          {manage && (
            <Panel
              id="purchase-sale"
              title={t("money.title")}
              intro={
                query.sold === "1" ? t("money.afterSold") : t("money.intro")
              }
              className={cn(
                query.sold === "1" &&
                  "border-highlight-border ring-2 ring-ring",
              )}
            >
              {unit.status !== "sold" &&
                (money?.sold_at || money?.sale_price != null) && (
                  <p
                    role="note"
                    className="mb-4 rounded-md border border-highlight-border bg-highlight p-3 text-sm text-highlight-foreground"
                  >
                    {t("money.notSoldNote")}
                  </p>
                )}
              <FinancialsForm
                slug={slug}
                id={unit.id}
                currency={tenant.currency}
                values={{
                  purchase_date: text(money?.purchase_date ?? null),
                  purchase_price: amount(money?.purchase_price),
                  purchased_from: text(money?.purchased_from ?? null),
                  sold_at: text(money?.sold_at ?? null),
                  sale_price: amount(money?.sale_price),
                  sold_to: text(money?.sold_to ?? null),
                }}
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
        </div>
      </div>
      {/* The very last thing on the page, under the purchase and sale
          details (owner, 12 Nov 2026). "Retire instead" appears to the
          right of Delete when the delete is refused. */}
      {manage && (
        <section
          aria-label={tUnit("delete")}
          className="mt-6 flex flex-wrap items-start gap-3 border-t pt-6"
        >
          <ActionForm
            action={deleteUnit}
            hidden={{ slug, id: unit.id }}
            submitLabel={tUnit("delete")}
            confirm={tUnit("deleteConfirm")}
            destructive="solid"
            // Refused because bookings point at it: offer to retire it,
            // unless it is out of the fleet already.
            offers={
              unit.status === "active" || unit.status === "maintenance"
                ? {
                    retire: (
                      <SetStatusButton
                        slug={slug}
                        id={unit.id}
                        was={unit.status}
                        status="retired"
                        label={tUnit("retireInstead")}
                        confirm={tUnit("retireConfirm")}
                      />
                    ),
                  }
                : undefined
            }
          />
        </section>
      )}
    </>
  );
}
