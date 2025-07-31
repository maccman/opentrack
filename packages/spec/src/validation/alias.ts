import { z } from 'zod'

import { segmentEventBaseSchema } from './track'

export const aliasEventSchema = segmentEventBaseSchema.extend({
  type: z.literal('alias'),
  userId: z.string(),
  previousId: z.string(),
})

export type AliasPayload = z.infer<typeof aliasEventSchema>
