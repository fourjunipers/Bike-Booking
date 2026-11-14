import { useId, type ReactNode } from "react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Panel } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page";
import {
  getGearUnits,
  getLocations,
  getMemberNames,
  getProductStock,
  getStockMovements,
} from "@/lib/fleet-data";
import {
  canEditProblem,
  canGear,
  problemKindsFor,
} from "@/lib/gear-permissions";
import {
  formatDay,
  gearState,
  hasStock,
  stockOf,
  unitNames,
  type GearState,
  type GeneralType,
} from "@/lib/general-products";
import { canManageFleet, type Role } from "@/lib/roles";
import { dateInZone, formatInstant } from "@/lib/shop-time";
import { cn } from "@/lib/utils";
import { DeleteProductButton } from "./delete-product";
import { ProblemActions, QuantityStepper, ReportProblem } from "./gear-stock";
import { GeneralForm, QuantityForm, UnitLabelForm } from "./general-forms";
import { HistoryTab } from "./history-tab";

const tabs = ["details", "stock", "history"] as const;
type Tab = (typeof tabs)[number];

type GeneralProduct = {
  id: string;
  name: string;
  type: string;
  tracking: string;
  description: string | null;
};

type Locations = Awaited<ReturnType<typeof getLocations>>;
type StockLines = Awaited<ReturnType<typeof getProductStock>>;

/**
 * A general product's page: Details, Stock and History.
 *
 * Rental gear (owner, 14 Nov 2026; docs/products-redesign.md §5.9):
 * - Details (everyone): per location, the counts as large tiles (In stock,
 *   Available now, In repair; Lost when above zero), "Change quantity",
 *   one "Report a problem" button and the "Out of service" list. Then, for
 *   owners and managers, the name and description and Delete.
 * - Stock (everyone): one row per unit with its name or label and a status
 *   chip. Counted gear gets a hint about tracking each unit on its own.
 * - History (owners and managers).
 * Who may do what is in lib/gear-permissions.
 *
 * Items for sale are as they were: Details (owners and managers), Stock
 * (everyone reads; the quantity and its ledger) and History. A service has
 * no stock. No Moto Mangos panel, no buffers, no deposit, no licence class.
 */
export async function GeneralProductPage({
  slug,
  tenant,
  role,
  product,
  asked,
  added,
}: {
  slug: string;
  tenant: { id: string; timezone: string };
  role: Role;
  product: GeneralProduct;
  /** The tab in the address. */
  asked: string;
  added: boolean;
}) {
  const manage = canManageFleet(role);
  const type = product.type as GeneralType;
  const stocked = hasStock(type);
  const allowed: Tab[] = manage
    ? tabs.filter((tab) => tab !== "stock" || stocked)
    : type === "gear"
      ? ["details", "stock"]
      : stocked
        ? ["stock"]
        : [];
  const tab: Tab | null = (allowed as string[]).includes(asked)
    ? (asked as Tab)
    : (allowed[0] ?? null);
  const [t, locale, locations, lines] = await Promise.all([
    getTranslations("Products"),
    getLocale(),
    getLocations(tenant.id),
    getProductStock(tenant.id),
  ]);
  const here = `/${slug}/products/${product.id}`;
  const total = stockOf(lines, product.id);
  const tracked = type === "gear" && product.tracking === "unit";

  return (
    <>
      <BackLink href={`/${slug}/products`} label={t("title")} />
      <PageHeader title={product.name} intro={t(`type.${type}`)} />
      {added && (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-950"
        >
          {t("addedGeneral")}
        </p>
      )}
      {allowed.length > 1 && (
        <nav
          aria-label={t("tabs.label")}
          className="mb-5 flex gap-1 overflow-x-auto border-b"
        >
          {allowed.map((name) => (
            <Link
              key={name}
              href={name === allowed[0] ? here : `${here}?tab=${name}`}
              aria-current={name === tab ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                name === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {t(`tabs.${name}`)}
              {name === "stock" && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                  {total.inStock}
                </span>
              )}
            </Link>
          ))}
        </nav>
      )}

      {/* A service, for someone who doesn't set the shop up: what it is. */}
      {tab === null && (
        <Panel className="max-w-3xl">
          <p className="text-sm">
            {product.description || t("stockTab.serviceNote")}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">{t("readOnly")}</p>
        </Panel>
      )}

      {tab === "details" && (
        <div className="max-w-3xl space-y-6">
          {type === "gear" && (
            <GearStock
              slug={slug}
              tenantId={tenant.id}
              role={role}
              product={product}
              tracked={tracked}
              locations={locations}
              lines={lines}
              locale={locale}
            />
          )}
          {manage && (
            <Card id="product-details" title={t("gearStock.detailsTitle")}>
              <GeneralForm
                slug={slug}
                locations={[]}
                values={{
                  id: product.id,
                  type,
                  name: product.name,
                  description: product.description ?? "",
                  track: tracked,
                }}
              />
            </Card>
          )}
          {manage && (
            <section
              aria-label={t("deleteTitle")}
              className="flex flex-wrap gap-3 border-t pt-6"
            >
              <DeleteProductButton
                slug={slug}
                id={product.id}
                general
                hasVehicles={total.inStock + total.lost > 0}
                label={t("delete")}
                confirm={t("deleteConfirm")}
                blocked={t("deleteBlocked")}
              />
            </section>
          )}
        </div>
      )}

      {tab === "stock" && type === "gear" && (
        <GearUnits
          slug={slug}
          tenantId={tenant.id}
          role={role}
          product={product}
          tracked={tracked}
          locations={locations}
        />
      )}

      {tab === "stock" && type === "sale_item" && (
        <SaleStock
          slug={slug}
          tenantId={tenant.id}
          role={role}
          product={product}
          locations={locations}
          lines={lines}
          locale={locale}
        />
      )}

      {tab === "history" && (
        <HistoryTab
          tenantId={tenant.id}
          productId={product.id}
          // Gear's stock events are the product's own ("marked 1 in
          // repair"). Tracked units add their labels' changes.
          units={[]}
          unitsAre="gear"
          trackedGear={tracked}
          timezone={tenant.timezone}
          locale={locale}
        />
      )}
    </>
  );
}

