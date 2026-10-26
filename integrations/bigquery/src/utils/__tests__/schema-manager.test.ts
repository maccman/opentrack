import type { TableSchema } from '@google-cloud/bigquery'
import { describe, expect, it } from 'vitest'

import { detectBigQueryType, generateSchemaFromRow, getBaseSchemaForTable, mergeSchemas } from '../schema-manager'

describe('detectBigQueryType', () => {
  it('should detect boolean types', () => {
    expect(detectBigQueryType(true)).toBe('BOOLEAN')
    expect(detectBigQueryType(false)).toBe('BOOLEAN')
  })

  it('should map whole numbers to FLOAT so later decimals still fit the column', () => {
    expect(detectBigQueryType(123)).toBe('FLOAT')
    expect(detectBigQueryType(0)).toBe('FLOAT')
    expect(detectBigQueryType(-456)).toBe('FLOAT')
  })

  it('should detect float types', () => {
    expect(detectBigQueryType(123.45)).toBe('FLOAT')
    expect(detectBigQueryType(0.1)).toBe('FLOAT')
    expect(detectBigQueryType(-456.789)).toBe('FLOAT')
  })

  it('should detect string types', () => {
    expect(detectBigQueryType('hello')).toBe('STRING')
    expect(detectBigQueryType('')).toBe('STRING')
    expect(detectBigQueryType('123')).toBe('STRING')
  })

  it('should detect timestamp strings', () => {
    expect(detectBigQueryType('2023-01-01T12:00:00.000Z')).toBe('TIMESTAMP')
    expect(detectBigQueryType('2023-01-01T12:00:00Z')).toBe('TIMESTAMP')
    expect(detectBigQueryType('2023-01-01T12:00:00')).toBe('TIMESTAMP')
  })

  it('should detect Date objects as timestamps', () => {
    expect(detectBigQueryType(new Date())).toBe('TIMESTAMP')
  })

  it('should detect arrays as strings (JSON)', () => {
    expect(detectBigQueryType([1, 2, 3])).toBe('STRING')
    expect(detectBigQueryType(['a', 'b'])).toBe('STRING')
  })

  it('should detect objects as strings (JSON)', () => {
    expect(detectBigQueryType({ key: 'value' })).toBe('STRING')
    expect(detectBigQueryType({})).toBe('STRING')
  })

  it('should handle null/undefined values', () => {
    expect(detectBigQueryType(null)).toBe('STRING')
    expect(detectBigQueryType(undefined)).toBe('STRING')
  })
})

describe('generateSchemaFromRow', () => {
  it('should generate schema from simple row', () => {
    const row = {
      id: 'test-123',
      count: 42,
      active: true,
      price: 99.99,
    }

    const schema = generateSchemaFromRow(row)

    expect(schema.fields).toHaveLength(4)
    expect(schema.fields).toContainEqual({
      name: 'id',
      type: 'STRING',
      mode: 'NULLABLE',
    })
    expect(schema.fields).toContainEqual({
      name: 'count',
      type: 'FLOAT',
      mode: 'NULLABLE',
    })
    expect(schema.fields).toContainEqual({
      name: 'active',
      type: 'BOOLEAN',
      mode: 'NULLABLE',
    })
    expect(schema.fields).toContainEqual({
      name: 'price',
      type: 'FLOAT',
      mode: 'NULLABLE',
    })
  })

  it('should handle complex data types', () => {
    const row = {
      timestamp: '2023-01-01T12:00:00.000Z',
      metadata: { key: 'value' },
      tags: ['tag1', 'tag2'],
      date: new Date(),
      empty: null,
    }

    const schema = generateSchemaFromRow(row)

    expect(schema.fields).toHaveLength(5)
    expect(schema.fields).toContainEqual({
      name: 'timestamp',
      type: 'TIMESTAMP',
      mode: 'NULLABLE',
    })
    expect(schema.fields).toContainEqual({
      name: 'metadata',
      type: 'STRING',
      mode: 'NULLABLE',
    })
    expect(schema.fields).toContainEqual({
      name: 'tags',
      type: 'STRING',
      mode: 'NULLABLE',
    })
    expect(schema.fields).toContainEqual({
      name: 'date',
      type: 'TIMESTAMP',
      mode: 'NULLABLE',
    })
    expect(schema.fields).toContainEqual({
      name: 'empty',
      type: 'STRING',
      mode: 'NULLABLE',
    })
  })
})

