import { createHash, timingSafeEqual } from 'node:crypto'

export type PrivacyAuthResult = 'authorized' | 'misconfigured' | 'unauthorized'

/**
 * `OPENTRACK_SECRET` guards destructive server-to-server endpoints, so a weak
 * value is treated as no value at all: the endpoint fails closed instead of
 * accepting a guessable credential.
 */
export const MIN_SECRET_LENGTH = 32
const MAX_SECRET_LENGTH = 512
const MAX_AUTHORIZATION_LENGTH = 4096

/** Compares equal-length SHA-256 digests so the comparison cost never depends on the candidate. */
function constantTimeEqual(candidate: string, expected: string): boolean {
  const candidateDigest = createHash('sha256').update(candidate).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(candidateDigest, expectedDigest)
}

/**
 * Validates the `Authorization: Bearer <OPENTRACK_SECRET>` header for internal
 * privacy routes.
 *
 * Returns `misconfigured` when the deployment's secret is unusable: missing,
 * shorter than {@link MIN_SECRET_LENGTH}, containing whitespace, or equal to the
 * browser-visible `WRITE_KEY` (which clients embed in web pages and must never
 * authorize deletions).
 */
export function validatePrivacyAuthorization(authorizationHeader: string | undefined): PrivacyAuthResult {
  const expectedSecret = process.env.OPENTRACK_SECRET
  const writeKey = process.env.WRITE_KEY

  if (
    !expectedSecret ||
    expectedSecret.length < MIN_SECRET_LENGTH ||
    expectedSecret.length > MAX_SECRET_LENGTH ||
    /\s/u.test(expectedSecret) ||
    (writeKey !== undefined && expectedSecret === writeKey)
  ) {
    return 'misconfigured'
  }

  if (!authorizationHeader || authorizationHeader.length > MAX_AUTHORIZATION_LENGTH) {
    return 'unauthorized'
  }

  const match = /^Bearer (\S+)$/.exec(authorizationHeader)
  if (!match) {
    return 'unauthorized'
  }

  return constantTimeEqual(match[1], expectedSecret) ? 'authorized' : 'unauthorized'
}
