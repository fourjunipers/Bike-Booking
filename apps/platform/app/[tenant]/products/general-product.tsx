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
import { hasStock, stockOf, type GeneralType } from "@/lib/general-products";
import {
  canManageFleet,
  canMarkLost,
  canWorkOnUnits,
  type Role,
} from "@/lib/roles";
import { formatInstant } from "@/lib/shop-time";
import { cn } from "@/lib/utils";
import { DeleteProductButton } from "./delete-product";
import {
  DamagedForm,
  GeneralForm,
  LostForm,
  QuantityForm,
  RepairedForm,
  ResolveLostForms,
  UnitButton,
  UnitLabelForm,
} from "./general-forms";
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

/**
 * A general product's page (owner, 13 Nov 2026): Details, Stock and History.
 * - Details (owners and managers): name and description; for gear, whether
 *   each unit is tracked on its own; delete at the very bottom.
 * - Stock (gear and items for sale; everyone reads): the quantity per
 *   location, then a unit's three states, each under a heading with a line
 *   saying what it means: In use ("Mark damaged", "Mark lost"), Damaged
 *   ("Back in use") and Lost ("Found, back in use", "Write off"). "Change
 *   quantity" is for owners and managers; "Mark damaged" and "Back in use"
 *   for everyone who works on units; "Mark lost" for owners, managers and
 *   staff; only an owner or manager marks a lost unit found or writes it off.
 * - History (owners and managers).
 * No Moto Mangos panel, no buffers, no deposit, no licence class.
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
        <div className="space-y-6">
          <Panel id="product-details" className="max-w-3xl">
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
          </Panel>
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
        </div>
      )}

      {tab === "stock" && (
        <StockTab
          slug={slug}
          tenantId={tenant.id}
          role={role}
          product={product}
          type={type as "gear" | "sale_item"}
          tracked={tracked}
          locations={locations}
          lines={lines}
          locale={locale}
        />
      )}

      {tab === "history" && (
        <HistoryTab
          tenantId={tenant.id}
          productId={product.id}
          // Counted gear is nameless rows: the product's own events tell the
          // story ("quantity 20 → 25", "wrote off 1"). Tracked units add
          // theirs, one line per unit.
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

const chip = "rounded-full px-2 py-0.5 text-xs font-medium";
/** The three states of a unit of gear, in the order the Stock tab shows them. */
const stateNames = ["inUse", "damaged", "lost"] as const;
const chipClass = {
  inUse:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  damaged: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  lost: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

/** The quantity per location, with what each role may do to it. */
async function StockTab({
  slug,
  tenantId,
  role,
  product,
  type,
  tracked,
  locations,
  lines,
  locale,
}: {
  slug: string;
  tenantId: string;
  role: Role;
  product: GeneralProduct;
  type: "gear" | "sale_item";
  tracked: boolean;
  locations: Awaited<ReturnType<typeof getLocations>>;
  lines: Awaited<ReturnType<typeof getProductStock>>;
  locale: string;
}) {
  const manage = canManageFleet(role);
  const work = canWorkOnUnits(role);
  const lose = canMarkLost(role);
  const [t, units, movements, names] = await Promise.all([
    getTranslations("Products.stockTab"),
    tracked ? getGearUnits(tenantId, product.id) : [],
    type === "sale_item" ? getStockMovements(tenantId, product.id, 20) : [],
    type === "sale_item" && manage
      ? getMemberNames(tenantId)
      : new Map<string, string>(),
  ]);
  const locationNames = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div className="max-w-3xl space-y-6">
      {locations.map((location) => {
        const stock = stockOf(lines, product.id, location.id);
        const target = { slug, id: product.id, location: location.id };
        // Tracked gear: this location's units, each with its state and the
        // name its line and buttons use.
        const named = units
          .filter((unit) => unit.location_id === location.id)
          .map((unit, index) => ({
            unit,
            name: unit.label ?? t("unit", { number: index + 1 }),
            state:
              unit.status === "lost"
                ? ("lost" as const)
                : unit.damaged
                  ? ("damaged" as const)
                  : ("inUse" as const),
          }));
        return (
          <section
            key={location.id}
            aria-labelledby={`stock-${location.id}`}
            className="rounded-lg border bg-card p-4 sm:p-5"
          >
            <h2 id={`stock-${location.id}`} className="text-lg font-semibold">
              {location.name}
            </h2>
            {type === "sale_item" ? (
              <p className="mt-1 text-sm" data-stock-line>
                {t("onHand", { count: stock.inStock })}
              </p>
            ) : (
              <ul
                data-stock-line
                aria-label={t("counts")}
                className="mt-2 flex flex-wrap gap-1.5 text-sm"
              >
                <li className={cn(chip, "bg-foreground text-background")}>
                  {t("inStock", { count: stock.inStock })}
                </li>
                <li className={cn(chip, chipClass.inUse)}>
                  {t("available", { count: stock.available })}
                </li>
                {stock.damaged > 0 && (
                  <li className={cn(chip, chipClass.damaged)}>
                    {t("damaged", { count: stock.damaged })}
                  </li>
                )}
                {stock.lost > 0 && (
                  <li className={cn(chip, chipClass.lost)}>
                    {t("lost", { count: stock.lost })}
                  </li>
                )}
              </ul>
            )}

            {manage && (
              <div className="mt-4">
                <QuantityForm
                  target={target}
                  type={type}
                  current={stock.inStock}
                />
              </div>
            )}

            {/* Gear: three states, each under its own heading with a line
                saying what it means and the actions that belong to it.
                Counted gear asks "how many"; tracked gear lists its units. */}
            {type === "gear" &&
              stateNames.map((state) => {
                const count =
                  state === "inUse"
                    ? stock.inStock - stock.damaged
                    : stock[state];
                // Damaged and Lost appear once something is in them.
                if (state !== "inUse" && count === 0) return null;
                const rows = named.filter((unit) => unit.state === state);
                // Its own id: the forms below have fields named after the states.
                const heading = `state-${state}-${location.id}`;
                return (
                  <section
                    key={state}
                    aria-labelledby={heading}
                    data-stock-state={state}
                    className="mt-5 border-t pt-4"
                  >
                    <h3 id={heading} className="font-medium">
                      {t(`state.${state}.title`, { count })}
                    </h3>
                    <p className="mt-1 mb-3 text-sm text-muted-foreground">
                      {t(`state.${state}.help`)}
                      {state === "lost" && !manage && ` ${t("lostWaiting")}`}
                    </p>

                    {!tracked && state === "inUse" && (
                      <div className="grid gap-5 sm:grid-cols-2">
                        {work && stock.available > 0 && (
                          <DamagedForm
                            target={target}
                            zone={location.timezone}
                          />
                        )}
                        {lose && stock.inStock > 0 && (
                          <LostForm target={target} />
                        )}
                      </div>
                    )}
                    {!tracked && state === "damaged" && work && (
                      <RepairedForm target={target} />
                    )}
                    {!tracked && state === "lost" && manage && (
                      <ResolveLostForms target={target} />
                    )}

                    {tracked && rows.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {t("noUnits")}
                      </p>
                    )}
                    {tracked && rows.length > 0 && (
                      <ul
                        aria-labelledby={heading}
                        className="divide-y rounded-md border"
                      >
                        {rows.map(({ unit, name }) => (
                          <li
                            key={unit.id}
                            data-gear-unit
                            className="space-y-3 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{name}</span>
                              <span className={cn(chip, chipClass[state])}>
                                {t(`status.${state}`)}
                              </span>
                            </div>
                            {manage && (
                              <UnitLabelForm
                                slug={slug}
                                unit={unit.id}
                                label={unit.label ?? ""}
                              />
                            )}
                            <div className="flex flex-wrap gap-2">
                              {state === "inUse" && work && (
                                <UnitButton
                                  slug={slug}
                                  unit={unit.id}
                                  change="damaged"
                                  label={`${t("markDamaged")}: ${name}`}
                                />
                              )}
                              {state === "damaged" && work && (
                                <UnitButton
                                  slug={slug}
                                  unit={unit.id}
                                  change="repaired"
                                  label={`${t("backInUse")}: ${name}`}
                                />
                              )}
                              {state !== "lost" && lose && (
                                <UnitButton
                                  slug={slug}
                                  unit={unit.id}
                                  change="lost"
                                  label={`${t("markLost")}: ${name}`}
                                  confirm={t("lostConfirm")}
                                  destructive
                                />
                              )}
                              {state === "lost" && manage && (
                                <>
                                  <UnitButton
                                    slug={slug}
                                    unit={unit.id}
                                    change="restore"
                                    label={`${t("found")}: ${name}`}
                                  />
                                  <UnitButton
                                    slug={slug}
                                    unit={unit.id}
                                    change="remove"
                                    label={`${t("writeOff")}: ${name}`}
                                    confirm={t("writeOffConfirm")}
                                    destructive
                                  />
                                </>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
          </section>
        );
      })}

      {type === "sale_item" && (
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
      )}
    </div>
  );
}
