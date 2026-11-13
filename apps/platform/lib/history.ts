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
]);

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** One audit row as a history entry. Updates list what changed, in column order. */
export function toHistoryEntry(row: AuditRow): HistoryEntry {
  const before = record(row.before);
  const after = record(row.after);
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
