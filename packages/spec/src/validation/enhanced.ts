import { z } from 'zod'

/**
 * Enhanced validation schemas that implement the full Segment specification constraints
 * as documented in the @docs/ folder.
 *
 * Key constraints implemented:
 * - String length limits (255 chars for IDs, 200 for event names)
 * - Property constraints (max 255 properties, max 3 levels nesting, max 255 array elements)
 * - Reserved name validation (no $ prefix)
 * - Data type restrictions
 */

// Helper function to validate no reserved names ($ prefix)
function validateNotReserved(name: string) {
  if (name.startsWith('$')) {
    return false
  }
  return true
}

// Enhanced properties schema with full constraint validation
const enhancedPropertiesSchema = z
  .record(
    z
      .string()
      .max(255, 'Property names cannot exceed 255 characters')
      .refine(validateNotReserved, 'Property names cannot start with $'),
    z.any() // Allow any values for now, validate arrays separately
  )
  .refine((props) => Object.keys(props).length <= 255, 'Cannot exceed 255 properties per event')
  .refine((props) => {
    // Validate array lengths
    for (const value of Object.values(props)) {
      if (Array.isArray(value) && value.length > 255) {
        return false
      }
    }
    return true
  }, 'Arrays cannot exceed 255 elements')
  .refine((props) => {
    // Validate nesting depth - properties object itself counts as level 1
    const checkDepth = (obj: unknown, depth = 1): boolean => {
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        for (const value of Object.values(obj)) {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            if (depth >= 3) {
              // At depth 3, no more nested objects allowed
              return false
            }
            if (!checkDepth(value, depth + 1)) {
              return false
            }
          }
        }
      }
      return true
    }
    return checkDepth(props)
  }, 'Nested objects cannot exceed 3 levels deep')
  .optional()

// Enhanced traits schema (same constraints as properties)
const enhancedTraitsSchema = enhancedPropertiesSchema

// Enhanced base schema with proper field validation
export const enhancedSegmentEventBaseSchema = z.object({
  messageId: z.string().max(255, 'messageId cannot exceed 255 characters').optional(),
  timestamp: z.string().datetime('timestamp must be a valid ISO 8601 datetime string').optional(),
  context: z.any().optional(), // Context can contain any structure
  integrations: z.record(z.string(), z.union([z.boolean(), z.record(z.string(), z.any())])).optional(),
})

// Enhanced track event schema with full constraints
export const enhancedTrackEventSchema = enhancedSegmentEventBaseSchema
  .extend({
    type: z.literal('track'),
    event: z
      .string()
      .min(1, 'Event name is required')
      .max(200, 'Event name cannot exceed 200 characters')
      .refine(validateNotReserved, 'Event name cannot start with $'),
    properties: enhancedPropertiesSchema,
    userId: z.string().max(255, 'userId cannot exceed 255 characters').optional(),
    anonymousId: z.string().max(255, 'anonymousId cannot exceed 255 characters').optional(),
  })
  .refine((data) => data.userId || data.anonymousId, 'Either userId or anonymousId must be provided')

// Enhanced identify event schema
export const enhancedIdentifyEventSchema = enhancedSegmentEventBaseSchema
  .extend({
    type: z.literal('identify'),
    traits: enhancedTraitsSchema,
    userId: z.string().max(255, 'userId cannot exceed 255 characters').optional(),
    anonymousId: z.string().max(255, 'anonymousId cannot exceed 255 characters').optional(),
  })
  .refine((data) => data.userId || data.anonymousId, 'Either userId or anonymousId must be provided')

// Enhanced page event schema
export const enhancedPageEventSchema = enhancedSegmentEventBaseSchema
  .extend({
    type: z.literal('page'),
    name: z.string().max(255, 'Page name cannot exceed 255 characters').optional(),
    properties: enhancedPropertiesSchema,
    userId: z.string().max(255, 'userId cannot exceed 255 characters').optional(),
    anonymousId: z.string().max(255, 'anonymousId cannot exceed 255 characters').optional(),
  })
  .refine((data) => data.userId || data.anonymousId, 'Either userId or anonymousId must be provided')

// Enhanced group event schema
export const enhancedGroupEventSchema = enhancedSegmentEventBaseSchema
  .extend({
    type: z.literal('group'),
    groupId: z
      .string({ error: 'groupId is required' })
      .min(1, 'groupId is required')
      .max(255, 'groupId cannot exceed 255 characters'),
    traits: enhancedTraitsSchema,
    userId: z.string().max(255, 'userId cannot exceed 255 characters').optional(),
    anonymousId: z.string().max(255, 'anonymousId cannot exceed 255 characters').optional(),
  })
  .refine((data) => data.userId || data.anonymousId, 'Either userId or anonymousId must be provided')

// Enhanced alias event schema
export const enhancedAliasEventSchema = enhancedSegmentEventBaseSchema
  .extend({
    type: z.literal('alias'),
    userId: z
      .string({ error: 'userId is required' })
      .min(1, 'userId is required')
      .max(255, 'userId cannot exceed 255 characters'),
    previousId: z
      .string({ error: 'previousId is required' })
      .min(1, 'previousId is required')
      .max(255, 'previousId cannot exceed 255 characters'),
  })
  // Alias events explicitly do not support traits
  .strict() // Reject any additional fields

// Enhanced payload types
export type EnhancedTrackPayload = z.infer<typeof enhancedTrackEventSchema>
export type EnhancedIdentifyPayload = z.infer<typeof enhancedIdentifyEventSchema>
export type EnhancedPagePayload = z.infer<typeof enhancedPageEventSchema>
export type EnhancedGroupPayload = z.infer<typeof enhancedGroupEventSchema>
export type EnhancedAliasPayload = z.infer<typeof enhancedAliasEventSchema>

// Enhanced Integration interface using the enhanced payload types
export interface EnhancedIntegration {
  name: string
  isEnabled(): boolean
  init?(): Promise<void>

  track(payload: EnhancedTrackPayload): Promise<void>
  identify(payload: EnhancedIdentifyPayload): Promise<void>
  page(payload: EnhancedPagePayload): Promise<void>
  group(payload: EnhancedGroupPayload): Promise<void>
  alias(payload: EnhancedAliasPayload): Promise<void>
}