describe('mergeSchemas', () => {
  it('should add new fields from new schema', () => {
    const existingSchema: TableSchema = {
      fields: [
        { name: 'id', type: 'STRING', mode: 'NULLABLE' },
        { name: 'count', type: 'INTEGER', mode: 'NULLABLE' },
      ],
    }

    const newSchema: TableSchema = {
      fields: [
        { name: 'id', type: 'STRING', mode: 'NULLABLE' },
        { name: 'count', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'active', type: 'BOOLEAN', mode: 'NULLABLE' },
      ],
    }

    const { schema: mergedSchema, hasChanges } = mergeSchemas(existingSchema, newSchema)

    expect(hasChanges).toBe(true)
    expect(mergedSchema.fields).toHaveLength(3)
    expect(mergedSchema.fields).toContainEqual({
      name: 'active',
      type: 'BOOLEAN',
      mode: 'NULLABLE',
    })
  })

  it('should never change an existing column type, which BigQuery rejects', () => {
    const existingSchema: TableSchema = {
      fields: [
        { name: 'number_field', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'bool_field', type: 'BOOLEAN', mode: 'NULLABLE' },
        { name: 'timestamp_field', type: 'TIMESTAMP', mode: 'NULLABLE' },
      ],
    }

    const newSchema: TableSchema = {
      fields: [
        { name: 'number_field', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'bool_field', type: 'STRING', mode: 'NULLABLE' },
        { name: 'timestamp_field', type: 'STRING', mode: 'NULLABLE' },
      ],
    }

    const { schema: mergedSchema, hasChanges } = mergeSchemas(existingSchema, newSchema)

    expect(hasChanges).toBe(false)
    expect(mergedSchema.fields).toEqual(existingSchema.fields)
  })

  it('should relax REQUIRED columns the new row does not provide', () => {
    const existingSchema: TableSchema = {
      fields: [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      ],
    }

    const newSchema: TableSchema = {
      fields: [
        { name: 'id', type: 'STRING', mode: 'NULLABLE' },
        { name: 'anonymous_id', type: 'STRING', mode: 'NULLABLE' },
      ],
    }

    const { schema: mergedSchema, hasChanges } = mergeSchemas(existingSchema, newSchema)

    expect(hasChanges).toBe(true)
    expect(mergedSchema.fields).toEqual([
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'NULLABLE' },
      { name: 'anonymous_id', type: 'STRING', mode: 'NULLABLE' },
    ])
  })

  it('should return no changes when schemas are identical', () => {
    const schema: TableSchema = {
      fields: [
        { name: 'id', type: 'STRING', mode: 'NULLABLE' },
        { name: 'count', type: 'INTEGER', mode: 'NULLABLE' },
      ],
    }

    const { hasChanges } = mergeSchemas(schema, schema)
    expect(hasChanges).toBe(false)
  })
})

describe('getBaseSchemaForTable', () => {
  it('should return tracks schema', () => {
    const schema = getBaseSchemaForTable('tracks')

    expect(schema.fields).toBeDefined()
    expect(schema.fields!.length).toBeGreaterThan(5)

    // Should have common fields
    expect(schema.fields).toContainEqual({
      name: 'id',
      type: 'STRING',
      mode: 'REQUIRED',
    })
    expect(schema.fields).toContainEqual({
      name: 'user_id',
      type: 'STRING',
      mode: 'NULLABLE',
    })

    // Should have track-specific fields
    expect(schema.fields).toContainEqual({
      name: 'event',
      type: 'STRING',
      mode: 'REQUIRED',
    })
  })

  it('should return identifies schema', () => {
    const schema = getBaseSchemaForTable('identifies')

    expect(schema.fields).toBeDefined()

    // user_id is optional so anonymous identify calls can be stored
    const userIdField = schema.fields!.find((f) => f.name === 'user_id')
    expect(userIdField?.mode).toBe('NULLABLE')
  })

  it('should return pages schema', () => {
    const schema = getBaseSchemaForTable('pages')

    expect(schema.fields).toBeDefined()

    // Should have page-specific fields
    expect(schema.fields).toContainEqual({
      name: 'name',
      type: 'STRING',
      mode: 'NULLABLE',
    })
    expect(schema.fields).toContainEqual({
      name: 'url',
      type: 'STRING',
      mode: 'NULLABLE',
    })
  })

  it('should return groups schema', () => {
    const schema = getBaseSchemaForTable('groups')

    expect(schema.fields).toBeDefined()

    // Should have group-specific fields
    expect(schema.fields).toContainEqual({
      name: 'group_id',
      type: 'STRING',
      mode: 'REQUIRED',
    })
  })

  it('should return aliases schema', () => {
    const schema = getBaseSchemaForTable('aliases')

    expect(schema.fields).toBeDefined()

    // Should have alias-specific fields
    expect(schema.fields).toContainEqual({
      name: 'previous_id',
      type: 'STRING',
      mode: 'REQUIRED',
    })

    // Should have user_id as required for aliases
    const userIdField = schema.fields!.find((f) => f.name === 'user_id')
    expect(userIdField?.mode).toBe('REQUIRED')
  })

  it('should return track-like schema for custom event tables', () => {
    const schema = getBaseSchemaForTable('product_purchased')

    expect(schema.fields).toBeDefined()

    // Should have track-specific fields since it's not a standard table type
    expect(schema.fields).toContainEqual({
      name: 'event',
      type: 'STRING',
      mode: 'REQUIRED',
    })
  })

  it('should support payload type keys', () => {
    const trackSchema = getBaseSchemaForTable('track')
    expect(trackSchema.fields).toContainEqual({
      name: 'event',
      type: 'STRING',
      mode: 'REQUIRED',
    })

    const pageSchema = getBaseSchemaForTable('page')
    expect(pageSchema.fields).toContainEqual({
      name: 'name',
      type: 'STRING',
      mode: 'NULLABLE',
    })

    const identifySchema = getBaseSchemaForTable('identify')
    const userIdField = identifySchema.fields!.find((f) => f.name === 'user_id')
    expect(userIdField?.mode).toBe('NULLABLE')
  })
})
