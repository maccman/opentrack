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
      expect(BigQuery).toHaveBeenCalledTimes(1)
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

      expect(BigQuery).toHaveBeenCalledWith({
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

      expect(BigQuery).toHaveBeenCalledWith({
        projectId: 'test-project',
        credentials: mockCredentials,
      })
    })
  })
})
