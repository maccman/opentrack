import { describe, expect, test } from 'vitest'
import {
  aliasEventSchema,
  groupEventSchema,
  identifyEventSchema,
  pageEventSchema,
  segmentEventBaseSchema,
  trackEventSchema,
  type AliasPayload,
  type GroupPayload,
  type IdentifyPayload,
  type PagePayload,
  type TrackPayload,
} from '../index'

describe('Segment Event Validation', () => {
  describe('Base Schema Fields', () => {
    test('should validate optional messageId as string', () => {
      const validBase = {
        messageId: 'ajs-msg-12345',
      }
      expect(() => segmentEventBaseSchema.parse(validBase)).not.toThrow()

      const invalidBase = {
        messageId: 123, // Should be string
      }
      expect(() => segmentEventBaseSchema.parse(invalidBase)).toThrow()
    })

    test('should validate optional timestamp as datetime string', () => {
      const validBase = {
        timestamp: '2025-01-15T10:30:00.000Z',
      }
      expect(() => segmentEventBaseSchema.parse(validBase)).not.toThrow()

      const invalidBase = {
        timestamp: 'invalid-date',
      }
      expect(() => segmentEventBaseSchema.parse(invalidBase)).toThrow()
    })

    test('should accept optional context and integrations as any', () => {
      const validBase = {
        context: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          page: { url: 'https://example.com' },
        },
        integrations: {
          'Google Analytics': false,
          Mixpanel: true,
        },
      }
      expect(() => segmentEventBaseSchema.parse(validBase)).not.toThrow()
    })
  })

  describe('Identity Requirements', () => {
    test('track event requires userId OR anonymousId', () => {
      const validWithUserId: TrackPayload = {
        type: 'track',
        event: 'Button Clicked',
        userId: 'user123',
      }
      expect(() => trackEventSchema.parse(validWithUserId)).not.toThrow()

      const validWithAnonymousId: TrackPayload = {
        type: 'track',
        event: 'Button Clicked',
        anonymousId: 'anon123',
      }
      expect(() => trackEventSchema.parse(validWithAnonymousId)).not.toThrow()

      const validWithBoth: TrackPayload = {
        type: 'track',
        event: 'Button Clicked',
        userId: 'user123',
        anonymousId: 'anon123',
      }
      expect(() => trackEventSchema.parse(validWithBoth)).not.toThrow()

      const invalidWithNeither = {
        type: 'track',
        event: 'Button Clicked',
      }
      expect(() => trackEventSchema.parse(invalidWithNeither)).toThrow()
    })

    test('identify event requires userId OR anonymousId', () => {
      const validWithUserId: IdentifyPayload = {
        type: 'identify',
        userId: 'user123',
      }
      expect(() => identifyEventSchema.parse(validWithUserId)).not.toThrow()

      const validWithAnonymousId: IdentifyPayload = {
        type: 'identify',
        anonymousId: 'anon123',
      }
      expect(() => identifyEventSchema.parse(validWithAnonymousId)).not.toThrow()

      const invalidWithNeither = {
        type: 'identify',
      }
      expect(() => identifyEventSchema.parse(invalidWithNeither)).toThrow()
    })

    test('page event requires userId OR anonymousId', () => {
      const validWithUserId: PagePayload = {
        type: 'page',
        userId: 'user123',
      }
      expect(() => pageEventSchema.parse(validWithUserId)).not.toThrow()

      const validWithAnonymousId: PagePayload = {
        type: 'page',
        anonymousId: 'anon123',
      }
      expect(() => pageEventSchema.parse(validWithAnonymousId)).not.toThrow()

      const invalidWithNeither = {
        type: 'page',
      }
      expect(() => pageEventSchema.parse(invalidWithNeither)).toThrow()
    })

    test('group event requires userId OR anonymousId AND groupId', () => {
      const validWithUserId: GroupPayload = {
        type: 'group',
        userId: 'user123',
        groupId: 'company123',
      }
      expect(() => groupEventSchema.parse(validWithUserId)).not.toThrow()

      const validWithAnonymousId: GroupPayload = {
        type: 'group',
        anonymousId: 'anon123',
        groupId: 'company123',
      }
      expect(() => groupEventSchema.parse(validWithAnonymousId)).not.toThrow()

      const invalidMissingGroupId = {
        type: 'group',
        userId: 'user123',
      }
      expect(() => groupEventSchema.parse(invalidMissingGroupId)).toThrow()

      const invalidMissingIdentity = {
        type: 'group',
        groupId: 'company123',
      }
      expect(() => groupEventSchema.parse(invalidMissingIdentity)).toThrow()
    })

    test('alias event requires both userId AND previousId', () => {
      const valid: AliasPayload = {
        type: 'alias',
        userId: 'user123',
        previousId: 'anon123',
      }
      expect(() => aliasEventSchema.parse(valid)).not.toThrow()

      const invalidMissingUserId = {
        type: 'alias',
        previousId: 'anon123',
      }
      expect(() => aliasEventSchema.parse(invalidMissingUserId)).toThrow()

      const invalidMissingPreviousId = {
        type: 'alias',
        userId: 'user123',
      }
      expect(() => aliasEventSchema.parse(invalidMissingPreviousId)).toThrow()
    })
  })

  describe('Track Event Validation', () => {
    test('requires event field', () => {
      const valid: TrackPayload = {
        type: 'track',
        event: 'Button Clicked',
        userId: 'user123',
      }
      expect(() => trackEventSchema.parse(valid)).not.toThrow()

      const invalid = {
        type: 'track',
        userId: 'user123',
      }
      expect(() => trackEventSchema.parse(invalid)).toThrow()
    })

    test('accepts optional properties object', () => {
      const valid: TrackPayload = {
        type: 'track',
        event: 'Product Purchased',
        userId: 'user123',
        properties: {
          productId: '12345',
          price: 99.99,
          category: 'Electronics',
        },
      }
      expect(() => trackEventSchema.parse(valid)).not.toThrow()
    })

    test('should enforce event type literal', () => {
      const invalid = {
        type: 'track_wrong',
        event: 'Test Event',
        userId: 'user123',
      }
      expect(() => trackEventSchema.parse(invalid)).toThrow()
    })
  })

  describe('Identify Event Validation', () => {
    test('accepts optional traits object', () => {
      const valid: IdentifyPayload = {
        type: 'identify',
        userId: 'user123',
        traits: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          age: 30,
        },
      }
      expect(() => identifyEventSchema.parse(valid)).not.toThrow()
    })

    test('should enforce identify type literal', () => {
      const invalid = {
        type: 'identify_wrong',
        userId: 'user123',
      }
      expect(() => identifyEventSchema.parse(invalid)).toThrow()
    })
  })

  describe('Page Event Validation', () => {
    test('accepts optional name and properties', () => {
      const valid: PagePayload = {
        type: 'page',
        userId: 'user123',
        name: 'Product Detail',
        properties: {
          url: 'https://example.com/product/123',
          title: 'Product 123 - Example Store',
          category: 'Electronics',
        },
      }
      expect(() => pageEventSchema.parse(valid)).not.toThrow()
    })

    test('works without optional fields', () => {
      const valid: PagePayload = {
        type: 'page',
        userId: 'user123',
      }
      expect(() => pageEventSchema.parse(valid)).not.toThrow()
    })

    test('should enforce page type literal', () => {
      const invalid = {
        type: 'page_wrong',
        userId: 'user123',
      }
      expect(() => pageEventSchema.parse(invalid)).toThrow()
    })
  })

  describe('Group Event Validation', () => {
    test('accepts optional traits object', () => {
      const valid: GroupPayload = {
        type: 'group',
        userId: 'user123',
        groupId: 'company123',
        traits: {
          name: 'Example Corp',
          industry: 'Technology',
          employees: 500,
          plan: 'enterprise',
        },
      }
      expect(() => groupEventSchema.parse(valid)).not.toThrow()
    })

    test('works without optional traits', () => {
      const valid: GroupPayload = {
        type: 'group',
        userId: 'user123',
        groupId: 'company123',
      }
      expect(() => groupEventSchema.parse(valid)).not.toThrow()
    })

    test('should enforce group type literal', () => {
      const invalid = {
        type: 'group_wrong',
        userId: 'user123',
        groupId: 'company123',
      }
      expect(() => groupEventSchema.parse(invalid)).toThrow()
    })
  })

  describe('Alias Event Validation', () => {
    test('should not accept traits field', () => {
      const validAlias: AliasPayload = {
        type: 'alias',
        userId: 'user123',
        previousId: 'anon123',
      }
      expect(() => aliasEventSchema.parse(validAlias)).not.toThrow()

      // The alias schema should not include traits
      const invalidWithTraits = {
        type: 'alias',
        userId: 'user123',
        previousId: 'anon123',
        traits: { name: 'John' }, // This should not be allowed
      }
      // If traits are provided, they should be ignored or cause error depending on schema strictness
      const result = aliasEventSchema.safeParse(invalidWithTraits)
      expect(result.success).toBe(true) // Zod ignores extra fields by default
      expect((result.data as any).traits).toBeUndefined()
    })

    test('should enforce alias type literal', () => {
      const invalid = {
        type: 'alias_wrong',
        userId: 'user123',
        previousId: 'anon123',
      }
      expect(() => aliasEventSchema.parse(invalid)).toThrow()
    })
  })
})
