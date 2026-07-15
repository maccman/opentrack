import { groupEventSchema, type GroupPayload } from '@app/spec'
import { waitUntil } from '@vercel/functions'
import { defineEventHandler, readBody } from 'h3'

import { integrationManager } from '@/integrations'

/**
 * POST /v1/group
 *
 * Associates users with groups, companies, or accounts. This is particularly useful for B2B
 * applications where you need to track which organization or team a user belongs to.
 *
 * @route POST /v1/group
 *
 * @param {GroupPayload} body - The group payload containing user and group information
 * @param {string} [body.userId] - User identifier (required if anonymousId not provided)
 * @param {string} [body.anonymousId] - Anonymous user identifier (required if userId not provided)
 * @param {string} body.groupId - Required. Unique identifier for the group/organization
 * @param {object} [body.traits] - Optional. Group attributes and properties
 * @param {string} [body.traits.name] - Group/company name
 * @param {string} [body.traits.plan] - Subscription plan or tier
 * @param {number} [body.traits.employees] - Number of employees
 * @param {string} [body.traits.industry] - Industry sector
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
 *   "groupId": "company_567",
 *   "traits": {
 *     "name": "Example Corporation",
 *     "plan": "enterprise",
 *     "employees": 500,
 *     "industry": "Technology",
 *     "website": "https://example.com"
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
 * curl -X POST https://your-deployment.vercel.app/v1/group \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId": "user_12345",
 *     "groupId": "company_567",
 *     "traits": {
 *       "name": "Example Corporation",
 *       "plan": "enterprise"
 *     }
 *   }'
 * ```
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<GroupPayload>(event)
  const validation = groupEventSchema.safeParse({ ...body, type: 'group' })

  if (!validation.success) {
    event.node.res.statusCode = 400
    return { error: 'Invalid payload', details: validation.error.issues }
  }

  waitUntil(integrationManager.process(validation.data))

  return { success: true }
})
