import { createHash, timingSafeEqual } from 'node:crypto'

export type PrivacyAuthResult = 'authorized' | 'misconfigured' | 'unauthorized'

const MAX_AUTHORIZATION_LENGTH = 4096

function constantTimeEqual(candidate: string, expected: string): boolean {
  const candidateDigest = createHash('sha256').update(candidate).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(candidateDigest, expectedDigest)
}

/** Validates the server-only OpenTrack credential. */
export function validatePrivacyAuthorization(authorizationHeader: string | undefined): PrivacyAuthResult {
  const expectedSecret = process.env.OPENTRACK_SECRET
  if (!expectedSecret || expectedSecret.trim().length === 0 || expectedSecret.length > MAX_AUTHORIZATION_LENGTH) {
    return 'misconfigured'
  }

  if (!authorizationHeader || authorizationHeader.length > MAX_AUTHORIZATION_LENGTH) {
    return 'unauthorized'
  }

  const match = authorizationHeader.match(/^Bearer (\S+)$/)
  if (!match) {
    return 'unauthorized'
  }

  return constantTimeEqual(match[1], expectedSecret) ? 'authorized' : 'unauthorized'
}
