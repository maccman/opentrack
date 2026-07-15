import type { IntegrationPayload } from '@app/core'
import { waitUntil } from '@vercel/functions'
import { createError, type H3Event } from 'h3'

import { integrationManager } from '@/integrations'

import { getAllowedIntegrationNames } from './ingest-routing'

/**
 * Check durable privacy suppression before acknowledging ingestion, then fan
 * out asynchronously. A configured-but-unavailable ledger returns HTTP 503
 * instead of accepting and silently dropping the event.
 */
export async function queueIngest(event: H3Event, payload: IntegrationPayload): Promise<'queued' | 'suppressed'> {
  const [result] = await queueIngestBatch(event, [payload])
  return result ?? 'suppressed'
}

/**
 * Preflight every payload before queueing any delivery. This keeps a retryable
 * batch-level 503 from duplicating events that were already accepted earlier
 * in the same request.
 */
export async function queueIngestBatch(
  event: H3Event,
  payloads: readonly IntegrationPayload[]
): Promise<Array<'queued' | 'suppressed'>> {
  if (payloads.length === 0) {
    return []
  }

  const allowedIntegrationNames = getAllowedIntegrationNames(event)
  if (allowedIntegrationNames?.some((integrationName) => !integrationManager.hasIntegration(integrationName))) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Analytics destination is temporarily unavailable',
    })
  }

  let suppressed: boolean[]
  try {
    suppressed = await Promise.all(payloads.map(async (payload) => await integrationManager.isSuppressed(payload)))
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'Analytics privacy check is temporarily unavailable',
    })
  }

  const results = payloads.map((payload, index): 'queued' | 'suppressed' => {
    if (suppressed[index]) {
      return 'suppressed'
    }

    waitUntil(
      integrationManager.process(payload, {
        allowedIntegrationNames,
        skipSuppressionCheck: true,
      })
    )
    return 'queued'
  })

  return results
}
