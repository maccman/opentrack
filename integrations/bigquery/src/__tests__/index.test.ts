import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BigQueryIntegration } from '../index'
import { TableManager } from '../utils/table-manager'

// Auto-mock the TableManager
vi.mock('../utils/table-manager')

// Mock the BigQuery client
vi.mock('@google-cloud/bigquery', () => {
  const mockInsert = vi.fn()
  const mockTable = vi.fn(() => ({ insert: mockInsert }))
  const mockDataset = vi.fn(() => ({ table: mockTable }))

  return {
    BigQuery: vi.fn(() => ({
      dataset: mockDataset,
    })),
  }
})

describe('BigQueryIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env = {
      ...process.env,
      BIGQUERY_PROJECT_ID: 'test-project',
      BIGQUERY_DATASET: 'test_dataset',
    }
  })

  // Helper function to create test payloads
  function createTrackPayload(overrides: Partial<TrackPayload> = {}): TrackPayload {
    return {
      type: 'track',
      messageId: 'test-message-id',
      event: 'Product Purchased',
      timestamp: '2023-01-01T12:00:00.000Z',
      userId: 'user123',
      anonymousId: 'anon123',
      properties: {
        productId: 'prod123',
        price: 99.99,
      },
      ...overrides,
    }
  }

  function createIdentifyPayload(): IdentifyPayload {
    return {
      type: 'identify',
      messageId: 'test-message-id',
      timestamp: '2023-01-01T12:00:00.000Z',
      userId: 'user123',
      anonymousId: 'anon123',
      traits: {
        email: 'test@example.com',
        firstName: 'John',
      },
    }
  }

  function createPagePayload(): PagePayload {
    return {
      type: 'page',
      messageId: 'test-message-id',
      timestamp: '2023-01-01T12:00:00.000Z',
      userId: 'user123',
      anonymousId: 'anon123',
      name: 'Home',
    }
  }

  function createGroupPayload(): GroupPayload {
    return {
      type: 'group',
      messageId: 'test-message-id',
      timestamp: '2023-01-01T12:00:00.000Z',
      userId: 'user123',
      anonymousId: 'anon123',
      groupId: 'group123',
    }
  }

  function createAliasPayload(): AliasPayload {
    return {
      type: 'alias',
      messageId: 'test-message-id',
      timestamp: '2023-01-01T12:00:00.000Z',
      userId: 'user123',
      previousId: 'old-user-id',
    }
  }

  describe('initialization', () => {
    it('should initialize when properly configured', () => {
      const integration = new BigQueryIntegration()
      expect(integration.name).toBe('BigQuery')
      expect(integration.isEnabled()).toBe(true)
      expect(TableManager).toHaveBeenCalledTimes(1)
    })

    it('should not be enabled without required environment variables', () => {
      delete process.env.BIGQUERY_PROJECT_ID
      const integration = new BigQueryIntegration()
      expect(integration.isEnabled()).toBe(false)
      expect(TableManager).not.toHaveBeenCalled()
    })
  })

  describe('track events', () => {
    it('should insert track events into both tracks and event-specific tables', async () => {
      const integration = new BigQueryIntegration()
      const payload = createTrackPayload()

      await integration.track(payload)

      const mockTableManagerInstance = (TableManager as any).mock.instances[0]
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledTimes(2)

      const calls = mockTableManagerInstance.insertWithAutoSchema.mock.calls
      expect(calls).toHaveLength(2)
      expect(calls).toContainEqual(['test_dataset', 'tracks', 'track', expect.any(Array)])
      expect(calls).toContainEqual(['test_dataset', 'product_purchased', 'track', expect.any(Array)])
    })

    it('should not attempt insert when not enabled', async () => {
      delete process.env.BIGQUERY_PROJECT_ID
      const integration = new BigQueryIntegration()
      const payload = createTrackPayload()
      await integration.track(payload)
      expect(TableManager).not.toHaveBeenCalled()
    })
  })

  describe('identify events', () => {
    it('should insert identify events into identifies table', async () => {
      const integration = new BigQueryIntegration()
      const payload = createIdentifyPayload()
      await integration.identify(payload)
      const mockTableManagerInstance = (TableManager as any).mock.instances[0]
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledTimes(1)
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledWith(
        'test_dataset',
        'identifies',
        'identify',
        expect.any(Array)
      )
    })
  })

  describe('page events', () => {
    it('should insert page events into pages table', async () => {
      const integration = new BigQueryIntegration()
      const payload = createPagePayload()
      await integration.page(payload)
      const mockTableManagerInstance = (TableManager as any).mock.instances[0]
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledTimes(1)
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledWith(
        'test_dataset',
        'pages',
        'page',
        expect.any(Array)
      )
    })
  })

  describe('group events', () => {
    it('should insert group events into groups table', async () => {
      const integration = new BigQueryIntegration()
      const payload = createGroupPayload()
      await integration.group(payload)
      const mockTableManagerInstance = (TableManager as any).mock.instances[0]
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledTimes(1)
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledWith(
        'test_dataset',
        'groups',
        'group',
        expect.any(Array)
      )
    })
  })

  describe('alias events', () => {
    it('should insert alias events into aliases table', async () => {
      const integration = new BigQueryIntegration()
      const payload = createAliasPayload()
      await integration.alias(payload)
      const mockTableManagerInstance = (TableManager as any).mock.instances[0]
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledTimes(1)
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledWith(
        'test_dataset',
        'aliases',
        'alias',
        expect.any(Array)
      )
    })
  })

  describe('error handling', () => {
    it('should handle BigQuery insertion errors gracefully', async () => {
      const integration = new BigQueryIntegration()
      const payload = createTrackPayload()
      const mockTableManagerInstance = (TableManager as any).mock.instances[0]
      mockTableManagerInstance.insertWithAutoSchema.mockRejectedValueOnce(new Error('BigQuery error'))

      await expect(integration.track(payload)).rejects.toThrow('BigQuery error')
    })
  })

  describe('data transformation', () => {
    it('should pass correctly transformed data to BigQuery', async () => {
      const integration = new BigQueryIntegration()
      const payload = createTrackPayload()
      await integration.track(payload)
      const mockTableManagerInstance = (TableManager as any).mock.instances[0]
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalled()
      const insertCall = mockTableManagerInstance.insertWithAutoSchema.mock.calls[0]
      const [, , , rows] = insertCall
      const row = rows[0]

      expect(row.id).toBe('test-message-id')
      expect(row.user_id).toBe('user123')
      expect(row.anonymous_id).toBe('anon123')
      expect(row.product_id).toBe('prod123')
      expect(row.price).toBe(99.99)
    })
  })
})
