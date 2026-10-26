// OpenTrack Analytics - Segment-compatible client library

import { createConfig, PRE_LOAD_HOLD_MS } from './config'
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
  // Events fired before load() wait here so they go out with its host and write key
  private queue: EventPayload[] = []
  private flushTimer: number | null = null
  private isLoaded = false

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
      useBeacon: this.config.useBeacon,
      writeKey: this.config.writeKey,
      timeout: this.config.timeout,
      retries: this.config.retries,
      retryDelay: this.config.retryDelay,
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
    }

    // Update transport config (always, to pick up writeKey changes)
    this.transport = new AnalyticsTransport({
      host: this.config.host,
      debug: this.config.debug,
      useBeacon: this.config.useBeacon,
      writeKey: this.config.writeKey,
      timeout: this.config.timeout,
      retries: this.config.retries,
      retryDelay: this.config.retryDelay,
    })

    // From here on events are sent as they happen; send the ones held until now
    this.isLoaded = true
    this.flush()
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

    this.send(payload)
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
      // A different user starts with their own traits, not the previous user's
      if (this.userId && this.userId !== userId) {
        this.traits = {}
      }
      this.userId = userId
      this.storage.setUserId(userId)
    }

    if (traits) {
      this.traits = { ...this.traits, ...traits }
    }
    this.storage.setTraits(this.traits)

    // Send every known trait, like Segment, so traits captured before
    // identification reach destinations that only accept identified users
    const payload: IdentifyPayload = {
      type: 'identify' as const,
      traits: this.traits,
      ...this.buildBasePayload(options),
    }

    this.send(payload)
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
    } else if (name === undefined) {
      // page(name) - a lone string is the page name, matching Segment
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

    this.send(payload)
  }

  group(groupId: string, traits?: Record<string, unknown>, options?: Record<string, unknown>): void {
    const payload: GroupPayload = {
      type: 'group' as const,
      groupId,
      traits,
      ...this.buildBasePayload(options),
    }

    this.send(payload)
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

    this.send(payload)
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

  // Sends any events still held because they were fired before load()
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

  /**
   * Sends an event as soon as it happens. Each event is its own request, so
   * holding events back would only add delay and a window in which they can be
   * lost. The one exception is events fired before load(), which are held so
   * they use its host and write key; if load() never runs, they're sent with
   * the default configuration after PRE_LOAD_HOLD_MS.
   */
  private send(payload: EventPayload): void {
    // Server environments have nothing to hold for; the transport skips sending
    if (this.isLoaded || typeof window === 'undefined') {
      void this.transport.sendEvent(payload)
      return
    }

    this.queue.push(payload)

    if (this.config.debug) {
      console.log('[Analytics] Holding event until load():', payload)
    }

    if (!this.flushTimer) {
      this.flushTimer = window.setTimeout(() => {
        // load() was never called, so the default configuration is final
        this.isLoaded = true
        this.flush()
      }, PRE_LOAD_HOLD_MS)
    }
  }
}

// Create global analytics instance
const analytics = new Analytics()

// Setup global usage (browser only)
if (typeof window !== 'undefined') {
  // Send any events still held for load() when the page is hidden or unloaded.
  // Mobile browsers often skip `beforeunload` when a tab is backgrounded or
  // closed; `visibilitychange` and `pagehide` fire reliably.
  window.addEventListener('pagehide', () => {
    analytics.flush()
  })
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        analytics.flush()
      }
    })
  }

  // Export for global usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  ;(window as any).analytics = analytics
}

export default analytics
