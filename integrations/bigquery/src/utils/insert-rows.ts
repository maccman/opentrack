import type { InsertRow, InsertRowsOptions } from '@google-cloud/bigquery'

/**
 * `table.insert` gives every row a random insertId unless the rows are passed
 * raw, so rows go raw, keyed by their event's messageId. BigQuery then drops,
 * on a best-effort basis, a row whose insertId it received up to a minute
 * earlier, such as a quick client retry or replay of the same event.
 */
export const RAW_INSERT_OPTIONS: InsertRowsOptions = { raw: true }

/**
 * Wraps rows in the raw insert form, each with the insertId at the same index.
 * Pass the event's messageId, not the row's `id` column: a property or trait
 * named `id` overwrites that column, and distinct events would then share an
 * insertId. Rows without one are inserted without dedupe. Values are serialized
 * as JSON, which gives Dates the same ISO strings the client's own encoding would.
 */
export function toInsertRows(
  rows: Array<Record<string, unknown>>,
  insertIds: Array<string | undefined> = []
): InsertRow[] {
  return rows.map((row, index) => {
    const insertId = insertIds[index]
    return insertId ? { insertId, json: row } : { json: row }
  })
}
