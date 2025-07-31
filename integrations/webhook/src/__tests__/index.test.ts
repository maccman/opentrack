/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { TrackPayload } from '@app/spec'
import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WebhookIntegration } from '../index'

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
  },
}))

const mockedAxios = vi.mocked(axios)

// Mock axios.create to return a mock instance
const mockAxiosInstance = {
  request: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
  defaults: {
    headers: {
      common: {},
    },
  },
}

describe('WebhookIntegration', () => {
  const defaultConfig = {
    url: 'https://webhook.example.com/events',
    method: 'POST' as const,
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
    vi.mocked(mockedAxios.create).mockReturnValue(mockAxiosInstance as never)
    mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'OK' })
  })

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const integration = new WebhookIntegration(defaultConfig)
      expect(integration.name).toBe('Webhook')
      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 10000, // default timeout
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OpenTrack-Webhook/1.0.0',
        },
        httpsAgent: undefined, // validateSsl is true by default
      })
    })

    it('should create instance with custom headers', () => {
      const config = {
        ...defaultConfig,
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
      }

      new WebhookIntegration(config)

      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OpenTrack-Webhook/1.0.0',
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
        httpsAgent: undefined,
      })
    })

    it('should disable SSL validation when configured', () => {
      const config = {
        ...defaultConfig,
        validateSsl: false,
      }

      new WebhookIntegration(config)

      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OpenTrack-Webhook/1.0.0',
        },
        httpsAgent: { rejectUnauthorized: false },
      })
    })

    it('should throw error for invalid URL', () => {
      const config = {
        ...defaultConfig,
        url: 'invalid-url',
      }

      expect(() => new WebhookIntegration(config)).toThrow()
    })
  })

  describe('track', () => {
    it('should send POST request with track payload', async () => {
      const integration = new WebhookIntegration(defaultConfig)
      const payload = createTrackPayload()

      await integration.track(payload)

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://webhook.example.com/events',
        data: expect.objectContaining({
          type: 'track',
          messageId: 'test-message-id',
          userId: 'user123',
          anonymousId: 'anon123',
          data: {
            event: 'Product Purchased',
            properties: { productId: 'prod123', price: 99.99 },
          },
        }),
      })
    })

    it('should handle GET requests with query parameters', async () => {
      const config = {
        ...defaultConfig,
        method: 'GET' as const,
      }
      const integration = new WebhookIntegration(config)
      const payload = createTrackPayload()

      await integration.track(payload)

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://webhook.example.com/events',
        params: expect.objectContaining({
          type: 'track',
          messageId: 'test-message-id',
        }),
      })
    })

    it('should send minimal payload when includePayload is false', async () => {
      const config = {
        ...defaultConfig,
        includePayload: false,
      }
      const integration = new WebhookIntegration(config)
      const payload = createTrackPayload()

      await integration.track(payload)

      const requestCall = mockAxiosInstance.request.mock.calls[0][0]
      expect(requestCall.data).not.toHaveProperty('originalPayload')
    })
  })

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const integration = new WebhookIntegration(defaultConfig)
      const payload = createTrackPayload()

      mockAxiosInstance.request.mockRejectedValue(new Error('Network Error'))

      await expect(integration.track(payload)).rejects.toThrow('Network Error')
    })

    it('should retry on retryable errors', async () => {
      const config = {
        ...defaultConfig,
        retryAttempts: 2,
      }
      const integration = new WebhookIntegration(config)
      const payload = createTrackPayload()

      // Mock to fail twice then succeed
      mockAxiosInstance.request
        .mockRejectedValueOnce({ response: { status: 500 }, isAxiosError: true })
        .mockRejectedValueOnce({ response: { status: 503 }, isAxiosError: true })
        .mockResolvedValueOnce({ status: 200, data: 'OK' })

      await integration.track(payload)

      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-retryable errors', async () => {
      const integration = new WebhookIntegration(defaultConfig)
      const payload = createTrackPayload()

      mockAxiosInstance.request.mockRejectedValue({
        response: { status: 400 },
        isAxiosError: true,
      })

      await expect(integration.track(payload)).rejects.toThrow()
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1)
    })
  })

  describe('identify', () => {
    it('should send identify payload', async () => {
      const integration = new WebhookIntegration(defaultConfig)
      const payload = {
        type: 'identify' as const,
        messageId: 'test-message-id',
        timestamp: '2023-01-01T12:00:00.000Z',
        userId: 'user123',
        traits: { email: 'test@example.com', name: 'John Doe' },
      }

      await integration.identify(payload)

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://webhook.example.com/events',
        data: expect.objectContaining({
          type: 'identify',
          messageId: 'test-message-id',
          userId: 'user123',
          data: {
            traits: { email: 'test@example.com', name: 'John Doe' },
          },
        }),
      })
    })
  })

  describe('page', () => {
    it('should send page payload', async () => {
      const integration = new WebhookIntegration(defaultConfig)
      const payload = {
        type: 'page' as const,
        messageId: 'test-message-id',
        timestamp: '2023-01-01T12:00:00.000Z',
        userId: 'user123',
        name: 'Home Page',
        properties: { url: 'https://example.com', title: 'Home' },
      }

      await integration.page(payload)

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://webhook.example.com/events',
        data: expect.objectContaining({
          type: 'page',
          messageId: 'test-message-id',
          userId: 'user123',
          data: {
            name: 'Home Page',
            properties: { url: 'https://example.com', title: 'Home' },
          },
        }),
      })
    })
  })

  describe('group', () => {
    it('should send group payload', async () => {
      const integration = new WebhookIntegration(defaultConfig)
      const payload = {
        type: 'group' as const,
        messageId: 'test-message-id',
        timestamp: '2023-01-01T12:00:00.000Z',
        userId: 'user123',
        groupId: 'group123',
        traits: { name: 'Acme Corp', industry: 'Technology' },
      }

      await integration.group(payload)

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://webhook.example.com/events',
        data: expect.objectContaining({
          type: 'group',
          messageId: 'test-message-id',
          userId: 'user123',
          data: {
            groupId: 'group123',
            traits: { name: 'Acme Corp', industry: 'Technology' },
          },
        }),
      })
    })
  })

  describe('alias', () => {
    it('should send alias payload', async () => {
      const integration = new WebhookIntegration(defaultConfig)
      const payload = {
        type: 'alias' as const,
        messageId: 'test-message-id',
        timestamp: '2023-01-01T12:00:00.000Z',
        userId: 'user123',
        previousId: 'old-user-id',
      }

      await integration.alias(payload)

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://webhook.example.com/events',
        data: expect.objectContaining({
          type: 'alias',
          messageId: 'test-message-id',
          userId: 'user123',
          data: {
            previousId: 'old-user-id',
            userId: 'user123',
          },
        }),
      })
    })
  })

  describe('testConnection', () => {
    it('should return true on successful test', async () => {
      const integration = new WebhookIntegration(defaultConfig)
      mockAxiosInstance.request.mockResolvedValue({ status: 200, data: 'OK' })

      const result = await integration.testConnection()

      expect(result).toBe(true)
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://webhook.example.com/events',
        data: expect.objectContaining({
          type: 'test',
          messageId: 'test-message-id',
          data: {
            message: 'OpenTrack webhook connection test',
          },
        }),
      })
    })

    it('should return false on failed test', async () => {
      const integration = new WebhookIntegration(defaultConfig)
      mockAxiosInstance.request.mockRejectedValue(new Error('Connection failed'))

      const result = await integration.testConnection()

      expect(result).toBe(false)
    })
  })

  describe('configuration methods', () => {
    it('should get current configuration', () => {
      const integration = new WebhookIntegration(defaultConfig)
      const config = integration.getConfig()

      expect(config).toMatchObject({
        url: 'https://webhook.example.com/events',
        method: 'POST',
      })
    })

    it('should update URL', () => {
      const integration = new WebhookIntegration(defaultConfig)
      const newUrl = 'https://new-webhook.example.com/events'

      integration.setUrl(newUrl)

      const config = integration.getConfig()
      expect(config.url).toBe(newUrl)
    })

    it('should update headers', () => {
      const integration = new WebhookIntegration(defaultConfig)
      const newHeaders = { Authorization: 'Bearer new-token' }

      integration.setHeaders(newHeaders)

      expect(mockAxiosInstance.defaults.headers.common).toMatchObject({
        'Content-Type': 'application/json',
        'User-Agent': 'OpenTrack-Webhook/1.0.0',
        Authorization: 'Bearer new-token',
      })
    })
  })
})
