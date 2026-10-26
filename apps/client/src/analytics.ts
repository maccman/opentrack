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
  describeDestination,
  generateId,
  generateMessageId,
  PersistedQueue,
} from './utils'

function messageIdsOf(events: EventPayload[]): string[] {
  return events.flatMap((event) => (event.messageId ? [event.messageId] : []))
}

function uniqueByMessageId(events: EventPayload[]): EventPayload[] {
  const seen = new Set<string>()
  return events.filter((event) => {
    if (!event.messageId) {
      return true
    }
    if (seen.has(event.messageId)) {
      return false
    }
    seen.add(event.messageId)
    return true
  })
}

// Main Analytics class
class Analytics {
  private config: Required<AnalyticsOptions>
  private storage: AnalyticsStorage
  private persistedQueue: PersistedQueue
  private transport: AnalyticsTransport
  private userId: string | null = null
  private anonymousId: string
  private traits: Record<string, unknown> = {}
  private readyCallbacks: Array<() => void> = []
  private isReady = false
  // Events fired before load() wait here so they go out with its host and write key
  private heldEvents: EventPayload[] = []
  // Message IDs this page is still delivering, retries included, so a replay doesn't send them twice
  private pendingIds = new Set<string>()
  // Message IDs with a request in flight, which keepalive lets finish if the page unloads
  private inFlightIds = new Set<string>()
  // Message IDs this page has beaconed, so each is beaconed at most once
  private beaconedIds = new Set<string>()
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

    // Every event stays here until the server confirms it. load() can move it to another storagePrefix
    this.persistedQueue = new PersistedQueue(this.queueNamespace())

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

    this.moveQueueTo(this.queueNamespace())

    // From here on events are sent as they happen
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

    // Kept until the server confirms it, so it can be replayed if this page closes first. Events
    // held for load() get their destination when it runs
    this.persistedQueue.add(payload, this.isLoaded ? this.destination() : null)

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

  /**
   * Starts sending events as they happen, and sends the held ones together
   * with any that earlier pages tracked but couldn't confirm, in /v1/batch
   * requests
   */
  private release(): void {
    this.isLoaded = true
    this.clearFlushTimer()

    // Events still waiting for load(), this page's or a closed page's, go where this page sends.
    // The queue then holds the held events too, so it comes first to keep events in order
    const destination = this.destination()
    this.persistedQueue.claim(destination)
    const replayed = this.persistedQueue.read(destination).filter((event) => !this.isPending(event))
    void this.deliverBatch(uniqueByMessageId([...replayed, ...this.takeHeldEvents()]))
  }

  private destination(): string {
    return describeDestination(this.config.host, this.config.writeKey)
  }

  private queueNamespace(): string {
    return `${this.config.storagePrefix}queue`
  }

  /**
   * Moves the queue to the storagePrefix load() configured. The singleton is
   * created before load() runs, so events held for it start in the default
   * namespace; events other pages left there stay for pages that use it.
   */
  private moveQueueTo(namespace: string): void {
    if (namespace === this.persistedQueue.namespace) {
      return
    }

    const queue = new PersistedQueue(namespace)
    this.persistedQueue.remove(messageIdsOf(this.heldEvents))
    this.heldEvents.forEach((event) => queue.add(event, null))
    this.persistedQueue = queue
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
   * Tracks events while the transport sends them: pending until each settles,
   * and in flight only while a request carries them
   */
  private async deliver(events: EventPayload[], send: (callbacks: DeliveryCallbacks) => Promise<void>): Promise<void> {
    if (events.length === 0) {
      return
    }

    // Settled events leave the queue they were sent from, even if load() moves it meanwhile
    const queue = this.persistedQueue
    const ids = messageIdsOf(events)
    ids.forEach((id) => this.pendingIds.add(id))

    try {
      await send({
        onRequestStart: (requestEvents) => messageIdsOf(requestEvents).forEach((id) => this.inFlightIds.add(id)),
        onRequestEnd: (requestEvents) => messageIdsOf(requestEvents).forEach((id) => this.inFlightIds.delete(id)),
        onSettled: (settledEvents, result) => {
          const settledIds = messageIdsOf(settledEvents)
          settledIds.forEach((id) => this.pendingIds.delete(id))
          // Delivered and rejected events are done; failed ones stay queued for replay
          if (result !== 'failed') {
            queue.remove(settledIds)
          }
        },
      })
    } finally {
      ids.forEach((id) => this.pendingIds.delete(id))
    }
  }

  private isPending(event: EventPayload): boolean {
    return event.messageId !== undefined && this.pendingIds.has(event.messageId)
  }

  /**
   * Beacons the events a closing page would otherwise leave behind: those held
   * for load() or, once loaded, queued events without a request in flight,
   * such as ones that failed, are waiting to retry, or are in a batch chunk
   * not sent yet. Requests already in flight finish on their own, since they
   * use keepalive. A beacon reports no status, so its events stay queued until
   * a later request confirms them, normally on the next page load.
   */
  private sendOnPageHide(): void {
    const candidates = this.isLoaded ? this.persistedQueue.read(this.destination()) : this.heldEvents
    const events = candidates.filter(
      (event) => !(event.messageId && (this.inFlightIds.has(event.messageId) || this.beaconedIds.has(event.messageId)))
    )
    if (events.length === 0) {
      return
    }

    messageIdsOf(this.transport.sendBeacon(events)).forEach((id) => this.beaconedIds.add(id))
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
