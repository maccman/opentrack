export const BIGQUERY_ERASURE_TRANSACTION_TABLE_LIMIT = 100

export const BIGQUERY_IDENTITY_COLUMNS = ['user_id', 'anonymous_id', 'previous_id'] as const
export const BIGQUERY_CANONICAL_TABLE_IDS = ['tracks', 'identifies', 'pages', 'groups', 'aliases'] as const

export type BigQueryIdentityColumn = (typeof BIGQUERY_IDENTITY_COLUMNS)[number]

export interface BigQueryErasableTable {
  tableId: string
  identityColumns: BigQueryIdentityColumn[]
}

export interface BigQueryErasureTablePartition {
  canonicalTables: BigQueryErasableTable[]
  eventSpecificTables: BigQueryErasableTable[]
}

interface BigQueryErasureBatchScriptConfig {
  projectId: string
  datasetId: string
  canonicalTables: BigQueryErasableTable[]
  mutationTables: BigQueryErasableTable[]
}

const SAFE_PROJECT_ID = /^[a-z][\da-z-]{4,61}[\da-z]$/
const SAFE_DATASET_OR_TABLE_ID = /^\w+$/

function isIdentityColumn(value: string): value is BigQueryIdentityColumn {
  return value === 'user_id' || value === 'anonymous_id' || value === 'previous_id'
}

function isCanonicalTableId(value: string): boolean {
  return value === 'tracks' || value === 'identifies' || value === 'pages' || value === 'groups' || value === 'aliases'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Returns validated, deterministically ordered identity columns from BigQuery field metadata. */
export function getBigQueryIdentityColumns(tableId: string, fields: unknown): BigQueryIdentityColumn[] {
  if (!Array.isArray(fields)) {
    throw new TypeError(`BigQuery table ${tableId} returned invalid schema fields`)
  }

  const presentColumns = new Set<BigQueryIdentityColumn>()

  for (const field of fields as unknown[]) {
    if (!isRecord(field) || typeof field.name !== 'string') {
      continue
    }
    const name = field.name
    if (!isIdentityColumn(name)) {
      continue
    }

    const type = typeof field.type === 'string' ? field.type.toUpperCase() : null
    if (type !== 'STRING') {
      throw new Error(`BigQuery identity column ${tableId}.${name} must have type STRING`)
    }

    const rawMode = field.mode
    const mode = typeof rawMode === 'string' ? rawMode.toUpperCase() : rawMode
    if (mode !== undefined && mode !== null && mode !== 'NULLABLE' && mode !== 'REQUIRED') {
      throw new Error(`BigQuery identity column ${tableId}.${name} must not be repeated`)
    }

    presentColumns.add(name)
  }

  return BIGQUERY_IDENTITY_COLUMNS.filter((column) => presentColumns.has(column))
}

/** Separates retry anchors from event-specific tables while keeping both groups deterministic. */
export function partitionBigQueryErasureTables(tables: BigQueryErasableTable[]): BigQueryErasureTablePartition {
  const sortedTables = [...tables].sort((left, right) => left.tableId.localeCompare(right.tableId))
  return {
    canonicalTables: sortedTables.filter((table) => isCanonicalTableId(table.tableId)),
    eventSpecificTables: sortedTables.filter((table) => !isCanonicalTableId(table.tableId)),
  }
}

function quoteTablePath(projectId: string, datasetId: string, tableId: string): string {
  if (!SAFE_PROJECT_ID.test(projectId)) {
    throw new Error('Invalid BigQuery project identifier')
  }
  if (!SAFE_DATASET_OR_TABLE_ID.test(datasetId) || !SAFE_DATASET_OR_TABLE_ID.test(tableId)) {
    throw new Error('Invalid BigQuery dataset or table identifier')
  }
  return `\`${projectId}.${datasetId}.${tableId}\``
}

function buildDirectAnonymousIdSelects(
  projectId: string,
  datasetId: string,
  canonicalTables: BigQueryErasableTable[]
): string[] {
  return canonicalTables.flatMap(({ tableId, identityColumns }) => {
    if (!identityColumns.includes('user_id')) {
      return []
    }

    const tablePath = quoteTablePath(projectId, datasetId, tableId)
    if (!identityColumns.includes('anonymous_id')) {
      return []
    }

    return [
      `SELECT anonymous_id
      FROM ${tablePath}
      WHERE user_id = @userId
        AND anonymous_id IS NOT NULL
        AND anonymous_id != ''`,
    ]
  })
}

function buildDeleteStatements(projectId: string, datasetId: string, mutationTables: BigQueryErasableTable[]): string {
  return mutationTables
    .map(({ tableId, identityColumns }) => {
      const tablePath = quoteTablePath(projectId, datasetId, tableId)
      const predicates = identityColumns.map((column) => {
        if (column === 'user_id') {
          return 'user_id = @userId'
        }
        if (column === 'anonymous_id') {
          return 'anonymous_id IN UNNEST(erasable_anonymous_ids)'
        }
        return 'previous_id = @userId'
      })
      return `DELETE FROM ${tablePath}
    WHERE ${predicates.join(' OR ')};`
    })
    .join('\n\n    ')
}

/**
 * Builds one atomic erasure batch.
 *
 * Only the requested identifier is ever matched against `user_id` or `previous_id`.
 * Canonical rows whose `user_id` equals that trusted root contribute directly observed
 * anonymous identifiers, but browser-supplied aliases are never promoted into user roots.
 */
export function buildBigQueryErasureBatchScript({
  projectId,
  datasetId,
  canonicalTables,
  mutationTables,
}: BigQueryErasureBatchScriptConfig): string {
  if (mutationTables.length === 0) {
    throw new Error('BigQuery erasure batch requires at least one identity-bearing table')
  }
  if (mutationTables.length > BIGQUERY_ERASURE_TRANSACTION_TABLE_LIMIT) {
    throw new Error(
      `BigQuery erasure batch cannot atomically mutate more than ${BIGQUERY_ERASURE_TRANSACTION_TABLE_LIMIT} tables`
    )
  }

  const sortedCanonicalTables = [...canonicalTables].sort((left, right) => left.tableId.localeCompare(right.tableId))
  const sortedMutationTables = [...mutationTables].sort((left, right) => left.tableId.localeCompare(right.tableId))
  for (const table of [...sortedCanonicalTables, ...sortedMutationTables]) {
    if (table.identityColumns.length === 0) {
      throw new Error(`BigQuery erasure table ${table.tableId} has no identity columns`)
    }
  }

  const directAnonymousIdSelects = buildDirectAnonymousIdSelects(projectId, datasetId, sortedCanonicalTables)
  const erasableAnonymousIdQuery = ['SELECT @userId AS anonymous_id', ...directAnonymousIdSelects].join(
    '\n        UNION DISTINCT\n        '
  )
  const deleteStatements = buildDeleteStatements(projectId, datasetId, sortedMutationTables)

  return `DECLARE erasable_anonymous_ids ARRAY<STRING> DEFAULT [@userId];

BEGIN
  BEGIN TRANSACTION;

  SET erasable_anonymous_ids = ARRAY(
    SELECT DISTINCT anonymous_id
    FROM (
      ${erasableAnonymousIdQuery}
    )
    WHERE anonymous_id IS NOT NULL
      AND anonymous_id != ''
  );

  ${deleteStatements}

  COMMIT TRANSACTION;
EXCEPTION WHEN ERROR THEN
  ROLLBACK TRANSACTION;
  RAISE;
END;`
}

export function isBigQueryStreamingBufferError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes('streaming buffer')
}
