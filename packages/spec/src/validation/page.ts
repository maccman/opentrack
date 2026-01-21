import { z } from 'zod'

import { segmentEventBaseSchema } from './track'

export const pageEventSchema = segmentEventBaseSchema
  .extend({
    type: z.literal('page'),
    name: z.string().optional(),
    properties: z.record(z.string(), z.any()).optional(),
    userId: z.string().optional(),
    anonymousId: z.string().optional(),
  })
  .refine((data) => data.userId || data.anonymousId, {
    message: 'Either userId or anonymousId must be provided.',
  })

export type PagePayload = z.infer<typeof pageEventSchema>
