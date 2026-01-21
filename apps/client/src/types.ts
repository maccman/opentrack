// Analytics Library Types

export interface AnalyticsOptions {
  writeKey?: string
  host?: string
  flushAt?: number
  flushInterval?: number
  debug?: boolean
  storagePrefix?: string
  userIdKey?: string
  anonymousIdKey?: string
  traitsKey?: string
  useBeacon?: boolean // Whether to use navigator.sendBeacon (includes credentials)
  timeout?: number // Request timeout in milliseconds
  retries?: number // Number of retry attempts
  retryDelay?: number // Base delay between retries in milliseconds
}

export interface BaseEventPayload {
  userId?: string
  anonymousId?: string
  timestamp?: string
  context?: Record<string, unknown>
  messageId?: string
}

export interface TrackPayload extends BaseEventPayload {
  type: 'track'
  event: string
  properties?: Record<string, unknown>
}

export interface IdentifyPayload extends BaseEventPayload {
  type: 'identify'
  traits?: Record<string, unknown>
}

export interface PagePayload extends BaseEventPayload {
  type: 'page'
  name?: string
  category?: string
  properties?: Record<string, unknown>
}

export interface GroupPayload extends BaseEventPayload {
  type: 'group'
  groupId: string
  traits?: Record<string, unknown>
}

export interface AliasPayload extends BaseEventPayload {
  type: 'alias'
  userId: string
  previousId?: string
}

export type EventPayload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload

export interface User {
  id(): string | null
  anonymousId(): string
  traits(): Record<string, unknown>
}

export interface ContextInfo extends Record<string, unknown> {
  page: {
    url: string
    title: string
    referrer: string
  }
  userAgent: string
  library: {
    name: string
    version: string
  }
  screen: {
    width: number
    height: number
  }
}
