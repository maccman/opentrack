import { describe, expect, it } from 'vitest'

import {
  buildAnonymousIdDiscoveryQuery,
  buildDeleteStatement,
  type DeletableTable,
  getDeletionIdentityColumns,
  isOpenTrackTable,
  isStreamingBufferError,
  orderTablesForDeletion,
  quoteTablePath,
} from '../deletion'

const PROJECT = 'test-project'
const DATASET = 'test_dataset'

function openTrackFields(identityFields: { name: string; type?: string; mode?: string }[]) {
  return [
    { name: 'id', type: 'STRING' },
    { name: 'received_at', type: 'TIMESTAMP' },
    ...identityFields.map((field) => ({ type: 'STRING', ...field })),
  ]
}

describe('isOpenTrackTable', () => {
  it('accepts tables carrying the OpenTrack base columns', () => {
    expect(isOpenTrackTable('tracks', openTrackFields([{ name: 'user_id' }]))).toBe(true)
  })

  it('rejects tables missing the base columns', () => {
    expect(isOpenTrackTable('billing', [{ name: 'user_id', type: 'STRING' }])).toBe(false)
  })

  it('rejects table names OpenTrack could not have created', () => {
    expect(isOpenTrackTable('my-events', openTrackFields([{ name: 'user_id' }]))).toBe(false)
  })

  it('rejects invalid schema metadata', () => {
    expect(isOpenTrackTable('tracks', null)).toBe(false)
    expect(isOpenTrackTable('tracks', 'not-fields')).toBe(false)
  })
})

describe('getDeletionIdentityColumns', () => {
  it('returns present identity columns in deterministic order', () => {
    const fields = openTrackFields([{ name: 'anonymous_id' }, { name: 'user_id' }])
    expect(getDeletionIdentityColumns('tracks', fields)).toEqual(['user_id', 'anonymous_id'])
  })

  it('throws when an identity column is not a STRING', () => {
    const fields = openTrackFields([{ name: 'user_id', type: 'INT64' }])
    expect(() => getDeletionIdentityColumns('tracks', fields)).toThrow(/must have type STRING/)
  })

  it('throws when an identity column is repeated', () => {
    const fields = openTrackFields([{ name: 'anonymous_id', mode: 'REPEATED' }])
    expect(() => getDeletionIdentityColumns('tracks', fields)).toThrow(/must not be repeated/)
  })

  it('accepts nullable and required modes', () => {
    const fields = openTrackFields([
      { name: 'user_id', mode: 'NULLABLE' },
      { name: 'anonymous_id', mode: 'REQUIRED' },
    ])
    expect(getDeletionIdentityColumns('tracks', fields)).toEqual(['user_id', 'anonymous_id'])
  })

  it('throws on invalid schema fields', () => {
    expect(() => getDeletionIdentityColumns('tracks', null)).toThrow(/invalid schema fields/)
  })
})

describe('quoteTablePath', () => {
  it('quotes valid identifiers', () => {
    expect(quoteTablePath(PROJECT, DATASET, 'tracks')).toBe('`test-project.test_dataset.tracks`')
  })

  it('rejects hostile identifiers', () => {
    expect(() => quoteTablePath('bad project', DATASET, 'tracks')).toThrow(/project identifier/)
    expect(() => quoteTablePath(PROJECT, 'data`set', 'tracks')).toThrow(/dataset or table identifier/)
    expect(() => quoteTablePath(PROJECT, DATASET, 'tracks`;DROP')).toThrow(/dataset or table identifier/)
  })
})

