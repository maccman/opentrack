import type { TableSchema } from '@google-cloud/bigquery'

import { TIMESTAMP_PATTERNS } from './constants'

/**
 * Utility functions for fitting row values to a table's existing column types
 */

export interface CoercedRow {
  row: Record<string, unknown>
  /** Columns whose value could not be represented in the column's type */
  droppedColumns: string[]
}

const DROPPED = Symbol('dropped')

/**
 * Converts a value to a column's type, or returns DROPPED when it can't be
 * represented. Column type names may use legacy (FLOAT) or standard (FLOAT64)
 * spelling depending on how the table was created.
 */
function coerceValue(value: unknown, columnType: string): unknown {
  switch (columnType) {
    case 'STRING':
      if (typeof value === 'string') {
        return value
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value)
      }
      if (value instanceof Date) {
        return value.toISOString()
      }
      return JSON.stringify(value)
    case 'FLOAT':
    case 'FLOAT64':
      return typeof value === 'number' && Number.isFinite(value) ? value : DROPPED
    case 'INTEGER':
    case 'INT64':
      return Number.isInteger(value) ? value : DROPPED
    case 'BOOLEAN':
    case 'BOOL':
      return typeof value === 'boolean' ? value : DROPPED
    case 'TIMESTAMP':
      return coerceTimestamp(value)
    default:
      return value
  }
}

function coerceTimestamp(value: unknown): unknown {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? DROPPED : value
  }
  if (typeof value !== 'string') {
    return DROPPED
  }
  // ISO 8601 strings go through unchanged so BigQuery applies its own (UTC) parsing
  if (TIMESTAMP_PATTERNS.ISO_8601.test(value)) {
    return value
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? DROPPED : date
}

/**
 * Fits a row to a table schema without changing the schema.
 *
 * BigQuery can't change a column's type after creation, so a value whose type
 * differs from its column (e.g. 9.99 for an INTEGER column) is converted when
 * that's lossless and dropped otherwise, letting the rest of the row insert.
 *
 * @param row - The row to insert
 * @param schema - The table's current schema
 * @returns The coerced row and the columns whose values were dropped
 */
export function coerceRowToSchema(row: Record<string, unknown>, schema: TableSchema): CoercedRow {
  const columnTypes = new Map<string, string>()
  for (const field of schema.fields || []) {
    if (field.name && field.type) {
      columnTypes.set(field.name, field.type)
    }
  }

  const coercedRow: Record<string, unknown> = {}
  const droppedColumns: string[] = []

  for (const [column, value] of Object.entries(row)) {
    const columnType = columnTypes.get(column)
    if (value === null || value === undefined || !columnType) {
      coercedRow[column] = value
      continue
    }

    const coerced = coerceValue(value, columnType)
    if (coerced === DROPPED) {
      droppedColumns.push(column)
    } else {
      coercedRow[column] = coerced
    }
  }

  return { row: coercedRow, droppedColumns }
}
