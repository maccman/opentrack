// Batch Request Utilities

import type { EventPayload } from '@/types'

/**
 * Browsers refuse keepalive fetches and beacons once the bodies of those still
 * in flight would exceed 64 KB in total.
 */
export const KEEPALIVE_BYTE_LIMIT = 64 * 1024

/**
 * Batches are split below the keepalive budget, leaving room for single events
 * sent at the same time.
 */
export const BATCH_BYTE_LIMIT = 60 * 1024

export interface BatchChunk {
  events: EventPayload[]
  body: string
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

/**
 * Serializes an event, or returns null when its properties hold a BigInt or a
 * circular reference
 */
export function serializeEvent(event: EventPayload): string | null {
  try {
    return JSON.stringify(event)
  } catch {
    return null
  }
}

function buildBatchBody(items: string[], writeKey?: string): string {
  const writeKeyField = writeKey ? `,"writeKey":${JSON.stringify(writeKey)}` : ''
  return `{"batch":[${items.join(',')}]${writeKeyField}}`
}

/**
 * Splits events into `/v1/batch` bodies of at most BATCH_BYTE_LIMIT bytes,
 * keeping their order. An event too large to share a body gets one of its own.
 * `writeKey` goes at the top level of each body, for beacons, which can't send
 * an Authorization header.
 */
export function buildBatchChunks(
  events: EventPayload[],
  writeKey?: string
): { chunks: BatchChunk[]; unserializable: EventPayload[] } {
  const emptyBodyBytes = byteLength(buildBatchBody([], writeKey))
  const chunks: BatchChunk[] = []
  const unserializable: EventPayload[] = []
  let chunkEvents: EventPayload[] = []
  let chunkItems: string[] = []
  let chunkBytes = emptyBodyBytes

  const closeChunk = () => {
    if (chunkItems.length > 0) {
      chunks.push({ events: chunkEvents, body: buildBatchBody(chunkItems, writeKey) })
    }
    chunkEvents = []
    chunkItems = []
    chunkBytes = emptyBodyBytes
  }

  for (const event of events) {
    const item = serializeEvent(event)
    if (item === null) {
      unserializable.push(event)
      continue
    }

    // Items after the first are preceded by a comma
    const itemBytes = byteLength(item)
    if (chunkItems.length > 0 && chunkBytes + 1 + itemBytes > BATCH_BYTE_LIMIT) {
      closeChunk()
    }
    chunkBytes += (chunkItems.length > 0 ? 1 : 0) + itemBytes
    chunkEvents.push(event)
    chunkItems.push(item)
  }
  closeChunk()

  return { chunks, unserializable }
}
