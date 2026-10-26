import type { InsertRow, InsertRowsOptions } from '@google-cloud/bigquery'

/**
 * `table.insert` gives every row a random insertId unless the rows are passed
 * raw, so rows go raw, keyed by their `id` (the event's messageId). BigQuery
 * then drops, on a best-effort basis, a row whose insertId it received up to a
 * minute earlier, such as a quick client retry or replay of the same event.
 */
export const RAW_INSERT_OPTIONS: InsertRowsOptions = { raw: true }

/**
 * Wraps rows in the raw insert form. Their values are serialized as JSON, which
 * gives Dates the same ISO strings the client's own encoding would.
 */
export function toInsertRows(rows: Array<Record<string, unknown>>): InsertRow[] {
  return rows.map((row) => (typeof row.id === 'string' ? { insertId: row.id, json: row } : { json: row }))
}
