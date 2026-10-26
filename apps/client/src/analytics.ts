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
  type DeliveryCallbacks,
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
  private heldEvents: EventPayload[] = []
  // Events sent but not yet delivered or refused, including ones that failed every retry
  private unsentEvents = new Set<EventPayload>()
  // Events with a request in flight, which keepalive lets finish if the page unloads
  private inFlightEvents = new Set<EventPayload>()
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
    this.listenForPageHide()
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
    this.release()
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
    if (this.heldEvents.length === 0) {
      return
    }

    this.clearFlushTimer()
    void this.deliverBatch(this.takeHeldEvents())
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
    // Server environments have nothing to send to
    if (typeof window === 'undefined') {
      return
    }

    if (this.isLoaded) {
      void this.deliverEvent(payload)
      return
    }

    this.heldEvents.push(payload)

    if (this.config.debug) {
      console.log(`[Analytics] Holding ${payload.type} event until load()`)
    }

    if (!this.flushTimer) {
      this.flushTimer = window.setTimeout(() => {
        // load() was never called, so the default configuration is final
        this.release()
      }, PRE_LOAD_HOLD_MS)
    }
  }

  // Starts sending events as they happen, and sends the held ones in /v1/batch requests
  private release(): void {
    this.isLoaded = true
    this.clearFlushTimer()
    void this.deliverBatch(this.takeHeldEvents())
  }

  private takeHeldEvents(): EventPayload[] {
    const events = this.heldEvents
    this.heldEvents = []
    return events
  }

  private clearFlushTimer(): void {
    if (this.flushTimer && typeof window !== 'undefined') {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  private async deliverEvent(event: EventPayload): Promise<void> {
    await this.deliver([event], async (callbacks) => await this.transport.sendEvent(event, callbacks))
  }

  private async deliverBatch(events: EventPayload[]): Promise<void> {
    await this.deliver(events, async (callbacks) => await this.transport.sendBatch(events, callbacks))
  }

  /**
   * Tracks events while the transport sends them: unsent until delivered or
   * refused, and in flight only while a request carries them
   */
  private async deliver(events: EventPayload[], send: (callbacks: DeliveryCallbacks) => Promise<void>): Promise<void> {
    if (events.length === 0) {
      return
    }

    events.forEach((event) => this.unsentEvents.add(event))
    await send({
      onRequestStart: (requestEvents) => requestEvents.forEach((event) => this.inFlightEvents.add(event)),
      onRequestEnd: (requestEvents) => requestEvents.forEach((event) => this.inFlightEvents.delete(event)),
      onSettled: (settledEvents, result) => {
        // Failed events stay unsent, for a beacon when the page is hidden
        if (result !== 'failed') {
          settledEvents.forEach((event) => this.unsentEvents.delete(event))
        }
      },
    })
  }

  /**
   * Beacons the events a closing page would otherwise leave behind: those held
   * for load() or, once loaded, unsent events without a request in flight,
   * such as ones that failed, are waiting to retry, or are in a batch chunk
   * not sent yet. Requests already in flight finish on their own, since they
   * use keepalive. A beacon reports no status, so once the browser accepts it
   * its events count as sent.
   */
  private sendOnPageHide(): void {
    const events = this.isLoaded
      ? [...this.unsentEvents].filter((event) => !this.inFlightEvents.has(event))
      : this.heldEvents
    if (events.length === 0) {
      return
    }

    const accepted = new Set(this.transport.sendBeacon(events))
    accepted.forEach((event) => this.unsentEvents.delete(event))
    this.heldEvents = this.heldEvents.filter((event) => !accepted.has(event))
  }

  private listenForPageHide(): void {
    if (typeof window === 'undefined') {
      return
    }

    // Mobile browsers often skip `beforeunload` when a tab is backgrounded or
    // closed; `visibilitychange` and `pagehide` fire reliably.
    window.addEventListener('pagehide', () => {
      this.sendOnPageHide()
    })
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.sendOnPageHide()
        }
      })
    }
  }
}

// Create global analytics instance
const analytics = new Analytics()

// Setup global usage (browser only)
if (typeof window !== 'undefined') {
  // Export for global usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  ;(window as any).analytics = analytics
}

export default analytics