describe('orderTablesForDeletion', () => {
  it('orders event tables first and canonical anchors last with tracks at the very end', () => {
    const tables: DeletableTable[] = [
      { tableId: 'tracks', identityColumns: ['user_id', 'anonymous_id'] },
      { tableId: 'product_purchased', identityColumns: ['user_id', 'anonymous_id'] },
      { tableId: 'identifies', identityColumns: ['user_id', 'anonymous_id'] },
      { tableId: 'aliases', identityColumns: ['user_id', 'previous_id'] },
      { tableId: 'button_clicked', identityColumns: ['user_id', 'anonymous_id'] },
    ]

    const { eventTables, canonicalTables } = orderTablesForDeletion(tables)

    expect(eventTables.map((table) => table.tableId)).toEqual(['button_clicked', 'product_purchased'])
    expect(canonicalTables.map((table) => table.tableId)).toEqual(['aliases', 'identifies', 'tracks'])
  })
})

describe('buildAnonymousIdDiscoveryQuery', () => {
  it('unions the canonical tables that carry both user_id and anonymous_id', () => {
    const tables: DeletableTable[] = [
      { tableId: 'tracks', identityColumns: ['user_id', 'anonymous_id'] },
      { tableId: 'identifies', identityColumns: ['user_id', 'anonymous_id'] },
      { tableId: 'aliases', identityColumns: ['user_id', 'previous_id'] },
      { tableId: 'product_purchased', identityColumns: ['user_id', 'anonymous_id'] },
    ]

    const query = buildAnonymousIdDiscoveryQuery(PROJECT, DATASET, tables)

    expect(query).toContain('`test-project.test_dataset.tracks`')
    expect(query).toContain('`test-project.test_dataset.identifies`')
    // Event-specific and alias tables are not discovery sources.
    expect(query).not.toContain('product_purchased')
    expect(query).not.toContain('aliases')
    expect(query).toContain('user_id IN UNNEST(@subjectIds)')
    // Discovery must never follow browser-supplied previous_id links.
    expect(query).not.toContain('previous_id')
  })

  it('returns null when no canonical table carries both identity columns', () => {
    const tables: DeletableTable[] = [{ tableId: 'aliases', identityColumns: ['user_id', 'previous_id'] }]
    expect(buildAnonymousIdDiscoveryQuery(PROJECT, DATASET, tables)).toBeNull()
  })
})

describe('buildDeleteStatement', () => {
  it('matches each identity column with its own parameter list', () => {
    const statement = buildDeleteStatement(PROJECT, DATASET, {
      tableId: 'aliases',
      identityColumns: ['user_id', 'anonymous_id', 'previous_id'],
    })

    expect(statement).toContain('DELETE FROM `test-project.test_dataset.aliases`')
    expect(statement).toContain('user_id IN UNNEST(@subjectIds)')
    expect(statement).toContain('anonymous_id IN UNNEST(@anonymousIds)')
    // previous_id is only ever matched against the trusted subject ids.
    expect(statement).toContain('previous_id IN UNNEST(@subjectIds)')
    expect(statement).not.toContain('previous_id IN UNNEST(@anonymousIds)')
  })

  it('is a single statement without scripting constructs', () => {
    const statement = buildDeleteStatement(PROJECT, DATASET, {
      tableId: 'tracks',
      identityColumns: ['user_id', 'anonymous_id'],
    })

    for (const construct of ['BEGIN', 'DECLARE', 'TRANSACTION', ';']) {
      expect(statement).not.toContain(construct)
    }
  })

  it('throws for tables without identity columns', () => {
    expect(() => buildDeleteStatement(PROJECT, DATASET, { tableId: 'tracks', identityColumns: [] })).toThrow(
      /no identity columns/
    )
  })
})

describe('isStreamingBufferError', () => {
  it('detects streaming buffer errors case-insensitively', () => {
    expect(
      isStreamingBufferError(
        new Error(
          'UPDATE or DELETE statement over table test_dataset.tracks would affect rows in the streaming buffer, which is not supported'
        )
      )
    ).toBe(true)
    expect(isStreamingBufferError(new Error('Streaming Buffer not yet flushed'))).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isStreamingBufferError(new Error('Permission denied'))).toBe(false)
    expect(isStreamingBufferError('plain string failure')).toBe(false)
  })
})
