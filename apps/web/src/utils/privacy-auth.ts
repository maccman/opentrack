import { createHash, timingSafeEqual } from 'node:crypto'

export type PrivacyAuthResult = 'authorized' | 'misconfigured' | 'unauthorized'

const MAX_AUTHORIZATION_LENGTH = 4096
const BEARER_PREFIX = 'Bearer '
const MAX_SECRET_LENGTH = MAX_AUTHORIZATION_LENGTH - BEARER_PREFIX.length

function constantTimeEqual(candidate: string, expected: string): boolean {
  const candidateDigest = createHash('sha256').update(candidate).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(candidateDigest, expectedDigest)
}

/** Validates the server-only OpenTrack credential. */
export function validatePrivacyAuthorization(authorizationHeader: string | undefined): PrivacyAuthResult {
  const expectedSecret = process.env.OPENTRACK_SECRET
  const writeKey = process.env.WRITE_KEY
  if (
    !expectedSecret ||
    /\s/u.test(expectedSecret) ||
    expectedSecret.length > MAX_SECRET_LENGTH ||
    (writeKey !== undefined && expectedSecret === writeKey)
  ) {
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
