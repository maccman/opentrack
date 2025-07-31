import type { TableField, TableSchema } from '@google-cloud/bigquery'

/**
 * Utility functions for managing BigQuery schemas and type detection
 */

/**
 * Maps JavaScript/JSON values to appropriate BigQuery data types
 * @param value - The value to analyze
 * @returns BigQuery column type string
 */
export function detectBigQueryType(value: any): string {
  if (value === null || value === undefined) {
    return 'STRING' // Default to STRING for null values, can be relaxed later
  }

  switch (typeof value) {
    case 'boolean':
      return 'BOOLEAN'
    case 'number':
      // Check if it's an integer or float
      return Number.isInteger(value) ? 'INTEGER' : 'FLOAT'
    case 'string':
      // Check if it's a valid timestamp
      if (isValidTimestamp(value)) {
        return 'TIMESTAMP'
      }
      return 'STRING'
    case 'object':
      if (value instanceof Date) {
        return 'TIMESTAMP'
      }
      if (Array.isArray(value)) {
        return 'STRING' // Arrays are JSON stringified
      }
      return 'STRING' // Objects are JSON stringified
    default:
      return 'STRING'
  }
}

/**
 * Checks if a string value represents a valid timestamp
 * @param value - String value to check
 * @returns True if it's a valid timestamp format
 */
function isValidTimestamp(value: string): boolean {
  // Check for ISO 8601 format or other common timestamp formats
  const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
  if (timestampRegex.test(value)) {
    const date = new Date(value)
    return !isNaN(date.getTime())
  }
  return false
}

/**
 * Generates a BigQuery schema from a data row
 * @param row - The data row to analyze
 * @returns BigQuery TableSchema
 */
export function generateSchemaFromRow(row: Record<string, any>): TableSchema {
  const fields: TableField[] = []

  for (const [columnName, value] of Object.entries(row)) {
    const field: TableField = {
      name: columnName,
      type: detectBigQueryType(value),
      mode: 'NULLABLE', // All fields start as nullable
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

  // Check if we can relax the type
  const existingType = existingField.type!
  const newType = newField.type!

  // Common relaxation patterns
  const relaxationRules = [
    ['INTEGER', 'FLOAT'], // INT can be relaxed to FLOAT
    ['INTEGER', 'STRING'], // INT can be relaxed to STRING
    ['FLOAT', 'STRING'], // FLOAT can be relaxed to STRING
    ['BOOLEAN', 'STRING'], // BOOLEAN can be relaxed to STRING
    ['TIMESTAMP', 'STRING'], // TIMESTAMP can be relaxed to STRING
  ]

  return relaxationRules.some(([from, to]) => existingType === from && newType === to)
}

/**
 * Determines the most permissive type between two BigQuery types
 * @param type1 - First type
 * @param type2 - Second type
 * @returns The more permissive type
 */
function relaxType(type1: string, type2: string): string {
  if (type1 === type2) {
    return type1
  }

  // Type hierarchy (from most restrictive to most permissive)
  const typeHierarchy = ['BOOLEAN', 'INTEGER', 'FLOAT', 'TIMESTAMP', 'STRING']

  const index1 = typeHierarchy.indexOf(type1)
  const index2 = typeHierarchy.indexOf(type2)

  // Return the type that's further in the hierarchy (more permissive)
  return index1 > index2 ? type1 : type2
}

/**
 * Gets the base schema for each table type following Segment conventions
 * @param tableType - Type of table (tracks, identifies, pages, groups, aliases, or event name)
 * @returns Base schema with standard Segment columns
 */
export function getBaseSchemaForTable(tableType: string): TableSchema {
  // Common columns for all tables
  const commonFields: TableField[] = [
    { name: 'id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'received_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    { name: 'sent_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
    { name: 'timestamp', type: 'TIMESTAMP', mode: 'NULLABLE' },
    { name: 'uuid_ts', type: 'TIMESTAMP', mode: 'REQUIRED' },
    { name: 'loaded_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    { name: 'user_id', type: 'STRING', mode: 'NULLABLE' },
    { name: 'anonymous_id', type: 'STRING', mode: 'NULLABLE' },
  ]

  // Type-specific fields
  const typeSpecificFields: Record<string, TableField[]> = {
    tracks: [
      { name: 'event', type: 'STRING', mode: 'REQUIRED' },
      { name: 'event_text', type: 'STRING', mode: 'NULLABLE' },
    ],
    identifies: [
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' }, // Override to make required
    ],
    pages: [
      { name: 'name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'url', type: 'STRING', mode: 'NULLABLE' },
      { name: 'path', type: 'STRING', mode: 'NULLABLE' },
      { name: 'referrer', type: 'STRING', mode: 'NULLABLE' },
      { name: 'search', type: 'STRING', mode: 'NULLABLE' },
      { name: 'title', type: 'STRING', mode: 'NULLABLE' },
    ],
    groups: [{ name: 'group_id', type: 'STRING', mode: 'REQUIRED' }],
    aliases: [
      { name: 'previous_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' }, // Override to make required
    ],
  }

  // For event-specific tables (not tracks, identifies, etc.), use track-like schema
  const specificFields = typeSpecificFields[tableType] || typeSpecificFields.tracks

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
