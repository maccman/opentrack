import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { transformToRow } from '../row-transformer'

// Mock Date.now() to have consistent timestamps in tests
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
      device: {
        type: 'mobile',
        brand: 'Apple',
      },
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
      age: 30,
    },
    context: {
      ip: '192.168.1.1',
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
    name: 'Home',
    properties: {
      url: 'https://example.com',
      title: 'Home Page',
      referrer: 'https://google.com',
    },
    context: {
      ip: '192.168.1.1',
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
      employees: 100,
    },
    context: {
      ip: '192.168.1.1',
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
    context: {
      ip: '192.168.1.1',
    },
    ...overrides,
  }
}

describe('transformToRow', () => {
  describe('common fields', () => {
    it('should include standard BigQuery columns', () => {
      const payload = createTrackPayload()
      const row = transformToRow(payload)

      expect(row.id).toBe('test-message-id')
      expect(row.user_id).toBe('user123')
      expect(row.anonymous_id).toBe('anon123')
      expect(row.received_at).toEqual(mockDate)
      expect(row.sent_at).toEqual(new Date('2023-01-01T12:00:00.000Z'))
      expect(row.timestamp).toEqual(new Date('2023-01-01T12:00:00.000Z'))
      expect(row.uuid_ts).toEqual(mockDate)
      expect(row.loaded_at).toEqual(mockDate)
    })

    it('should handle missing optional fields', () => {
      const payload = createTrackPayload({
        userId: undefined,
        anonymousId: undefined,
        timestamp: undefined,
        context: undefined,
      })
      const row = transformToRow(payload)

      expect(row.id).toBe('test-message-id')
      expect(row.user_id).toBeUndefined()
      expect(row.anonymous_id).toBeUndefined()
      expect(row.received_at).toEqual(mockDate)
      expect(row.sent_at).toEqual(mockDate)
      expect(row.timestamp).toEqual(mockDate)
    })

    it('should flatten context properties', () => {
      const payload = createTrackPayload()
      const row = transformToRow(payload)

      expect(row.context_ip).toBe('192.168.1.1')
      expect(row.context_user_agent).toBe('Mozilla/5.0...')
      expect(row.context_device_type).toBe('mobile')
      expect(row.context_device_brand).toBe('Apple')
    })
  })

  describe('track events', () => {
    it('should transform track payload correctly', () => {
      const payload = createTrackPayload()
      const row = transformToRow(payload)

      expect(row.event).toBe('product_purchased')
      expect(row.event_text).toBe('Product Purchased')
      expect(row.product_id).toBe('prod123')
      expect(row.price).toBe(99.99)
      expect(row.currency).toBe('USD')
    })

    it('should handle track events without properties', () => {
      const payload = createTrackPayload({ properties: undefined })
      const row = transformToRow(payload)

      expect(row.event).toBe('product_purchased')
      expect(row.event_text).toBe('Product Purchased')
      expect(row.product_id).toBeUndefined()
      expect(row.price).toBeUndefined()
    })

    it('should handle complex nested properties', () => {
      const payload = createTrackPayload({
        properties: {
          product: {
            name: 'iPhone',
            specs: {
              storage: '128GB',
              color: 'Black',
            },
          },
          tags: ['electronics', 'mobile'],
        },
      })
      const row = transformToRow(payload)

      expect(row.product_name).toBe('iPhone')
      expect(row.product_specs_storage).toBe('128GB')
      expect(row.product_specs_color).toBe('Black')
      expect(row.tags).toBe('["electronics","mobile"]')
    })
  })

  describe('identify events', () => {
    it('should transform identify payload correctly', () => {
      const payload = createIdentifyPayload()
      const row = transformToRow(payload)

      expect(row.email).toBe('test@example.com')
      expect(row.first_name).toBe('John')
      expect(row.last_name).toBe('Doe')
      expect(row.age).toBe(30)
    })

    it('should handle identify events without traits', () => {
      const payload = createIdentifyPayload({ traits: undefined })
      const row = transformToRow(payload)

      expect(row.email).toBeUndefined()
      expect(row.first_name).toBeUndefined()
    })

    it('should flatten nested traits', () => {
      const payload = createIdentifyPayload({
        traits: {
          name: {
            first: 'John',
            last: 'Doe',
          },
          address: {
            street: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
          },
          interests: ['technology', 'sports'],
        },
      })
      const row = transformToRow(payload)

      expect(row.name_first).toBe('John')
      expect(row.name_last).toBe('Doe')
      expect(row.address_street).toBe('123 Main St')
      expect(row.address_city).toBe('San Francisco')
      expect(row.address_state).toBe('CA')
      expect(row.interests).toBe('["technology","sports"]')
    })
  })

  describe('page events', () => {
    it('should transform page payload correctly', () => {
      const payload = createPagePayload()
      const row = transformToRow(payload)

      expect(row.name).toBe('Home')
      expect(row.url).toBe('https://example.com')
      expect(row.title).toBe('Home Page')
      expect(row.referrer).toBe('https://google.com')
    })

    it('should handle page events without name', () => {
      const payload = createPagePayload({ name: undefined })
      const row = transformToRow(payload)

      expect(row.name).toBeUndefined()
      expect(row.url).toBe('https://example.com')
    })

    it('should handle page events without properties', () => {
      const payload = createPagePayload({ properties: undefined })
      const row = transformToRow(payload)

      expect(row.name).toBe('Home')
      expect(row.url).toBeUndefined()
      expect(row.title).toBeUndefined()
    })
  })

  describe('group events', () => {
    it('should transform group payload correctly', () => {
      const payload = createGroupPayload()
      const row = transformToRow(payload)

      expect(row.group_id).toBe('group123')
      expect(row.name).toBe('Acme Corp')
      expect(row.industry).toBe('Technology')
      expect(row.employees).toBe(100)
    })

    it('should handle group events without traits', () => {
      const payload = createGroupPayload({ traits: undefined })
      const row = transformToRow(payload)

      expect(row.group_id).toBe('group123')
      expect(row.name).toBeUndefined()
      expect(row.industry).toBeUndefined()
    })
  })

  describe('alias events', () => {
    it('should transform alias payload correctly', () => {
      const payload = createAliasPayload()
      const row = transformToRow(payload)

      expect(row.previous_id).toBe('old-user-id')
      expect(row.anonymous_id).toBeUndefined() // alias events don't include anonymous_id
    })

    it('should not include anonymous_id for alias events', () => {
      const payload = createAliasPayload()
      const row = transformToRow(payload)

      expect(row.anonymous_id).toBeUndefined()
      expect(row.user_id).toBe('user123')
      expect(row.previous_id).toBe('old-user-id')
    })
  })

  describe('error handling', () => {
    it('should throw error for unknown payload types', () => {
      interface InvalidPayload {
        type: 'unknown'
        messageId: string
      }

      const invalidPayload: InvalidPayload = {
        type: 'unknown',
        messageId: 'test',
      }

      expect(() => transformToRow(invalidPayload as any)).toThrow('Unknown payload type: unknown')
    })
  })

  describe('date handling', () => {
    it('should handle various date formats', () => {
      const isoString = '2023-01-01T12:00:00.000Z'
      const payload = createTrackPayload({ timestamp: isoString })
      const row = transformToRow(payload)

      expect(row.sent_at).toEqual(new Date(isoString))
      expect(row.timestamp).toEqual(new Date(isoString))
    })

    it('should handle missing timestamp', () => {
      const payload = createTrackPayload({ timestamp: undefined })
      const row = transformToRow(payload)

      expect(row.sent_at).toEqual(mockDate)
      expect(row.timestamp).toEqual(mockDate)
    })
  })
})
