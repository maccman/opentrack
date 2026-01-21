import { z } from 'zod'

import { segmentEventBaseSchema } from './track'

export const identifyEventSchema = segmentEventBaseSchema
  .extend({
    type: z.literal('identify'),
    traits: z.record(z.string(), z.any()).optional(),
    userId: z.string().optional(),
    anonymousId: z.string().optional(),
  })
  .refine((data) => data.userId || data.anonymousId, {
    message: 'Either userId or anonymousId must be provided.',
  })

export type IdentifyPayload = z.infer<typeof identifyEventSchema>
