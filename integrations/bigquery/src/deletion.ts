/**
 * User deletion helpers for BigQuery, modeled on how Segment regulations delete
 * from warehouses: plain parameterized DML statements, one per table.
 *
 * Design constraints:
 *
 * - Every statement is a single-statement parameterized query. No multi-statement
 *   scripts, no transactions, so none of BigQuery's scripting limitations apply and
 *   query parameters are always supported.
 * - Deletion is idempotent, so partial progress is safe: a failed or deferred run is
 *   simply retried by the caller.
 * - Only tables that look like OpenTrack tables are touched. A shared dataset must
 *   never have unrelated tables mutated, and unrelated tables with incompatible
 *   schemas must never break deletion.
 */

export const DELETION_IDENTITY_COLUMNS = ['user_id', 'anonymous_id', 'previous_id'] as const
export type DeletionIdentityColumn = (typeof DELETION_IDENTITY_COLUMNS)[number]

/** Columns every OpenTrack-written row carries (see row-transformer's base row). */
export const OPENTRACK_TABLE_FINGERPRINT_COLUMNS = ['id', 'received_at'] as const

export const CANONICAL_TABLE_IDS = ['tracks', 'identifies', 'pages', 'groups', 'aliases'] as const

/**
 * Canonical tables ordered so the richest identity anchors are deleted last.
 * `tracks` and `identifies` hold the `user_id` -> `anonymous_id` pairs that
 * anonymous-id discovery depends on, so a retry after a partial failure can
 * still rediscover the same anonymous ids.
 */
export const CANONICAL_TABLE_DELETION_ORDER = ['aliases', 'groups', 'pages', 'identifies', 'tracks'] as const

export interface DeletableTable {
  tableId: string
  identityColumns: DeletionIdentityColumn[]
}

const SAFE_PROJECT_ID = /^[a-z][\da-z-]{4,61}[\da-z]$/
const SAFE_DATASET_OR_TABLE_ID = /^\w+$/

