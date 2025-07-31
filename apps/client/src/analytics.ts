// OpenTrack Analytics - Segment-compatible client library

import { createConfig } from './config'
import type {
  AliasPayload,
  AnalyticsOptions,
  EventPayload,
  GroupPayload,
  IdentifyPayload,
  PagePayload,
  TrackPayload,
  User,
} from './types'
import {
  AnalyticsStorage,
  AnalyticsTransport,
  buildContext,
  buildPageProperties,
  generateId,
  generateMessageId,
} from './utils'

// Main Analytics class
class Analytics {
  private config: Required<AnalyticsOptions>
  private storage: AnalyticsStorage
  private transport: AnalyticsTransport
  private userId: string | null = null
  private anonymousId: string
  private traits: Record<string, unknown> = {}
  private readyCallbacks: Array<() => void> = []
  private isReady = false
  private queue: EventPayload[] = []
  private flushTimer: number | null = null

  constructor(options: AnalyticsOptions = {}) {
    this.config = createConfig(options)

    // Initialize storage with configured keys
    this.storage = new AnalyticsStorage({
      userIdKey: this.config.userIdKey,
      anonymousIdKey: this.config.anonymousIdKey,
      traitsKey: this.config.traitsKey,
    })

    // Initialize transport
    this.transport = new AnalyticsTransport({
      host: this.config.host,
      debug: this.config.debug,
    })

    // Initialize user identity
    this.anonymousId = this.storage.getAnonymousId() || generateId()
    this.userId = this.storage.getUserId()
    this.traits = this.storage.getTraits()

    // Store anonymous ID if new
    if (!this.storage.getAnonymousId()) {
      this.storage.setAnonymousId(this.anonymousId)
    }

    this.isReady = true
    this.processReadyCallbacks()
  }

  // Initialization
  load(writeKey?: string, options?: AnalyticsOptions): void {
    if (writeKey) {
      this.config.writeKey = writeKey
    }
    if (options) {
      this.config = createConfig({ ...this.config, ...options })

      // Update transport config if host or debug changed
      this.transport = new AnalyticsTransport({
        host: this.config.host,
        debug: this.config.debug,
      })
    }
  }

  ready(callback: () => void): void {
    if (this.isReady) {
      callback()
    } else {
      this.readyCallbacks.push(callback)
    }
  }

  private processReadyCallbacks(): void {
    this.readyCallbacks.forEach((callback) => callback())
    this.readyCallbacks = []
  }

  // Core tracking methods
  track(event: string, properties?: Record<string, unknown>, options?: Record<string, unknown>): void {
    const payload: TrackPayload = {
      type: 'track' as const,
      event,
      properties,
      ...this.buildBasePayload(options),
    }

    this.enqueue(payload)
  }

  identify(userId?: string, traits?: Record<string, unknown>, options?: Record<string, unknown>): void {
    // Handle overloaded signatures
    if (typeof userId === 'object' && userId !== null) {
      // identify(traits, options)
      options = traits as Record<string, unknown>
      traits = userId as Record<string, unknown>
      userId = undefined
    }

    if (userId) {
      this.userId = userId
      this.storage.setUserId(userId)
    }

    if (traits) {
      this.traits = { ...this.traits, ...traits }
      this.storage.setTraits(this.traits)
    }

    const payload: IdentifyPayload = {
      type: 'identify' as const,
      traits,
      ...this.buildBasePayload(options),
    }

    this.enqueue(payload)
  }

  page(
    category?: string,
    name?: string,
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>
  ): void {
    // Handle overloaded signatures
    if (typeof category === 'object') {
      // page(properties, options)
      options = name as Record<string, unknown> | undefined
      properties = category
      name = undefined
      category = undefined
    } else if (typeof name === 'object') {
      // page(name, properties, options)
      options = properties
      properties = name as Record<string, unknown>
      name = category
      category = undefined
    }

    // Auto-capture page properties if not provided
    const pageProperties = buildPageProperties(properties)

    const payload: PagePayload = {
      type: 'page' as const,
      name,
      category,
      properties: pageProperties,
      ...this.buildBasePayload(options),
    }

    this.enqueue(payload)
  }

  group(groupId: string, traits?: Record<string, unknown>, options?: Record<string, unknown>): void {
    const payload: GroupPayload = {
      type: 'group' as const,
      groupId,
      traits,
      ...this.buildBasePayload(options),
    }

    this.enqueue(payload)
  }

  alias(userId: string, previousId?: string, options?: Record<string, unknown>): void {
    const basePayload = this.buildBasePayload(options)
    const payload: AliasPayload = {
      type: 'alias' as const,
      userId,
      previousId: previousId || this.userId || this.anonymousId,
      timestamp: basePayload.timestamp,
      context: basePayload.context,
      messageId: basePayload.messageId,
    }

    // Update current user ID
    this.userId = userId
    this.storage.setUserId(userId)

    this.enqueue(payload)
  }

  // User identity management
  user(): User {
    return {
      id: () => this.userId,
      anonymousId: () => this.anonymousId,
      traits: () => ({ ...this.traits }),
    }
  }

  reset(): void {
    this.userId = null
    this.anonymousId = generateId()
    this.traits = {}

    this.storage.clear()
    this.storage.setAnonymousId(this.anonymousId)
  }

  // Queue and flush management
  flush(): void {
    if (this.queue.length === 0) {
      return
    }

    const events = [...this.queue]
    this.queue = []

    // Clear flush timer (browser only)
    if (this.flushTimer && typeof window !== 'undefined') {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    // Send events
    void this.transport.sendEvents(events)
  }

  // Private methods
  private buildBasePayload(options?: Record<string, unknown>) {
    return {
      userId: this.userId || undefined,
      anonymousId: this.anonymousId,
      timestamp: new Date().toISOString(),
      messageId: generateMessageId(),
      context: buildContext(),
      ...options,
    }
  }

  private enqueue(payload: EventPayload): void {
    this.queue.push(payload)

    if (this.config.debug) {
      console.log('[Analytics] Enqueued event:', payload)
    }

    // Auto-flush if queue is full
    if (this.queue.length >= this.config.flushAt) {
      this.flush()
      return
    }

    // Schedule flush if not already scheduled (browser only)
    if (!this.flushTimer && typeof window !== 'undefined') {
      this.flushTimer = window.setTimeout(() => {
        this.flush()
      }, this.config.flushInterval)
    }
  }
}

// Create global analytics instance
const analytics = new Analytics()

// Auto-track initial page view and setup global usage (browser only)
if (typeof window !== 'undefined') {
  analytics.ready(() => {
    analytics.page()
  })

  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    analytics.flush()
  })

  // Export for global usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).analytics = analytics
}

export default analytics
