import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'

type Payload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload

/**
 * Standard webhook payload structure
 */
export interface WebhookPayload {
  /**
   * The type of event
   */
  type: string

  /**
   * Unique identifier for this message
   */
  messageId: string

  /**
   * Timestamp when the event occurred
   */
  timestamp: string

  /**
   * User identifier
   */
  userId?: string

  /**
   * Anonymous user identifier
   */
  anonymousId?: string

  /**
   * Original event payload
   */
  originalPayload: Payload

  /**
   * Event-specific data
   */
  data: Record<string, unknown>

  /**
   * Context information
   */
  context?: Record<string, unknown>

  /**
   * Integration metadata
   */
  integrations?: {
    webhook: {
      sentAt: string
      version: string
    }
  }
}

export class WebhookTransformer {
  /**
   * Transforms any Segment payload into a webhook payload
   */
  static transform(payload: Payload): WebhookPayload {
    const basePayload: WebhookPayload = {
      type: payload.type,
      messageId: payload.messageId || '',
      timestamp: payload.timestamp || new Date().toISOString(),
      originalPayload: payload,
      data: {},
      integrations: {
        webhook: {
          sentAt: new Date().toISOString(),
          version: '1.0.0',
        },
      },
    }

    // Add user identifiers
    if (payload.userId) {
      basePayload.userId = payload.userId
    }

    if ('anonymousId' in payload && payload.anonymousId) {
      basePayload.anonymousId = payload.anonymousId
    }

    // Add context if present
    if ('context' in payload && payload.context) {
      basePayload.context = payload.context
    }

    // Transform based on event type
    switch (payload.type) {
      case 'track':
        basePayload.data = this.transformTrack(payload)
        break
      case 'identify':
        basePayload.data = this.transformIdentify(payload)
        break
      case 'page':
        basePayload.data = this.transformPage(payload)
        break
      case 'group':
        basePayload.data = this.transformGroup(payload)
        break
      case 'alias':
        basePayload.data = this.transformAlias(payload)
        break
    }

    return basePayload
  }

  /**
   * Transforms track event data
   */
  private static transformTrack(payload: TrackPayload): Record<string, unknown> {
    return {
      event: payload.event,
      properties: payload.properties || {},
    }
  }

  /**
   * Transforms identify event data
   */
  private static transformIdentify(payload: IdentifyPayload): Record<string, unknown> {
    return {
      traits: payload.traits || {},
    }
  }

  /**
   * Transforms page event data
   */
  private static transformPage(payload: PagePayload): Record<string, unknown> {
    return {
      name: payload.name,
      properties: payload.properties || {},
    }
  }

  /**
   * Transforms group event data
   */
  private static transformGroup(payload: GroupPayload): Record<string, unknown> {
    return {
      groupId: payload.groupId,
      traits: payload.traits || {},
    }
  }

  /**
   * Transforms alias event data
   */
  private static transformAlias(payload: AliasPayload): Record<string, unknown> {
    return {
      previousId: payload.previousId,
      userId: payload.userId,
    }
  }

  /**
   * Creates a minimal payload without the original payload included
   */
  static transformMinimal(payload: Payload): Omit<WebhookPayload, 'originalPayload'> {
    const fullPayload = this.transform(payload)
    const { originalPayload: _originalPayload, ...minimalPayload } = fullPayload
    return minimalPayload
  }

  /**
   * Validates that the payload can be safely serialized to JSON
   */
  static validateSerializable(payload: WebhookPayload): boolean {
    try {
      JSON.stringify(payload)
      return true
    } catch {
      return false
    }
  }

  /**
   * Sanitizes payload by removing circular references and non-serializable values
   */
  static sanitize(payload: WebhookPayload): WebhookPayload {
    try {
      return structuredClone(payload)
    } catch {
      // If serialization fails, return a safe fallback
      return {
        type: payload.type,
        messageId: payload.messageId,
        timestamp: payload.timestamp,
        userId: payload.userId,
        anonymousId: payload.anonymousId,
        data: {},
        originalPayload: payload.originalPayload,
        integrations: payload.integrations,
      }
    }
  }
}
