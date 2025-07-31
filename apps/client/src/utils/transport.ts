// HTTP Transport Utilities

import type { EventPayload } from '../types'

export interface TransportConfig {
  host: string
  debug: boolean
}

export class AnalyticsTransport {
  private config: TransportConfig

  constructor(config: TransportConfig) {
    this.config = config
  }

  /**
   * Sends a single event to the analytics endpoint
   * Safely handles server environments where browser APIs are not available
   */
  async sendEvent(event: EventPayload): Promise<void> {
    // Skip sending events in server environments
    if (typeof window === 'undefined') {
      if (this.config.debug) {
        console.log('[Analytics] Skipping event send in server environment:', event)
      }
      return
    }

    const endpoint = `${this.config.host}/v1/${event.type}`
    const data = JSON.stringify(event)

    if (this.config.debug) {
      console.log('[Analytics] Sending event:', { endpoint, data: event })
    }

    try {
      // Use sendBeacon for reliability, fallback to fetch
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([data], { type: 'application/json' })
        const success = navigator.sendBeacon(endpoint, blob)

        if (!success) {
          if (this.config.debug) {
            console.warn('[Analytics] sendBeacon failed, trying fetch fallback')
          }
          await this.fallbackFetch(endpoint, data)
        }
      } else {
        await this.fallbackFetch(endpoint, data)
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[Analytics] Failed to send event:', error)
      }
    }
  }

  /**
   * Sends multiple events
   */
  async sendEvents(events: EventPayload[]): Promise<void> {
    for (const event of events) {
      await this.sendEvent(event)
    }
  }

  /**
   * Fallback fetch implementation
   * Safely handles server environments where fetch might not be available
   */
  private async fallbackFetch(endpoint: string, data: string): Promise<void> {
    try {
      if (typeof fetch !== 'undefined') {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: data,
          keepalive: true,
        })
      } else if (this.config.debug) {
        console.warn('[Analytics] Fetch not available in this environment')
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[Analytics] Fetch fallback failed:', error)
      }
    }
  }
}
