import { describe, expect, it } from 'vitest'

import type { TrackPayload } from '@/types'
import { BATCH_BYTE_LIMIT, buildBatchChunks, byteLength, KEEPALIVE_BYTE_LIMIT } from '@/utils/batch'

function trackEvent(index: number, notesBytes = 0): TrackPayload {
  return {
    type: 'track',
    event: `Event ${index}`,
    anonymousId: 'anon-1',
    messageId: `message-${index}`,
    properties: notesBytes > 0 ? { notes: 'x'.repeat(notesBytes) } : undefined,
  }
}

describe('buildBatchChunks', () => {
  it('splits events into /v1/batch bodies under 64 KB, keeping their order', () => {
    const events = Array.from({ length: 40 }, (_, index) => trackEvent(index, 5 * 1024))

    const { chunks, unserializable } = buildBatchChunks(events)

    expect(unserializable).toEqual([])
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(byteLength(chunk.body)).toBeLessThanOrEqual(BATCH_BYTE_LIMIT)
      expect(byteLength(chunk.body)).toBeLessThan(KEEPALIVE_BYTE_LIMIT)
      expect(JSON.parse(chunk.body)).toEqual({ batch: chunk.events })
    }
    expect(chunks.flatMap((chunk) => chunk.events)).toEqual(events)
  })

  it('fills each chunk as far as the limit allows', () => {
    const events = Array.from({ length: 40 }, (_, index) => trackEvent(index, 5 * 1024))

    const { chunks } = buildBatchChunks(events)

    for (const [index, chunk] of chunks.slice(0, -1).entries()) {
      const nextEvent = JSON.stringify(chunks[index + 1].events[0])
      expect(byteLength(chunk.body) + 1 + byteLength(nextEvent)).toBeGreaterThan(BATCH_BYTE_LIMIT)
    }
  })

  it('counts multi-byte characters by their UTF-8 size', () => {
    const events = Array.from({ length: 20 }, (_, index) => ({
      ...trackEvent(index),
      properties: { notes: 'é'.repeat(3 * 1024) },
    }))

    const { chunks } = buildBatchChunks(events)

    for (const chunk of chunks) {
      expect(byteLength(chunk.body)).toBeLessThanOrEqual(BATCH_BYTE_LIMIT)
    }
  })

  it('puts the write key at the top level of each body for beacons', () => {
    const { chunks } = buildBatchChunks([trackEvent(1)], 'test-key')

    expect(JSON.parse(chunks[0].body)).toEqual({ batch: [trackEvent(1)], writeKey: 'test-key' })
  })

  it('gives an event too large to share a body a chunk of its own', () => {
    const events = [trackEvent(0), trackEvent(1, BATCH_BYTE_LIMIT), trackEvent(2)]

    const { chunks } = buildBatchChunks(events)

    expect(chunks.map((chunk) => chunk.events.map((event) => event.messageId))).toEqual([
      ['message-0'],
      ['message-1'],
      ['message-2'],
    ])
  })

  it('leaves out events that cannot be serialized', () => {
    const unserializable: TrackPayload = { ...trackEvent(1), properties: { orderId: 123n } }

    const result = buildBatchChunks([trackEvent(0), unserializable, trackEvent(2)])

    expect(result.unserializable).toEqual([unserializable])
    expect(result.chunks.flatMap((chunk) => chunk.events)).toEqual([trackEvent(0), trackEvent(2)])
  })
})
