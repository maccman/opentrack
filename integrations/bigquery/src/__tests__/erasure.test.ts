import { describe, expect, it } from 'vitest'

import {
  BIGQUERY_ERASURE_TRANSACTION_TABLE_LIMIT,
  buildBigQueryErasureBatchScript,
  getBigQueryIdentityColumns,
  partitionBigQueryErasureTables,
} from '../erasure'

describe('BigQuery erasure planning', () => {
  it('resolves only anonymous identifiers directly observed with the requested user root', () => {
    const query = buildBigQueryErasureBatchScript({
      projectId: 'test-project',
      datasetId: 'test_dataset',
      canonicalTables: [
        { tableId: 'tracks', identityColumns: ['user_id', 'anonymous_id'] },
        { tableId: 'aliases', identityColumns: ['user_id', 'previous_id'] },
      ],
      mutationTables: [{ tableId: 'product_purchased', identityColumns: ['user_id', 'anonymous_id', 'previous_id'] }],
    })

    expect(query).toContain('SELECT anonymous_id')
    expect(query).not.toContain('SELECT previous_id')
    expect(query).toContain('WHERE user_id = @userId')
    expect(query).toContain('DELETE FROM `test-project.test_dataset.product_purchased`')
    expect(query).toContain(
      'WHERE user_id = @userId OR anonymous_id IN UNNEST(erasable_anonymous_ids) OR previous_id = @userId;'
    )
  })

  it('never promotes a browser-supplied alias into another user_id root', () => {
    const query = buildBigQueryErasureBatchScript({
      projectId: 'test-project',
      datasetId: 'test_dataset',
      canonicalTables: [{ tableId: 'aliases', identityColumns: ['user_id', 'previous_id'] }],
      mutationTables: [{ tableId: 'aliases', identityColumns: ['user_id', 'previous_id'] }],
    })

    expect(query).toContain('user_id = @userId')
    expect(query).toContain('previous_id = @userId')
    expect(query).not.toContain('user_id IN UNNEST')
    expect(query).not.toContain('previous_id IN UNNEST')
    expect(query).not.toContain('SELECT previous_id')
    expect(query).not.toContain('privacy_identity_edges')
    expect(query).not.toContain('ARRAY_CONCAT')
    expect(query).not.toContain('LOOP')
  })

  it('builds one rollback-safe transaction for each mutation batch', () => {
    const query = buildBigQueryErasureBatchScript({
      projectId: 'test-project',
      datasetId: 'test_dataset',
      canonicalTables: [{ tableId: 'tracks', identityColumns: ['user_id', 'anonymous_id'] }],
      mutationTables: [{ tableId: 'checkout_started', identityColumns: ['user_id', 'anonymous_id'] }],
    })

    expect(query).toContain('DECLARE erasable_anonymous_ids ARRAY<STRING> DEFAULT [@userId];')
    expect(query).toContain('BEGIN TRANSACTION;')
    expect(query).toContain('COMMIT TRANSACTION;')
    expect(query).toContain('EXCEPTION WHEN ERROR THEN\n  ROLLBACK TRANSACTION;\n  RAISE;')
  })

  it('keeps the five canonical OpenTrack tables separate from event-specific tables', () => {
    const partition = partitionBigQueryErasureTables([
      { tableId: 'product_purchased', identityColumns: ['user_id'] },
      { tableId: 'tracks', identityColumns: ['user_id'] },
      { tableId: 'aliases', identityColumns: ['user_id', 'previous_id'] },
      { tableId: 'pages', identityColumns: ['user_id', 'anonymous_id'] },
      { tableId: 'identifies', identityColumns: ['user_id', 'anonymous_id'] },
      { tableId: 'groups', identityColumns: ['user_id', 'anonymous_id'] },
      { tableId: 'checkout_started', identityColumns: ['anonymous_id'] },
    ])

    expect(partition.canonicalTables.map((table) => table.tableId)).toEqual([
      'aliases',
      'groups',
      'identifies',
      'pages',
      'tracks',
    ])
    expect(partition.eventSpecificTables.map((table) => table.tableId)).toEqual([
      'checkout_started',
      'product_purchased',
    ])
  })

  it('uses only the requested root when canonical tables contain no direct link column', () => {
    const query = buildBigQueryErasureBatchScript({
      projectId: 'test-project',
      datasetId: 'test_dataset',
      canonicalTables: [{ tableId: 'identifies', identityColumns: ['user_id'] }],
      mutationTables: [{ tableId: 'user_traits', identityColumns: ['user_id'] }],
    })

    expect(query).toContain('SELECT @userId AS anonymous_id')
    expect(query).not.toContain('FROM `test-project.test_dataset.identifies`')
    expect(query).toContain('WHERE user_id = @userId;')
  })

  it("rejects an individual batch above BigQuery's 100-table mutation limit", () => {
    const mutationTables = Array.from({ length: BIGQUERY_ERASURE_TRANSACTION_TABLE_LIMIT + 1 }, (_, index) => ({
      tableId: `event_${index}`,
      identityColumns: ['user_id'] as ['user_id'],
    }))

    expect(() =>
      buildBigQueryErasureBatchScript({
        projectId: 'test-project',
        datasetId: 'test_dataset',
        canonicalTables: [],
        mutationTables,
      })
    ).toThrow('batch cannot atomically mutate more than 100 tables')
  })

  it('quotes validated table paths and rejects unsafe identifiers', () => {
    const query = buildBigQueryErasureBatchScript({
      projectId: 'test-project',
      datasetId: 'test_dataset',
      canonicalTables: [],
      mutationTables: [{ tableId: 'product_purchased', identityColumns: ['user_id'] }],
    })

    expect(query).toContain('`test-project.test_dataset.product_purchased`')
    expect(() =>
      buildBigQueryErasureBatchScript({
        projectId: 'test-project',
        datasetId: 'test_dataset',
        canonicalTables: [],
        mutationTables: [{ tableId: 'events`; DELETE FROM secrets; --', identityColumns: ['user_id'] }],
      })
    ).toThrow('Invalid BigQuery dataset or table identifier')
  })
})

describe('BigQuery identity schema validation', () => {
  it('returns identity columns in canonical order and ignores ordinary fields', () => {
    expect(
      getBigQueryIdentityColumns('tracks', [
        { name: 'anonymous_id', type: 'STRING', mode: 'NULLABLE' },
        { name: 'event', type: 'STRING', mode: 'REQUIRED' },
        { name: 'user_id', type: 'string', mode: 'required' },
        { name: 'previous_id', type: 'STRING' },
      ])
    ).toEqual(['user_id', 'anonymous_id', 'previous_id'])
  })

  it('fails closed for non-string identity columns', () => {
    expect(() => getBigQueryIdentityColumns('tracks', [{ name: 'user_id', type: 'INT64', mode: 'NULLABLE' }])).toThrow(
      'tracks.user_id must have type STRING'
    )
  })

  it('fails closed for repeated identity columns', () => {
    expect(() =>
      getBigQueryIdentityColumns('tracks', [{ name: 'anonymous_id', type: 'STRING', mode: 'REPEATED' }])
    ).toThrow('tracks.anonymous_id must not be repeated')
  })
})
