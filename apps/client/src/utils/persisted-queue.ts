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
  event: EventPayload
}

function isPersistedEntry(value: unknown): value is PersistedEntry {
  if (typeof value !== 'object' || value === null || !('storedAt' in value) || !('event' in value)) {
    return false
  }
  const { storedAt, event } = value
  return (
    typeof storedAt === 'number' &&
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

function entryBytes(entry: PersistedEntry): number | null {
  try {
    return byteLength(JSON.stringify(entry))
  } catch {
    return null
  }
}

/** Drops the oldest entries until the queue fits its count and size caps */
function trimToLimits(entries: PersistedEntry[]): PersistedEntry[] {
  // Each entry is followed by a comma or the closing bracket, after the opening bracket
  const sizes = entries.map((entry) => (entryBytes(entry) ?? 0) + 1)
  let start = Math.max(0, entries.length - PERSISTED_QUEUE_LIMITS.MAX_EVENTS)
  let totalBytes = sizes.slice(start).reduce((sum, size) => sum + size, 1)

  while (start < entries.length && totalBytes > PERSISTED_QUEUE_LIMITS.MAX_BYTES) {
    totalBytes -= sizes[start]
    start++
  }

  return entries.slice(start)
}

/**
 * Keeps each event in localStorage from when it's tracked until the server
 * confirms it, so events held, in flight or failing when a page closes can be
 * replayed on the next page load. Every call re-reads storage, because other
 * tabs share it.
 */
export class PersistedQueue {
  private key: string

  constructor(key: string) {
    this.key = key
  }

  add(event: EventPayload): void {
    if (!event.messageId) {
      return
    }

    const entry: PersistedEntry = { storedAt: Date.now(), event }
    const bytes = entryBytes(entry)
    // An event that can't be serialized or is too large to keep is still sent, just never replayed
    if (bytes === null || bytes + 2 > PERSISTED_QUEUE_LIMITS.MAX_BYTES) {
      return
    }

    this.write(trimToLimits([...this.readEntries().filter(isFresh), entry]))
  }

  remove(messageIds: string[]): void {
    if (messageIds.length === 0) {
      return
    }

    const ids = new Set(messageIds)
    const entries = this.readEntries()
    const remaining = entries.filter((entry) => !entry.event.messageId || !ids.has(entry.event.messageId))
    if (remaining.length !== entries.length) {
      this.write(remaining)
    }
  }

  /** Returns unconfirmed events, oldest first, and forgets expired ones */
  read(): EventPayload[] {
    const entries = this.readEntries()
    const fresh = entries.filter(isFresh)
    if (fresh.length !== entries.length) {
      this.write(fresh)
    }
    return fresh.map((entry) => entry.event)
  }

  private readEntries(): PersistedEntry[] {
    try {
      const stored = localStorage.getItem(this.key)
      const parsed: unknown = stored ? JSON.parse(stored) : []
      return Array.isArray(parsed) ? parsed.filter(isPersistedEntry) : []
    } catch {
      return []
    }
  }

  private write(entries: PersistedEntry[]): void {
    try {
      if (entries.length === 0) {
        localStorage.removeItem(this.key)
      } else {
        localStorage.setItem(this.key, JSON.stringify(entries))
      }
    } catch {
      // Ignore storage errors
    }
  }
}
