/**
 * A product's History tab (docs/products-redesign.md §4.3): the audit trail
 * for one product and its units, turned into lines a shop owner can read.
 * Pure: the page fetches the rows (owners and managers only, by RLS).
 */

export type AuditRow = {
  id: number;
  entity: string;
  entity_id: string;
  action: string;
  actor: string | null;
  before: unknown;
  after: unknown;
  at: string;
};

export type HistoryChange = {
  field: string;
  from: unknown;
  to: unknown;
};

export type HistoryEntry = {
  id: number;
  at: string;
  /** Null: the system, or a database job. */
  actor: string | null;
  entity: string;
  entityId: string;
  action: string;
  /** For an update: the columns that changed. */
  changes: HistoryChange[];
  /** For a stock event: how many units it was about. */
  quantity?: number;
};

/** Columns that say nothing to a reader, or repeat another one. */
const quiet = new Set([
  "id",
  "tenant_id",
  "product_id",
  "product_type",
  "created_at",
  "updated_at",
  "qr_token",
  "ready_updated_at",
  "deposit_currency",
  "catalog_approved_at",
  "catalog_rejected_at",
  "catalog_reject_reason",
  "type",
  "tracking",
  "vehicle_type",
  "location_id",
  "photos",
  "created_by",
  // Asked for on the Moto Mangos review form only; not shown on the platform.
  "make",
  "model",
  "cc",
  "transmission",
  "catalog_id",
  // The manual order is the shop's, not this product's story.
  "sort_position",
]);

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** One audit row as a history entry. Updates list what changed, in column order. */
export function toHistoryEntry(row: AuditRow): HistoryEntry {
  const before = record(row.before);
  const after = record(row.after);
  // A quantity change reads "Quantity: 20 -> 25"; marking units damaged or
  // lost carries how many.
  if (row.action === "stock_adjust")
    return {
      id: row.id,
      at: row.at,
      actor: row.actor,
      entity: row.entity,
      entityId: row.entity_id,
      action: row.action,
      changes: [
        {
          field: "quantity",
          from: before.quantity ?? null,
          to: after.quantity ?? null,
        },
      ],
    };
  const quantity =
    row.action !== "update" && typeof after.quantity === "number"
      ? after.quantity
      : undefined;
  const changes =
    row.action === "update"
      ? Object.keys(after)
          .filter((field) => !quiet.has(field))
          .map((field) => ({
            field,
            from: before[field] ?? null,
            to: after[field] ?? null,
          }))
      : [];
  return {
    id: row.id,
    at: row.at,
    actor: row.actor,
    entity: row.entity,
    entityId: row.entity_id,
    action: row.action,
    changes,
    ...(quantity === undefined ? {} : { quantity }),
  };
}

/**
 * The entries worth showing: an update that only touched quiet columns (a
 * timestamp, say) is left out.
 */
export function buildHistory(rows: AuditRow[]): HistoryEntry[] {
  return rows
    .map(toHistoryEntry)
    .filter((entry) => entry.action !== "update" || entry.changes.length > 0);
}

/** A stored value as text. Yes and no, and "empty", are worded by the caller. */
export function historyValue(
  value: unknown,
  words: { empty: string; yes: string; no: string },
): string {
  if (value === null || value === undefined || value === "") return words.empty;
  if (value === true) return words.yes;
  if (value === false) return words.no;
  if (Array.isArray(value))
    return value.length === 0 ? words.empty : value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

// Tracked gear ---------------------------------------------------------------------------

/**
 * What happened to the units of a tracked gear product, in the words of the
 * buttons that did it. The audit trail holds rows of two tables: a unit
 * (marked lost, found, written off, given a label) and its downtime (marked
 * damaged, put back in use). This turns them into one line each:
 *   unit_damaged      "Mark damaged"
 *   unit_repaired     "Back in use"
 *   unit_lost         "Mark lost"
 *   unit_found        "Found, back in use"
 *   unit_written_off  "Write off" (the unit's row is gone; its line stays)
 * A unit added or removed by a quantity change is left to that change's own
 * line ("Quantity: 2 → 3"). Also answers with each unit's label, so a unit
 * that was written off still has its name.
 */
export function gearUnitHistory(rows: AuditRow[]): {
  rows: AuditRow[];
  names: Map<string, string | null>;
} {
  const oldestFirst = [...rows].sort(
    (a, b) => a.at.localeCompare(b.at) || a.id - b.id,
  );
  const names = new Map<string, string | null>();
  /** Which unit a downtime block is on, learnt when it is added or removed. */
  const blockUnit = new Map<string, string>();
  const out: AuditRow[] = [];
  const say = (row: AuditRow, unit: string, action: string, extra = {}) =>
    out.push({
      id: row.id,
      entity: "units",
      entity_id: unit,
      action,
      actor: row.actor,
      before: null,
      after: null,
      at: row.at,
      ...extra,
    });

  for (const row of oldestFirst) {
    const before = record(row.before);
    const after = record(row.after);
    if (row.entity === "units") {
      const unit = row.entity_id;
      if ("label" in after) names.set(unit, (after.label as string) ?? null);
      else if (!names.has(unit) && "label" in before)
        names.set(unit, (before.label as string) ?? null);
      if (row.action === "delete") {
        if (before.status === "lost") say(row, unit, "unit_written_off");
      } else if (row.action === "update") {
        if (after.status === "lost") say(row, unit, "unit_lost");
        else if (before.status === "lost" && after.status === "active")
          say(row, unit, "unit_found");
        else if (before.status === "lost" && after.status === "retired")
          say(row, unit, "unit_written_off");
        if ("label" in after)
          say(row, unit, "update", {
            before: { label: before.label ?? null },
            after: { label: after.label ?? null },
          });
      }
    } else if (row.entity === "unit_blocks") {
      const full = row.action === "delete" ? before : after;
      if (row.action !== "update") {
        if (full.kind !== "downtime" || typeof full.unit_id !== "string")
          continue;
        blockUnit.set(row.entity_id, full.unit_id);
      }
      const unit = blockUnit.get(row.entity_id);
      if (!unit) continue;
      say(
        row,
        unit,
        row.action === "insert" ? "unit_damaged" : "unit_repaired",
      );
    }
  }

  // Marking a unit lost, or removing it, ends its downtime in the same
  // moment: that is not someone putting it back in use.
  const gone = new Set(
    oldestFirst
      .filter(
        (row) =>
          row.entity === "units" &&
          (row.action === "delete" || record(row.after).status === "lost"),
      )
      .map((row) => `${row.entity_id} ${row.at}`),
  );
  return {
    rows: out.filter(
      (row) =>
        row.action !== "unit_repaired" ||
        !gone.has(`${row.entity_id} ${row.at}`),
    ),
    names,
  };
}
