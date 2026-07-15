import { z } from 'zod'

/** Strict service-to-service request for erasing one analytics subject. */
export const privacyEraseRequestSchema = z
  .object({
    userId: z.string().uuid(),
  })
  .strict()

export type PrivacyEraseRequest = z.infer<typeof privacyEraseRequestSchema>
