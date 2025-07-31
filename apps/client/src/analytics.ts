// Libroseg Analytics - Segment-compatible client library

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
  private _userId: string | null = null
  private _anonymousId: string
  private _traits: Record<string, unknown> = {}
  private _readyCallbacks: Array<() => void> = []
  private _isReady = false
  private _queue: EventPayload[] = []
  private _flushTimer: number | null = null

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
    this._anonymousId = this.storage.getAnonymousId() || generateId()
    this._userId = this.storage.getUserId()
    this._traits = this.storage.getTraits()

    // Store anonymous ID if new
    if (!this.storage.getAnonymousId()) {
      this.storage.setAnonymousId(this._anonymousId)
    }

    this._isReady = true
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
    if (this._isReady) {
      callback()
    } else {
      this._readyCallbacks.push(callback)
    }
  }

  private processReadyCallbacks(): void {
    this._readyCallbacks.forEach((callback) => callback())
    this._readyCallbacks = []
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
      this._userId = userId
      this.storage.setUserId(userId)
    }

    if (traits) {
      this._traits = { ...this._traits, ...traits }
      this.storage.setTraits(this._traits)
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
      previousId: previousId || this._userId || this._anonymousId,
      timestamp: basePayload.timestamp,
      context: basePayload.context,
      messageId: basePayload.messageId,
    }

    // Update current user ID
    this._userId = userId
    this.storage.setUserId(userId)

    this.enqueue(payload)
  }

  // User identity management
  user(): User {
    return {
      id: () => this._userId,
      anonymousId: () => this._anonymousId,
      traits: () => ({ ...this._traits }),
    }
  }

  reset(): void {
    this._userId = null
    this._anonymousId = generateId()
    this._traits = {}

    this.storage.clear()
    this.storage.setAnonymousId(this._anonymousId)
  }

  // Queue and flush management
  flush(): void {
    if (this._queue.length === 0) {
      return
    }

    const events = [...this._queue]
    this._queue = []

    // Clear flush timer
    if (this._flushTimer) {
      clearTimeout(this._flushTimer)
      this._flushTimer = null
    }

    // Send events
    void this.transport.sendEvents(events)
  }

  // Private methods
  private buildBasePayload(options?: Record<string, unknown>) {
    return {
      userId: this._userId || undefined,
      anonymousId: this._anonymousId,
      timestamp: new Date().toISOString(),
      messageId: generateMessageId(),
      context: buildContext(),
      ...options,
    }
  }

  private enqueue(payload: EventPayload): void {
    this._queue.push(payload)

    if (this.config.debug) {
      console.log('[Analytics] Enqueued event:', payload)
    }

    // Auto-flush if queue is full
    if (this._queue.length >= this.config.flushAt) {
      this.flush()
      return
    }

    // Schedule flush if not already scheduled
    if (!this._flushTimer) {
      this._flushTimer = window.setTimeout(() => {
        this.flush()
      }, this.config.flushInterval)
    }
  }
}

// Create global analytics instance
const analytics = new Analytics()

// Auto-track initial page view
if (typeof window !== 'undefined') {
  analytics.ready(() => {
    analytics.page()
  })

  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    analytics.flush()
  })
}

// Export for global usage
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
;(window as any).analytics = analytics

export default analytics
