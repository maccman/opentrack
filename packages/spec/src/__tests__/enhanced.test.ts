import { describe, expect, test } from 'vitest'
import {
  enhancedAliasEventSchema,
  enhancedGroupEventSchema,
  enhancedIdentifyEventSchema,
  enhancedPageEventSchema,
  enhancedTrackEventSchema,
  type EnhancedAliasPayload,
  type EnhancedGroupPayload,
  type EnhancedIdentifyPayload,
  type EnhancedPagePayload,
  type EnhancedTrackPayload,
} from '../validation/enhanced'

describe('Enhanced Schema Validation (Spec-Compliant)', () => {
  describe('String Length Enforcement', () => {
    test('should enforce userId max 255 characters', () => {
      const validUserId = 'a'.repeat(255)
      const invalidUserId = 'a'.repeat(256)

      const validTrack = {
        type: 'track' as const,
        event: 'Test Event',
        userId: validUserId,
      }
      expect(() => enhancedTrackEventSchema.parse(validTrack)).not.toThrow()

      const invalidTrack = {
        type: 'track' as const,
        event: 'Test Event',
        userId: invalidUserId,
      }
      expect(() => enhancedTrackEventSchema.parse(invalidTrack)).toThrow(/userId cannot exceed 255 characters/)
    })

    test('should enforce anonymousId max 255 characters', () => {
      const validAnonymousId = 'a'.repeat(255)
      const invalidAnonymousId = 'a'.repeat(256)

      const validTrack = {
        type: 'track' as const,
        event: 'Test Event',
        anonymousId: validAnonymousId,
      }
      expect(() => enhancedTrackEventSchema.parse(validTrack)).not.toThrow()

      const invalidTrack = {
        type: 'track' as const,
        event: 'Test Event',
        anonymousId: invalidAnonymousId,
      }
      expect(() => enhancedTrackEventSchema.parse(invalidTrack)).toThrow(/anonymousId cannot exceed 255 characters/)
    })

    test('should enforce event name max 200 characters', () => {
      const validEvent = 'a'.repeat(200)
      const invalidEvent = 'a'.repeat(201)

      const validTrack = {
        type: 'track' as const,
        event: validEvent,
        userId: 'user123',
      }
      expect(() => enhancedTrackEventSchema.parse(validTrack)).not.toThrow()

      const invalidTrack = {
        type: 'track' as const,
        event: invalidEvent,
        userId: 'user123',
      }
      expect(() => enhancedTrackEventSchema.parse(invalidTrack)).toThrow(/Event name cannot exceed 200 characters/)
    })

    test('should enforce groupId max 255 characters', () => {
      const validGroupId = 'a'.repeat(255)
      const invalidGroupId = 'a'.repeat(256)

      const validGroup = {
        type: 'group' as const,
        userId: 'user123',
        groupId: validGroupId,
      }
      expect(() => enhancedGroupEventSchema.parse(validGroup)).not.toThrow()

      const invalidGroup = {
        type: 'group' as const,
        userId: 'user123',
        groupId: invalidGroupId,
      }
      expect(() => enhancedGroupEventSchema.parse(invalidGroup)).toThrow(/groupId cannot exceed 255 characters/)
    })

    test('should enforce previousId max 255 characters', () => {
      const validPreviousId = 'a'.repeat(255)
      const invalidPreviousId = 'a'.repeat(256)

      const validAlias = {
        type: 'alias' as const,
        userId: 'user123',
        previousId: validPreviousId,
      }
      expect(() => enhancedAliasEventSchema.parse(validAlias)).not.toThrow()

      const invalidAlias = {
        type: 'alias' as const,
        userId: 'user123',
        previousId: invalidPreviousId,
      }
      expect(() => enhancedAliasEventSchema.parse(invalidAlias)).toThrow(/previousId cannot exceed 255 characters/)
    })
  })

  describe('Reserved Names Validation', () => {
    test('should reject event names starting with $', () => {
      const invalidEvent = {
        type: 'track' as const,
        event: '$reserved_event',
        userId: 'user123',
      }
      expect(() => enhancedTrackEventSchema.parse(invalidEvent)).toThrow(/Event name cannot start with \$/)
    })

    test('should reject property names starting with $', () => {
      const invalidTrack = {
        type: 'track' as const,
        event: 'Test Event',
        userId: 'user123',
        properties: {
          $reserved_property: 'value',
          validProperty: 'value',
        },
      }
      expect(() => enhancedTrackEventSchema.parse(invalidTrack)).toThrow(/Property names cannot start with \$/)
    })

    test('should reject trait names starting with $', () => {
      const invalidIdentify = {
        type: 'identify' as const,
        userId: 'user123',
        traits: {
          $reserved_trait: 'value',
          validTrait: 'value',
        },
      }
      expect(() => enhancedIdentifyEventSchema.parse(invalidIdentify)).toThrow(/Property names cannot start with \$/)
    })
  })

  describe('Property Constraints Enforcement', () => {
    test('should limit properties to max 255', () => {
      // Create an object with 256 properties
      const tooManyProperties: Record<string, any> = {}
      for (let i = 0; i < 256; i++) {
        tooManyProperties[`prop${i}`] = `value${i}`
      }

      const invalidTrack = {
        type: 'track' as const,
        event: 'Test Event',
        userId: 'user123',
        properties: tooManyProperties,
      }
      expect(() => enhancedTrackEventSchema.parse(invalidTrack)).toThrow(/Cannot exceed 255 properties per event/)
    })

    test('should limit property name length to 255 characters', () => {
      const longPropertyName = 'a'.repeat(256)
      const invalidTrack = {
        type: 'track' as const,
        event: 'Test Event',
        userId: 'user123',
        properties: {
          [longPropertyName]: 'value',
        },
      }
      expect(() => enhancedTrackEventSchema.parse(invalidTrack)).toThrow(/Property names cannot exceed 255 characters/)
    })

    test('should limit nested objects to max 3 levels deep', () => {
      const validNested = {
        type: 'track' as const,
        event: 'Test Event',
        userId: 'user123',
        properties: {
          level1: {
            level2: {
              level3: 'valid',
            },
          },
        },
      }
      expect(() => enhancedTrackEventSchema.parse(validNested)).not.toThrow()

      const invalidNested = {
        type: 'track' as const,
        event: 'Test Event',
        userId: 'user123',
        properties: {
          level1: {
            level2: {
              level3: {
                level4: 'too deep',
              },
            },
          },
        },
      }
      expect(() => enhancedTrackEventSchema.parse(invalidNested)).toThrow(/Nested objects cannot exceed 3 levels deep/)
    })

    test('should limit arrays to max 255 elements', () => {
      const validArray = Array(255).fill('item')
      const invalidArray = Array(256).fill('item')

      const validTrack = {
        type: 'track' as const,
        event: 'Test Event',
        userId: 'user123',
        properties: {
          items: validArray,
        },
      }
      expect(() => enhancedTrackEventSchema.parse(validTrack)).not.toThrow()

      const invalidTrack = {
        type: 'track' as const,
        event: 'Test Event',
        userId: 'user123',
        properties: {
          items: invalidArray,
        },
      }
      expect(() => enhancedTrackEventSchema.parse(invalidTrack)).toThrow(/Arrays cannot exceed 255 elements/)
    })
  })

  describe('Traits Constraints Enforcement', () => {
    test('should limit traits to max 255', () => {
      // Create an object with 256 traits
      const tooManyTraits: Record<string, any> = {}
      for (let i = 0; i < 256; i++) {
        tooManyTraits[`trait${i}`] = `value${i}`
      }

      const invalidIdentify = {
        type: 'identify' as const,
        userId: 'user123',
        traits: tooManyTraits,
      }
      expect(() => enhancedIdentifyEventSchema.parse(invalidIdentify)).toThrow(/Cannot exceed 255 properties per event/)
    })

    test('should limit trait name length to 255 characters', () => {
      const longTraitName = 'a'.repeat(256)
      const invalidIdentify = {
        type: 'identify' as const,
        userId: 'user123',
        traits: {
          [longTraitName]: 'value',
        },
      }
      expect(() => enhancedIdentifyEventSchema.parse(invalidIdentify)).toThrow(
        /Property names cannot exceed 255 characters/
      )
    })

    test('should limit nested trait objects to max 3 levels deep', () => {
      const validNested = {
        type: 'identify' as const,
        userId: 'user123',
        traits: {
          address: {
            billing: {
              street: '123 Main St',
            },
          },
        },
      }
      expect(() => enhancedIdentifyEventSchema.parse(validNested)).not.toThrow()

      const invalidNested = {
        type: 'identify' as const,
        userId: 'user123',
        traits: {
          address: {
            billing: {
              details: {
                tooDeep: 'value',
              },
            },
          },
        },
      }
      expect(() => enhancedIdentifyEventSchema.parse(invalidNested)).toThrow(
        /Nested objects cannot exceed 3 levels deep/
      )
    })
  })

  describe('Required Fields Enforcement', () => {
    test('should require event field for track events', () => {
      const invalid = {
        type: 'track' as const,
        userId: 'user123',
      }
      expect(() => enhancedTrackEventSchema.parse(invalid)).toThrow()
    })

    test('should require groupId for group events', () => {
      const invalid = {
        type: 'group' as const,
        userId: 'user123',
      }
      expect(() => enhancedGroupEventSchema.parse(invalid)).toThrow(/groupId is required/)
    })

    test('should require userId and previousId for alias events', () => {
      const invalidMissingUserId = {
        type: 'alias' as const,
        previousId: 'anon123',
      }
      expect(() => enhancedAliasEventSchema.parse(invalidMissingUserId)).toThrow(/userId is required/)

      const invalidMissingPreviousId = {
        type: 'alias' as const,
        userId: 'user123',
      }
      expect(() => enhancedAliasEventSchema.parse(invalidMissingPreviousId)).toThrow(/previousId is required/)
    })

    test('should require either userId or anonymousId for all events except alias', () => {
      const invalidTrack = {
        type: 'track' as const,
        event: 'Test Event',
      }
      expect(() => enhancedTrackEventSchema.parse(invalidTrack)).toThrow(
        /Either userId or anonymousId must be provided/
      )

      const invalidIdentify = {
        type: 'identify' as const,
      }
      expect(() => enhancedIdentifyEventSchema.parse(invalidIdentify)).toThrow(
        /Either userId or anonymousId must be provided/
      )

      const invalidPage = {
        type: 'page' as const,
      }
      expect(() => enhancedPageEventSchema.parse(invalidPage)).toThrow(/Either userId or anonymousId must be provided/)

      const invalidGroup = {
        type: 'group' as const,
        groupId: 'group123',
      }
      expect(() => enhancedGroupEventSchema.parse(invalidGroup)).toThrow(
        /Either userId or anonymousId must be provided/
      )
    })
  })

  describe('Alias Event Constraints', () => {
    test('should not accept traits field in alias events', () => {
      const invalidWithTraits = {
        type: 'alias' as const,
        userId: 'user123',
        previousId: 'anon123',
        traits: { name: 'John' }, // This should not be allowed
      }
      expect(() => enhancedAliasEventSchema.parse(invalidWithTraits)).toThrow()
    })

    test('should not accept properties field in alias events', () => {
      const invalidWithProperties = {
        type: 'alias' as const,
        userId: 'user123',
        previousId: 'anon123',
        properties: { test: 'value' }, // This should not be allowed
      }
      expect(() => enhancedAliasEventSchema.parse(invalidWithProperties)).toThrow()
    })
  })

  describe('Valid Examples Should Pass', () => {
    test('should accept valid track event', () => {
      const valid: EnhancedTrackPayload = {
        type: 'track',
        event: 'Product Purchased',
        userId: 'user123',
        properties: {
          productId: '12345',
          price: 99.99,
          category: 'Electronics',
        },
        timestamp: '2025-01-15T10:30:00.000Z',
        messageId: 'msg123',
      }
      expect(() => enhancedTrackEventSchema.parse(valid)).not.toThrow()
    })

    test('should accept valid identify event', () => {
      const valid: EnhancedIdentifyPayload = {
        type: 'identify',
        userId: 'user123',
        traits: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          age: 30,
        },
      }
      expect(() => enhancedIdentifyEventSchema.parse(valid)).not.toThrow()
    })

    test('should accept valid page event', () => {
      const valid: EnhancedPagePayload = {
        type: 'page',
        userId: 'user123',
        name: 'Product Detail',
        properties: {
          url: 'https://example.com/product/123',
          title: 'Product 123',
        },
      }
      expect(() => enhancedPageEventSchema.parse(valid)).not.toThrow()
    })

    test('should accept valid group event', () => {
      const valid: EnhancedGroupPayload = {
        type: 'group',
        userId: 'user123',
        groupId: 'company123',
        traits: {
          name: 'Example Corp',
          industry: 'Technology',
          employees: 500,
        },
      }
      expect(() => enhancedGroupEventSchema.parse(valid)).not.toThrow()
    })

    test('should accept valid alias event', () => {
      const valid: EnhancedAliasPayload = {
        type: 'alias',
        userId: 'user123',
        previousId: 'anon123',
      }
      expect(() => enhancedAliasEventSchema.parse(valid)).not.toThrow()
    })
  })

  describe('Complex Validation Scenarios', () => {
    test('should handle nested validation properly', () => {
      const validComplex = {
        type: 'track' as const,
        event: 'Complex Event',
        userId: 'user123',
        properties: {
          product: {
            details: {
              specifications: 'This is at the maximum allowed depth',
            },
            price: 99.99,
          },
          categories: ['electronics', 'mobile'],
          inStock: true,
          metadata: null,
        },
      }
      expect(() => enhancedTrackEventSchema.parse(validComplex)).not.toThrow()
    })

    test('should validate messageId length', () => {
      const invalidMessageId = {
        type: 'track' as const,
        event: 'Test Event',
        userId: 'user123',
        messageId: 'a'.repeat(256),
      }
      expect(() => enhancedTrackEventSchema.parse(invalidMessageId)).toThrow(/messageId cannot exceed 255 characters/)
    })

    test('should validate timestamp format', () => {
      const invalidTimestamp = {
        type: 'track' as const,
        event: 'Test Event',
        userId: 'user123',
        timestamp: 'invalid-date-format',
      }
      expect(() => enhancedTrackEventSchema.parse(invalidTimestamp)).toThrow(
        /timestamp must be a valid ISO 8601 datetime string/
      )
    })
  })
})
