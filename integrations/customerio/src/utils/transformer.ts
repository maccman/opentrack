import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'
import { IdentifierType } from 'customerio-node'

export class CustomerioTransformer {
  /**
   * Transform identify payload to Customer.io format
   */
  static transformIdentify(payload: IdentifyPayload): {
    id: string
    traits: Record<string, unknown>
  } {
    const { userId, traits = {} } = payload

    if (!userId) {
      throw new Error('User ID is required for identify calls')
    }

    // Ensure email is present if available in traits
    const transformedTraits = { ...traits }

    // Convert timestamp if present
    if (payload.timestamp) {
      transformedTraits.created_at = this.convertTimestamp(payload.timestamp)
    }

    return {
      id: userId,
      traits: transformedTraits,
    }
  }

  /**
   * Transform track payload to Customer.io format
   */
  static transformTrack(payload: TrackPayload): {
    id?: string
    event: string
    properties: Record<string, unknown>
  } {
    const { userId, event, properties = {} } = payload

    if (!event) {
      throw new Error('Event name is required for track calls')
    }

    const transformedProperties = { ...properties }

    // Add timestamp if present
    if (payload.timestamp) {
      transformedProperties.timestamp = this.convertTimestamp(payload.timestamp)
    }

    const result: {
      id?: string
      event: string
      properties: Record<string, unknown>
    } = {
      event,
      properties: transformedProperties,
    }

    // Only add id if userId is present (for non-anonymous tracking)
    if (userId) {
      result.id = userId
    }

    return result
  }

  /**
   * Transform page payload to Customer.io format
   */
  static transformPage(payload: PagePayload): {
    id?: string
    event: string
    properties: Record<string, unknown>
  } {
    const { userId, name, properties = {} } = payload

    // Create a page title from name
    const pageTitle = name || 'Page Viewed'

    const transformedProperties: Record<string, unknown> = {
      ...properties,
      page_title: pageTitle,
    }

    // Add page-specific properties
    if (name) {
      transformedProperties.page_name = name
    }

    // Add timestamp if present
    if (payload.timestamp) {
      transformedProperties.timestamp = this.convertTimestamp(payload.timestamp)
    }

    const result = {
      event: 'page_viewed',
      properties: transformedProperties,
    }

    // Only add id if userId is present
    if (userId) {
      ;(result as { id?: string }).id = userId
    }

    return result
  }

  /**
   * Transform group payload to Customer.io format
   */
  static transformGroup(payload: GroupPayload): {
    id: string
    groupId: string
    traits: Record<string, unknown>
  } {
    const { userId, groupId, traits = {} } = payload

    if (!userId) {
      throw new Error('User ID is required for group calls')
    }

    if (!groupId) {
      throw new Error('Group ID is required for group calls')
    }

    const transformedTraits = { ...traits }

    // Add timestamp if present
    if (payload.timestamp) {
      transformedTraits.created_at = this.convertTimestamp(payload.timestamp)
    }

    return {
      id: userId,
      groupId,
      traits: transformedTraits,
    }
  }

  /**
   * Transform alias payload to Customer.io format
   */
  static transformAlias(payload: AliasPayload): {
    primaryType: IdentifierType
    primaryId: string
    secondaryType: IdentifierType
    secondaryId: string
  } {
    const { userId, previousId } = payload

    if (!userId) {
      throw new Error('User ID is required for alias calls')
    }

    if (!previousId) {
      throw new Error('Previous ID is required for alias calls')
    }

    return {
      primaryType: IdentifierType.Id,
      primaryId: userId,
      secondaryType: IdentifierType.Id,
      secondaryId: previousId,
    }
  }

  /**
   * Convert timestamp to Unix timestamp (seconds)
   */
  private static convertTimestamp(timestamp: string | number | Date): number {
    if (typeof timestamp === 'number') {
      // If it's already a number, assume it's milliseconds and convert to seconds
      return timestamp > 10000000000 ? Math.floor(timestamp / 1000) : timestamp
    }

    if (typeof timestamp === 'string') {
      const date = new Date(timestamp)
      return Math.floor(date.getTime() / 1000)
    }

    if (timestamp instanceof Date) {
      return Math.floor(timestamp.getTime() / 1000)
    }

    throw new Error('Invalid timestamp format')
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Sanitize properties to ensure they're JSON-serializable
   */
  static sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(properties)) {
      if (value === undefined) {
        continue // Skip undefined values
      }

      if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) => this.sanitizeValue(item))
      } else if (typeof value === 'object' && value.constructor === Object) {
        sanitized[key] = this.sanitizeProperties(value as Record<string, unknown>)
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString()
      } else {
        // Convert other types to string, but skip complex objects
        if (typeof value === 'object' && value !== null) {
          sanitized[key] = JSON.stringify(value)
        } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          sanitized[key] = String(value)
        } else {
          // Fallback for any other primitive types
          sanitized[key] = value === null || value === undefined ? '' : 'null'
        }
      }
    }

    return sanitized
  }

  private static sanitizeValue(value: unknown): unknown {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value
    }

    if (value instanceof Date) {
      return value.toISOString()
    }

    if (typeof value === 'object' && value.constructor === Object) {
      return this.sanitizeProperties(value as Record<string, unknown>)
    }

    // Handle remaining primitive types
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value)
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    // Fallback for any remaining values
    return value === null || value === undefined ? '' : 'null'
  }
}
