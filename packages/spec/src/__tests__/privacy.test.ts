import { describe, expect, it } from 'vitest'

import { createRegulationRequestSchema, MAX_REGULATION_SUBJECT_IDS } from '../privacy'

const validRequest = {
  regulationType: 'DELETE_ONLY',
  subjectType: 'USER_ID',
  subjectIds: ['user_12345'],
}

describe('createRegulationRequestSchema', () => {
  it('accepts a DELETE_ONLY regulation for arbitrary string user ids', () => {
    const result = createRegulationRequestSchema.safeParse(validRequest)
    expect(result.success).toBe(true)
  })

  it('accepts every identifier shape the ingestion API accepts', () => {
    const subjectIds = ['b9a54fe6-c995-4f14-9d85-0769b11dfe57', 'user@example.com', '42', 'x'.repeat(255)]
    const result = createRegulationRequestSchema.safeParse({ ...validRequest, subjectIds })
    expect(result.success).toBe(true)
  })

  it('rejects suppression-style regulation types', () => {
    const result = createRegulationRequestSchema.safeParse({
      ...validRequest,
      regulationType: 'SUPPRESS_WITH_DELETE',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown subject types', () => {
    const result = createRegulationRequestSchema.safeParse({ ...validRequest, subjectType: 'OBJECT_ID' })
    expect(result.success).toBe(false)
  })

  it('rejects unexpected fields', () => {
    const result = createRegulationRequestSchema.safeParse({ ...validRequest, email: 'a@example.com' })
    expect(result.success).toBe(false)
  })

  it('rejects empty, oversized, padded, and control-character subject ids', () => {
    for (const subjectIds of [
      [],
      [''],
      ['x'.repeat(256)],
      [' padded '],
      ['line\nbreak'],
      Array.from({ length: MAX_REGULATION_SUBJECT_IDS + 1 }, (_, index) => `user_${index}`),
    ]) {
      const result = createRegulationRequestSchema.safeParse({ ...validRequest, subjectIds })
      expect(result.success).toBe(false)
    }
  })
})
