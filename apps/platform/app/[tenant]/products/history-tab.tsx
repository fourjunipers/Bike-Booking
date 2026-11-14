import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/action-form";
import {
  getGearUnitAudit,
  getMemberNames,
  getProductHistory,
} from "@/lib/fleet-data";
import { buildHistory, gearUnitHistory, historyValue } from "@/lib/history";
import { formatInstant } from "@/lib/shop-time";
import { humanizeKey } from "@/lib/vehicle-kinds";

/**
 * Who changed what on a product and its units, newest first (owners and
 * managers: the audit log's own rule). A vehicle product names its vehicles
 * by plate. Tracked gear names its units by label and says what was done to
 * each in the words of the Stock tab's buttons ("marked unit GoPro 3 lost",
 * "wrote off unit GoPro 3"); a unit that was written off keeps its lines.
 */
export async function HistoryTab({
  tenantId,
  productId,
  units,
  unitsAre,
  trackedGear,
  timezone,
  locale,
}: {
  tenantId: string;
  productId: string;
  /** The units whose own changes belong in this history, with a name each. */
  units: { id: string; name: string | null }[];
  unitsAre: "vehicles" | "gear";
  /** Gear tracked unit by unit: each unit's own lines are added. */
  trackedGear?: boolean;
  timezone: string;
  locale: string;
}) {
  const limit = 100;
  const [t, tFleet, productRows, names, unitRows] = await Promise.all([
    getTranslations("Products.history"),
    getTranslations("Fleet"),
    getProductHistory(
      tenantId,
      productId,
      units.map((unit) => unit.id),
      limit,
    ),
    getMemberNames(tenantId),
    trackedGear ? getGearUnitAudit(tenantId, productId, limit) : [],
  ]);
  const gear = gearUnitHistory(unitRows);
  const rows = [...productRows, ...gear.rows]
    .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
    .slice(0, limit);
  const entries = buildHistory(rows);
  const unnamed = unitsAre === "vehicles" ? tFleet("noPlate") : t("unlabelled");
  const unitNames = new Map([
    ...[...gear.names].map(([id, name]) => [id, name ?? unnamed] as const),
    ...units.map((unit) => [unit.id, unit.name ?? unnamed] as const),
  ]);
  const words = { empty: t("empty"), yes: t("yes"), no: t("no") };
  const fieldLabel = (field: string) =>
    t.has(`field.${field}` as "field.name")
      ? t(`field.${field}` as "field.name")
      : humanizeKey(field);
  const what = (entity: string, entityId: string) =>
    entity === "units"
      ? t(unitsAre === "vehicles" ? "on.units" : "on.gearUnits", {
          name: unitNames.get(entityId) ?? unnamed,
        })
      : t("on.products");

  return (
    <Panel
      intro={t(unitsAre === "vehicles" ? "intro" : "introGeneral")}
      className="max-w-3xl"
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ol className="divide-y rounded-md border">
          {entries.map((entry) => {
            const who =
              entry.actor === null
                ? t("system")
                : (names.get(entry.actor) ?? t("formerMember"));
            const subject = what(entry.entity, entry.entityId);
            const line = t.has(`action.${entry.action}` as "action.insert")
              ? t(`action.${entry.action}` as "action.insert", {
                  who,
                  what: subject,
                  count: entry.quantity ?? 0,
                })
              : t("action.other", {
                  who,
                  action: entry.action,
                  what: subject,
                });
            return (
              <li key={entry.id} className="p-3 text-sm">
                <p className="font-medium">{line}</p>
                <p className="text-xs text-muted-foreground">
                  <time dateTime={entry.at}>
                    {formatInstant(new Date(entry.at), timezone, locale)}
                  </time>
                </p>
                {entry.changes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {entry.changes.map((change) => (
                      <li key={change.field}>
                        {t("change", {
                          field: fieldLabel(change.field),
                          from: historyValue(change.from, words),
                          to: historyValue(change.to, words),
                        })}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {rows.length >= limit && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("latest", { count: limit })}
        </p>
      )}
    </Panel>
  );
}
