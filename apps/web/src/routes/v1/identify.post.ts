import { identifyEventSchema, type IdentifyPayload } from '@app/spec'
import { waitUntil } from '@vercel/functions'
import { defineEventHandler, readBody } from 'h3'

import { integrationManager } from '@/integrations'

/**
 * POST /v1/identify
 * 
 * Sets user traits and associates anonymous activity with known users. This endpoint is typically
 * called when a user signs up, logs in, or updates their profile information.
 * 
 * @route POST /v1/identify
 * 
 * @param {IdentifyPayload} body - The identify payload containing user information
 * @param {string} [body.userId] - User identifier (required if anonymousId not provided)
 * @param {string} [body.anonymousId] - Anonymous user identifier (required if userId not provided)
 * @param {object} [body.traits] - Optional. User attributes and properties
 * @param {string} [body.traits.email] - User's email address
 * @param {string} [body.traits.firstName] - User's first name
 * @param {string} [body.traits.lastName] - User's last name
 * @param {string} [body.traits.company] - User's company name
 * @param {string} [body.traits.plan] - User's subscription plan
 * @param {object} [body.context] - Optional. Additional context information (IP, userAgent, etc.)
 * @param {string} [body.timestamp] - Optional. ISO 8601 timestamp of when the event occurred
 * @param {string} [body.messageId] - Optional. Unique identifier for this message
 * @param {object} [body.integrations] - Optional. Integration-specific settings
 * 
 * @returns {Promise<{success: true} | {error: string, details: object[]}>} 
 *   Success response with {success: true} or error response with validation details
 * 
 * @throws {400} Bad Request - When payload validation fails or required fields are missing
 * 
 * @example
 * ```typescript
 * // Request body
 * {
 *   "userId": "user_12345",
 *   "anonymousId": "anon_abc123",
 *   "traits": {
 *     "email": "john.doe@example.com",
 *     "firstName": "John",
 *     "lastName": "Doe",
 *     "company": "Example Corp",
 *     "plan": "premium",
 *     "signupSource": "organic_search"
 *   },
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
 * curl -X POST https://your-deployment.vercel.app/v1/identify \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId": "user_12345",
 *     "traits": {
 *       "email": "john@example.com",
 *       "firstName": "John",
 *       "plan": "premium"
 *     }
 *   }'
 * ```
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<IdentifyPayload>(event)
  const validation = identifyEventSchema.safeParse({
    ...body,
    type: 'identify',
  })

  if (!validation.success) {
    event.node.res.statusCode = 400
    return { error: 'Invalid payload', details: validation.error.issues }
  }

  waitUntil(integrationManager.process(validation.data))

  return { success: true }
})
