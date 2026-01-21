/**
 * Authentication Plugin - Write Key Validation
 *
 * Validates writeKey authentication for all /v1/* API routes.
 * Supports two authentication methods:
 * 1. Authorization header: "Basic base64(writeKey:)"
 * 2. writeKey field in request body (accepted by Zod schemas)
 *
 * Environment Variables:
 * - WRITE_KEY: The expected write key value. If not set, authentication is disabled.
 *
 * When authentication is required:
 * - If writeKey is valid: request proceeds
 * - If writeKey is invalid/missing: returns 401 Unauthorized
 *
 * When authentication is not required (WRITE_KEY not set):
 * - All requests proceed without authentication
 */

import { readBody, setResponseStatus } from 'h3'

import {
  createUnauthorizedResponse,
  extractWriteKeyFromBody,
  extractWriteKeyFromHeader,
  isAuthRequired,
  validateWriteKey,
} from '@/utils/auth'

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
      event.node.res.setHeader('Content-Type', 'application/json')
      event.node.res.end(JSON.stringify(createUnauthorizedResponse()))
      return
    }
  })
})
