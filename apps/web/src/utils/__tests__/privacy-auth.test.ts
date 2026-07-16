import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { validatePrivacyAuthorization } from '../privacy-auth'

const SECRET = 'a-sufficiently-long-server-secret-value'

describe('validatePrivacyAuthorization', () => {
  let originalSecret: string | undefined
  let originalWriteKey: string | undefined

  beforeEach(() => {
    originalSecret = process.env.OPENTRACK_SECRET
    originalWriteKey = process.env.WRITE_KEY
    process.env.OPENTRACK_SECRET = SECRET
    process.env.WRITE_KEY = 'browser-visible-write-key'
  })

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.OPENTRACK_SECRET
    } else {
      process.env.OPENTRACK_SECRET = originalSecret
    }
    if (originalWriteKey === undefined) {
      delete process.env.WRITE_KEY
    } else {
      process.env.WRITE_KEY = originalWriteKey
    }
  })

  it('authorizes the exact bearer secret', () => {
    expect(validatePrivacyAuthorization(`Bearer ${SECRET}`)).toBe('authorized')
  })

  it('rejects missing, malformed, and wrong credentials', () => {
    expect(validatePrivacyAuthorization(undefined)).toBe('unauthorized')
    expect(validatePrivacyAuthorization(SECRET)).toBe('unauthorized')
    expect(validatePrivacyAuthorization(`Basic ${SECRET}`)).toBe('unauthorized')
    expect(validatePrivacyAuthorization('Bearer wrong-secret-of-comparable-length')).toBe('unauthorized')
    expect(validatePrivacyAuthorization(`Bearer ${SECRET} trailing`)).toBe('unauthorized')
    expect(validatePrivacyAuthorization(`Bearer ${'x'.repeat(5000)}`)).toBe('unauthorized')
  })

  it('reports a missing secret as misconfigured', () => {
    delete process.env.OPENTRACK_SECRET
    expect(validatePrivacyAuthorization(`Bearer ${SECRET}`)).toBe('misconfigured')
  })

  it('reports a short secret as misconfigured', () => {
    process.env.OPENTRACK_SECRET = 'too-short'
    expect(validatePrivacyAuthorization('Bearer too-short')).toBe('misconfigured')
  })

  it('reports a whitespace-containing secret as misconfigured', () => {
    process.env.OPENTRACK_SECRET = 'a secret with spaces that is quite long'
    expect(validatePrivacyAuthorization('Bearer anything')).toBe('misconfigured')
  })

  it('reports an oversized secret as misconfigured', () => {
    process.env.OPENTRACK_SECRET = 'x'.repeat(513)
    expect(validatePrivacyAuthorization(`Bearer ${'x'.repeat(513)}`)).toBe('misconfigured')
  })

  it('never accepts the browser-visible WRITE_KEY as the privacy secret', () => {
    process.env.WRITE_KEY = SECRET
    expect(validatePrivacyAuthorization(`Bearer ${SECRET}`)).toBe('misconfigured')
  })
})
