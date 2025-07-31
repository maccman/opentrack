import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'

import { eventNameToTableName } from './case-converter'

type Payload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload

/**
 * Utility functions for mapping Segment payloads to BigQuery table names
 */

/**
 * Determines the appropriate BigQuery table name for a given payload
 * @param payload - The Segment payload
 * @returns The table name where this payload should be stored
 */
export function getTableName(payload: Payload): string {
  if (payload.type === 'track') {
    // Convert event name to snake_case table name
    return eventNameToTableName(payload.event)
  }

  // Handle proper pluralization for different types
  switch (payload.type) {
    case 'identify':
      return 'identifies'
    case 'alias':
      return 'aliases'
    default:
      return `${payload.type}s` // pages, groups
  }
}

/**
 * Gets all table names that should receive data for a given payload
 * @param payload - The Segment payload
 * @returns Array of table names
 */
export function getTableNames(payload: Payload): string[] {
  const tables = [getTableName(payload)]

  // Track events also go to the tracks table
  if (payload.type === 'track') {
    tables.push('tracks')
  }

  return tables
}
