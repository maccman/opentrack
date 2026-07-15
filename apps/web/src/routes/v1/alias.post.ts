import type { AliasPayload } from '@app/spec'
import { aliasEventSchema } from '@app/spec'
import { waitUntil } from '@vercel/functions'
import { defineEventHandler, readBody } from 'h3'

import { integrationManager } from '@/integrations'

/**
 * POST /v1/alias
 *
 * Merges user identities across sessions or devices. This endpoint allows you to connect
 * anonymous user activity with known user identities when they sign up or log in.
 *
 * @route POST /v1/alias
 *
 * @param {AliasPayload} body - The alias payload containing user identity information
 * @param {string} body.userId - Required. The new user identifier to merge to
 * @param {string} body.previousId - Required. The previous identifier to merge from (usually anonymousId)
 * @param {object} [body.context] - Optional. Additional context information (IP, userAgent, etc.)
 * @param {string} [body.timestamp] - Optional. ISO 8601 timestamp of when the event occurred
 * @param {string} [body.messageId] - Optional. Unique identifier for this message
 * @param {object} [body.integrations] - Optional. Integration-specific settings
 *
 * @returns {Promise<{success: true} | {error: string, details: object[]}>}
 *   Success response with {success: true} or error response with validation details
 *
 * @throws {400} Bad Request - When payload validation fails
 *
 * @example
 * ```typescript
 * // Request body
 * {
 *   "userId": "user_12345",
 *   "previousId": "anon_abc123",
 *   "timestamp": "2025-01-15T14:30:00.000Z"
 * }
 *
 * // Success response
 * {
 *   "success": true
 * }
 * ```
 *
 * @example
 * ```bash
 * curl -X POST https://your-deployment.vercel.app/v1/alias \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId": "user_12345",
 *     "previousId": "anon_abc123"
 *   }'
 * ```
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<AliasPayload>(event)
  const validation = aliasEventSchema.safeParse({ ...body, type: 'alias' })

  if (!validation.success) {
    event.node.res.statusCode = 400
    return { error: 'Invalid payload', details: validation.error.issues }
  }

  waitUntil(integrationManager.process(validation.data))

  return { success: true }
})
