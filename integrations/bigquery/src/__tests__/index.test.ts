import type { TrackPayload } from '@app/spec'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BigQueryIntegration } from '../index'
import { TableManager } from '../utils/table-manager'

// Auto-mock the TableManager
vi.mock('../utils/table-manager')

// Mock the BigQuery client
const mockInsert = vi.fn()
const mockTable = vi.fn((_tableId: string) => ({ insert: mockInsert }))
const mockGetTables = vi.fn()
const mockDataset = vi.fn(() => ({ table: mockTable, getTables: mockGetTables }))
const mockQuery = vi.fn()
const mockBigQueryConstructor = vi.fn()

vi.mock('@google-cloud/bigquery', () => {
  return {
    BigQuery: class MockBigQuery {
      dataset = mockDataset
      query = mockQuery
      constructor(config: unknown) {
        mockBigQueryConstructor(config)
      }
    },
  }
})

describe('BigQueryIntegration', () => {
  const defaultConfig = {
    projectId: 'test-project',
    datasetId: 'test_dataset',
  }

  const createTrackPayload = (overrides: Partial<TrackPayload> = {}): TrackPayload => ({
    type: 'track',
    messageId: 'test-message-id',
    event: 'Product Purchased',
    timestamp: '2023-01-01T12:00:00.000Z',
    userId: 'user123',
    anonymousId: 'anon123',
    properties: { productId: 'prod123', price: 99.99 },
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTables.mockResolvedValue([[]])
    mockQuery.mockResolvedValue([[]])
  })

  describe('with auto table management ENABLED', () => {
    it('should initialize TableManager', () => {
      new BigQueryIntegration({ ...defaultConfig, autoTableManagement: true })
      expect(TableManager).toHaveBeenCalledTimes(1)
    })

    it('should use TableManager to insert records', async () => {
      const integration = new BigQueryIntegration({ ...defaultConfig, autoTableManagement: true })
      const payload = createTrackPayload()
      await integration.track(payload)
      const MockedTableManager = vi.mocked(TableManager)
      const mockTableManagerInstance = MockedTableManager.mock.instances[0] as unknown as {
        insertWithAutoSchema: ReturnType<typeof vi.fn>
      }
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledTimes(2)
      expect(mockTableManagerInstance.insertWithAutoSchema.mock.calls[0]?.[1]).toBe('tracks')
      expect(mockTableManagerInstance.insertWithAutoSchema.mock.calls[1]?.[1]).toBe('product_purchased')
    })

    it('does not create an event-specific row when the canonical tracks write fails', async () => {
      const integration = new BigQueryIntegration({ ...defaultConfig, autoTableManagement: true })
      const MockedTableManager = vi.mocked(TableManager)
      const mockTableManagerInstance = MockedTableManager.mock.instances[0] as unknown as {
        insertWithAutoSchema: ReturnType<typeof vi.fn>
      }
      mockTableManagerInstance.insertWithAutoSchema.mockRejectedValueOnce(new Error('tracks unavailable'))

      await expect(integration.track(createTrackPayload())).rejects.toThrow('tracks unavailable')

      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledTimes(1)
      expect(mockTableManagerInstance.insertWithAutoSchema.mock.calls[0]?.[1]).toBe('tracks')
    })
  })

  describe('with auto table management DISABLED', () => {
    it('should NOT initialize TableManager', () => {
      new BigQueryIntegration({ ...defaultConfig, autoTableManagement: false })
      expect(TableManager).not.toHaveBeenCalled()
    })

    it('should use direct BigQuery client to insert records', async () => {
      const integration = new BigQueryIntegration({ ...defaultConfig, autoTableManagement: false })
      const payload = createTrackPayload()
      await integration.track(payload)

      // Ensure TableManager was not used
      const MockedTableManager = vi.mocked(TableManager)
      expect(MockedTableManager.mock.instances).toHaveLength(0)

      // Ensure direct client was used
      expect(mockBigQueryConstructor).toHaveBeenCalledTimes(1)
      expect(mockDataset).toHaveBeenCalledWith('test_dataset')
      expect(mockTable).toHaveBeenCalledWith('tracks')
      expect(mockTable).toHaveBeenCalledWith('product_purchased')
      expect(mockInsert).toHaveBeenCalledTimes(2)
      expect(mockTable.mock.calls.map(([tableId]) => tableId)).toEqual(['tracks', 'product_purchased'])
    })

    it('should fail gracefully if direct insertion fails', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Schema mismatch'))

      const integration = new BigQueryIntegration({ ...defaultConfig, autoTableManagement: false })
      const payload = createTrackPayload()

      await expect(integration.track(payload)).rejects.toThrow('Schema mismatch')
      expect(mockTable).toHaveBeenCalledTimes(1)
      expect(mockTable).toHaveBeenCalledWith('tracks')
    })
  })

  describe('credentials handling', () => {
    it('should initialize BigQuery client without credentials when none provided', () => {
      new BigQueryIntegration(defaultConfig)

      expect(mockBigQueryConstructor).toHaveBeenCalledWith({
        projectId: 'test-project',
      })
    })

    it('should use credentials when provided in config', () => {
      const mockCredentials = {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----\n',
        client_email: 'test@test-project.iam.gserviceaccount.com',
        client_id: '123456789',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      }

      new BigQueryIntegration({ ...defaultConfig, credentials: mockCredentials })

      expect(mockBigQueryConstructor).toHaveBeenCalledWith({
        projectId: 'test-project',
        credentials: mockCredentials,
      })
    })
  })

  describe('privacy erasure', () => {
    function createTable(
      id: string,
      type: string,
      columns: Array<string | { name: string; type?: string; mode?: string }>
    ) {
      return {
        id,
        getMetadata: vi.fn().mockResolvedValue([
          {
            type,
            schema: {
              fields: columns.map((column) =>
                typeof column === 'string' ? { name: column, type: 'STRING', mode: 'NULLABLE' } : column
              ),
            },
          },
        ]),
      }
    }

    const canonicalTableIds = ['aliases', 'groups', 'identifies', 'pages', 'tracks']

    function getQuery(callIndex: number): string {
      return (mockQuery.mock.calls[callIndex]?.[0] as { query: string }).query
    }

    function expectNoCanonicalDeletes(query: string): void {
      for (const tableId of canonicalTableIds) {
        expect(query).not.toContain(`DELETE FROM \`test-project.test_dataset.${tableId}\``)
      }
    }

    function expectEveryCanonicalDelete(query: string): void {
      for (const tableId of canonicalTableIds) {
        expect(query).toContain(`DELETE FROM \`test-project.test_dataset.${tableId}\``)
      }
    }

    function createCanonicalTables() {
      return [
        createTable('tracks', 'TABLE', ['user_id', 'anonymous_id']),
        createTable('identifies', 'TABLE', ['user_id', 'anonymous_id']),
        createTable('pages', 'TABLE', ['user_id', 'anonymous_id']),
        createTable('groups', 'TABLE', ['user_id', 'anonymous_id']),
        createTable('aliases', 'TABLE', ['user_id', 'previous_id']),
      ]
    }

    it('deletes event-specific tables first and every canonical retry anchor only in the final transaction', async () => {
      mockGetTables.mockResolvedValue([
        [
          ...createCanonicalTables(),
          createTable('product_purchased', 'TABLE', ['user_id']),
          createTable('analytics_view', 'VIEW', ['user_id']),
          createTable('unrelated', 'TABLE', ['event']),
        ],
      ])
      const integration = new BigQueryIntegration(defaultConfig)

      const result = await integration.eraseUser('subject-123')

      expect(result).toEqual({ status: 'erased' })
      expect(mockGetTables).toHaveBeenCalledWith({ autoPaginate: true })
      expect(mockQuery).toHaveBeenCalledTimes(2)

      const [firstOptions] = mockQuery.mock.calls[0] as [
        { query: string; params: Record<string, unknown>; types: Record<string, unknown> },
      ]
      expect(firstOptions.params).toEqual({ userId: 'subject-123' })
      expect(firstOptions.types).toEqual({ userId: 'STRING' })
      expect(firstOptions.query).not.toContain('subject-123')
      expect(firstOptions.query).not.toContain('analytics_view')
      expect(firstOptions.query).toContain('DELETE FROM `test-project.test_dataset.product_purchased`')
      expect(firstOptions.query).toContain('SELECT anonymous_id')
      expect(firstOptions.query).not.toContain('SELECT previous_id')
      expect(firstOptions.query).not.toContain('user_id IN UNNEST')
      expect(firstOptions.query).not.toContain('previous_id IN UNNEST')
      expectNoCanonicalDeletes(firstOptions.query)

      const finalQuery = getQuery(1)
      expectEveryCanonicalDelete(finalQuery)
      expect(finalQuery).not.toContain('DELETE FROM `test-project.test_dataset.product_purchased`')
    })

    it('keeps canonical links when an event-specific batch is blocked by the streaming buffer', async () => {
      mockGetTables.mockResolvedValue([
        [...createCanonicalTables(), createTable('product_purchased', 'TABLE', ['user_id', 'anonymous_id'])],
      ])
      mockQuery.mockRejectedValue(new Error('DELETE would affect rows in the streaming buffer'))
      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.eraseUser('subject-123')).resolves.toEqual({ status: 'pending' })
      expect(mockQuery).toHaveBeenCalledTimes(1)
      expect(getQuery(0)).toContain('DELETE FROM `test-project.test_dataset.product_purchased`')
      expect(getQuery(0)).toContain('ROLLBACK TRANSACTION;')
      expectNoCanonicalDeletes(getQuery(0))
    })

    it('batches more than 100 event tables and retains every canonical table through a pending retry', async () => {
      const eventTables = Array.from({ length: 101 }, (_, index) =>
        createTable(`event_${index.toString().padStart(3, '0')}`, 'TABLE', ['user_id', 'anonymous_id'])
      )
      mockGetTables.mockResolvedValue([[...createCanonicalTables(), ...eventTables]])
      mockQuery
        .mockResolvedValueOnce([[]])
        .mockRejectedValueOnce(new Error('DELETE would affect rows in the streaming buffer'))
      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.eraseUser('subject-123')).resolves.toEqual({ status: 'pending' })
      expect(mockQuery).toHaveBeenCalledTimes(2)
      expectNoCanonicalDeletes(getQuery(0))
      expectNoCanonicalDeletes(getQuery(1))

      await expect(integration.eraseUser('subject-123')).resolves.toEqual({ status: 'erased' })
      expect(mockQuery).toHaveBeenCalledTimes(5)

      expectNoCanonicalDeletes(getQuery(2))
      expectNoCanonicalDeletes(getQuery(3))
      expectEveryCanonicalDelete(getQuery(4))
      expect((getQuery(2).match(/DELETE FROM/g) ?? []).length).toBe(100)
      expect((getQuery(3).match(/DELETE FROM/g) ?? []).length).toBe(1)
      expect((getQuery(4).match(/DELETE FROM/g) ?? []).length).toBe(5)
    })

    it('builds and validates every batch before the first mutation', async () => {
      const safeEventTables = Array.from({ length: 100 }, (_, index) =>
        createTable(`event_${index.toString().padStart(3, '0')}`, 'TABLE', ['user_id'])
      )
      mockGetTables.mockResolvedValue([
        [...createCanonicalTables(), ...safeEventTables, createTable('unsafe`; DELETE', 'TABLE', ['user_id'])],
      ])
      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.eraseUser('subject-123')).rejects.toThrow('Invalid BigQuery dataset or table identifier')
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('propagates non-streaming deletion errors without deleting canonical links', async () => {
      mockGetTables.mockResolvedValue([
        [...createCanonicalTables(), createTable('product_purchased', 'TABLE', ['user_id', 'anonymous_id'])],
      ])
      mockQuery.mockRejectedValueOnce(new Error('permission denied'))
      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.eraseUser('subject-123')).rejects.toThrow('permission denied')
      expect(mockQuery).toHaveBeenCalledTimes(1)
      expectNoCanonicalDeletes(getQuery(0))
    })

    it.each([
      [{ name: 'user_id', type: 'INT64', mode: 'NULLABLE' }, 'must have type STRING'],
      [{ name: 'anonymous_id', type: 'STRING', mode: 'REPEATED' }, 'must not be repeated'],
    ])('fails closed for an invalid identity schema', async (column, message) => {
      mockGetTables.mockResolvedValue([[createTable('tracks', 'TABLE', [column])]])
      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.eraseUser('subject-123')).rejects.toThrow(message)
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('fails closed for malformed physical-table metadata', async () => {
      mockGetTables.mockResolvedValue([
        [
          {
            id: 'tracks',
            getMetadata: vi.fn().mockResolvedValue([{ type: 'TABLE', schema: {} }]),
          },
        ],
      ])
      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.eraseUser('subject-123')).rejects.toThrow(
        'BigQuery table tracks returned invalid schema metadata'
      )
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('skips views and returns erased without a mutation when no physical table bears identities', async () => {
      mockGetTables.mockResolvedValue([
        [createTable('analytics_view', 'VIEW', [{ name: 'user_id' }]), createTable('events', 'TABLE', ['event'])],
      ])
      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.eraseUser('subject-123')).resolves.toEqual({ status: 'erased' })
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })
})
