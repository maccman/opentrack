import { z } from 'zod'

/** Strict service-to-service request for erasing one Picardo analytics subject. */
export const privacyEraseRequestSchema = z
  .object({
    userId: z.string().uuid(),
  })
  .strict()

/** Idempotency keys are Picardo account-deletion request UUIDs. */
export const privacyEraseIdempotencyKeySchema = z.string().uuid()

export type PrivacyEraseRequest = z.infer<typeof privacyEraseRequestSchema>
