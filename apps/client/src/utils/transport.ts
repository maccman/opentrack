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
   */
  async sendEvent(event: EventPayload): Promise<void> {
    const endpoint = `${this.config.host}/v1/${event.type}`
    const data = JSON.stringify(event)

    if (this.config.debug) {
      console.log('[Analytics] Sending event:', { endpoint, data: event })
    }

    try {
      // Use sendBeacon for reliability, fallback to fetch
      if (navigator.sendBeacon) {
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
   */
  private async fallbackFetch(endpoint: string, data: string): Promise<void> {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data,
        keepalive: true,
      })
    } catch (error) {
      if (this.config.debug) {
        console.error('[Analytics] Fetch fallback failed:', error)
      }
    }
  }
}
