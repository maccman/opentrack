import { aliasEventSchema, groupEventSchema, identifyEventSchema, pageEventSchema, trackEventSchema } from '@app/spec'
import { waitUntil } from '@vercel/functions'
import { defineEventHandler, readBody } from 'h3'

import { integrationManager } from '@/integrations'

/**
 * Payload structure for batch requests containing multiple events
 */
interface BatchPayload {
  /** Array of events to process in a single batch */
  batch: Array<{
    /** Type of event: track, identify, page, group, or alias */
    type: 'track' | 'identify' | 'page' | 'group' | 'alias'
    /** Additional event-specific fields */
    [key: string]: unknown
  }>
}

/**
 * POST /v1/batch
 * 
 * Sends multiple events in a single request for improved performance. Each event in the batch
 * is validated against its respective schema and processed asynchronously. Supports partial
 * success where some events may fail while others succeed.
 * 
 * @route POST /v1/batch
 * 
 * @param {BatchPayload} body - The batch payload containing an array of events
 * @param {Array} body.batch - Required. Array of events to process
 * @param {string} body.batch[].type - Required. Event type (track, identify, page, group, alias)
 * 
 * @returns {Promise<BatchSuccessResponse | BatchErrorResponse>}
 *   Success response with processing summary or error response with details
 * 
 * @typedef BatchSuccessResponse
 * @property {true} success - Indicates successful processing
 * @property {number} processed - Number of successfully processed events
 * @property {number} total - Total number of events in the batch
 * @property {Array} [errors] - Array of errors for failed events (if any partial failures)
 * 
 * @throws {400} Bad Request - When batch array is missing/invalid or no events could be processed
 * 
 * @example
 * ```typescript
 * // Request body
 * {
 *   "batch": [
 *     {
 *       "type": "identify",
 *       "userId": "user_12345",
 *       "traits": {
 *         "email": "john@example.com",
 *         "plan": "premium"
 *       }
 *     },
 *     {
 *       "type": "track",
 *       "userId": "user_12345", 
 *       "event": "Product Purchased",
 *       "properties": {
 *         "productId": "widget_001",
 *         "price": 99.99
 *       }
 *     }
 *   ]
 * }
 * 
 * // Success response
 * {
 *   "success": true,
 *   "processed": 2,
 *   "total": 2,
 *   "errors": []
 * }
 * 
 * // Partial success response
 * {
 *   "success": true,
 *   "processed": 1,
 *   "total": 2,
 *   "errors": [
 *     {
 *       "error": "Invalid payload",
 *       "details": [...],
 *       "type": "track"
 *     }
 *   ]
 * }
 * ```
 * 
 * @example
 * ```bash
 * curl -X POST https://your-deployment.vercel.app/v1/batch \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "batch": [
 *       {
 *         "type": "track",
 *         "userId": "user123",
 *         "event": "Button Clicked"
 *       }
 *     ]
 *   }'
 * ```
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<BatchPayload>(event)

  if (!body.batch || !Array.isArray(body.batch)) {
    event.node.res.statusCode = 400
    return { error: 'Invalid payload: batch array is required' }
  }

  const processedEvents = []
  const errors = []

  for (const item of body.batch) {
    try {
      let validation

      switch (item.type) {
        case 'track':
          validation = trackEventSchema.safeParse(item)
          break
        case 'identify':
          validation = identifyEventSchema.safeParse(item)
          break
        case 'page':
          validation = pageEventSchema.safeParse(item)
          break
        case 'group':
          validation = groupEventSchema.safeParse(item)
          break
        case 'alias':
          validation = aliasEventSchema.safeParse(item)
          break
        default:
          errors.push({ error: `Unknown event type: ${item.type}` })
          continue
      }

      if (!validation.success) {
        errors.push({
          error: 'Invalid payload',
          details: validation.error.issues,
          type: item.type,
        })
        continue
      }

      // Process the validated event
      waitUntil(integrationManager.process(validation.data))
      processedEvents.push({ type: item.type, status: 'processed' })
    } catch (error) {
      errors.push({
        error: 'Processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: item.type,
      })
    }
  }

  // Return success if at least some events were processed
  if (processedEvents.length > 0) {
    const response: {
      success: boolean
      processed: number
      total: number
      errors?: Array<{ error: string; details?: unknown; type?: string }>
    } = {
      success: true,
      processed: processedEvents.length,
      total: body.batch.length,
    }

    if (errors.length > 0) {
      response.errors = errors
    }

    return response
  } else {
    event.node.res.statusCode = 400
    return { error: 'No events could be processed', details: errors }
  }
})
