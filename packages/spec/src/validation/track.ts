import { z } from 'zod'

export const segmentEventBaseSchema = z.object({
  messageId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  context: z.any().optional(),
  integrations: z.any().optional(),
  writeKey: z.string().optional(),
})

export const trackEventSchema = segmentEventBaseSchema
  .extend({
    type: z.literal('track'),
    event: z.string(),
    properties: z.record(z.string(), z.any()).optional(),
    userId: z.string().optional(),
    anonymousId: z.string().optional(),
  })
  .refine((data) => data.userId || data.anonymousId, {
    message: 'Either userId or anonymousId must be provided.',
  })

export type TrackPayload = z.infer<typeof trackEventSchema>
