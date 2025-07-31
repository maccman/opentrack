import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'

import { eventNameToTableName } from './case-converter'
import { flattenObject } from './object-flattener'

type Payload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload

/**
 * Utility functions for transforming Segment payloads into BigQuery rows
 */

/**
 * Creates the base row with common fields for all event types
 * @param payload - The Segment payload
 * @returns Base row with common fields
 */
function createBaseRow(payload: Payload): Record<string, unknown> {
  const now = new Date()
  const timestamp = payload.timestamp ? new Date(payload.timestamp) : now

  return {
    id: payload.messageId,
    received_at: now,
    sent_at: timestamp,
    timestamp,
    uuid_ts: now,
    loaded_at: now,
  }
}

/**
 * Adds user identifiers to the row
 * @param row - The row object to modify
 * @param payload - The Segment payload
 */
function addUserIdentifiers(row: Record<string, unknown>, payload: Payload): void {
  if (payload.userId) {
    row.user_id = payload.userId
  }

  // Alias events don't include anonymous_id
  if (payload.type !== 'alias' && payload.anonymousId) {
    row.anonymous_id = payload.anonymousId
  }
}

/**
 * Adds flattened context properties to the row
 * @param row - The row object to modify
 * @param payload - The Segment payload
 */
function addContextFields(row: Record<string, unknown>, payload: Payload): void {
  if (payload.context) {
    const flattenedContext = flattenObject(payload.context as Record<string, unknown>, 'context')
    Object.assign(row, flattenedContext)
  }
}

/**
 * Adds type-specific fields based on the payload type
 * @param row - The row object to modify
 * @param payload - The Segment payload
 */
function addTypeSpecificFields(row: Record<string, unknown>, payload: Payload): void {
  switch (payload.type) {
    case 'track':
      row.event = eventNameToTableName(payload.event)
      row.event_text = payload.event

      if (payload.properties) {
        const flattenedProps = flattenObject(payload.properties)
        Object.assign(row, flattenedProps)
      }
      break

    case 'identify':
      if (payload.traits) {
        const flattenedTraits = flattenObject(payload.traits)
        Object.assign(row, flattenedTraits)
      }
      break

    case 'page':
      if (payload.name) {
        row.name = payload.name
      }

      if (payload.properties) {
        const flattenedProps = flattenObject(payload.properties)
        Object.assign(row, flattenedProps)
      }
      break

    case 'group':
      row.group_id = payload.groupId

      if (payload.traits) {
        const flattenedTraits = flattenObject(payload.traits)
        Object.assign(row, flattenedTraits)
      }
      break

    case 'alias':
      row.previous_id = payload.previousId
      break

    default:
      throw new Error(`Unknown payload type: ${(payload as { type?: string }).type}`)
  }
}

/**
 * Transforms a Segment payload into a BigQuery row following Segment conventions
 * @param payload - The Segment payload to transform
 * @returns BigQuery row object with proper column names and values
 */
export function transformToRow(payload: Payload): Record<string, unknown> {
  const row = createBaseRow(payload)

  addUserIdentifiers(row, payload)
  addContextFields(row, payload)
  addTypeSpecificFields(row, payload)

  return row
}
