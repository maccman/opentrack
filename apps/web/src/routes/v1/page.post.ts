import { pageEventSchema, type PagePayload } from '@app/spec'
import { waitUntil } from '@vercel/functions'
import { defineEventHandler, readBody } from 'h3'

import { integrationManager } from '@/integrations'

/**
 * POST /v1/page
 * 
 * Records page views and screen navigation. This endpoint tracks when users visit pages
 * on your website or navigate between screens in your application.
 * 
 * @route POST /v1/page
 * 
 * @param {PagePayload} body - The page payload containing page view information
 * @param {string} [body.userId] - User identifier (required if anonymousId not provided)
 * @param {string} [body.anonymousId] - Anonymous user identifier (required if userId not provided)
 * @param {string} [body.name] - Optional. Human-readable page name (e.g., "Product Detail")
 * @param {string} [body.category] - Optional. Page category (e.g., "E-commerce", "Documentation")
 * @param {object} [body.properties] - Optional. Page-specific data and metadata
 * @param {string} [body.properties.url] - Page URL
 * @param {string} [body.properties.title] - Page title
 * @param {string} [body.properties.referrer] - Referring page URL
 * @param {string} [body.properties.path] - URL path
 * @param {string} [body.properties.search] - URL query parameters
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
 *   "name": "Product Detail",
 *   "category": "E-commerce",
 *   "properties": {
 *     "url": "https://store.example.com/products/widget",
 *     "title": "Premium Widget - Example Store",
 *     "referrer": "https://store.example.com/category/electronics",
 *     "productId": "widget_001",
 *     "productCategory": "Electronics"
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
 * curl -X POST https://your-deployment.vercel.app/v1/page \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId": "user_12345",
 *     "name": "Home Page",
 *     "properties": {
 *       "url": "https://example.com",
 *       "title": "Welcome to Example"
 *     }
 *   }'
 * ```
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<PagePayload>(event)
  const validation = pageEventSchema.safeParse({ ...body, type: 'page' })

  if (!validation.success) {
    event.node.res.statusCode = 400
    return { error: 'Invalid payload', details: validation.error.issues }
  }

  waitUntil(integrationManager.process(validation.data))

  return { success: true }
})
