/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WebhookTransformer } from '../../utils/transformer'

// Mock Date.now() for consistent timestamps in tests
const mockDate = new Date('2023-01-01T12:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(mockDate)
})

afterEach(() => {
  vi.useRealTimers()
})

// Helper functions to create test payloads
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
      currency: 'USD',
    },
    context: {
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
    },
    ...overrides,
  }
}

function createIdentifyPayload(overrides: Partial<IdentifyPayload> = {}): IdentifyPayload {
  return {
    type: 'identify',
    messageId: 'test-message-id',
    timestamp: '2023-01-01T12:00:00.000Z',
    userId: 'user123',
    anonymousId: 'anon123',
    traits: {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
    ...overrides,
  }
}

function createPagePayload(overrides: Partial<PagePayload> = {}): PagePayload {
  return {
    type: 'page',
    messageId: 'test-message-id',
    timestamp: '2023-01-01T12:00:00.000Z',
    userId: 'user123',
    anonymousId: 'anon123',
    name: 'Home Page',
    properties: {
      url: 'https://example.com',
      title: 'Home',
    },
    ...overrides,
  }
}

function createGroupPayload(overrides: Partial<GroupPayload> = {}): GroupPayload {
  return {
    type: 'group',
    messageId: 'test-message-id',
    timestamp: '2023-01-01T12:00:00.000Z',
    userId: 'user123',
    anonymousId: 'anon123',
    groupId: 'group123',
    traits: {
      name: 'Acme Corp',
      industry: 'Technology',
    },
    ...overrides,
  }
}

function createAliasPayload(overrides: Partial<AliasPayload> = {}): AliasPayload {
  return {
    type: 'alias',
    messageId: 'test-message-id',
    timestamp: '2023-01-01T12:00:00.000Z',
    userId: 'user123',
    previousId: 'old-user-id',
    ...overrides,
  }
}

describe('WebhookTransformer', () => {
  describe('transform', () => {
    it('should transform track payload correctly', () => {
      const payload = createTrackPayload()
      const result = WebhookTransformer.transform(payload)

      expect(result).toMatchObject({
        type: 'track',
        messageId: 'test-message-id',
        timestamp: '2023-01-01T12:00:00.000Z',
        userId: 'user123',
        anonymousId: 'anon123',
        originalPayload: payload,
        data: {
          event: 'Product Purchased',
          properties: {
            productId: 'prod123',
            price: 99.99,
            currency: 'USD',
          },
        },
        context: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
        },
        integrations: {
          webhook: {
            sentAt: mockDate.toISOString(),
            version: '1.0.0',
          },
        },
      })
    })

    it('should transform identify payload correctly', () => {
      const payload = createIdentifyPayload()
      const result = WebhookTransformer.transform(payload)

      expect(result).toMatchObject({
        type: 'identify',
        messageId: 'test-message-id',
        userId: 'user123',
        anonymousId: 'anon123',
        data: {
          traits: {
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      })
    })

    it('should transform page payload correctly', () => {
      const payload = createPagePayload()
      const result = WebhookTransformer.transform(payload)

      expect(result).toMatchObject({
        type: 'page',
        messageId: 'test-message-id',
        userId: 'user123',
        data: {
          name: 'Home Page',
          properties: {
            url: 'https://example.com',
            title: 'Home',
          },
        },
      })
    })

    it('should transform group payload correctly', () => {
      const payload = createGroupPayload()
      const result = WebhookTransformer.transform(payload)

      expect(result).toMatchObject({
        type: 'group',
        messageId: 'test-message-id',
        userId: 'user123',
        data: {
          groupId: 'group123',
          traits: {
            name: 'Acme Corp',
            industry: 'Technology',
          },
        },
      })
    })

    it('should transform alias payload correctly', () => {
      const payload = createAliasPayload()
      const result = WebhookTransformer.transform(payload)

      expect(result).toMatchObject({
        type: 'alias',
        messageId: 'test-message-id',
        userId: 'user123',
        data: {
          previousId: 'old-user-id',
          userId: 'user123',
        },
      })

      // Alias payloads should not include anonymousId
      expect(result.anonymousId).toBeUndefined()
    })

    it('should handle missing optional fields', () => {
      const payload = createTrackPayload({
        userId: undefined,
        anonymousId: undefined,
        properties: undefined,
        context: undefined,
      })

      const result = WebhookTransformer.transform(payload)

      expect(result.userId).toBeUndefined()
      expect(result.anonymousId).toBeUndefined()
      expect(result.context).toBeUndefined()
      expect(result.data).toEqual({
        event: 'Product Purchased',
        properties: {},
      })
    })

    it('should use current timestamp when not provided', () => {
      const payload = createTrackPayload({ timestamp: undefined })
      const result = WebhookTransformer.transform(payload)

      expect(result.timestamp).toBe(mockDate.toISOString())
    })
  })

  describe('transformMinimal', () => {
    it('should return payload without originalPayload', () => {
      const payload = createTrackPayload()
      const result = WebhookTransformer.transformMinimal(payload)

      expect(result).not.toHaveProperty('originalPayload')
      expect(result).toMatchObject({
        type: 'track',
        messageId: 'test-message-id',
        userId: 'user123',
        data: {
          event: 'Product Purchased',
          properties: expect.any(Object),
        },
      })
    })
  })

  describe('sanitize', () => {
    it('should return clean copy of serializable payload', () => {
      const payload = createTrackPayload()
      const webhookPayload = WebhookTransformer.transform(payload)

      const result = WebhookTransformer.sanitize(webhookPayload)

      expect(result).toEqual(webhookPayload)
      expect(result).not.toBe(webhookPayload) // Should be a copy
    })

    it('should return safe fallback for non-serializable payload', () => {
      const payload = createTrackPayload()
      const webhookPayload = WebhookTransformer.transform(payload)

      // Create circular reference
      const circular: { circular: unknown } = { circular: null }
      circular.circular = circular
      webhookPayload.data.circular = circular

      const result = WebhookTransformer.sanitize(webhookPayload)

      expect(result).toMatchObject({
        type: 'track',
        messageId: 'test-message-id',
        userId: 'user123',
        anonymousId: 'anon123',
        data: {},
        originalPayload: expect.any(Object),
        integrations: expect.any(Object),
      })
    })
  })

  describe('edge cases', () => {
    it('should handle track event without properties', () => {
      const payload = createTrackPayload({ properties: undefined })
      const result = WebhookTransformer.transform(payload)

      expect(result.data).toEqual({
        event: 'Product Purchased',
        properties: {},
      })
    })

    it('should handle identify event without traits', () => {
      const payload = createIdentifyPayload({ traits: undefined })
      const result = WebhookTransformer.transform(payload)

      expect(result.data).toEqual({
        traits: {},
      })
    })

    it('should handle page event without name', () => {
      const payload = createPagePayload({ name: undefined })
      const result = WebhookTransformer.transform(payload)

      expect(result.data.name).toBeUndefined()
    })

    it('should handle group event without traits', () => {
      const payload = createGroupPayload({ traits: undefined })
      const result = WebhookTransformer.transform(payload)

      expect(result.data).toEqual({
        groupId: 'group123',
        traits: {},
      })
    })
  })
})
