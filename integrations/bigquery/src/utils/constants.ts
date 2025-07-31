/**
 * Constants used throughout the BigQuery integration
 */

// BigQuery data types
export const BIGQUERY_TYPES = {
  BOOLEAN: 'BOOLEAN',
  INTEGER: 'INTEGER',
  FLOAT: 'FLOAT',
  STRING: 'STRING',
  TIMESTAMP: 'TIMESTAMP',
} as const

export type BigQueryType = (typeof BIGQUERY_TYPES)[keyof typeof BIGQUERY_TYPES]

// Field modes
export const FIELD_MODES = {
  REQUIRED: 'REQUIRED',
  NULLABLE: 'NULLABLE',
  REPEATED: 'REPEATED',
} as const

export type FieldMode = (typeof FIELD_MODES)[keyof typeof FIELD_MODES]

// Table types
export const TABLE_TYPES = {
  TRACKS: 'tracks',
  IDENTIFIES: 'identifies',
  PAGES: 'pages',
  GROUPS: 'groups',
  ALIASES: 'aliases',
} as const

export type TableType = (typeof TABLE_TYPES)[keyof typeof TABLE_TYPES]

// Type hierarchy for relaxation (from most restrictive to most permissive)
export const TYPE_HIERARCHY: readonly BigQueryType[] = [
  BIGQUERY_TYPES.BOOLEAN,
  BIGQUERY_TYPES.INTEGER,
  BIGQUERY_TYPES.FLOAT,
  BIGQUERY_TYPES.TIMESTAMP,
  BIGQUERY_TYPES.STRING,
] as const

// Common timestamp regex patterns
export const TIMESTAMP_PATTERNS = {
  ISO_8601: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
} as const

// Cache configuration
export const CACHE_CONFIG = {
  TTL_MS: 5 * 60 * 1000, // 5 minutes
} as const

// Default dataset configuration
export const DATASET_CONFIG = {
  LOCATION: 'US',
  LABELS: {
    created_by: 'opentrack',
    source: 'segment_integration',
  },
} as const
