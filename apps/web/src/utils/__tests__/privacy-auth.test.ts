import { afterEach, describe, expect, it, vi } from 'vitest'

import { validatePrivacyAuthorization } from '../privacy-auth'

describe('validatePrivacyAuthorization', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('fails closed when the OpenTrack secret is missing', () => {
    vi.stubEnv('OPENTRACK_SECRET', '')
    expect(validatePrivacyAuthorization('Bearer anything')).toBe('misconfigured')

    vi.stubEnv('OPENTRACK_SECRET', '   ')
    expect(validatePrivacyAuthorization('Bearer anything')).toBe('misconfigured')
  })

  it('fails closed when the OpenTrack secret contains whitespace', () => {
    for (const secret of [' leading', 'trailing ', 'internal whitespace', 'line\nbreak']) {
      vi.stubEnv('OPENTRACK_SECRET', secret)
      expect(validatePrivacyAuthorization(`Bearer ${secret}`)).toBe('misconfigured')
    }
  })

  it('accepts only an exact Bearer match against the OpenTrack secret', () => {
    vi.stubEnv('OPENTRACK_SECRET', 'privacy-secret')
    expect(validatePrivacyAuthorization('Bearer privacy-secret')).toBe('authorized')
    expect(validatePrivacyAuthorization('Bearer privacy-secreu')).toBe('unauthorized')
    expect(validatePrivacyAuthorization('Basic privacy-secret')).toBe('unauthorized')
    expect(validatePrivacyAuthorization('Bearer privacy-secret extra')).toBe('unauthorized')
  })

  it('does not accept WRITE_KEY as privacy authorization', () => {
    vi.stubEnv('OPENTRACK_SECRET', 'privacy-secret')
    vi.stubEnv('WRITE_KEY', 'analytics-write-key')
    expect(validatePrivacyAuthorization('Bearer analytics-write-key')).toBe('unauthorized')
  })

  it('fails closed when the OpenTrack secret is the analytics write key', () => {
    vi.stubEnv('OPENTRACK_SECRET', 'shared-secret')
    vi.stubEnv('WRITE_KEY', 'shared-secret')
    expect(validatePrivacyAuthorization('Bearer shared-secret')).toBe('misconfigured')
  })

  it('rejects absurd headers before digest comparison', () => {
    vi.stubEnv('OPENTRACK_SECRET', 'privacy-secret')
    expect(validatePrivacyAuthorization(`Bearer ${'a'.repeat(5000)}`)).toBe('unauthorized')
  })

  it('keeps the secret limit compatible with the full Authorization header limit', () => {
    const maximumSecret = 'a'.repeat(4096 - 'Bearer '.length)
    vi.stubEnv('OPENTRACK_SECRET', maximumSecret)
    expect(validatePrivacyAuthorization(`Bearer ${maximumSecret}`)).toBe('authorized')

    const oversizedSecret = `${maximumSecret}a`
    vi.stubEnv('OPENTRACK_SECRET', oversizedSecret)
    expect(validatePrivacyAuthorization(`Bearer ${oversizedSecret}`)).toBe('misconfigured')
  })
})
