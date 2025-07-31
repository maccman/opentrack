import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'
import { describe, expect, it } from 'vitest'

import { getTableName, getTableNames } from '../table-mapper'

// Helper functions to create test payloads
function createTrackPayload(event: string): TrackPayload {
  return {
    type: 'track',
    messageId: 'test-message-id',
    event,
    timestamp: new Date().toISOString(),
    userId: 'user123',
    anonymousId: 'anon123',
  }
}

function createIdentifyPayload(): IdentifyPayload {
  return {
    type: 'identify',
    messageId: 'test-message-id',
    timestamp: new Date().toISOString(),
    userId: 'user123',
    anonymousId: 'anon123',
    traits: { email: 'test@example.com' },
  }
}

function createPagePayload(): PagePayload {
  return {
    type: 'page',
    messageId: 'test-message-id',
    timestamp: new Date().toISOString(),
    userId: 'user123',
    anonymousId: 'anon123',
    name: 'Home',
  }
}

function createGroupPayload(): GroupPayload {
  return {
    type: 'group',
    messageId: 'test-message-id',
    timestamp: new Date().toISOString(),
    userId: 'user123',
    anonymousId: 'anon123',
    groupId: 'group123',
  }
}

function createAliasPayload(): AliasPayload {
  return {
    type: 'alias',
    messageId: 'test-message-id',
    timestamp: new Date().toISOString(),
    userId: 'user123',
    previousId: 'old-user-id',
  }
}

describe('getTableName', () => {
  describe('track events', () => {
    it('should convert track event names to table names', () => {
      expect(getTableName(createTrackPayload('Product Purchased'))).toBe('product_purchased')
      expect(getTableName(createTrackPayload('Page Viewed'))).toBe('page_viewed')
      expect(getTableName(createTrackPayload('User Signed Up'))).toBe('user_signed_up')
    })

    it('should handle complex event names', () => {
      expect(getTableName(createTrackPayload('Order #12345 Completed!'))).toBe('order_12345_completed')
      expect(getTableName(createTrackPayload('API-Call_Success'))).toBe('api_call_success')
      expect(getTableName(createTrackPayload('Email@Sent'))).toBe('email_sent')
    })

    it('should handle edge cases for track events', () => {
      expect(getTableName(createTrackPayload('A'))).toBe('a')
      expect(getTableName(createTrackPayload('123'))).toBe('123')
      expect(getTableName(createTrackPayload('___'))).toBe('')
    })
  })

  describe('non-track events', () => {
    it('should return plural table names for non-track events', () => {
      expect(getTableName(createIdentifyPayload())).toBe('identifies')
      expect(getTableName(createPagePayload())).toBe('pages')
      expect(getTableName(createGroupPayload())).toBe('groups')
      expect(getTableName(createAliasPayload())).toBe('aliases')
    })
  })
})

describe('getTableNames', () => {
  describe('track events', () => {
    it('should return both tracks table and event-specific table for track events', () => {
      const payload = createTrackPayload('Product Purchased')
      const tableNames = getTableNames(payload)

      expect(tableNames).toHaveLength(2)
      expect(tableNames).toContain('tracks')
      expect(tableNames).toContain('product_purchased')
    })

    it('should return unique table names even for duplicate entries', () => {
      const payload = createTrackPayload('tracks') // event name that matches the tracks table
      const tableNames = getTableNames(payload)

      expect(tableNames).toHaveLength(2)
      expect(tableNames).toContain('tracks')
      expect(tableNames.filter((name) => name === 'tracks')).toHaveLength(2) // Should have 2 'tracks' entries
    })
  })

  describe('non-track events', () => {
    it('should return single table name for identify events', () => {
      const payload = createIdentifyPayload()
      const tableNames = getTableNames(payload)

      expect(tableNames).toHaveLength(1)
      expect(tableNames).toContain('identifies')
    })

    it('should return single table name for page events', () => {
      const payload = createPagePayload()
      const tableNames = getTableNames(payload)

      expect(tableNames).toHaveLength(1)
      expect(tableNames).toContain('pages')
    })

    it('should return single table name for group events', () => {
      const payload = createGroupPayload()
      const tableNames = getTableNames(payload)

      expect(tableNames).toHaveLength(1)
      expect(tableNames).toContain('groups')
    })

    it('should return single table name for alias events', () => {
      const payload = createAliasPayload()
      const tableNames = getTableNames(payload)

      expect(tableNames).toHaveLength(1)
      expect(tableNames).toContain('aliases')
    })
  })

  describe('all event types', () => {
    it('should handle all Segment event types correctly', () => {
      const trackPayload = createTrackPayload('Test Event')
      const identifyPayload = createIdentifyPayload()
      const pagePayload = createPagePayload()
      const groupPayload = createGroupPayload()
      const aliasPayload = createAliasPayload()

      expect(getTableNames(trackPayload)).toEqual(['test_event', 'tracks'])
      expect(getTableNames(identifyPayload)).toEqual(['identifies'])
      expect(getTableNames(pagePayload)).toEqual(['pages'])
      expect(getTableNames(groupPayload)).toEqual(['groups'])
      expect(getTableNames(aliasPayload)).toEqual(['aliases'])
    })
  })
})
