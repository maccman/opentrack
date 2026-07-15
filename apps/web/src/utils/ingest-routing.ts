import type { H3Event } from 'h3'

import type { WriteKeyRouting } from './auth'

const ROUTING_CONTEXT_KEY = 'openTrackWriteKeyRouting'
const BIGQUERY_INTEGRATION_NAME = 'BigQuery'

/** Persist the server-resolved source policy on the request, never the key itself. */
export function setWriteKeyRouting(event: H3Event, routing: WriteKeyRouting): void {
  event.context[ROUTING_CONTEXT_KEY] = routing
}

/** Convert the authenticated source policy into an integration allowlist. */
export function getAllowedIntegrationNames(event: H3Event): readonly string[] | undefined {
  return event.context[ROUTING_CONTEXT_KEY] === 'bigquery-only' ? [BIGQUERY_INTEGRATION_NAME] : undefined
}
