import { trackEventSchema, type TrackPayload } from '@app/spec'
import { waitUntil } from '@vercel/functions'
import { defineEventHandler, readBody } from 'h3'

import { integrationManager } from '@/integrations'

/**
 * POST /v1/track
 * 
 * Records user actions and custom events. This is the most flexible endpoint for tracking
 * any user behavior, from button clicks to complex business events like purchases.
 * 
 * @route POST /v1/track
 * 
 * @param {TrackPayload} body - The track payload containing event information
 * @param {string} [body.userId] - User identifier (required if anonymousId not provided)
 * @param {string} [body.anonymousId] - Anonymous user identifier (required if userId not provided)
 * @param {string} body.event - Required. Name of the event being tracked
 * @param {object} [body.properties] - Optional. Event-specific data and metadata
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
 *   "event": "Product Purchased",
 *   "properties": {
 *     "productId": "widget_001",
 *     "productName": "Premium Widget",
 *     "price": 99.99,
 *     "currency": "USD",
 *     "category": "Electronics",
 *     "quantity": 1,
 *     "discount": 10.00
 *   },
 *   "context": {
 *     "ip": "192.168.1.1",
 *     "userAgent": "Mozilla/5.0...",
 *     "page": {
 *       "url": "https://store.example.com/checkout",
 *       "title": "Checkout - Example Store"
 *     }
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
 * curl -X POST https://your-deployment.vercel.app/v1/track \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId": "user_12345",
 *     "event": "Button Clicked",
 *     "properties": {
 *       "buttonText": "Sign Up",
 *       "location": "header"
 *     }
 *   }'
 * ```
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<TrackPayload>(event)
  const validation = trackEventSchema.safeParse({ ...body, type: 'track' })

  if (!validation.success) {
    event.node.res.statusCode = 400
    return { error: 'Invalid payload', details: validation.error.issues }
  }

  waitUntil(integrationManager.process(validation.data))

  return { success: true }
})
