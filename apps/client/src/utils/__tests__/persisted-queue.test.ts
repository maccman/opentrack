import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TrackPayload } from '@/types'
import { PERSISTED_QUEUE_LIMITS, PersistedQueue } from '@/utils/persisted-queue'

const KEY = 'analytics_queue'

function trackEvent(index: number, notesBytes = 0): TrackPayload {
  return {
    type: 'track',
    event: `Event ${index}`,
    anonymousId: 'anon-1',
    messageId: `message-${index}`,
    properties: notesBytes > 0 ? { notes: 'x'.repeat(notesBytes) } : undefined,
  }
}

let store: Map<string, string>

beforeEach(() => {
  store = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('PersistedQueue', () => {
  it('keeps events until they are removed, oldest first', () => {
    const queue = new PersistedQueue(KEY)
    queue.add(trackEvent(1))
    queue.add(trackEvent(2))
    queue.add(trackEvent(3))

    queue.remove(['message-2'])

    expect(queue.read().map((event) => event.messageId)).toEqual(['message-1', 'message-3'])
    // Another tab, or the next page, sees the same queue
    expect(new PersistedQueue(KEY).read()).toHaveLength(2)
  })

  it('clears the storage key once the queue is empty', () => {
    const queue = new PersistedQueue(KEY)
    queue.add(trackEvent(1))

    queue.remove(['message-1'])

    expect(store.has(KEY)).toBe(false)
  })

  it('keeps only the newest events past the count cap', () => {
    const queue = new PersistedQueue(KEY)
    const total = PERSISTED_QUEUE_LIMITS.MAX_EVENTS + 5

    for (let index = 0; index < total; index++) {
      queue.add(trackEvent(index))
    }

    const ids = queue.read().map((event) => event.messageId)
    expect(ids).toHaveLength(PERSISTED_QUEUE_LIMITS.MAX_EVENTS)
    expect(ids[0]).toBe('message-5')
    expect(ids[ids.length - 1]).toBe(`message-${total - 1}`)
  })

  it('drops the oldest events to stay under the byte cap', () => {
    const queue = new PersistedQueue(KEY)

    for (let index = 0; index < 10; index++) {
      queue.add(trackEvent(index, 30 * 1024))
    }

    const stored = store.get(KEY) ?? ''
    expect(new TextEncoder().encode(stored).byteLength).toBeLessThanOrEqual(PERSISTED_QUEUE_LIMITS.MAX_BYTES)
    const ids = queue.read().map((event) => event.messageId)
    expect(ids.length).toBeLessThan(10)
    expect(ids[ids.length - 1]).toBe('message-9')
  })

  it('does not keep an event larger than the byte cap, and keeps the rest', () => {
    const queue = new PersistedQueue(KEY)
    queue.add(trackEvent(1))

    queue.add(trackEvent(2, PERSISTED_QUEUE_LIMITS.MAX_BYTES))

    expect(queue.read().map((event) => event.messageId)).toEqual(['message-1'])
  })

  it('forgets events once they are seven days old', () => {
    vi.useFakeTimers()
    const queue = new PersistedQueue(KEY)
    queue.add(trackEvent(1))
    vi.advanceTimersByTime(PERSISTED_QUEUE_LIMITS.MAX_AGE_MS - 1)
    queue.add(trackEvent(2))

    expect(queue.read().map((event) => event.messageId)).toEqual(['message-1', 'message-2'])

    vi.advanceTimersByTime(1)
    expect(queue.read().map((event) => event.messageId)).toEqual(['message-2'])
    expect(store.get(KEY)).not.toContain('message-1')
  })

  it('ignores events without a messageId, which could never be removed', () => {
    const queue = new PersistedQueue(KEY)

    queue.add({ ...trackEvent(1), messageId: undefined })

    expect(queue.read()).toEqual([])
  })

  it('treats unreadable storage as an empty queue', () => {
    store.set(KEY, '{not json')
    expect(new PersistedQueue(KEY).read()).toEqual([])

    store.set(KEY, JSON.stringify([{ storedAt: Date.now(), event: { type: 'track' } }, 'junk']))
    expect(new PersistedQueue(KEY).read()).toEqual([])
  })

  it('never throws when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    })
    const queue = new PersistedQueue(KEY)

    expect(() => {
      queue.add(trackEvent(1))
      queue.remove(['message-1'])
    }).not.toThrow()
    expect(queue.read()).toEqual([])
  })
})
