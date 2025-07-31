import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'

import { eventNameToTableName } from './case-converter'
import { flattenObject } from './object-flattener'

type Payload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload

/**
 * Utility functions for transforming Segment payloads into BigQuery rows
 */

/**
 * Transforms a Segment payload into a BigQuery row following Segment conventions
 * @param payload - The Segment payload to transform
 * @returns BigQuery row object with proper column names and values
 */
export function transformToRow(payload: Payload): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: payload.messageId,
    received_at: new Date(),
    sent_at: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    uuid_ts: new Date(),
    loaded_at: new Date(),
  }

  // Add user identifiers
  if (payload.userId) {
    row.user_id = payload.userId
  }
  if (payload.type !== 'alias' && payload.anonymousId) {
    row.anonymous_id = payload.anonymousId
  }

  // Flatten context properties
  if (payload.context) {
    const flattenedContext = flattenObject(payload.context, 'context')
    Object.assign(row, flattenedContext)
  }

  // Add type-specific fields
  switch (payload.type) {
    case 'track':
      row.event = eventNameToTableName(payload.event)
      row.event_text = payload.event

      // Flatten properties as top-level columns
      if (payload.properties) {
        const flattenedProps = flattenObject(payload.properties)
        Object.assign(row, flattenedProps)
      }
      break

    case 'identify':
      // Flatten traits as top-level columns
      if (payload.traits) {
        const flattenedTraits = flattenObject(payload.traits)
        Object.assign(row, flattenedTraits)
      }
      break

    case 'page':
      if (payload.name) {
        row.name = payload.name
      }

      // Flatten properties as top-level columns
      if (payload.properties) {
        const flattenedProps = flattenObject(payload.properties)
        Object.assign(row, flattenedProps)
      }
      break

    case 'group':
      row.group_id = payload.groupId

      // Flatten traits as top-level columns
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

  return row
}
