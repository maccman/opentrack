// HTTP Transport Utilities

import type { EventPayload } from '../types'

export interface TransportConfig {
  host: string
  debug: boolean
  useBeacon: boolean
  timeout?: number
  retries?: number
  retryDelay?: number
}

export enum TransportError {
  SERVER_UNAVAILABLE = 'SERVER_UNAVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  BEACON_FAILED = 'BEACON_FAILED',
}

const TRANSPORT_CONSTANTS = {
  CONTENT_TYPE: 'application/json',
  DEFAULT_TIMEOUT: 5000,
  DEFAULT_RETRIES: 2,
  DEFAULT_RETRY_DELAY: 1000,
  LOG_PREFIX: '[Analytics]',
} as const

export class AnalyticsTransport {
  private config: Required<TransportConfig>

  constructor(config: TransportConfig) {
    this.config = {
      timeout: TRANSPORT_CONSTANTS.DEFAULT_TIMEOUT,
      retries: TRANSPORT_CONSTANTS.DEFAULT_RETRIES,
      retryDelay: TRANSPORT_CONSTANTS.DEFAULT_RETRY_DELAY,
      ...config,
    }
  }

  /**
   * Sends a single event to the analytics endpoint
   * Safely handles server environments where browser APIs are not available
   */
  async sendEvent(event: EventPayload): Promise<void> {
    // Skip sending events in server environments
    if (typeof window === 'undefined') {
      this.debugLog('Skipping event send in server environment:', event)
      return
    }

    const endpoint = this.buildEndpoint(event.type)
    const data = JSON.stringify(event)

    this.debugLog('Sending event:', { endpoint, data: event })

    try {
      await this.sendWithRetry(endpoint, data)
    } catch (error) {
      this.debugError('Failed to send event after retries:', error)
      // Silently fail in production to avoid breaking user experience
    }
  }

  /**
   * Sends multiple events with improved batching
   */
  async sendEvents(events: EventPayload[]): Promise<void> {
    // Process events in parallel for better performance
    const promises = events.map((event) => this.sendEvent(event))
    await Promise.allSettled(promises)
  }

  /**
   * Send with retry logic and exponential backoff
   */
  private async sendWithRetry(endpoint: string, data: string): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        await this.attemptSend(endpoint, data)
        return // Success
      } catch (error) {
        lastError = error as Error

        if (attempt < this.config.retries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt) // Exponential backoff
          this.debugLog(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error)
          await this.sleep(delay)
        }
      }
    }

    throw lastError || new Error('Failed to send after retries')
  }

  /**
   * Attempt to send using beacon or fetch
   */
  private async attemptSend(endpoint: string, data: string): Promise<void> {
    // Try sendBeacon first if enabled and available
    if (this.config.useBeacon && this.isBeaconAvailable()) {
      const success = this.sendViaBeacon(endpoint, data)
      if (success) {
        return
      }

      this.debugLog('sendBeacon failed, falling back to fetch')
    }

    // Fallback to fetch
    await this.sendViaFetch(endpoint, data)
  }

  /**
   * Send via navigator.sendBeacon
   */
  private sendViaBeacon(endpoint: string, data: string): boolean {
    if (!this.isBeaconAvailable()) {
      throw new Error(TransportError.BEACON_FAILED)
    }

    const blob = new Blob([data], { type: TRANSPORT_CONSTANTS.CONTENT_TYPE })
    return navigator.sendBeacon(endpoint, blob)
  }

  /**
   * Send via fetch with timeout and proper error handling
   */
  private async sendViaFetch(endpoint: string, data: string): Promise<void> {
    if (typeof fetch === 'undefined') {
      throw new TypeError(TransportError.SERVER_UNAVAILABLE)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': TRANSPORT_CONSTANTS.CONTENT_TYPE,
        },
        body: data,
        keepalive: true,
        credentials: 'omit', // Don't send credentials for analytics requests
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(TransportError.TIMEOUT)
        }
        if (error.message.includes('fetch')) {
          throw new Error(TransportError.NETWORK_ERROR)
        }
      }
      throw error
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

  /**
   * Build endpoint URL for event type
   */
  private buildEndpoint(eventType: string): string {
    return `${this.config.host}/v1/${eventType}`
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Debug logging utility
   */
  private debugLog(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`${TRANSPORT_CONSTANTS.LOG_PREFIX} ${message}`, ...args)
    }
  }

  /**
   * Debug error logging utility
   */
  private debugError(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.error(`${TRANSPORT_CONSTANTS.LOG_PREFIX} ${message}`, ...args)
    }
  }
}
