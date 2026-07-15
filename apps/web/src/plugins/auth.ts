/**
 * Authentication Plugin - Write Key Validation
 *
 * Validates writeKey authentication for all /v1/* API routes.
 * Supports two authentication methods:
 * 1. Authorization header: "Basic base64(writeKey:)"
 * 2. writeKey field in request body (accepted by Zod schemas)
 *
 * Environment Variables:
 * - WRITE_KEY: Default source key for all configured destinations.
 * - BIGQUERY_ONLY_WRITE_KEY: Product source key restricted to BigQuery.
 * - OPENTRACK_ALLOW_UNAUTHENTICATED_INGEST: Explicit non-production bypass.
 *
 * When authentication is required:
 * - If writeKey is valid: request proceeds
 * - If writeKey is invalid/missing: returns 401 Unauthorized
 *
 * Unauthenticated local/test requests require an explicit bypass and are never allowed in production.
 */

import { readBody, send, setResponseHeader, setResponseStatus } from 'h3'

import {
  createAuthConfigurationErrorResponse,
  createUnauthorizedResponse,
  extractWriteKeyFromBody,
  extractWriteKeyFromHeader,
  getWriteKeyRouting,
  hasConfiguredWriteKey,
  isAuthRequired,
  validateWriteKey,
} from '@/utils/auth'
import { setWriteKeyRouting } from '@/utils/ingest-routing'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    // Only apply to /v1/* routes
    const path = event.node.req.url || ''
    if (!path.startsWith('/v1/')) {
      return
    }

    // Skip OPTIONS requests (CORS preflight)
    if (event.node.req.method === 'OPTIONS') {
      return
    }

    // If auth is not required, allow all requests
    if (!isAuthRequired()) {
      return
    }

    if (!hasConfiguredWriteKey()) {
      setResponseStatus(event, 503)
      setResponseHeader(event, 'Content-Type', 'application/json')
      return await send(event, JSON.stringify(createAuthConfigurationErrorResponse()))
    }

    // Try to extract writeKey from Authorization header first
    const authHeader = event.node.req.headers.authorization
    let writeKey = extractWriteKeyFromHeader(authHeader)

    // If not in header, try to extract from body
    if (!writeKey && event.node.req.method === 'POST') {
      try {
        const body: unknown = await readBody(event)
        writeKey = extractWriteKeyFromBody(body)
      } catch {
        // Body parsing failed, continue with header-only auth
      }
    }

    // Validate the writeKey
    if (!validateWriteKey(writeKey)) {
      setResponseStatus(event, 401)
      setResponseHeader(event, 'Content-Type', 'application/json')
      return await send(event, JSON.stringify(createUnauthorizedResponse()))
    }

    const routing = getWriteKeyRouting(writeKey)
    if (routing) {
      setWriteKeyRouting(event, routing)
    }
  })
})
