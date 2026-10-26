import type { TableSchema } from '@google-cloud/bigquery'
import { describe, expect, it } from 'vitest'

import { coerceRowToSchema } from '../row-coercer'

const schema: TableSchema = {
  fields: [
    { name: 'label', type: 'STRING', mode: 'NULLABLE' },
    { name: 'price', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'quantity', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'active', type: 'BOOLEAN', mode: 'NULLABLE' },
    { name: 'shipped_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
  ],
}

describe('coerceRowToSchema', () => {
  it('leaves values that already match their column untouched', () => {
    const row = { label: 'a', price: 9.99, quantity: 3, active: true, shipped_at: '2025-01-15T14:30:00.000Z' }

    expect(coerceRowToSchema(row, schema)).toEqual({ row, droppedColumns: [] })
  })

  it('converts numbers, booleans, and dates to strings for STRING columns', () => {
    const date = new Date('2025-01-15T14:30:00.000Z')

    const { row } = coerceRowToSchema({ label: 42 }, schema)
    expect(row.label).toBe('42')
    expect(coerceRowToSchema({ label: false }, schema).row.label).toBe('false')
    expect(coerceRowToSchema({ label: date }, schema).row.label).toBe('2025-01-15T14:30:00.000Z')
  })

  it('stores whole numbers in FLOAT columns', () => {
    expect(coerceRowToSchema({ price: 10 }, schema)).toEqual({ row: { price: 10 }, droppedColumns: [] })
  })

  it('drops values that cannot be represented in the column type', () => {
    const { row, droppedColumns } = coerceRowToSchema(
      { label: 'kept', quantity: 9.99, active: 'yes', price: 'free', shipped_at: 'yesterday' },
      schema
    )

    expect(row).toEqual({ label: 'kept' })
    expect(droppedColumns).toEqual(['quantity', 'active', 'price', 'shipped_at'])
  })

  it('converts parseable non-ISO timestamp strings to dates', () => {
    const { row } = coerceRowToSchema({ shipped_at: '2025-01-15T14:30:00+02:00' }, schema)

    expect(row.shipped_at).toEqual(new Date('2025-01-15T12:30:00.000Z'))
  })

  it('passes through nulls and columns the schema does not know', () => {
    const row = { quantity: null, unknown_column: { nested: true } }

    expect(coerceRowToSchema(row, schema)).toEqual({ row, droppedColumns: [] })
  })
})
