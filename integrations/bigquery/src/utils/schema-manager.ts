import type { TableField, TableSchema } from '@google-cloud/bigquery'

import { BIGQUERY_TYPES, FIELD_MODES, TIMESTAMP_PATTERNS, TYPE_HIERARCHY, type BigQueryType } from './constants'

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
    return BIGQUERY_TYPES.STRING // Default to STRING for null values, can be relaxed later
  }

  switch (typeof value) {
    case 'boolean':
      return BIGQUERY_TYPES.BOOLEAN
    case 'number':
      // Check if it's an integer or float
      return Number.isInteger(value) ? BIGQUERY_TYPES.INTEGER : BIGQUERY_TYPES.FLOAT
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
 * Merges two BigQuery schemas, adding new fields and relaxing types as needed
 * @param existingSchema - Current table schema
 * @param newSchema - Schema generated from new data
 * @returns Updated schema with new fields and relaxed types
 */
export function mergeSchemas(
  existingSchema: TableSchema,
  newSchema: TableSchema
): {
  schema: TableSchema
  hasChanges: boolean
} {
  const existingFieldsMap = new Map<string, TableField>()
  for (const field of existingSchema.fields || []) {
    existingFieldsMap.set(field.name!, field)
  }

  const mergedFields: TableField[] = [...(existingSchema.fields || [])]
  let hasChanges = false

  for (const newField of newSchema.fields || []) {
    const existingField = existingFieldsMap.get(newField.name!)

    if (!existingField) {
      // New field - add it
      mergedFields.push(newField)
      hasChanges = true
    } else if (needsTypeRelaxation(existingField, newField)) {
      // Existing field needs type relaxation
      const relaxedType = relaxType(existingField.type!, newField.type!)
      if (relaxedType !== existingField.type) {
        // Update the existing field in the merged array
        const fieldIndex = mergedFields.findIndex((f) => f.name === newField.name)
        mergedFields[fieldIndex] = {
          ...existingField,
          type: relaxedType,
        }
        hasChanges = true
      }
    }
  }

  return {
    schema: { fields: mergedFields },
    hasChanges,
  }
}

/**
 * Determines if a field type needs to be relaxed to accommodate new data
 * @param existingField - Current field definition
 * @param newField - New field definition
 * @returns True if type relaxation is needed
 */
function needsTypeRelaxation(existingField: TableField, newField: TableField): boolean {
  if (existingField.type === newField.type) {
    return false
  }

  const existingType = existingField.type!
  const newType = newField.type!

  // Common relaxation patterns using constants
  const relaxationRules = [
    [BIGQUERY_TYPES.INTEGER, BIGQUERY_TYPES.FLOAT],
    [BIGQUERY_TYPES.INTEGER, BIGQUERY_TYPES.STRING],
    [BIGQUERY_TYPES.FLOAT, BIGQUERY_TYPES.STRING],
    [BIGQUERY_TYPES.BOOLEAN, BIGQUERY_TYPES.STRING],
    [BIGQUERY_TYPES.TIMESTAMP, BIGQUERY_TYPES.STRING],
  ] as const

  return relaxationRules.some(([from, to]) => existingType === from && newType === to)
}

/**
 * Determines the most permissive type between two BigQuery types
 * @param type1 - First type
 * @param type2 - Second type
 * @returns The more permissive type
 */
function relaxType(type1: string, type2: string): BigQueryType {
  if (type1 === type2) {
    return type1 as BigQueryType
  }

  const index1 = TYPE_HIERARCHY.indexOf(type1 as BigQueryType)
  const index2 = TYPE_HIERARCHY.indexOf(type2 as BigQueryType)

  // Return the type that's further in the hierarchy (more permissive)
  return index1 > index2 ? (type1 as BigQueryType) : (type2 as BigQueryType)
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
    identify: [
      { name: 'user_id', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.REQUIRED }, // Override to make required
    ],
    page: [
      { name: 'name', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
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
    identifies: [{ name: 'user_id', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.REQUIRED }],
    pages: [
      { name: 'name', type: BIGQUERY_TYPES.STRING, mode: FIELD_MODES.NULLABLE },
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
