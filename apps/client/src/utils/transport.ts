// HTTP Transport Utilities

import type { EventPayload } from '@/types'

import { buildBatchChunks, byteLength, KEEPALIVE_BYTE_LIMIT, serializeEvent } from './batch'

export interface TransportConfig {
  host: string
  debug: boolean
  useBeacon: boolean
  writeKey?: string
  timeout?: number
  retries?: number
  retryDelay?: number
}

/**
 * How sending ended:
 * - `delivered`: the server answered 2xx
 * - `rejected`: sending again can't succeed, because the server answered with
 *   a 4xx other than 429 or the event can't be serialized
 * - `failed`: every attempt ended in a network error, a timeout, a 429 or a 5xx
 */
export type DeliveryResult = 'delivered' | 'rejected' | 'failed'

const TRANSPORT_CONSTANTS = {
  CONTENT_TYPE: 'application/json',
  BATCH_PATH: '/v1/batch',
  DEFAULT_TIMEOUT: 5000,
  DEFAULT_RETRIES: 2,
  DEFAULT_RETRY_DELAY: 1000,
  LOG_PREFIX: '[Analytics]',
} as const

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function describeCount(count: number): string {
  return count === 1 ? '1 event' : `${count} events`
}

export class AnalyticsTransport {
  private config: Required<Omit<TransportConfig, 'writeKey'>> & { writeKey?: string }

  constructor(config: TransportConfig) {
    this.config = {
      timeout: TRANSPORT_CONSTANTS.DEFAULT_TIMEOUT,
      retries: TRANSPORT_CONSTANTS.DEFAULT_RETRIES,
      retryDelay: TRANSPORT_CONSTANTS.DEFAULT_RETRY_DELAY,
      ...config,
    }
  }

  /**
   * Generate Basic auth header value from writeKey
   * Format: "Basic base64(writeKey:)"
   */
  private getAuthHeader(): string | null {
    if (!this.config.writeKey) {
      return null
    }
    // In browser, use btoa for base64 encoding
    const encoded = typeof btoa !== 'undefined' ? btoa(`${this.config.writeKey}:`) : null
    return encoded ? `Basic ${encoded}` : null
  }

  /**
   * Sends one event to its own endpoint, such as `/v1/track`
   */
  async sendEvent(event: EventPayload): Promise<DeliveryResult> {
    const body = serializeEvent(event)
    if (body === null) {
      this.debugError(`Dropping a ${event.type} event that can't be serialized`)
      return 'rejected'
    }

    return await this.postWithRetry(`/v1/${event.type}`, body, 1)
  }

  /**
   * Sends events to `/v1/batch`, split into bodies under the keepalive budget.
   * The chunks go one at a time, so the batch never has more than one request
   * in flight, and `onSettled` reports each chunk's result as it ends.
   */
  async sendBatch(
    events: EventPayload[],
    onSettled: (events: EventPayload[], result: DeliveryResult) => void
  ): Promise<void> {
    const { chunks, unserializable } = buildBatchChunks(events)
    if (unserializable.length > 0) {
      this.debugError(`Dropping ${describeCount(unserializable.length)} that can't be serialized`)
      onSettled(unserializable, 'rejected')
    }

    for (const chunk of chunks) {
      onSettled(chunk.events, await this.postWithRetry(TRANSPORT_CONSTANTS.BATCH_PATH, chunk.body, chunk.events.length))
    }
  }

  /**
   * Hands events to navigator.sendBeacon as `/v1/batch` requests, for when the
   * page is being hidden or unloaded and a fetch can't be awaited. A beacon
   * can't carry headers, so the write key goes in the body, and it reports no
   * status. Returns the events the browser accepted for sending.
   */
  sendBeacon(events: EventPayload[]): EventPayload[] {
    if (!this.config.useBeacon || !this.isBeaconAvailable()) {
      return []
    }

    const { chunks } = buildBatchChunks(events, this.config.writeKey)
    const endpoint = this.buildEndpoint(TRANSPORT_CONSTANTS.BATCH_PATH)
    const accepted: EventPayload[] = []

    for (const chunk of chunks) {
      if (this.beacon(endpoint, chunk.body)) {
        accepted.push(...chunk.events)
      } else {
        this.debugError(`The browser refused a beacon of ${describeCount(chunk.events.length)}`)
      }
    }

    return accepted
  }

  private beacon(endpoint: string, body: string): boolean {
    try {
      const blob = new Blob([body], { type: TRANSPORT_CONSTANTS.CONTENT_TYPE })
      return navigator.sendBeacon(endpoint, blob)
    } catch {
      // Some browsers throw rather than return false
      return false
    }
  }

  /**
   * POSTs a body, retrying network errors, timeouts, 429s and 5xxs with
   * exponential backoff
   */
  private async postWithRetry(path: string, body: string, eventCount: number): Promise<DeliveryResult> {
    const events = describeCount(eventCount)
    let lastFailure = ''

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      if (attempt > 0) {
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1)
        this.debugLog(`Sending ${events} to ${path} failed (${lastFailure}), retrying in ${delay}ms`)
        await this.sleep(delay)
      }

      const status = await this.post(this.buildEndpoint(path), body)
      if (status !== null && status >= 200 && status < 300) {
        this.debugLog(`Delivered ${events} to ${path}`)
        return 'delivered'
      }
      if (status !== null && !isRetryableStatus(status)) {
        this.debugError(`${path} rejected ${events} with HTTP ${status}`)
        return 'rejected'
      }
      lastFailure = status === null ? 'network error or timeout' : `HTTP ${status}`
    }

    this.debugError(`Could not deliver ${events} to ${path} (${lastFailure}); keeping them for replay`)
    return 'failed'
  }

  /**
   * Sends a body with fetch and returns the response status, or null when no
   * response arrived: a network error, a timeout, or a keepalive request the
   * browser refused because too many were in flight
   */
  private async post(endpoint: string, body: string): Promise<number | null> {
    if (typeof fetch === 'undefined') {
      return null
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      // Build headers with optional Authorization
      const headers: Record<string, string> = {
        'Content-Type': TRANSPORT_CONSTANTS.CONTENT_TYPE,
      }
      const authHeader = this.getAuthHeader()
      if (authHeader) {
        headers['Authorization'] = authHeader
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
        // Lets the request finish if the page unloads; browsers refuse keepalive bodies over 64 KB
        keepalive: byteLength(body) <= KEEPALIVE_BYTE_LIMIT,
        credentials: 'omit', // Don't send credentials for analytics requests
        signal: controller.signal,
      })
      return response.status
    } catch {
      return null
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Check if sendBeacon is available
   */
  private isBeaconAvailable(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
  }

  private buildEndpoint(path: string): string {
    return `${this.config.host}${path}`
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Debug logging utility. Never pass event payloads: they can hold personal data.
   */
  private debugLog(message: string): void {
    if (this.config.debug) {
      console.log(`${TRANSPORT_CONSTANTS.LOG_PREFIX} ${message}`)
    }
  }

  /**
   * Debug error logging utility. Never pass event payloads: they can hold personal data.
   */
  private debugError(message: string): void {
    if (this.config.debug) {
      console.error(`${TRANSPORT_CONSTANTS.LOG_PREFIX} ${message}`)
    }
  }
}
