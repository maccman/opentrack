import { IdentifierType } from 'customerio-node';
import type {
  IdentifyPayload,
  TrackPayload,
  PagePayload,
  GroupPayload,
  AliasPayload,
} from '@app/spec';

export class CustomerioTransformer {
  /**
   * Transform identify payload to Customer.io format
   */
  static transformIdentify(payload: IdentifyPayload): {
    id: string;
    traits: Record<string, any>;
  } {
    const { userId, traits = {} } = payload;

    if (!userId) {
      throw new Error('User ID is required for identify calls');
    }

    // Ensure email is present if available in traits
    const transformedTraits = { ...traits };

    // Convert timestamp if present
    if (payload.timestamp) {
      transformedTraits.created_at = this.convertTimestamp(payload.timestamp);
    }

    return {
      id: userId,
      traits: transformedTraits,
    };
  }

  /**
   * Transform track payload to Customer.io format
   */
  static transformTrack(payload: TrackPayload): {
    id?: string;
    event: string;
    properties: Record<string, any>;
  } {
    const { userId, event, properties = {} } = payload;

    if (!event) {
      throw new Error('Event name is required for track calls');
    }

    const transformedProperties = { ...properties };

    // Add timestamp if present
    if (payload.timestamp) {
      transformedProperties.timestamp = this.convertTimestamp(payload.timestamp);
    }

    const result: {
      id?: string;
      event: string;
      properties: Record<string, any>;
    } = {
      event,
      properties: transformedProperties,
    };

    // Only add id if userId is present (for non-anonymous tracking)
    if (userId) {
      result.id = userId;
    }

    return result;
  }

  /**
   * Transform page payload to Customer.io format
   */
  static transformPage(payload: PagePayload): {
    id?: string;
    event: string;
    properties: Record<string, any>;
  } {
    const { userId, name, properties = {} } = payload;

    // Create a page title from name
    const pageTitle = name || 'Page Viewed';

    const transformedProperties = {
      ...properties,
      page_title: pageTitle,
    };

    // Add page-specific properties
    if (name) transformedProperties.page_name = name;

    // Add timestamp if present
    if (payload.timestamp) {
      transformedProperties.timestamp = this.convertTimestamp(payload.timestamp);
    }

    const result = {
      event: 'page_viewed',
      properties: transformedProperties,
    };

    // Only add id if userId is present
    if (userId) {
      (result as any).id = userId;
    }

    return result;
  }

  /**
   * Transform group payload to Customer.io format
   */
  static transformGroup(payload: GroupPayload): {
    id: string;
    groupId: string;
    traits: Record<string, any>;
  } {
    const { userId, groupId, traits = {} } = payload;

    if (!userId) {
      throw new Error('User ID is required for group calls');
    }

    if (!groupId) {
      throw new Error('Group ID is required for group calls');
    }

    const transformedTraits = { ...traits };

    // Add timestamp if present
    if (payload.timestamp) {
      transformedTraits.created_at = this.convertTimestamp(payload.timestamp);
    }

    return {
      id: userId,
      groupId,
      traits: transformedTraits,
    };
  }

  /**
   * Transform alias payload to Customer.io format
   */
  static transformAlias(payload: AliasPayload): {
    primaryType: IdentifierType;
    primaryId: string;
    secondaryType: IdentifierType;
    secondaryId: string;
  } {
    const { userId, previousId } = payload;

    if (!userId) {
      throw new Error('User ID is required for alias calls');
    }

    if (!previousId) {
      throw new Error('Previous ID is required for alias calls');
    }

    return {
      primaryType: IdentifierType.Id,
      primaryId: userId,
      secondaryType: IdentifierType.Id,
      secondaryId: previousId,
    };
  }

  /**
   * Convert timestamp to Unix timestamp (seconds)
   */
  private static convertTimestamp(timestamp: string | number | Date): number {
    if (typeof timestamp === 'number') {
      // If it's already a number, assume it's milliseconds and convert to seconds
      return timestamp > 10000000000 ? Math.floor(timestamp / 1000) : timestamp;
    }

    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      return Math.floor(date.getTime() / 1000);
    }

    if (timestamp instanceof Date) {
      return Math.floor(timestamp.getTime() / 1000);
    }

    throw new Error('Invalid timestamp format');
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sanitize properties to ensure they're JSON-serializable
   */
  static sanitizeProperties(properties: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (value === undefined) {
        continue; // Skip undefined values
      }

      if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => this.sanitizeValue(item));
      } else if (typeof value === 'object' && value.constructor === Object) {
        sanitized[key] = this.sanitizeProperties(value);
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else {
        // Convert other types to string
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  private static sanitizeValue(value: any): any {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'object' && value.constructor === Object) {
      return this.sanitizeProperties(value);
    }

    return String(value);
  }
}