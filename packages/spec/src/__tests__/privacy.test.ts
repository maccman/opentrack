import { describe, expect, it } from 'vitest'

import { privacyEraseIdempotencyKeySchema, privacyEraseRequestSchema } from '../privacy'

describe('privacy erasure contract', () => {
  it('accepts only a strict UUID subject body', () => {
    const body = { userId: 'b9a54fe6-c995-4f14-9d85-0769b11dfe57' }
    expect(privacyEraseRequestSchema.safeParse(body).success).toBe(true)
    expect(privacyEraseRequestSchema.safeParse({ ...body, email: 'sensitive@example.com' }).success).toBe(false)
    expect(privacyEraseRequestSchema.safeParse({ userId: 'not-a-uuid' }).success).toBe(false)
  })

  it('requires a UUID Idempotency-Key', () => {
    expect(privacyEraseIdempotencyKeySchema.safeParse('f0509ab9-ecbe-4cab-b04a-af9693434589').success).toBe(true)
    expect(privacyEraseIdempotencyKeySchema.safeParse('request-123').success).toBe(false)
  })
})
