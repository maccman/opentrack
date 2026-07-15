import { afterEach, describe, expect, it, vi } from 'vitest'

import { validatePrivacyAuthorization } from '../privacy-auth'

describe('validatePrivacyAuthorization', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('fails closed when the dedicated secret is missing', () => {
    vi.stubEnv('OPENTRACK_ERASURE_SECRET', '')
    expect(validatePrivacyAuthorization('Bearer anything')).toBe('misconfigured')

    vi.stubEnv('OPENTRACK_ERASURE_SECRET', '   ')
    expect(validatePrivacyAuthorization('Bearer anything')).toBe('misconfigured')
  })

  it('accepts only an exact Bearer match against the dedicated secret', () => {
    vi.stubEnv('OPENTRACK_ERASURE_SECRET', 'privacy-secret')
    expect(validatePrivacyAuthorization('Bearer privacy-secret')).toBe('authorized')
    expect(validatePrivacyAuthorization('Bearer privacy-secreu')).toBe('unauthorized')
    expect(validatePrivacyAuthorization('Basic privacy-secret')).toBe('unauthorized')
    expect(validatePrivacyAuthorization('Bearer privacy-secret extra')).toBe('unauthorized')
  })

  it('does not accept WRITE_KEY as privacy authorization', () => {
    vi.stubEnv('OPENTRACK_ERASURE_SECRET', 'privacy-secret')
    vi.stubEnv('WRITE_KEY', 'analytics-write-key')
    expect(validatePrivacyAuthorization('Bearer analytics-write-key')).toBe('unauthorized')
  })

  it('rejects absurd headers before digest comparison', () => {
    vi.stubEnv('OPENTRACK_ERASURE_SECRET', 'privacy-secret')
    expect(validatePrivacyAuthorization(`Bearer ${'a'.repeat(5000)}`)).toBe('unauthorized')
  })
})
