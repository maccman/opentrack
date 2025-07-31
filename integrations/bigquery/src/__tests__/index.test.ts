import type { TrackPayload } from '@app/spec'
import { BigQuery } from '@google-cloud/bigquery'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BigQueryIntegration } from '../index'
import { TableManager } from '../utils/table-manager'

// Auto-mock the TableManager
vi.mock('../utils/table-manager')

// Mock the BigQuery client
const mockInsert = vi.fn()
const mockTable = vi.fn(() => ({ insert: mockInsert }))
const mockDataset = vi.fn(() => ({ table: mockTable }))

vi.mock('@google-cloud/bigquery', () => {
  return {
    BigQuery: vi.fn(() => ({
      dataset: mockDataset,
    })),
  }
})

describe('BigQueryIntegration', () => {
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
    process.env = {
      ...process.env,
      BIGQUERY_PROJECT_ID: 'test-project',
      BIGQUERY_DATASET: 'test_dataset',
    }
  })

  describe('with auto table management ENABLED', () => {
    beforeEach(() => {
      process.env.BIGQUERY_AUTO_TABLE_MANAGEMENT = 'true'
    })

    it('should initialize TableManager', () => {
      new BigQueryIntegration()
      expect(TableManager).toHaveBeenCalledTimes(1)
    })

    it('should use TableManager to insert records', async () => {
      const integration = new BigQueryIntegration()
      const payload = createTrackPayload()
      await integration.track(payload)
      const mockTableManagerInstance = (TableManager as any).mock.instances[0]
      expect(mockTableManagerInstance.insertWithAutoSchema).toHaveBeenCalledTimes(2)
    })
  })

  describe('with auto table management DISABLED', () => {
    beforeEach(() => {
      process.env.BIGQUERY_AUTO_TABLE_MANAGEMENT = 'false'
    })

    it('should NOT initialize TableManager', () => {
      new BigQueryIntegration()
      expect(TableManager).not.toHaveBeenCalled()
    })

    it('should use direct BigQuery client to insert records', async () => {
      const integration = new BigQueryIntegration()
      const payload = createTrackPayload()
      await integration.track(payload)

      // Ensure TableManager was not used
      expect((TableManager as any).mock.instances).toHaveLength(0)

      // Ensure direct client was used
      expect(BigQuery).toHaveBeenCalledTimes(1)
      expect(mockDataset).toHaveBeenCalledWith('test_dataset')
      expect(mockTable).toHaveBeenCalledWith('tracks')
      expect(mockTable).toHaveBeenCalledWith('product_purchased')
      expect(mockInsert).toHaveBeenCalledTimes(2)
    })

    it('should fail gracefully if direct insertion fails', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Schema mismatch'))

      const integration = new BigQueryIntegration()
      const payload = createTrackPayload()

      await expect(integration.track(payload)).rejects.toThrow('Schema mismatch')
    })
  })
})
