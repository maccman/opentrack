import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CustomerioIntegration } from '../index'

// Mock the customerio-node module
const mockIdentify = vi.fn().mockResolvedValue({})
const mockTrack = vi.fn().mockResolvedValue({})
const mockTrackAnonymous = vi.fn().mockResolvedValue({})
const mockTrackPageView = vi.fn().mockResolvedValue({})
const mockMergeCustomers = vi.fn().mockResolvedValue({})

vi.mock('customerio-node', () => ({
  TrackClient: class MockTrackClient {
    identify = mockIdentify
    track = mockTrack
    trackAnonymous = mockTrackAnonymous
    trackPageView = mockTrackPageView
    mergeCustomers = mockMergeCustomers
  },
  RegionUS: 'US',
  RegionEU: 'EU',
  IdentifierType: {
    Id: 'id',
    Email: 'email',
    CioId: 'cio_id',
  },
}))

describe('CustomerioIntegration', () => {
  let integration: CustomerioIntegration
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    // Save original environment variables
    originalEnv = {
      CUSTOMERIO_SITE_ID: process.env.CUSTOMERIO_SITE_ID,
      CUSTOMERIO_API_KEY: process.env.CUSTOMERIO_API_KEY,
      CUSTOMERIO_REGION: process.env.CUSTOMERIO_REGION,
    }

    integration = new CustomerioIntegration({
      siteId: 'test_site_id',
      apiKey: 'test_api_key',
      region: 'US',
    })
  })

  afterEach(() => {
    // Restore original environment variables
    Object.keys(originalEnv).forEach((key) => {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key]
      } else {
        delete process.env[key]
      }
    })
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create instance with provided config', () => {
      const config = {
        siteId: 'site123',
        apiKey: 'key456',
        region: 'EU' as const,
        timeout: 5000,
      }

      const instance = new CustomerioIntegration(config)
      expect(instance.getConfig()).toMatchObject(config)
    })

    it('should use default timeout when not provided', () => {
      const instance = new CustomerioIntegration({
        siteId: 'site123',
        apiKey: 'key456',
      })

      expect(instance.getConfig().timeout).toBe(10000)
    })
  })

  describe('identify', () => {
    it('should call client identify with transformed data', async () => {
      const call: IdentifyPayload = {
        type: 'identify',
        userId: 'user123',
        traits: {
          email: 'test@example.com',
          name: 'Test User',
        },
      }

      await integration.identify(call)

      expect(mockIdentify).toHaveBeenCalledWith('user123', {
        email: 'test@example.com',
        name: 'Test User',
      })
    })

    it('should validate email format', async () => {
      const call: IdentifyPayload = {
        type: 'identify',
        userId: 'user123',
        traits: {
          email: 'invalid-email',
        },
      }

      await expect(integration.identify(call)).rejects.toThrow('Invalid email format')
    })

    it('should handle timestamp conversion', async () => {
      const call: IdentifyPayload = {
        type: 'identify',
        userId: 'user123',
        traits: { email: 'test@example.com' },
        timestamp: '2023-01-01T00:00:00Z',
      }

      await integration.identify(call)

      expect(mockIdentify).toHaveBeenCalledWith('user123', {
        email: 'test@example.com',
        created_at: 1672531200,
      })
    })
  })

  describe('track', () => {
    it('should call client track for identified users', async () => {
      const call: TrackPayload = {
        type: 'track',
        userId: 'user123',
        event: 'Purchase Completed',
        properties: {
          revenue: 99.99,
          currency: 'USD',
        },
      }

      await integration.track(call)

      expect(mockTrack).toHaveBeenCalledWith('user123', {
        name: 'Purchase Completed',
        data: {
          revenue: 99.99,
          currency: 'USD',
        },
      })
    })

    it('should call trackAnonymous for anonymous users', async () => {
      const call: TrackPayload = {
        type: 'track',
        event: 'Page Viewed',
        properties: {
          url: '/home',
        },
        anonymousId: 'anon123',
      }

      await integration.track(call)

      expect(mockTrackAnonymous).toHaveBeenCalledWith('anon123', {
        name: 'Page Viewed',
        data: {
          url: '/home',
        },
      })
    })

    it('should generate anonymous ID when not provided', async () => {
      const call: TrackPayload = {
        type: 'track',
        event: 'Page Viewed',
        properties: {
          url: '/home',
        },
      }

      await integration.track(call)

      expect(mockTrackAnonymous).toHaveBeenCalledWith(expect.stringMatching(/^anon_/), {
        name: 'Page Viewed',
        data: {
          url: '/home',
        },
      })
    })
  })

  describe('page', () => {
    it('should call track with page event for identified users', async () => {
      const payload: PagePayload = {
        type: 'page',
        userId: 'user123',
        name: 'Home',
        properties: {
          url: '/home',
        },
      }

      await integration.page(payload)

      expect(mockTrack).toHaveBeenCalledWith('user123', {
        name: 'page_viewed',
        data: {
          url: '/home',
          page_title: 'Home',
          page_name: 'Home',
        },
      })
    })

    it('should also call trackPageView when URL is available', async () => {
      const payload: PagePayload = {
        type: 'page',
        userId: 'user123',
        properties: {
          url: '/home',
        },
      }

      await integration.page(payload)

      expect(mockTrackPageView).toHaveBeenCalledWith('user123', '/home')
    })

    it('should handle anonymous page views', async () => {
      const payload: PagePayload = {
        type: 'page',
        name: 'Home',
        anonymousId: 'anon123',
      }

      await integration.page(payload)

      expect(mockTrackAnonymous).toHaveBeenCalledWith('anon123', {
        name: 'page_viewed',
        data: {
          page_title: 'Home',
          page_name: 'Home',
        },
      })
    })
  })

  describe('group', () => {
    it('should update user with group information and track group joined event', async () => {
      const call: GroupPayload = {
        type: 'group',
        userId: 'user123',
        groupId: 'company456',
        traits: {
          name: 'Acme Corp',
          industry: 'Technology',
        },
      }

      await integration.group(call)

      // Should update user with group attributes
      expect(mockIdentify).toHaveBeenCalledWith('user123', {
        group_company456: true,
        group_company456_joined_at: expect.any(Number) as number,
        group_name: 'Acme Corp',
        group_industry: 'Technology',
      })

      // Should track group joined event
      expect(mockTrack).toHaveBeenCalledWith('user123', {
        name: 'Group Joined',
        data: {
          group_id: 'company456',
          name: 'Acme Corp',
          industry: 'Technology',
        },
      })
    })
  })

  describe('alias', () => {
    it('should call mergeCustomers with correct parameters', async () => {
      const call: AliasPayload = {
        type: 'alias',
        userId: 'user123',
        previousId: 'temp456',
      }

      await integration.alias(call)

      expect(mockMergeCustomers).toHaveBeenCalledWith('id', 'user123', 'id', 'temp456')
    })
  })

  describe('getName', () => {
    it('should return integration name', () => {
      expect(integration.getName()).toBe('customerio')
    })
  })

  describe('setRegion', () => {
    it('should update region and recreate client', () => {
      const originalClient = (integration as unknown as { client: unknown }).client

      integration.setRegion('EU')

      expect(integration.getConfig().region).toBe('EU')
      // Client should be recreated (different instance)
      expect((integration as unknown as { client: unknown }).client).not.toBe(originalClient)
    })
  })

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      const result = await integration.testConnection()
      expect(result).toBe(true)
      expect(mockIdentify).toHaveBeenCalled()
    })

    it('should return false for authentication errors', async () => {
      mockIdentify.mockRejectedValueOnce({
        statusCode: 401,
        message: 'Unauthorized',
      })

      const result = await integration.testConnection()
      expect(result).toBe(false)
    })

    it('should return true for other errors (connection is working)', async () => {
      mockIdentify.mockRejectedValueOnce({
        statusCode: 400,
        message: 'Bad Request',
      })

      const result = await integration.testConnection()
      expect(result).toBe(true)
    })
  })

  describe('error handling and retries', () => {
    it('should retry on retryable errors', async () => {
      mockIdentify
        .mockRejectedValueOnce({ statusCode: 500 })
        .mockRejectedValueOnce({ statusCode: 500 })
        .mockResolvedValueOnce({})

      const call: IdentifyPayload = {
        type: 'identify',
        userId: 'user123',
        traits: { email: 'test@example.com' },
      }

      await integration.identify(call)
      expect(mockIdentify).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-retryable errors', async () => {
      mockIdentify.mockRejectedValueOnce({ statusCode: 400 })

      const call: IdentifyPayload = {
        type: 'identify',
        userId: 'user123',
        traits: { email: 'test@example.com' },
      }

      await expect(integration.identify(call)).rejects.toThrow()
      expect(mockIdentify).toHaveBeenCalledTimes(1)
    })

    it('should throw after maximum retry attempts', async () => {
      mockIdentify.mockRejectedValue({ statusCode: 500 })

      const call: IdentifyPayload = {
        type: 'identify',
        userId: 'user123',
        traits: { email: 'test@example.com' },
      }

      await expect(integration.identify(call)).rejects.toThrow()
      expect(mockIdentify).toHaveBeenCalledTimes(3) // Default retry attempts
    })
  })
})