/**
 * One section of the page: a card with its title above a divider. One main
 * (filled) button at most goes inside.
 */
function Card({
  id,
  title,
  intro,
  children,
  ...rest
}: {
  id?: string;
  title: string;
  intro?: string;
  children: ReactNode;
  "data-card"?: string;
}) {
  const heading = useId();
  return (
    <section
      id={id}
      aria-labelledby={heading}
      className="scroll-mt-20 rounded-lg border bg-card"
      {...rest}
    >
      <div className="border-b px-4 py-3 sm:px-5">
        <h2 id={heading} className="text-base font-semibold">
          {title}
        </h2>
        {intro && (
          <p className="mt-0.5 text-sm text-muted-foreground">{intro}</p>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

const chip = "rounded-full px-2 py-0.5 text-xs font-medium";
const chipClass: Record<GearState, string> = {
  inUse:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  repair: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  lost: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

/** Today at a location, as a date field takes it: "2026-11-14". */
function todayAt(timeZone: string): string {
  const { year, month, day } = dateInZone(new Date(), timeZone);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${year}-${two(month)}-${two(day)}`;
}

/** A location's name above its cards, when the shop has more than one. */
function LocationGroup({
  name,
  show,
  children,
}: {
  name: string;
  show: boolean;
  children: ReactNode;
}) {
  // One location: its cards stand on their own, with no group around them.
  if (!show) return <div className="space-y-6">{children}</div>;
  return (
    <section aria-label={name} data-location className="space-y-4">
      <p className="text-lg font-semibold">{name}</p>
      {children}
    </section>
  );
}

/**
 * Rental gear's stock on the Details tab, per location: the tiles, "Change
 * quantity", "Report a problem" and "Out of service".
 */
async function GearStock({
  slug,
  tenantId,
  role,
  product,
  tracked,
  locations,
  lines,
  locale,
}: {
  slug: string;
  tenantId: string;
  role: Role;
  product: GeneralProduct;
  tracked: boolean;
  locations: Locations;
  lines: StockLines;
  locale: string;
}) {
  const [t, tUnit, units] = await Promise.all([
    getTranslations("Products.gearStock"),
    getTranslations("Products.stockTab"),
    getGearUnits(tenantId, product.id),
  ]);
  const kinds = problemKindsFor(role);
  const can = {
    backInUse: canGear(role, "back_in_use"),
    found: canGear(role, "found"),
    writeOff: canGear(role, "write_off"),
  };

  return locations.map((location) => {
    const stock = stockOf(lines, product.id, location.id);
    const target = { slug, id: product.id, location: location.id };
    const here = units.filter((unit) => unit.location_id === location.id);
    const names = unitNames(here, (number) => tUnit("unit", { number }));
    const today = todayAt(location.timezone);
    // In repair first, then lost; the longest out at the top of each.
    const out = here
      .map((unit) => ({ unit, state: gearState(unit) }))
      .filter(
        (row): row is typeof row & { state: "repair" | "lost" } =>
          row.state !== "inUse",
      )
      .sort(
        (a, b) =>
          Number(a.state === "lost") - Number(b.state === "lost") ||
          (a.unit.problem_on ?? "").localeCompare(b.unit.problem_on ?? ""),
      );
    // In use and held by nothing right now. (A unit booked for later is
    // refused by the database, with a message.)
    const free = here.filter((unit) => unit.status === "active" && !unit.held);
    const tiles: {
      key: "inStock" | "available" | "inRepair" | "lost";
      count: number;
    }[] = [
      { key: "inStock", count: stock.inStock },
      { key: "available", count: stock.available },
      { key: "inRepair", count: stock.inRepair },
      // Lost shows only while something is lost.
      ...(stock.lost > 0 ? [{ key: "lost" as const, count: stock.lost }] : []),
    ];

    return (
      <LocationGroup
        key={location.id}
        name={location.name}
        show={locations.length > 1}
      >
        <Card data-card="summary" title={t("summary")} intro={t("summaryHelp")}>
          <dl
            data-stock-line
            className={cn(
              "grid gap-2 sm:gap-3",
              tiles.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
            )}
          >
            {tiles.map((tile) => (
              <div
                key={tile.key}
                data-tile={tile.key}
                className="flex flex-col justify-between rounded-lg border bg-background p-3"
              >
                <dt className="text-xs font-medium text-muted-foreground sm:text-sm">
                  {t(`tile.${tile.key}`)}
                </dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">
                  {tile.count}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        {canGear(role, "set_quantity") && (
          <Card data-card="quantity" title={t("quantityTitle")}>
            <QuantityStepper
              // A saved quantity redraws the field with it.
              key={stock.inStock}
              target={target}
              current={stock.inStock}
            />
          </Card>
        )}

        {kinds.length > 0 && (
          <Card
            data-card="report"
            title={t("reportTitle")}
            intro={t("reportIntro")}
          >
            <ReportProblem
              target={target}
              kinds={kinds}
              units={
                tracked
                  ? free.map((unit) => ({
                      id: unit.id,
                      name: names.get(unit.id) ?? "",
                    }))
                  : undefined
              }
              free={tracked ? free.length : stock.available}
              today={today}
            />
          </Card>
        )}

        <Card data-card="out" title={t("outTitle")} intro={t("outIntro")}>
          {out.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("outNone")}</p>
          ) : (
            <ul className="-my-4 divide-y">
              {out.map(({ unit, state }) => {
                const name = tracked ? names.get(unit.id) : undefined;
                return (
                  <li
                    key={unit.id}
                    data-out-unit={state}
                    className="space-y-3 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {name && <span className="font-medium">{name}</span>}
                      <span className={cn(chip, chipClass[state])}>
                        {tUnit(`status.${state}`)}
                      </span>
                    </div>
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          {t("line.happenedOn")}
                        </dt>
                        <dd>
                          {unit.problem_on
                            ? formatDay(unit.problem_on, locale)
                            : t("line.notSet")}
                        </dd>
                      </div>
                      {state === "repair" && (
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            {t("line.expectedBack")}
                          </dt>
                          <dd>
                            {unit.expected_back
                              ? formatDay(unit.expected_back, locale)
                              : t("line.notSet")}
                          </dd>
                        </div>
                      )}
                      {unit.problem_notes && (
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-muted-foreground">
                            {t("line.notes")}
                          </dt>
                          <dd className="whitespace-pre-line">
                            {unit.problem_notes}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <ProblemActions
                      slug={slug}
                      unit={unit.id}
                      state={state}
                      name={name}
                      can={{ ...can, edit: canEditProblem(role, state) }}
                      values={{
                        happenedOn: unit.problem_on ?? "",
                        expectedBack: unit.expected_back ?? "",
                        notes: unit.problem_notes ?? "",
                      }}
                      today={today}
                    />
                    {state === "lost" && !can.found && (
                      <p className="text-sm text-muted-foreground">
                        {t("lostWaiting")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </LocationGroup>
    );
  });
}

/**
 * Rental gear's Stock tab: one row per unit with its name or label and a
 * status chip. Owners and managers label the units of tracked gear here.
 * Everything that changes a unit's state is on the Details tab.
 */
async function GearUnits({
  slug,
  tenantId,
  role,
  product,
  tracked,
  locations,
}: {
  slug: string;
  tenantId: string;
  role: Role;
  product: GeneralProduct;
  tracked: boolean;
  locations: Locations;
}) {
  const manage = canManageFleet(role);
  const [t, units] = await Promise.all([
    getTranslations("Products.stockTab"),
    getGearUnits(tenantId, product.id),
  ]);
  return (
    <div className="max-w-3xl space-y-6">
      {!tracked && (
        <p
          data-untracked-hint
          className="rounded-lg border border-highlight-border bg-highlight p-3 text-sm text-highlight-foreground"
        >
          {t(manage ? "untrackedHint" : "untrackedHintStaff")}
        </p>
      )}
      {locations.map((location) => {
        const here = units.filter((unit) => unit.location_id === location.id);
        const names = unitNames(here, (number) => t("unit", { number }));
        return (
          <Card
            key={location.id}
            data-card={`units-${location.id}`}
            title={
              locations.length > 1
                ? t("unitsAt", { location: location.name, count: here.length })
                : t("units", { count: here.length })
            }
          >
            {here.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noUnits")}</p>
            ) : (
              <ul className="-my-4 divide-y">
                {here.map((unit) => {
                  const state = gearState(unit);
                  return (
                    <li key={unit.id} data-gear-unit className="space-y-3 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {names.get(unit.id)}
                        </span>
                        <span className={cn(chip, chipClass[state])}>
                          {t(`status.${state}`)}
                        </span>
                      </div>
                      {tracked && manage && (
                        <UnitLabelForm
                          slug={slug}
                          unit={unit.id}
                          label={unit.label ?? ""}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/** An item for sale's Stock tab, as it was: what is on hand, and its ledger. */
async function SaleStock({
  slug,
  tenantId,
  role,
  product,
  locations,
  lines,
  locale,
}: {
  slug: string;
  tenantId: string;
  role: Role;
  product: GeneralProduct;
  locations: Locations;
  lines: StockLines;
  locale: string;
}) {
  const manage = canManageFleet(role);
  const [t, movements, names] = await Promise.all([
    getTranslations("Products.stockTab"),
    getStockMovements(tenantId, product.id, 20),
    manage ? getMemberNames(tenantId) : new Map<string, string>(),
  ]);
  const locationNames = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div className="max-w-3xl space-y-6">
      {locations.map((location) => {
        const stock = stockOf(lines, product.id, location.id);
        return (
          <section
            key={location.id}
            aria-labelledby={`stock-${location.id}`}
            className="rounded-lg border bg-card p-4 sm:p-5"
          >
            <h2 id={`stock-${location.id}`} className="text-lg font-semibold">
              {location.name}
            </h2>
            <p className="mt-1 text-sm" data-stock-line>
              {t("onHand", { count: stock.inStock })}
            </p>
            {manage && (
              <div className="mt-4">
                <QuantityForm
                  target={{ slug, id: product.id, location: location.id }}
                  current={stock.inStock}
                />
              </div>
            )}
          </section>
        );
      })}

      <Panel title={t("ledger")} intro={t("ledgerIntro")}>
        {movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("ledgerNone")}</p>
        ) : (
          <ol className="divide-y rounded-md border text-sm">
            {movements.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-3"
              >
                <span className="font-medium tabular-nums">
                  {t(`kind.${row.kind}` as "kind.received")}{" "}
                  {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[
                    locations.length > 1
                      ? locationNames.get(row.location_id)
                      : null,
                    row.created_by ? names.get(row.created_by) : null,
                    formatInstant(
                      new Date(row.created_at),
                      locations.find((l) => l.id === row.location_id)
                        ?.timezone ?? "UTC",
                      locale,
                    ),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
