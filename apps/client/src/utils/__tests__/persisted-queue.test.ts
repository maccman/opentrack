import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakeStorage } from '@/__tests__/fake-browser'
import type { TrackPayload } from '@/types'
import { describeDestination, PERSISTED_QUEUE_LIMITS, PersistedQueue } from '@/utils/persisted-queue'

const NAMESPACE = 'analytics_queue'
const SITE = describeDestination('https://site.test', 'key-a')
const OTHER_SITE = describeDestination('https://other.test', 'key-b')

function trackEvent(index: number, notesBytes = 0): TrackPayload {
  return {
    type: 'track',
    event: `Event ${index}`,
    anonymousId: 'anon-1',
    messageId: `message-${index}`,
    properties: notesBytes > 0 ? { notes: 'x'.repeat(notesBytes) } : undefined,
  }
}

function queuedIds(queue: PersistedQueue, destination = SITE): Array<string | undefined> {
  return queue.read(destination).map((event) => event.messageId)
}

let store: Map<string, string>

beforeEach(() => {
  store = new Map()
  vi.stubGlobal('localStorage', createFakeStorage(store))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('PersistedQueue', () => {
  it('keeps events until they are removed, oldest first', () => {
    const queue = new PersistedQueue(NAMESPACE)
    queue.add(trackEvent(1), SITE)
    queue.add(trackEvent(2), SITE)
    queue.add(trackEvent(3), SITE)

    queue.remove(['message-2'])

    expect(queuedIds(queue)).toEqual(['message-1', 'message-3'])
    // Another tab, or the next page, sees the same queue
    expect(queuedIds(new PersistedQueue(NAMESPACE))).toEqual(['message-1', 'message-3'])
  })

  it('stores each event as its own record, removed once it is confirmed', () => {
    const queue = new PersistedQueue(NAMESPACE)
    queue.add(trackEvent(1), SITE)
    expect([...store.keys()]).toEqual(['analytics_queue:message-1'])

    queue.remove(['message-1'])

    expect(store.size).toBe(0)
  })

  it('keeps an event another tab adds while this tab is writing', () => {
    const thisTab = new PersistedQueue(NAMESPACE)
    const otherTab = new PersistedQueue(NAMESPACE)
    const storage = createFakeStorage(store)
    let interleaved = false
    vi.stubGlobal('localStorage', {
      ...storage,
      get length() {
        return storage.length
      },
      setItem: (key: string, value: string) => {
        if (!interleaved) {
          interleaved = true
          otherTab.add(trackEvent(2), SITE)
        }
        storage.setItem(key, value)
      },
    })

    thisTab.add(trackEvent(1), SITE)
    thisTab.remove(['message-0'])

    expect(queuedIds(thisTab).sort()).toEqual(['message-1', 'message-2'])
  })

  it('only returns events meant for the given destination', () => {
    const queue = new PersistedQueue(NAMESPACE)
    queue.add(trackEvent(1), SITE)
    queue.add(trackEvent(2), OTHER_SITE)

    expect(queuedIds(queue, SITE)).toEqual(['message-1'])
    expect(queuedIds(queue, OTHER_SITE)).toEqual(['message-2'])
  })

  it('binds events still waiting for load() to the destination that claims them', () => {
    const queue = new PersistedQueue(NAMESPACE)
    queue.add(trackEvent(1), null)
    queue.add(trackEvent(2), OTHER_SITE)
    expect(queuedIds(queue, SITE)).toEqual([])

    queue.claim(SITE)

    expect(queuedIds(queue, SITE)).toEqual(['message-1'])
    expect(queuedIds(queue, OTHER_SITE)).toEqual(['message-2'])
  })

  it('keeps only the newest events past the count cap', () => {
    const queue = new PersistedQueue(NAMESPACE)
    const total = PERSISTED_QUEUE_LIMITS.MAX_EVENTS + 5

    for (let index = 0; index < total; index++) {
      queue.add(trackEvent(index), SITE)
    }

    const ids = queuedIds(queue)
    expect(ids).toHaveLength(PERSISTED_QUEUE_LIMITS.MAX_EVENTS)
    expect(ids[0]).toBe('message-5')
    expect(ids[ids.length - 1]).toBe(`message-${total - 1}`)
  })

  it('drops the oldest events to stay under the byte cap', () => {
    const queue = new PersistedQueue(NAMESPACE)

    for (let index = 0; index < 10; index++) {
      queue.add(trackEvent(index, 30 * 1024), SITE)
    }

    const encoder = new TextEncoder()
    const storedBytes = [...store.entries()].reduce(
      (sum, [key, value]) => sum + encoder.encode(key).byteLength + encoder.encode(value).byteLength,
      0
    )
    expect(storedBytes).toBeLessThanOrEqual(PERSISTED_QUEUE_LIMITS.MAX_BYTES)
    const ids = queuedIds(queue)
    expect(ids.length).toBeLessThan(10)
    expect(ids[ids.length - 1]).toBe('message-9')
  })

  it('does not keep an event larger than the byte cap, and keeps the rest', () => {
    const queue = new PersistedQueue(NAMESPACE)
    queue.add(trackEvent(1), SITE)

    queue.add(trackEvent(2, PERSISTED_QUEUE_LIMITS.MAX_BYTES), SITE)

    expect(queuedIds(queue)).toEqual(['message-1'])
  })

  it('forgets events once they are seven days old', () => {
    vi.useFakeTimers()
    const queue = new PersistedQueue(NAMESPACE)
    queue.add(trackEvent(1), SITE)
    vi.advanceTimersByTime(PERSISTED_QUEUE_LIMITS.MAX_AGE_MS - 1)
    queue.add(trackEvent(2), SITE)

    expect(queuedIds(queue)).toEqual(['message-1', 'message-2'])

    vi.advanceTimersByTime(1)
    expect(queuedIds(queue)).toEqual(['message-2'])
    expect(store.has('analytics_queue:message-1')).toBe(false)
  })

  it('ignores records in other namespaces', () => {
    new PersistedQueue('projectA_queue').add(trackEvent(1), SITE)
    store.set('analytics_queue_other', 'unrelated')

    expect(queuedIds(new PersistedQueue(NAMESPACE))).toEqual([])
    expect(store.get('analytics_queue_other')).toBe('unrelated')
  })

  it('ignores events without a messageId, which could never be removed', () => {
    const queue = new PersistedQueue(NAMESPACE)

    queue.add({ ...trackEvent(1), messageId: undefined }, SITE)

    expect(store.size).toBe(0)
  })

  it('discards unreadable records', () => {
    store.set('analytics_queue:broken', '{not json')
    store.set('analytics_queue:partial', JSON.stringify({ storedAt: Date.now(), event: { type: 'track' } }))

    expect(new PersistedQueue(NAMESPACE).read(SITE)).toEqual([])
    expect(store.size).toBe(0)
  })

  it('never throws when storage is unavailable', () => {
    const fail = () => {
      throw new Error('SecurityError')
    }
    vi.stubGlobal('localStorage', {
      get length(): number {
        return fail()
      },
      key: fail,
      getItem: fail,
      setItem: fail,
      removeItem: fail,
    })
    const queue = new PersistedQueue(NAMESPACE)

    expect(() => {
      queue.add(trackEvent(1), SITE)
      queue.claim(SITE)
      queue.remove(['message-1'])
    }).not.toThrow()
    expect(queue.read(SITE)).toEqual([])
  })
})
