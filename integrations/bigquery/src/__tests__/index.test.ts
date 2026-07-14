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
    mockQuery.mockImplementation(({ query }: { query: string }) =>
      Promise.resolve(query.startsWith('SELECT') ? [[{ count: 0 }]] : [[]])
    )
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
    function createTable(id: string, type: string, columns: string[]) {
      return {
        id,
        getMetadata: vi.fn().mockResolvedValue([
          {
            type,
            schema: { fields: columns.map((name) => ({ name })) },
          },
        ]),
      }
    }

    it('enumerates every physical identity-bearing table while skipping views', async () => {
      mockGetTables.mockResolvedValue([
        [
          createTable('tracks', 'TABLE', ['user_id', 'anonymous_id']),
          createTable('product_purchased', 'TABLE', ['user_id']),
          createTable('aliases', 'TABLE', ['user_id', 'previous_id']),
          createTable('analytics_view', 'VIEW', ['user_id']),
          createTable('unrelated', 'TABLE', ['event']),
        ],
      ])
      const integration = new BigQueryIntegration(defaultConfig)

      const result = await integration.eraseUser('subject-123')

      expect(result).toEqual({ status: 'erased', remainingRows: 0, pendingTableCount: 0 })
      expect(mockGetTables).toHaveBeenCalledWith({ autoPaginate: true })
      expect(mockQuery).toHaveBeenCalledTimes(6)

      const queries = mockQuery.mock.calls.map(
        ([options]) => options as { query: string; params: Record<string, unknown> }
      )
      expect(queries.every(({ params }) => params.userId === 'subject-123')).toBe(true)
      expect(queries.every(({ query }) => !query.includes('subject-123'))).toBe(true)
      expect(queries.some(({ query }) => query.includes('analytics_view'))).toBe(false)
      expect(queries.some(({ query }) => query.includes('product_purchased'))).toBe(true)
      expect(queries.some(({ query }) => query.includes('previous_id = @userId'))).toBe(true)
    })

    it('returns pending when insertAll rows are still in the streaming buffer', async () => {
      mockGetTables.mockResolvedValue([[createTable('tracks', 'TABLE', ['user_id'])]])
      mockQuery.mockImplementation(({ query }: { query: string }) => {
        if (query.startsWith('DELETE')) {
          return Promise.reject(new Error('DELETE would affect rows in the streaming buffer'))
        }
        return Promise.resolve([[{ count: 1 }]])
      })
      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.eraseUser('subject-123')).resolves.toEqual({
        status: 'pending',
        remainingRows: 1,
        pendingTableCount: 1,
      })
    })

    it('propagates non-streaming deletion errors', async () => {
      mockGetTables.mockResolvedValue([[createTable('tracks', 'TABLE', ['user_id'])]])
      mockQuery.mockRejectedValueOnce(new Error('permission denied'))
      const integration = new BigQueryIntegration(defaultConfig)

      await expect(integration.eraseUser('subject-123')).rejects.toThrow('permission denied')
    })
  })
})
