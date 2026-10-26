// Persisted Event Queue

import type { EventPayload } from '@/types'

import { byteLength } from './batch'

export const PERSISTED_QUEUE_LIMITS = {
  MAX_EVENTS: 100,
  MAX_BYTES: 256 * 1024,
  MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const

interface PersistedEntry {
  storedAt: number
  // Orders events this page stored in the same millisecond
  sequence: number
  // Where the event is to be sent, or null while it waits for load()
  destination: string | null
  event: EventPayload
}

interface StoredRecord {
  key: string
  entry: PersistedEntry
  bytes: number
}

let nextSequence = 0

/**
 * Identifies where events go, so a page only replays events meant for the same
 * host and write key
 */
export function describeDestination(host: string, writeKey: string): string {
  return JSON.stringify([host, writeKey])
}

function isPersistedEntry(value: unknown): value is PersistedEntry {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('storedAt' in value) ||
    !('sequence' in value) ||
    !('destination' in value) ||
    !('event' in value)
  ) {
    return false
  }
  const { storedAt, sequence, destination, event } = value
  return (
    typeof storedAt === 'number' &&
    typeof sequence === 'number' &&
    (typeof destination === 'string' || destination === null) &&
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    typeof event.type === 'string' &&
    'messageId' in event &&
    typeof event.messageId === 'string'
  )
}

function isFresh(entry: PersistedEntry): boolean {
  return Date.now() - entry.storedAt < PERSISTED_QUEUE_LIMITS.MAX_AGE_MS
}

function byAge(a: StoredRecord, b: StoredRecord): number {
  return a.entry.storedAt - b.entry.storedAt || a.entry.sequence - b.entry.sequence
}

/**
 * Keeps each event in localStorage from when it's tracked until the server
 * confirms it, so events held, in flight or failing when a page closes can be
 * replayed on the next page load. Each event is its own record, written and
 * removed on its own, so tabs sharing the queue can't overwrite each other's
 * events.
 */
export class PersistedQueue {
  readonly namespace: string
  private keyPrefix: string

  constructor(namespace: string) {
    this.namespace = namespace
    this.keyPrefix = `${namespace}:`
  }

  add(event: EventPayload, destination: string | null): void {
    if (!event.messageId) {
      return
    }

    const key = this.keyPrefix + event.messageId
    const entry: PersistedEntry = { storedAt: Date.now(), sequence: nextSequence++, destination, event }
    let value: string
    try {
      value = JSON.stringify(entry)
    } catch {
      // An event that can't be serialized is never sent either
      return
    }

    // An event too large to keep is still sent, just never replayed
    if (byteLength(key) + byteLength(value) > PERSISTED_QUEUE_LIMITS.MAX_BYTES) {
      return
    }

    this.setItem(key, value)
    this.trimToLimits()
  }

  remove(messageIds: string[]): void {
    messageIds.forEach((messageId) => this.removeItem(this.keyPrefix + messageId))
  }

  /** Returns the unconfirmed events meant for `destination`, oldest first */
  read(destination: string): EventPayload[] {
    return this.readFresh()
      .filter((record) => record.entry.destination === destination)
      .map((record) => record.entry.event)
  }

  /**
   * Binds events still waiting for load() to `destination`, both this page's
   * and those of a page that closed before its load() ran
   */
  claim(destination: string): void {
    for (const { key, entry } of this.readFresh()) {
      if (entry.destination === null) {
        this.setItem(key, JSON.stringify({ ...entry, destination }))
      }
    }
  }

  /** Drops expired records, then the oldest until the queue fits its count and size caps */
  private trimToLimits(): void {
    const records = this.readFresh()
    let count = records.length
    let totalBytes = records.reduce((sum, record) => sum + record.bytes, 0)

    for (const record of records) {
      if (count <= PERSISTED_QUEUE_LIMITS.MAX_EVENTS && totalBytes <= PERSISTED_QUEUE_LIMITS.MAX_BYTES) {
        break
      }
      this.removeItem(record.key)
      count--
      totalBytes -= record.bytes
    }
  }

  /** Reads this queue's records, oldest first, removing expired and unreadable ones */
  private readFresh(): StoredRecord[] {
    const records: StoredRecord[] = []
    for (const key of this.readKeys()) {
      const value = this.getItem(key)
      if (value === null) {
        continue
      }

      let entry: unknown
      try {
        entry = JSON.parse(value)
      } catch {
        entry = null
      }

      if (isPersistedEntry(entry) && isFresh(entry)) {
        records.push({ key, entry, bytes: byteLength(key) + byteLength(value) })
      } else {
        this.removeItem(key)
      }
    }
    return records.sort(byAge)
  }

  private readKeys(): string[] {
    try {
      const keys: string[] = []
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index)
        if (key?.startsWith(this.keyPrefix)) {
          keys.push(key)
        }
      }
      return keys
    } catch {
      return []
    }
  }

  private getItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  private setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Ignore storage errors
    }
  }

  private removeItem(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignore storage errors
    }
  }
}
