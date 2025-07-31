import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BigQueryIntegration } from '../index'

// Mock the BigQuery client
vi.mock('@google-cloud/bigquery', () => {
  const mockInsert = vi.fn()
  const mockTable = vi.fn(() => ({ insert: mockInsert }))
  const mockDataset = vi.fn(() => ({ table: mockTable }))

  return {
    BigQuery: vi.fn(() => ({
      dataset: mockDataset,
    })),
    // Export the mocks so we can access them in tests
    __mocks: {
      mockInsert,
      mockTable,
      mockDataset,
    },
  }
})

// Import the mocks
const { __mocks } = (await import('@google-cloud/bigquery')) as any

// Mock environment variables
const originalEnv = process.env

beforeEach(() => {
  vi.resetAllMocks()
  process.env = {
    ...originalEnv,
    BIGQUERY_PROJECT_ID: 'test-project',
    BIGQUERY_DATASET: 'test_dataset',
  }
})

afterEach(() => {
  process.env = originalEnv
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

describe('BigQueryIntegration', () => {
  describe('initialization', () => {
    it('should initialize when properly configured', () => {
      const integration = new BigQueryIntegration()
      expect(integration.name).toBe('BigQuery')
      expect(integration.isEnabled()).toBe(true)
    })

    it('should not be enabled without required environment variables', () => {
      delete process.env.BIGQUERY_PROJECT_ID
      const integration = new BigQueryIntegration()
      expect(integration.isEnabled()).toBe(false)
    })

    it('should not be enabled without dataset', () => {
      delete process.env.BIGQUERY_DATASET
      const integration = new BigQueryIntegration()
      expect(integration.isEnabled()).toBe(false)
    })
  })

  describe('track events', () => {
    it('should insert track events into both tracks and event-specific tables', async () => {
      const integration = new BigQueryIntegration()
      const payload = createTrackPayload()

      await integration.track(payload)

      expect(__mocks.mockInsert).toHaveBeenCalledTimes(2)
      expect(__mocks.mockTable).toHaveBeenCalledWith('product_purchased')
      expect(__mocks.mockTable).toHaveBeenCalledWith('tracks')
    })

    it('should handle complex event names', async () => {
      const integration = new BigQueryIntegration()
      const payload = createTrackPayload({ event: 'Order #123 Completed!' })

      await integration.track(payload)

      expect(__mocks.mockTable).toHaveBeenCalledWith('order_123_completed')
      expect(__mocks.mockTable).toHaveBeenCalledWith('tracks')
    })

    it('should not attempt insert when not enabled', async () => {
      delete process.env.BIGQUERY_PROJECT_ID
      const integration = new BigQueryIntegration()
      const payload = createTrackPayload()

      await integration.track(payload)

      expect(__mocks.mockInsert).not.toHaveBeenCalled()
    })
  })

  describe('identify events', () => {
    it('should insert identify events into identifies table', async () => {
      const integration = new BigQueryIntegration()
      const payload = createIdentifyPayload()

      await integration.identify(payload)

      expect(__mocks.mockInsert).toHaveBeenCalledTimes(1)
      expect(__mocks.mockTable).toHaveBeenCalledWith('identifies')
    })
  })

  describe('page events', () => {
    it('should insert page events into pages table', async () => {
      const integration = new BigQueryIntegration()
      const payload = createPagePayload()

      await integration.page(payload)

      expect(__mocks.mockInsert).toHaveBeenCalledTimes(1)
      expect(__mocks.mockTable).toHaveBeenCalledWith('pages')
    })
  })

  describe('group events', () => {
    it('should insert group events into groups table', async () => {
      const integration = new BigQueryIntegration()
      const payload = createGroupPayload()

      await integration.group(payload)

      expect(__mocks.mockInsert).toHaveBeenCalledTimes(1)
      expect(__mocks.mockTable).toHaveBeenCalledWith('groups')
    })
  })

  describe('alias events', () => {
    it('should insert alias events into aliases table', async () => {
      const integration = new BigQueryIntegration()
      const payload = createAliasPayload()

      await integration.alias(payload)

      expect(__mocks.mockInsert).toHaveBeenCalledTimes(1)
      expect(__mocks.mockTable).toHaveBeenCalledWith('aliases')
    })
  })

  describe('error handling', () => {
    it('should handle BigQuery insertion errors gracefully', async () => {
      __mocks.mockInsert.mockRejectedValueOnce(new Error('BigQuery error'))

      const integration = new BigQueryIntegration()
      const payload = createTrackPayload()

      // Should not throw an error
      await expect(integration.track(payload)).rejects.toThrow('BigQuery error')
    })
  })

  describe('data transformation', () => {
    it('should pass correctly transformed data to BigQuery', async () => {
      const integration = new BigQueryIntegration()
      const payload = createTrackPayload()

      await integration.track(payload)

      // Check that the data passed to insert contains expected fields
      const insertCall = __mocks.mockInsert.mock.calls[0]
      const [rows] = insertCall
      const row = rows[0]

      expect(row.id).toBe('test-message-id')
      expect(row.event).toBe('product_purchased')
      expect(row.event_text).toBe('Product Purchased')
      expect(row.user_id).toBe('user123')
      expect(row.anonymous_id).toBe('anon123')
      expect(row.product_id).toBe('prod123')
      expect(row.price).toBe(99.99)
    })
  })
})