function isIdentityColumn(value: string): value is DeletionIdentityColumn {
  return (DELETION_IDENTITY_COLUMNS as readonly string[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function fieldNames(fields: unknown): Set<string> {
  const names = new Set<string>()
  if (!Array.isArray(fields)) {
    return names
  }
  for (const field of fields as unknown[]) {
    if (isRecord(field) && typeof field.name === 'string') {
      names.add(field.name)
    }
  }
  return names
}

/**
 * Decides whether a physical table is an OpenTrack-managed table that deletion
 * may touch. Tables written by OpenTrack always carry the base row columns and
 * use `\w`-only names, so anything else is skipped rather than mutated.
 */
export function isOpenTrackTable(tableId: string, fields: unknown): boolean {
  if (!SAFE_DATASET_OR_TABLE_ID.test(tableId)) {
    return false
  }
  const names = fieldNames(fields)
  return OPENTRACK_TABLE_FINGERPRINT_COLUMNS.every((column) => names.has(column))
}

/**
 * Returns the identity columns of an OpenTrack-shaped table, validating that each
 * is a plain STRING column. An OpenTrack table with a malformed identity column is
 * an error rather than a skip: silently leaving its rows in place would turn a
 * schema surprise into a compliance gap.
 */
export function getDeletionIdentityColumns(tableId: string, fields: unknown): DeletionIdentityColumn[] {
  if (!Array.isArray(fields)) {
    throw new TypeError(`BigQuery table ${tableId} returned invalid schema fields`)
  }

  const present = new Set<DeletionIdentityColumn>()
  for (const field of fields as unknown[]) {
    if (!isRecord(field) || typeof field.name !== 'string' || !isIdentityColumn(field.name)) {
      continue
    }

    const type = typeof field.type === 'string' ? field.type.toUpperCase() : null
    if (type !== 'STRING') {
      throw new Error(`BigQuery identity column ${tableId}.${field.name} must have type STRING`)
    }
    const mode = typeof field.mode === 'string' ? field.mode.toUpperCase() : field.mode
    if (mode !== undefined && mode !== null && mode !== 'NULLABLE' && mode !== 'REQUIRED') {
      throw new Error(`BigQuery identity column ${tableId}.${field.name} must not be repeated`)
    }

    present.add(field.name)
  }

  return DELETION_IDENTITY_COLUMNS.filter((column) => present.has(column))
}

export function quoteTablePath(projectId: string, datasetId: string, tableId: string): string {
  if (!SAFE_PROJECT_ID.test(projectId)) {
    throw new Error('Invalid BigQuery project identifier')
  }
  if (!SAFE_DATASET_OR_TABLE_ID.test(datasetId) || !SAFE_DATASET_OR_TABLE_ID.test(tableId)) {
    throw new Error('Invalid BigQuery dataset or table identifier')
  }
  return `\`${projectId}.${datasetId}.${tableId}\``
}

export interface DeletionTableOrder {
  eventTables: DeletableTable[]
  canonicalTables: DeletableTable[]
}

/** Splits tables into event-specific tables (deleted first) and canonical anchors (deleted last, `tracks` very last). */
export function orderTablesForDeletion(tables: DeletableTable[]): DeletionTableOrder {
  const canonicalIds = new Set<string>(CANONICAL_TABLE_IDS)
  const byId = new Map(tables.map((table) => [table.tableId, table]))

  const eventTables = tables
    .filter((table) => !canonicalIds.has(table.tableId))
    .sort((left, right) => left.tableId.localeCompare(right.tableId))
  const canonicalTables = CANONICAL_TABLE_DELETION_ORDER.flatMap((tableId) => {
    const table = byId.get(tableId)
    return table ? [table] : []
  })

  return { eventTables, canonicalTables }
}

/**
 * Builds the anonymous-id discovery query: one SELECT over the canonical tables
 * that carry both `user_id` and `anonymous_id`, returning every anonymous id
 * directly observed on rows owned by the requested user ids.
 *
 * Browser-supplied aliases (`previous_id`) are deliberately not followed: a
 * `previous_id` is untrusted telemetry, and promoting it into a deletion root
 * would let one client delete another user's data.
 */
export function buildAnonymousIdDiscoveryQuery(
  projectId: string,
  datasetId: string,
  tables: DeletableTable[]
): string | null {
  const sources = tables
    .filter(
      (table) =>
        (CANONICAL_TABLE_IDS as readonly string[]).includes(table.tableId) &&
        table.identityColumns.includes('user_id') &&
        table.identityColumns.includes('anonymous_id')
    )
    .sort((left, right) => left.tableId.localeCompare(right.tableId))

  if (sources.length === 0) {
    return null
  }

  const selects = sources.map(
    (table) =>
      `SELECT anonymous_id FROM ${quoteTablePath(projectId, datasetId, table.tableId)} WHERE user_id IN UNNEST(@subjectIds)`
  )

  return `SELECT DISTINCT anonymous_id
FROM (
  ${selects.join('\n  UNION DISTINCT\n  ')}
)
WHERE anonymous_id IS NOT NULL
  AND anonymous_id != ''`
}

/**
 * Builds one single-statement parameterized DELETE for a table, matching:
 * - `user_id` equal to a requested subject id,
 * - `anonymous_id` equal to a requested subject id or a discovered anonymous id,
 * - `previous_id` equal to a requested subject id (rows a browser aliased away
 *   from the trusted root), never a discovered or transitively aliased id.
 */
export function buildDeleteStatement(projectId: string, datasetId: string, table: DeletableTable): string {
  if (table.identityColumns.length === 0) {
    throw new Error(`BigQuery deletion table ${table.tableId} has no identity columns`)
  }

  const predicates = table.identityColumns.map((column) => {
    if (column === 'anonymous_id') {
      return 'anonymous_id IN UNNEST(@anonymousIds)'
    }
    return `${column} IN UNNEST(@subjectIds)`
  })

  return `DELETE FROM ${quoteTablePath(projectId, datasetId, table.tableId)}
WHERE ${predicates.join('\n   OR ')}`
}

/**
 * Rows younger than BigQuery's streaming buffer cannot be deleted by DML yet.
 * The buffer drains on its own, so this maps to a retryable "RUNNING" outcome.
 */
export function isStreamingBufferError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes('streaming buffer')
}
