/**
 * Authentication Utilities
 *
 * Handles writeKey authentication for the analytics API.
 * Supports both Authorization header (Basic auth) and writeKey in request body.
 *
 * Environment Variables:
 * - WRITE_KEY: The default source key, routed to every configured integration.
 * - BIGQUERY_ONLY_WRITE_KEY: Optional public product-analytics key restricted to BigQuery.
 * - OPENTRACK_ALLOW_UNAUTHENTICATED_INGEST: Explicit local/test-only bypass.
 */

/**
 * Get the configured write key from environment
 * Returns null if not configured.
 */
export function getConfiguredWriteKey(): string | null {
  const writeKey = process.env.WRITE_KEY?.trim()
  return writeKey || null
}

/** Return the optional source key whose events may only reach BigQuery. */
export function getConfiguredBigQueryOnlyWriteKey(): string | null {
  const writeKey = process.env.BIGQUERY_ONLY_WRITE_KEY?.trim()
  return writeKey || null
}

export type WriteKeyRouting = 'all' | 'bigquery-only'

/** Resolve an authenticated source key to its server-enforced destination policy. */
export function getWriteKeyRouting(writeKey: string | null): WriteKeyRouting | null {
  if (!writeKey) {
    return null
  }

  // Prefer the restrictive policy if deployment configuration accidentally
  // gives both sources the same value.
  if (writeKey === getConfiguredBigQueryOnlyWriteKey()) {
    return 'bigquery-only'
  }
  if (writeKey === getConfiguredWriteKey()) {
    return 'all'
  }
  return null
}

export function hasConfiguredWriteKey(): boolean {
  return getConfiguredWriteKey() !== null || getConfiguredBigQueryOnlyWriteKey() !== null
}

/**
 * The unauthenticated bypass is explicit and is never honored in production.
 */
export function isUnauthenticatedIngestAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.OPENTRACK_ALLOW_UNAUTHENTICATED_INGEST === 'true'
}

/** Authentication is the default in every environment. */
export function isAuthRequired(): boolean {
  return hasConfiguredWriteKey() || !isUnauthenticatedIngestAllowed()
}

/**
 * Extract writeKey from Authorization header (Basic auth)
 * Format: "Basic base64(writeKey:)"
 */
export function extractWriteKeyFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null
  }

  const basicMatch = authHeader.match(/^basic\s+(.+)$/i)
  if (!basicMatch) {
    return null
  }

  try {
    // Decode base64: "writeKey:" -> extract writeKey
    const decoded = Buffer.from(basicMatch[1], 'base64').toString('utf-8')
    // Format is "writeKey:" or "writeKey:password" - we only use the username part
    const [writeKey] = decoded.split(':')
    return writeKey || null
  } catch {
    return null
  }
}

/**
 * Extract writeKey from request body
 */
export function extractWriteKeyFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null
  }

  const bodyObj = body as Record<string, unknown>
  return typeof bodyObj.writeKey === 'string' ? bodyObj.writeKey : null
}

/**
 * Validate writeKey against configured value
 */
export function validateWriteKey(writeKey: string | null): boolean {
  // Missing configuration is accepted only by the explicit non-production bypass.
  if (!hasConfiguredWriteKey()) {
    return isUnauthenticatedIngestAllowed()
  }

  return getWriteKeyRouting(writeKey) !== null
}

/**
 * Create a 401 Unauthorized response object
 */
export function createUnauthorizedResponse(): { error: string; type: string } {
  return {
    error: 'Invalid write key',
    type: 'authentication_error',
  }
}

export function createAuthConfigurationErrorResponse(): { error: string; type: string } {
  return {
    error: 'Analytics ingestion is not configured',
    type: 'configuration_error',
  }
}
