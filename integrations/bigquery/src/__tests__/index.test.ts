import type { TrackPayload } from '@app/spec'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BigQueryIntegration } from '../index'
import { TableManager } from '../utils/table-manager'

// Auto-mock the TableManager
vi.mock('../utils/table-manager')

// Mock the BigQuery client
const mockInsert = vi.fn()
const mockTable = vi.fn(() => ({ insert: mockInsert }))
const mockGetTables = vi.fn()
const mockQuery = vi.fn()
const mockDataset = vi.fn(() => ({ table: mockTable, getTables: mockGetTables }))
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
    })

    it('should fail gracefully if direct insertion fails', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Schema mismatch'))

      const integration = new BigQueryIntegration({ ...defaultConfig, autoTableManagement: false })
      const payload = createTrackPayload()

      await expect(integration.track(payload)).rejects.toThrow('Schema mismatch')
    })
  })

  describe('canonical-first track writes', () => {
    it('writes the tracks anchor row before event-specific rows', async () => {
      const order: string[] = []
      mockInsert.mockImplementation(() => {
        const lastTableCall = mockTable.mock.calls.at(-1) as unknown as [string]
        order.push(lastTableCall[0])
        return Promise.resolve()
      })

      const integration = new BigQueryIntegration({ ...defaultConfig, autoTableManagement: false })
      await integration.track(createTrackPayload())

      expect(order[0]).toBe('tracks')
      expect(order).toContain('product_purchased')
    })

    it('does not write event-specific rows when the tracks anchor write fails', async () => {
      mockInsert.mockRejectedValueOnce(new Error('anchor failed'))

      const integration = new BigQueryIntegration({ ...defaultConfig, autoTableManagement: false })

      await expect(integration.track(createTrackPayload())).rejects.toThrow('anchor failed')
      expect(mockInsert).toHaveBeenCalledTimes(1)
      expect(mockTable).toHaveBeenCalledWith('tracks')
      expect(mockTable).not.toHaveBeenCalledWith('product_purchased')
    })
  })

  describe('deleteUsers', () => {
    const subjectIds = ['user_12345']

    const openTrackFields = (identityNames: string[]) => [
      { name: 'id', type: 'STRING' },
      { name: 'received_at', type: 'TIMESTAMP' },
      ...identityNames.map((name) => ({ name, type: 'STRING', mode: 'NULLABLE' })),
    ]

    const fakeTable = (id: string, metadata: Record<string, unknown>) => ({
      id,
      getMetadata: vi.fn().mockResolvedValue([metadata]),
    })

    const standardTables = () => [
      fakeTable('tracks', { type: 'TABLE', schema: { fields: openTrackFields(['user_id', 'anonymous_id']) } }),
      fakeTable('identifies', { type: 'TABLE', schema: { fields: openTrackFields(['user_id', 'anonymous_id']) } }),
      fakeTable('aliases', { type: 'TABLE', schema: { fields: openTrackFields(['user_id', 'previous_id']) } }),
      fakeTable('product_purchased', {
        type: 'TABLE',
        schema: { fields: openTrackFields(['user_id', 'anonymous_id']) },
      }),
    ]

    function deletedTables(): string[] {
      return mockQuery.mock.calls
        .map((call) => (call[0] as { query: string }).query)
        .filter((query) => query.startsWith('DELETE'))
        .map((query) => /`(?:[^.]+\.){2}(\w+)`/.exec(query)?.[1] as string)
    }

    it('discovers anonymous ids then deletes event tables before canonical anchors, tracks last', async () => {
      mockGetTables.mockResolvedValue([standardTables()])
      mockQuery.mockImplementation(({ query }: { query: string }) =>
        query.startsWith('SELECT') ? Promise.resolve([[{ anonymous_id: 'anon_777' }]]) : Promise.resolve([[]])
      )

      const integration = new BigQueryIntegration(defaultConfig)
      const result = await integration.deleteUsers(subjectIds)

      expect(result).toEqual({ status: 'FINISHED', skippedTables: [] })
      expect(deletedTables()).toEqual(['product_purchased', 'aliases', 'identifies', 'tracks'])

      const deleteCall = mockQuery.mock.calls.find((call) => (call[0] as { query: string }).query.startsWith('DELETE'))
      expect(deleteCall?.[0]).toMatchObject({
        params: { subjectIds, anonymousIds: ['user_12345', 'anon_777'] },
        types: { subjectIds: ['STRING'], anonymousIds: ['STRING'] },
      })
    })

    it('skips foreign tables and views instead of mutating or failing on them', async () => {
      mockGetTables.mockResolvedValue([
        [
          ...standardTables(),
          fakeTable('billing_accounts', {
            type: 'TABLE',
            schema: { fields: [{ name: 'user_id', type: 'INT64' }] },
          }),
          fakeTable('tracks_view', { type: 'VIEW', schema: { fields: openTrackFields(['user_id']) } }),
        ],
      ])
      mockQuery.mockResolvedValue([[]])

      const integration = new BigQueryIntegration(defaultConfig)
      const result = await integration.deleteUsers(subjectIds)

      expect(result.status).toBe('FINISHED')
      expect(result.skippedTables).toEqual(['billing_accounts'])
      expect(deletedTables()).not.toContain('billing_accounts')
      expect(deletedTables()).not.toContain('tracks_view')
    })

    it('fails closed when an OpenTrack-shaped table has a malformed identity column', async () => {
      mockGetTables.mockResolvedValue([
        [
          fakeTable('tracks', {
            type: 'TABLE',
            schema: {
              fields: [
                { name: 'id', type: 'STRING' },
                { name: 'received_at', type: 'TIMESTAMP' },
                { name: 'user_id', type: 'INT64' },
              ],
            },
          }),
        ],
      ])

      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.deleteUsers(subjectIds)).rejects.toThrow(/must have type STRING/)
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('returns RUNNING and preserves every canonical anchor when an event table is still buffered', async () => {
      mockGetTables.mockResolvedValue([standardTables()])
      mockQuery.mockImplementation(({ query }: { query: string }) => {
        if (query.startsWith('SELECT')) {
          return Promise.resolve([[]])
        }
        if (query.includes('product_purchased')) {
          return Promise.reject(new Error('rows in the streaming buffer'))
        }
        return Promise.resolve([[]])
      })

      const integration = new BigQueryIntegration(defaultConfig)
      const result = await integration.deleteUsers(subjectIds)

      expect(result.status).toBe('RUNNING')
      expect(deletedTables()).toEqual(['product_purchased'])
    })

    it('returns RUNNING and keeps later anchors when a canonical delete is buffered', async () => {
      mockGetTables.mockResolvedValue([standardTables()])
      mockQuery.mockImplementation(({ query }: { query: string }) => {
        if (query.startsWith('SELECT')) {
          return Promise.resolve([[]])
        }
        if (query.includes('identifies')) {
          return Promise.reject(new Error('rows in the streaming buffer'))
        }
        return Promise.resolve([[]])
      })

      const integration = new BigQueryIntegration(defaultConfig)
      const result = await integration.deleteUsers(subjectIds)

      expect(result.status).toBe('RUNNING')
      // `tracks`, the richest discovery anchor, must not be deleted after a deferral.
      expect(deletedTables()).not.toContain('tracks')
    })

    it('rethrows non-streaming-buffer failures', async () => {
      mockGetTables.mockResolvedValue([standardTables()])
      mockQuery.mockImplementation(({ query }: { query: string }) =>
        query.startsWith('SELECT') ? Promise.resolve([[]]) : Promise.reject(new Error('Permission denied'))
      )

      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.deleteUsers(subjectIds)).rejects.toThrow('Permission denied')
    })

    it('finishes immediately when the dataset has no OpenTrack tables', async () => {
      mockGetTables.mockResolvedValue([[]])

      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.deleteUsers(subjectIds)).resolves.toEqual({
        status: 'FINISHED',
        skippedTables: [],
      })
      expect(mockQuery).not.toHaveBeenCalled()
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
})
