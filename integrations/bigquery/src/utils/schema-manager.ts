import type { TableField, TableSchema } from '@google-cloud/bigquery'

import { BIGQUERY_TYPES, FIELD_MODES, TIMESTAMP_PATTERNS, type BigQueryType } from './constants'

/**
 * Utility functions for managing BigQuery schemas and type detection
 */

/**
 * Maps JavaScript/JSON values to appropriate BigQuery data types
 * @param value - The value to analyze
 * @returns BigQuery column type string
 */
export function detectBigQueryType(value: unknown): BigQueryType {
  if (value === null || value === undefined) {
    return BIGQUERY_TYPES.STRING // Default to STRING for null values
  }

  switch (typeof value) {
    case 'boolean':
      return BIGQUERY_TYPES.BOOLEAN
    case 'number':
      // Every number maps to FLOAT. Column types can't change once created, so an
      // INTEGER column would have to drop the first decimal value it receives.
      return BIGQUERY_TYPES.FLOAT
    case 'string':
      // Check if it's a valid timestamp
      if (isValidTimestamp(value)) {
        return BIGQUERY_TYPES.TIMESTAMP
      }
      return BIGQUERY_TYPES.STRING
    case 'object':
      if (value instanceof Date) {
        return BIGQUERY_TYPES.TIMESTAMP
      }
      if (Array.isArray(value)) {
        return BIGQUERY_TYPES.STRING // Arrays are JSON stringified
      }
      return BIGQUERY_TYPES.STRING // Objects are JSON stringified
    default:
      return BIGQUERY_TYPES.STRING
  }
}

/**
 * Checks if a string value represents a valid timestamp
 * @param value - String value to check
 * @returns True if it's a valid timestamp format
 */
function isValidTimestamp(value: string): boolean {
  if (TIMESTAMP_PATTERNS.ISO_8601.test(value)) {
    const date = new Date(value)
    return !Number.isNaN(date.getTime())
  }
  return false
}

/**
 * Generates a BigQuery schema from a data row
 * @param row - The data row to analyze
 * @returns BigQuery TableSchema
 */
export function generateSchemaFromRow(row: Record<string, unknown>): TableSchema {
  const fields: TableField[] = []

  for (const [columnName, value] of Object.entries(row)) {
    const field: TableField = {
      name: columnName,
      type: detectBigQueryType(value),
      mode: FIELD_MODES.NULLABLE, // All fields start as nullable
    }
    fields.push(field)
  }

  return { fields }
}

/**
 * Merges a row's schema into a table schema using only changes BigQuery accepts:
 * new columns are added, and REQUIRED columns the row doesn't provide are relaxed
 * to NULLABLE.
 *
 * Existing column types never change. BigQuery's API rejects a schema update that
 * changes a column's data type, so a value that doesn't match its column is
 * coerced (or dropped) at insert time instead; see `coerceRowToSchema`.
 *
 * @param existingSchema - Current table schema
 * @param newSchema - Schema generated from new data
 * @returns Updated schema and whether it differs from the existing one
 */
export function mergeSchemas(
  existingSchema: TableSchema,
  newSchema: TableSchema
): {
  schema: TableSchema
  hasChanges: boolean
} {
  const existingFields = existingSchema.fields || []
  const newFields = newSchema.fields || []
  const existingNames = new Set(existingFields.map((field) => field.name))
  const newNames = new Set(newFields.map((field) => field.name))
  let hasChanges = false

  const mergedFields: TableField[] = existingFields.map((field) => {
    if (field.mode === FIELD_MODES.REQUIRED && !newNames.has(field.name)) {
      hasChanges = true
      return { ...field, mode: FIELD_MODES.NULLABLE }
    }
    return field
  })

  for (const newField of newFields) {
    if (!existingNames.has(newField.name)) {
      mergedFields.push(newField)
      hasChanges = true
    }
  }

  return {
    schema: { fields: mergedFields },
    hasChanges,
  }
}

/**
 * Gets the base schema for each table type following Segment conventions
 * @param tableType - Type of table (tracks, identifies, pages, groups, aliases, or event name)
 * @returns Base schema with standard Segment columns
 */
export function getBaseSchemaForTable(tableType: string): TableSchema {
  // Common columns for all tables
  const commonFields: TableField[] = [
    { name: 'id', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.REQUIRED },
    { name: 'received_at', type: BIGQUERY_TYPES.TIMESTAMP, mode: FIELD_MODES.REQUIRED },
    { name: 'sent_at', type: BIGQUERY_TYPES.TIMESTAMP, mode: FIELD_MODES.NULLABLE },
    { name: 'timestamp', type: BIGQUERY_TYPES.TIMESTAMP, mode: FIELD_MODES.NULLABLE },
    { name: 'uuid_ts', type: BIGQUERY_TYPES.TIMESTAMP, mode: FIELD_MODES.REQUIRED },
    { name: 'loaded_at', type: BIGQUERY_TYPES.TIMESTAMP, mode: FIELD_MODES.REQUIRED },
    { name: 'user_id', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
    { name: 'anonymous_id', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
  ]

  // Type-specific fields (using payload types as keys)
  const typeSpecificFields: Record<string, TableField[]> = {
    track: [
      { name: 'event', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.REQUIRED },
      { name: 'event_text', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
    ],
    // user_id stays NULLABLE: anonymous identify calls carry only an anonymous_id
    identify: [],
    page: [
      { name: 'name', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'category', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'url', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'path', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'referrer', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'search', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'title', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
    ],
    group: [{ name: 'group_id', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.REQUIRED }],
    alias: [
      { name: 'previous_id', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.REQUIRED },
      { name: 'user_id', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.REQUIRED }, // Override to make required
    ],
    // Legacy table name support (for compatibility)
    tracks: [
      { name: 'event', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.REQUIRED },
      { name: 'event_text', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
    ],
    identifies: [],
    pages: [
      { name: 'name', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'category', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'url', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'path', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'referrer', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'search', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
      { name: 'title', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
    ],
    groups: [{ name: 'group_id', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.REQUIRED }],
    aliases: [
      { name: 'previous_id', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.REQUIRED },
      { name: 'user_id', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.REQUIRED },
    ],
  }

  // For event-specific tables (not standard payload types), use track-like schema
  const specificFields = typeSpecificFields[tableType] || typeSpecificFields.track

  // Merge common fields with type-specific fields
  const allFields = [...commonFields]

  // Add or override with type-specific fields
  for (const specificField of specificFields) {
    const existingIndex = allFields.findIndex((f) => f.name === specificField.name)
    if (existingIndex >= 0) {
      allFields[existingIndex] = specificField // Override existing field
    } else {
      allFields.push(specificField) // Add new field
    }
  }

  return { fields: allFields }
}
